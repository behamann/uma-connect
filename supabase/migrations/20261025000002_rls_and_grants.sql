-- Constitution VI: deny by default. Clients reach data only through RPC functions.
alter table public.trainees enable row level security;
alter table public.puzzles enable row level security;
alter table public.puzzle_answers enable row level security;
alter table public.profiles enable row level security;
alter table public.reserved_names enable row level security;
alter table public.daily_sessions enable row level security;
alter table public.legacy_history enable row level security;
alter table public.puzzle_stats enable row level security;
alter table public.answer_counts enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- The secret key (service_role) is used only by sync-puzzles and local tests.
grant all on all tables in schema public to service_role;
alter default privileges for role postgres in schema public grant all on tables to service_role;

-- Internal helpers live outside the exposed API schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
