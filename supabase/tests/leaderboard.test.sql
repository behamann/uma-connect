-- Leaderboards (FR-022, FR-023).
begin;
select plan(22);

select tests.seed_fixture_puzzles();
-- Isolate from sessions left in the local database by E2E runs (rolled back at the end).
delete from public.daily_sessions;
insert into public.puzzles (puzzle_number, date, rows, cols, data_version) values
  (900003, '2000-01-02', array['r1','r2','r3'], array['c1','c2','c3'], 'test'),
  (900005, '1999-12-31', array['r1','r2','r3'], array['c1','c2','c3'], 'test');

create temp table u(name text primary key, id uuid) on commit drop;
grant select on u to anon, authenticated;
insert into u values
  ('Aye', tests.create_user('aye@example.com')),
  ('Bee', tests.create_user('bee@example.com')),
  ('Cee', tests.create_user('cee@example.com')),
  ('Dee', tests.create_user('dee@example.com')),
  ('Eee', tests.create_user('eee@example.com')),
  ('Pea', tests.create_user('pea@example.com')),
  ('Que', tests.create_user('que@example.com')),
  ('guest', tests.create_user(null, true));
-- Profiles created in alphabetical order (all-time tiebreak); Dee opted out.
update public.profiles p
set display_name = u.name,
    created_at = '2000-01-01'::timestamptz + (ascii(u.name) - 65) * interval '1 day',
    leaderboard_opt_out = (u.name = 'Dee')
from u where p.id = u.id;

-- Finished game with p_score correct cells (main answers tt-1.., or alternates tt-11..).
create function pg_temp.play(p_user text, p_puzzle int, p_score int, p_alt boolean, p_at text, p_guest boolean default false)
returns void
language sql
as $$
  insert into public.daily_sessions (user_id, puzzle_number, guesses, status, score, finished_at, is_guest)
  select (select id from u where name = p_user), p_puzzle,
    coalesce(jsonb_agg(jsonb_build_object(
      'cell', c, 'trainee_id', 'tt-' || (c + case when p_alt then 11 else 1 end), 'correct', true, 'at', p_at
    ) order by c), '[]'::jsonb),
    case when p_score = 9 then 'completed' else 'gave_up' end, p_score, p_at::timestamptz, p_guest
  from generate_series(0, p_score - 1) c
$$;

create function pg_temp.names(p_board jsonb) returns text[]
language sql
as $$ select array_agg(e ->> 'display_name' order by i) from jsonb_array_elements(p_board -> 'entries') with ordinality x(e, i) $$;

create function pg_temp.ranks(p_board jsonb) returns int[]
language sql
as $$ select array_agg((e ->> 'rank')::int order by i) from jsonb_array_elements(p_board -> 'entries') with ordinality x(e, i) $$;

select pg_temp.play('Aye', 900001, 9, false, '2000-01-01 10:00Z');
select pg_temp.play('Bee', 900001, 9, true, '2000-01-01 11:00Z');
select pg_temp.play('Cee', 900001, 9, false, '2000-01-01 09:00Z');
select pg_temp.play('Dee', 900001, 9, false, '2000-01-01 08:00Z');
select pg_temp.play('Eee', 900001, 5, false, '2000-01-01 08:00Z');
select pg_temp.play('guest', 900001, 9, false, '2000-01-01 07:00Z', true);
select pg_temp.play('Pea', 900003, 9, true, '2000-01-02 10:00Z');
select pg_temp.play('Que', 900003, 4, false, '2000-01-02 10:00Z');
select pg_temp.play('Que', 900005, 5, false, '1999-12-31 10:00Z');
insert into public.daily_sessions (user_id, puzzle_number, guesses, score)
select id, 900005, '[{"cell":0,"trainee_id":"tt-1","correct":true,"at":"1999-12-31"}]', 1 from u where name = 'Aye';

-- Rarity per answer: 900001 main 50%, alternates 10%; 900003 alternates 100%; others 0%.
update public.puzzle_stats set finished_games = 100 where puzzle_number in (900001, 900003, 900005);
delete from public.answer_counts where puzzle_number in (900001, 900003, 900005);
insert into public.answer_counts (puzzle_number, cell, trainee_id, picks)
select 900001, c, 'tt-' || (c + 1), 50 from generate_series(0, 8) c
union all select 900001, c, 'tt-' || (c + 11), 10 from generate_series(0, 8) c
union all select 900003, c, 'tt-' || (c + 11), 100 from generate_series(0, 8) c;

select public.refresh_leaderboards();

select tests.authenticate_as(null);
select is(
  pg_temp.names(public.get_leaderboard('daily', '900001')), array['Bee', 'Cee', 'Aye', 'Eee'],
  'daily: score desc, rarity asc, finish time asc; opted-out players and guests excluded'
);
select is(
  public.get_leaderboard('daily', '900001') -> 'entries' -> 0,
  '{"rank":1,"display_name":"Bee","score":9,"rarity":90}'::jsonb,
  'daily entries show only rank, name, score and rarity'
);
select is(public.get_leaderboard('daily', '900001') -> 'me', 'null'::jsonb, 'anonymous viewers have no own rank');
select ok(
  not exists (
    select 1 from u, (values ('daily', '900001'), ('week', '1999-W52'), ('all', 'all')) v(p, k)
    where position(u.id::text in public.get_leaderboard(v.p, v.k)::text) > 0
  ) and position('@' in public.get_leaderboard('all', 'all')::text) = 0,
  'no user ids or emails in the output'
);

select tests.authenticate_as((select id from u where name = 'Aye'));
select is(
  public.get_leaderboard('daily', '900001') -> 'me',
  '{"rank":3,"display_name":"Aye","score":9,"rarity":450}'::jsonb,
  'signed-in caller sees their own rank'
);
select is(
  pg_temp.names(public.get_leaderboard('week', '1999-W52')), array['Bee', 'Aye', 'Cee', 'Que', 'Pea', 'Eee'],
  'weekly: score sum desc, rarity sum asc, more games'
);
select is(pg_temp.ranks(public.get_leaderboard('week', '1999-W52')), array[1, 2, 2, 4, 5, 6], 'ties share a rank');
select is(
  public.get_leaderboard('week', '1999-W52') -> 'entries' -> 3,
  '{"rank":4,"display_name":"Que","score":9,"rarity":900,"games":2,"perfect":0}'::jsonb,
  'period entries aggregate the games in the period'
);
select is(
  (select (e ->> 'games')::int from jsonb_array_elements(public.get_leaderboard('week', '1999-W52') -> 'entries') e
   where e ->> 'display_name' = 'Aye'),
  1, 'in-progress games never count'
);
select is(
  pg_temp.names(public.get_leaderboard('month', '2000-01')), array['Bee', 'Aye', 'Cee', 'Pea', 'Eee', 'Que'],
  'monthly uses the calendar month (UTC)'
);
select is(
  pg_temp.names(public.get_leaderboard('all', 'all')), array['Aye', 'Bee', 'Cee', 'Pea', 'Que', 'Eee'],
  'all-time: score sum desc, more perfect grids, earlier account'
);
select is((public.get_leaderboard('week', '1999-W52') -> 'me' ->> 'rank')::int, 2, 'own rank in period leaderboards');

select tests.authenticate_as((select id from u where name = 'Dee'));
select is(public.get_leaderboard('daily', '900001') -> 'me', 'null'::jsonb, 'opted-out caller has no rank');

-- Opt-out and deletion apply immediately, before the next refresh.
reset role;
update public.profiles set leaderboard_opt_out = true where id = (select id from u where name = 'Bee');
delete from auth.users where id = (select id from u where name = 'Eee');
select tests.authenticate_as(null);
select is(
  pg_temp.names(public.get_leaderboard('week', '1999-W52')), array['Aye', 'Cee', 'Que', 'Pea'],
  'newly opted-out and deleted players disappear from period leaderboards at once'
);
select is(pg_temp.names(public.get_leaderboard('all', 'all')), array['Aye', 'Cee', 'Pea', 'Que'], 'and from all-time');
select is(pg_temp.names(public.get_leaderboard('daily', '900001')), array['Cee', 'Aye'], 'and from daily');

select throws_ok($$ select public.get_leaderboard('daily', '900002') $$, 'P0001', 'puzzle_unavailable', 'no leaderboard for future puzzles');
select throws_ok($$ select public.get_leaderboard('year', '2000') $$, 'P0001', 'bad_input', 'unknown period');
select throws_ok($$ select public.get_leaderboard('week', '2000-01') $$, 'P0001', 'bad_input', 'malformed period key');
select throws_ok($$ select public.refresh_leaderboards() $$, '42501', null, 'clients cannot refresh leaderboards');

-- Top 100 plus the caller's own rank.
reset role;
insert into u select 'bulk' || i, tests.create_user('bulk' || i || '@example.com') from generate_series(1, 101) i;
select pg_temp.play('bulk' || i, 900005, 9, false, '1999-12-31 09:00Z') from generate_series(1, 101) i;
select tests.authenticate_as((select id from u where name = 'Que'));
select is(jsonb_array_length(public.get_leaderboard('daily', '900005') -> 'entries'), 100, 'only the top 100 are listed');
select is((public.get_leaderboard('daily', '900005') -> 'me' ->> 'rank')::int, 102, 'own rank shown outside the top 100');

select * from finish();
rollback;
