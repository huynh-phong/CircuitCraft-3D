-- Migration: 20260914000001_user_data_isolation_and_courses.sql
-- Description: Absolute user data isolation for Course Enrollments, Lesson Progress, Subscriptions, Orders, and Projects

-- 1. Ensure required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Table: course_enrollments
-- Enforces that courses are global catalog items, while enrollment records are strictly per-user.
CREATE TABLE IF NOT EXISTS public.course_enrollments (
  id TEXT PRIMARY KEY DEFAULT ('enr_' || gen_random_uuid()::text),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_course UNIQUE (user_id, course_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own enrollments"
  ON public.course_enrollments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own enrollments"
  ON public.course_enrollments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own enrollments"
  ON public.course_enrollments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own enrollments"
  ON public.course_enrollments FOR DELETE
  USING (auth.uid() = user_id);

-- 3. Table: lesson_progress
-- Tracks per-user, per-lesson interactive lab progress and completion
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id TEXT PRIMARY KEY DEFAULT ('prog_' || gen_random_uuid()::text),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_lesson UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lesson progress"
  ON public.lesson_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lesson progress"
  ON public.lesson_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lesson progress"
  ON public.lesson_progress FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lesson progress"
  ON public.lesson_progress FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Table: subscriptions
-- Manages user plan tiers, project limits, and AI quota
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id TEXT PRIMARY KEY DEFAULT ('sub_' || gen_random_uuid()::text),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'student', 'creator')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'expired')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  current_period_end TIMESTAMPTZ,
  ai_queries_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_queries_used >= 0),
  ai_queries_limit INTEGER NOT NULL DEFAULT 50 CHECK (ai_queries_limit >= 0),
  projects_limit INTEGER NOT NULL DEFAULT 10 CHECK (projects_limit >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_user_subscription UNIQUE (user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscription"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Audit & Harden RLS for Projects
-- Users can only read their own projects, or public projects.
-- Users can strictly only insert, update, or delete projects with owner_id = auth.uid().
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own projects or public projects" ON public.projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;

CREATE POLICY "Users can read own projects or public projects"
  ON public.projects FOR SELECT
  USING (auth.uid() = owner_id OR is_public = true);

CREATE POLICY "Users can insert own projects"
  ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects"
  ON public.projects FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own projects"
  ON public.projects FOR DELETE
  USING (auth.uid() = owner_id);

-- 6. Audit & Harden RLS for Project Versions
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read versions of accessible projects" ON public.project_versions;
DROP POLICY IF EXISTS "Users can insert versions into own projects" ON public.project_versions;

CREATE POLICY "Users can read versions of accessible projects"
  ON public.project_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND (p.owner_id = auth.uid() OR p.is_public = true)
    )
  );

CREATE POLICY "Users can insert versions into own projects"
  ON public.project_versions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND p.owner_id = auth.uid()
    )
  );

-- 7. Audit & Harden RLS for Orders and Entitlements
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can update own orders" ON public.orders;

CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own entitlements" ON public.entitlements;
DROP POLICY IF EXISTS "Users can insert own entitlements" ON public.entitlements;

CREATE POLICY "Users can read own entitlements"
  ON public.entitlements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own entitlements"
  ON public.entitlements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes for optimal lookup by user_id
CREATE INDEX IF NOT EXISTS idx_course_enrollments_user ON public.course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON public.entitlements(user_id);
