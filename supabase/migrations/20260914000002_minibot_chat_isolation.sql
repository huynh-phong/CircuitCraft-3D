-- ==========================================================
-- Migration: 20260914000002_minibot_chat_isolation.sql
-- Description: Isolated Minibot AI chat history per user account with strict Row Level Security (RLS)
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.minibot_chat_messages (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  proposal JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.minibot_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_minibot_chat_user_created ON public.minibot_chat_messages(user_id, created_at ASC);

-- 1. Users can only select their own chat messages
DROP POLICY IF EXISTS "Users can only view their own chat messages" ON public.minibot_chat_messages;
CREATE POLICY "Users can only view their own chat messages"
  ON public.minibot_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Users can only insert messages belonging to themselves
DROP POLICY IF EXISTS "Users can insert their own chat messages" ON public.minibot_chat_messages;
CREATE POLICY "Users can insert their own chat messages"
  ON public.minibot_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 3. Users can only delete their own chat messages
DROP POLICY IF EXISTS "Users can delete their own chat messages" ON public.minibot_chat_messages;
CREATE POLICY "Users can delete their own chat messages"
  ON public.minibot_chat_messages FOR DELETE
  USING (auth.uid() = user_id);
