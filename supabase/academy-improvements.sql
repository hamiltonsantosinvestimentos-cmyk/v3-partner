-- academy_quiz_results
create table if not exists academy_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id text not null,
  score int not null default 0,
  passed boolean not null default false,
  answers jsonb,
  attempts int not null default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists academy_quiz_results_user_cat on academy_quiz_results(user_id, category_id);
alter table academy_quiz_results enable row level security;
create policy "users see own quiz results" on academy_quiz_results for select using (auth.uid() = user_id);
create policy "users insert own quiz results" on academy_quiz_results for insert with check (auth.uid() = user_id);
create policy "users update own quiz results" on academy_quiz_results for update using (auth.uid() = user_id);

-- academy_badges
create table if not exists academy_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null,
  awarded_at timestamptz default now()
);
create unique index if not exists academy_badges_user_badge on academy_badges(user_id, badge_id);
alter table academy_badges enable row level security;
create policy "users see own badges" on academy_badges for select using (auth.uid() = user_id);
create policy "service insert badges" on academy_badges for insert with check (true);

-- academy_comments
create table if not exists academy_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_id text not null,
  comment text not null,
  author_name text,
  created_at timestamptz default now()
);
create index if not exists academy_comments_video on academy_comments(video_id);
alter table academy_comments enable row level security;
create policy "authenticated users see comments" on academy_comments for select using (auth.role() = 'authenticated');
create policy "users insert own comments" on academy_comments for insert with check (auth.uid() = user_id);
create policy "users delete own comments" on academy_comments for delete using (auth.uid() = user_id);

-- Add requires column to track prerequisites (stored in app, but we can store overrides here)
-- No DB changes needed for prerequisites — managed in lib/academy-data.ts
