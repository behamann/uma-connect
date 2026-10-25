-- Core schema for player accounts (specs/002-player-accounts/data-model.md).
create extension if not exists citext with schema extensions;

-- Reference data: written only by scripts/backend/sync-puzzles.ts.
create table public.trainees (
  id text primary key,
  character_id text not null
);

create table public.puzzles (
  puzzle_number int primary key check (puzzle_number >= 1),
  date date not null unique,
  rows text[] not null check (cardinality(rows) = 3),
  cols text[] not null check (cardinality(cols) = 3),
  data_version text not null
);

create table public.puzzle_answers (
  puzzle_number int not null references public.puzzles on delete cascade,
  cell smallint not null check (cell between 0 and 8),
  trainee_id text not null references public.trainees,
  primary key (puzzle_number, cell, trainee_id)
);

-- Player data.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name extensions.citext not null unique,
  leaderboard_opt_out boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reserved_names (
  term extensions.citext primary key
);

create table public.daily_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_number int not null references public.puzzles,
  guesses jsonb not null default '[]'::jsonb
    check (jsonb_typeof(guesses) = 'array' and jsonb_array_length(guesses) <= 9),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'out_of_guesses', 'gave_up')),
  score smallint not null default 0 check (score between 0 and 9),
  imported boolean not null default false,
  is_guest boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (user_id, puzzle_number)
);

create index daily_sessions_puzzle_status_idx on public.daily_sessions (puzzle_number, status);

create table public.legacy_history (
  user_id uuid not null references auth.users (id) on delete cascade,
  puzzle_number int not null references public.puzzles,
  score smallint not null check (score between 0 and 9),
  status text not null check (status in ('completed', 'out_of_guesses', 'gave_up')),
  primary key (user_id, puzzle_number)
);

-- Aggregates without user identity.
create table public.puzzle_stats (
  puzzle_number int primary key references public.puzzles,
  finished_games int not null default 0
);

create table public.answer_counts (
  puzzle_number int not null references public.puzzles,
  cell smallint not null check (cell between 0 and 8),
  trainee_id text not null references public.trainees,
  picks int not null default 0,
  primary key (puzzle_number, cell, trainee_id)
);
