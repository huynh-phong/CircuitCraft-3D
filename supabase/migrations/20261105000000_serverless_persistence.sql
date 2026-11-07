-- ==============================================================================
-- Migration: 20261105000000_serverless_persistence.sql
-- Description: Shared state for running the API on Vercel Functions (many short-lived instances).
--
--   cc_documents    application records (users, projects, orders, courses, ...) as versioned JSON
--   cc_otp_codes    one-time codes (hashed), verified atomically
--   cc_rate_limits  shared request counters
--   storage buckets course-media, course-video (private; served through short-lived signed URLs)
--
-- ADDITIVE ONLY: creates new objects and never touches existing tables or rows.
-- All access goes through the server with the service role key; the anon and authenticated
-- roles have no access (RLS enabled with no policies, EXECUTE revoked).
--
-- ROLLBACK (only after exporting cc_documents; this deletes the migrated application data):
--   DROP FUNCTION IF EXISTS public.cc_put_documents(jsonb), public.cc_documents_since(timestamptz, text, text, integer),
--     public.cc_otp_put(text, text, text, jsonb, timestamptz, integer), public.cc_otp_verify(text, text, text[], integer),
--     public.cc_otp_delete(text), public.cc_rate_limit_hit(text, integer, integer), public.cc_rate_limit_peek(text, integer);
--   DROP TABLE IF EXISTS public.cc_documents, public.cc_otp_codes, public.cc_rate_limits;
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.cc_documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  version BIGINT NOT NULL DEFAULT 1,
  deleted BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS idx_cc_documents_sync ON public.cc_documents (updated_at, collection, id);

CREATE TABLE IF NOT EXISTS public.cc_otp_codes (
  key TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  cooldown_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.cc_rate_limits (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  window_ends_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cc_rate_limits_expiry ON public.cc_rate_limits (window_ends_at);

ALTER TABLE public.cc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cc_rate_limits ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Documents: optimistic concurrency per record.
-- Input rows: [{ collection, id, data, deleted, expected_version }]
-- expected_version NULL means "must not exist yet". A row whose version does not match is not
-- written; it comes back with conflict = true and the current data so the caller can merge.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_put_documents(p_rows JSONB)
RETURNS TABLE (collection TEXT, id TEXT, version BIGINT, conflict BOOLEAN, data JSONB, deleted BOOLEAN)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  r JSONB;
  v_collection TEXT;
  v_id TEXT;
  v_expected BIGINT;
  v_current public.cc_documents%ROWTYPE;
BEGIN
  FOR r IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    v_collection := r->>'collection';
    v_id := r->>'id';
    v_expected := NULLIF(r->>'expected_version', '')::BIGINT;

    SELECT * INTO v_current FROM public.cc_documents d
      WHERE d.collection = v_collection AND d.id = v_id FOR UPDATE;

    IF NOT FOUND THEN
      IF v_expected IS NULL THEN
        BEGIN
          INSERT INTO public.cc_documents (collection, id, data, deleted)
            VALUES (v_collection, v_id, r->'data', COALESCE((r->>'deleted')::BOOLEAN, false))
            RETURNING * INTO v_current;
          collection := v_collection; id := v_id; version := v_current.version;
          conflict := false; data := NULL; deleted := v_current.deleted;
          RETURN NEXT;
          CONTINUE;
        EXCEPTION WHEN unique_violation THEN
          SELECT * INTO v_current FROM public.cc_documents d
            WHERE d.collection = v_collection AND d.id = v_id;
        END;
      ELSE
        -- Expected to exist but is gone: report an empty, deleted record
        collection := v_collection; id := v_id; version := 0;
        conflict := true; data := '{}'::jsonb; deleted := true;
        RETURN NEXT;
        CONTINUE;
      END IF;
    ELSIF v_expected IS NOT NULL AND v_current.version = v_expected THEN
      UPDATE public.cc_documents d
        SET data = r->'data',
            deleted = COALESCE((r->>'deleted')::BOOLEAN, false),
            version = d.version + 1,
            updated_at = clock_timestamp()
        WHERE d.collection = v_collection AND d.id = v_id
        RETURNING * INTO v_current;
      collection := v_collection; id := v_id; version := v_current.version;
      conflict := false; data := NULL; deleted := v_current.deleted;
      RETURN NEXT;
      CONTINUE;
    END IF;

    collection := v_collection; id := v_id; version := v_current.version;
    conflict := true; data := v_current.data; deleted := v_current.deleted;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Keyset pagination over (updated_at, collection, id). The caller re-reads a small overlap window,
-- so a transaction committing slightly out of timestamp order is not missed.
CREATE OR REPLACE FUNCTION public.cc_documents_since(
  p_since TIMESTAMPTZ,
  p_after_collection TEXT,
  p_after_id TEXT,
  p_limit INTEGER
)
RETURNS TABLE (collection TEXT, id TEXT, data JSONB, version BIGINT, deleted BOOLEAN, updated_at TIMESTAMPTZ, server_now TIMESTAMPTZ)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT d.collection, d.id, d.data, d.version, d.deleted, d.updated_at, clock_timestamp()
  FROM public.cc_documents d
  WHERE p_since IS NULL
     OR (d.updated_at, d.collection, d.id) > (p_since, COALESCE(p_after_collection, ''), COALESCE(p_after_id, ''))
  ORDER BY d.updated_at, d.collection, d.id
  LIMIT LEAST(GREATEST(p_limit, 1), 500);
$$;

-- ------------------------------------------------------------------------------
-- One-time codes
-- ------------------------------------------------------------------------------
-- Stores a new code unless the previous one is still in its resend cooldown.
CREATE OR REPLACE FUNCTION public.cc_otp_put(
  p_key TEXT,
  p_code_hash TEXT,
  p_purpose TEXT,
  p_payload JSONB,
  p_expires_at TIMESTAMPTZ,
  p_cooldown_seconds INTEGER
)
RETURNS TABLE (stored BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_cooldown TIMESTAMPTZ;
BEGIN
  -- Opportunistic cleanup of expired codes
  DELETE FROM public.cc_otp_codes c WHERE c.expires_at < v_now - INTERVAL '1 hour';

  INSERT INTO public.cc_otp_codes AS c (key, code_hash, purpose, payload, attempts, expires_at, cooldown_until)
    VALUES (p_key, p_code_hash, p_purpose, COALESCE(p_payload, '{}'::jsonb), 0, p_expires_at,
            v_now + make_interval(secs => p_cooldown_seconds))
    ON CONFLICT (key) DO UPDATE
      SET code_hash = EXCLUDED.code_hash, purpose = EXCLUDED.purpose, payload = EXCLUDED.payload, attempts = 0,
          expires_at = EXCLUDED.expires_at, cooldown_until = EXCLUDED.cooldown_until, created_at = v_now
      WHERE c.cooldown_until <= v_now
    RETURNING c.cooldown_until INTO v_cooldown;

  IF FOUND THEN
    stored := true; retry_after_seconds := 0;
  ELSE
    SELECT c.cooldown_until INTO v_cooldown FROM public.cc_otp_codes c WHERE c.key = p_key;
    stored := false;
    retry_after_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_cooldown - v_now)))::INTEGER);
  END IF;
  RETURN NEXT;
END;
$$;

-- Atomic check under a row lock: concurrent attempts cannot exceed the limit or reuse a code.
-- status: ok | invalid | locked | expired | missing | wrong_purpose
CREATE OR REPLACE FUNCTION public.cc_otp_verify(
  p_key TEXT,
  p_code_hash TEXT,
  p_purposes TEXT[],
  p_max_attempts INTEGER
)
RETURNS TABLE (status TEXT, attempts_left INTEGER, payload JSONB)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_row public.cc_otp_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.cc_otp_codes c WHERE c.key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    status := 'missing'; attempts_left := 0; payload := NULL;
    RETURN NEXT; RETURN;
  END IF;
  IF clock_timestamp() > v_row.expires_at THEN
    DELETE FROM public.cc_otp_codes c WHERE c.key = p_key;
    status := 'expired'; attempts_left := 0; payload := NULL;
    RETURN NEXT; RETURN;
  END IF;
  IF NOT (v_row.purpose = ANY (p_purposes)) THEN
    status := 'wrong_purpose'; attempts_left := 0; payload := NULL;
    RETURN NEXT; RETURN;
  END IF;

  IF v_row.attempts + 1 > p_max_attempts THEN
    DELETE FROM public.cc_otp_codes c WHERE c.key = p_key;
    status := 'locked'; attempts_left := 0; payload := NULL;
    RETURN NEXT; RETURN;
  END IF;

  IF v_row.code_hash = p_code_hash THEN
    DELETE FROM public.cc_otp_codes c WHERE c.key = p_key;
    status := 'ok'; attempts_left := 0; payload := v_row.payload;
    RETURN NEXT; RETURN;
  END IF;

  UPDATE public.cc_otp_codes c SET attempts = c.attempts + 1 WHERE c.key = p_key;
  status := 'invalid'; attempts_left := p_max_attempts - (v_row.attempts + 1); payload := NULL;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_otp_delete(p_key TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  DELETE FROM public.cc_otp_codes c WHERE c.key = p_key;
$$;

-- ------------------------------------------------------------------------------
-- Rate limits (fixed window per key)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_rate_limit_hit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS TABLE (limited BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_hits INTEGER;
  v_ends TIMESTAMPTZ;
BEGIN
  IF random() < 0.01 THEN
    DELETE FROM public.cc_rate_limits r WHERE r.window_ends_at < v_now;
  END IF;

  INSERT INTO public.cc_rate_limits AS r (key, hits, window_ends_at)
    VALUES (p_key, 1, v_now + make_interval(secs => p_window_seconds))
    ON CONFLICT (key) DO UPDATE
      SET hits = CASE WHEN r.window_ends_at <= v_now THEN 1
                      ELSE LEAST(r.hits + 1, p_limit + 1) END,
          window_ends_at = CASE WHEN r.window_ends_at <= v_now THEN EXCLUDED.window_ends_at
                                ELSE r.window_ends_at END
    RETURNING r.hits, r.window_ends_at INTO v_hits, v_ends;

  limited := v_hits > p_limit;
  retry_after_seconds := CASE WHEN v_hits > p_limit
    THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_ends - v_now)))::INTEGER) ELSE 0 END;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.cc_rate_limit_peek(p_key TEXT, p_limit INTEGER)
RETURNS TABLE (limited BOOLEAN, retry_after_seconds INTEGER)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_hits INTEGER;
  v_ends TIMESTAMPTZ;
BEGIN
  SELECT r.hits, r.window_ends_at INTO v_hits, v_ends FROM public.cc_rate_limits r WHERE r.key = p_key;
  IF NOT FOUND OR v_ends <= v_now OR v_hits < p_limit THEN
    limited := false; retry_after_seconds := 0;
  ELSE
    limited := true;
    retry_after_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_ends - v_now)))::INTEGER);
  END IF;
  RETURN NEXT;
END;
$$;

-- ------------------------------------------------------------------------------
-- Only the service role (the API server) may use these objects
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.cc_put_documents(jsonb)',
    'public.cc_documents_since(timestamptz, text, text, integer)',
    'public.cc_otp_put(text, text, text, jsonb, timestamptz, integer)',
    'public.cc_otp_verify(text, text, text[], integer)',
    'public.cc_otp_delete(text)',
    'public.cc_rate_limit_hit(text, integer, integer)',
    'public.cc_rate_limit_peek(text, integer)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', fn);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.cc_documents, public.cc_otp_codes, public.cc_rate_limits FROM anon, authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.cc_documents, public.cc_otp_codes, public.cc_rate_limits TO service_role;
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- Private bucket for slide images (only exists on a real Supabase project)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-media', 'course-media', false, 1572864,
            ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'])
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-video', 'course-video', false, 52428800, ARRAY['video/mp4', 'video/webm'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;
