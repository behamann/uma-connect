-- Test helpers (local only). Committed so later test files can use them; runs first by name.
begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_email text, p_anonymous boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, email_confirmed_at, is_anonymous,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    case when p_anonymous then null else p_email end,
    case when p_anonymous then null else now() end,
    p_anonymous,
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  );
  return v_id;
end $$;

-- Switches the current transaction to the given user (or to anon when null).
create or replace function tests.authenticate_as(p_user uuid, p_anonymous boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_user is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    perform set_config('role', 'anon', true);
    return;
  end if;
  perform set_config('request.jwt.claims', json_build_object(
    'sub', p_user, 'role', 'authenticated', 'is_anonymous', p_anonymous
  )::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Fixture puzzles: 900001 is playable (past date), 900002 is in the future.
create or replace function tests.seed_fixture_puzzles()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trainees (id, character_id)
  select 'tt-' || i, 'tc-' || i from generate_series(1, 20) i
  on conflict do nothing;
  insert into public.puzzles (puzzle_number, date, rows, cols, data_version) values
    (900001, '2000-01-01', array['r1','r2','r3'], array['c1','c2','c3'], 'test'),
    (900002, '2999-01-01', array['r1','r2','r3'], array['c1','c2','c3'], 'test')
  on conflict do nothing;
  -- Cell c accepts tt-(c+1) and tt-(c+11).
  insert into public.puzzle_answers (puzzle_number, cell, trainee_id)
  select p, c, 'tt-' || (c + o)
  from (values (900001, 1), (900001, 11), (900002, 1)) v(p, o), generate_series(0, 8) c
  on conflict do nothing;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
commit;
