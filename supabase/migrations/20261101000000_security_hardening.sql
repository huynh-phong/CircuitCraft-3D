-- ==============================================================================
-- Migration: 20261101000000_security_hardening.sql
-- Description: Tighten Row Level Security. NON-DESTRUCTIVE: no table, column or row is
--              dropped or modified; only policies and one guard trigger change.
--
-- Fixes:
--   1. profiles: users could UPDATE their own `role` (self-promotion to 'admin'/'pro').
--   2. profiles: every profile (incl. e-mail) was readable by anyone.
--   3. orders: users could INSERT orders already marked 'paid'.
--   4. subscriptions: users could INSERT/UPDATE their own plan (self-upgrade).
--
-- Server-side writes use the service role key, which bypasses RLS, so backend flows
-- (registration sync, payment settlement, admin moderation) keep working.
--
-- ROLLBACK (restores the previous behaviour, NOT recommended):
--   DROP TRIGGER IF EXISTS trg_profiles_protect_role ON public.profiles;
--   DROP FUNCTION IF EXISTS public.protect_profile_role();
--   DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
--   CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
--   DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
--   CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
--   DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
--   CREATE POLICY "Users can create their own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "Users can insert own subscription" ON public.subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
--   CREATE POLICY "Users can update own subscription" ON public.subscriptions FOR UPDATE
--     USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- ==============================================================================

-- 1. profiles: read only your own row (admin dashboards read through the service role)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. profiles: a self-created profile always starts as a plain 'user'
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id AND role = 'user');

-- 3. profiles: users may edit their own row, but never the `role` column.
--    (A trigger is used instead of a self-referencing policy to avoid RLS recursion.)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'Changing profiles.role is not allowed from the client'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_protect_role ON public.profiles;
CREATE TRIGGER trg_profiles_protect_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 4. orders: clients may only create PENDING orders for themselves.
--    Marking an order paid is a server-side operation (service role).
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;
CREATE POLICY "Users can create their own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- 5. subscriptions: read-only for users; plan changes are written by the server.
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON public.subscriptions;
