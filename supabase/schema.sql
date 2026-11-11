-- Stride Lab database schema. Run once in the Supabase dashboard: SQL Editor > New query > Run.
-- Sign-in is handled by Clerk. Supabase verifies Clerk session tokens through its Clerk
-- third-party auth integration, and `auth.jwt() ->> 'sub'` is the Clerk user ID (e.g. user_2abc...).
-- Stores one row per analysed video. Videos and evidence images are never stored.

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt() ->> 'sub'),
  created_at timestamptz not null default now(),
  video_name text not null,
  analysed_seconds numeric,
  overall_score integer,
  category text,
  cadence_spm numeric,
  shank_angle_deg numeric,
  knee_flexion_deg numeric,
  trunk_lean_deg numeric,
  stride_cv_pct numeric,
  symmetry_index_pct numeric,
  landing_offset_torso_pct numeric,
  vertical_oscillation_torso_pct numeric,
  -- Component scores, observations and recording warnings for the history view.
  details jsonb not null default '{}'::jsonb
);

create index if not exists analyses_user_created_idx on public.analyses (user_id, created_at desc);

-- Row-level security: each signed-in user can only see, add and delete their own analyses.
alter table public.analyses enable row level security;

drop policy if exists "Users read own analyses" on public.analyses;
create policy "Users read own analyses" on public.analyses
  for select to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users insert own analyses" on public.analyses;
create policy "Users insert own analyses" on public.analyses
  for insert to authenticated with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "Users delete own analyses" on public.analyses;
create policy "Users delete own analyses" on public.analyses
  for delete to authenticated using ((select auth.jwt() ->> 'sub') = user_id);

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
