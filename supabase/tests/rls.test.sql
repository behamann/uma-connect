-- Constitution VI: anon and authenticated cannot touch any table directly.
begin;
select plan(74);

select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'every public table has RLS enabled'
);

select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  0,
  'no table grants to anon/authenticated'
);

create temp table t(name text, col text) on commit drop;
insert into t values
  ('trainees', 'id'), ('puzzles', 'puzzle_number'), ('puzzle_answers', 'cell'),
  ('profiles', 'display_name'), ('reserved_names', 'term'), ('daily_sessions', 'status'),
  ('legacy_history', 'score'), ('puzzle_stats', 'finished_games'), ('answer_counts', 'picks');
grant select on t to anon, authenticated;

select tests.authenticate_as(null);
select throws_ok(format('select * from public.%I', name), '42501', null, 'anon cannot select ' || name) from t;
select throws_ok(format('insert into public.%I default values', name), '42501', null, 'anon cannot insert ' || name) from t;
select throws_ok(format('update public.%I set %I = %I', name, col, col), '42501', null, 'anon cannot update ' || name) from t;
select throws_ok(format('delete from public.%I', name), '42501', null, 'anon cannot delete ' || name) from t;

reset role;
select tests.authenticate_as(tests.create_user('rls@example.com'));
select throws_ok(format('select * from public.%I', name), '42501', null, 'authenticated cannot select ' || name) from t;
select throws_ok(format('insert into public.%I default values', name), '42501', null, 'authenticated cannot insert ' || name) from t;
select throws_ok(format('update public.%I set %I = %I', name, col, col), '42501', null, 'authenticated cannot update ' || name) from t;
select throws_ok(format('delete from public.%I', name), '42501', null, 'authenticated cannot delete ' || name) from t;

select * from finish();
rollback;
