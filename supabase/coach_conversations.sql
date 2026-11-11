-- AI coach chat history. Run once in the Supabase dashboard: SQL Editor > New query > Run.
-- (Also included at the end of schema.sql for new projects.)
-- Each conversation keeps the measurements and coaching it was based on, so it can be reopened and
-- continued later without the video. No images or video are stored.

create table if not exists public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  analysis_id uuid references public.analyses (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  -- Overall score, category and metrics sent to the coach (no images).
  context jsonb not null,
  -- The structured coaching summary.
  advice jsonb,
  -- Follow-up chat: [{ "role": "user" | "coach", "text": "..." }]
  messages jsonb not null default '[]'::jsonb
);

create index if not exists coach_conversations_user_updated_idx on public.coach_conversations (user_id, updated_at desc);

alter table public.coach_conversations enable row level security;

drop policy if exists "Users read own conversations" on public.coach_conversations;
create policy "Users read own conversations" on public.coach_conversations
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users insert own conversations" on public.coach_conversations;
create policy "Users insert own conversations" on public.coach_conversations
  for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users update own conversations" on public.coach_conversations;
create policy "Users update own conversations" on public.coach_conversations
  for update to authenticated using ((select auth.jwt() ->> 'sub') = user_id) with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users delete own conversations" on public.coach_conversations;
create policy "Users delete own conversations" on public.coach_conversations
  for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);
