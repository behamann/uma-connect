-- Rarity counting, guest submissions and get_rarity (FR-020, FR-021).
begin;
select plan(15);

select tests.seed_fixture_puzzles();
create temp table u(name text primary key, id uuid) on commit drop;
grant select on u to anon, authenticated;
insert into u values
  ('a', tests.create_user('a@example.com')),
  ('c', tests.create_user('c@example.com')),
  ('g1', tests.create_user(null, true)),
  ('g2', tests.create_user(null, true));

-- A finishes with a perfect board.
select tests.authenticate_as((select id from u where name = 'a'));
select public.record_guess(900001, i, i, 'tt-' || (i + 1)) from generate_series(0, 7) i;
select tests.authenticate_as(null);
select is((public.get_rarity(900001) ->> 'finished_games')::int, 0, 'in-progress games are not counted');
select tests.authenticate_as((select id from u where name = 'a'));
select public.record_guess(900001, 8, 8, 'tt-9');
select tests.authenticate_as(null);
select is((public.get_rarity(900001) ->> 'finished_games')::int, 1, 'finished game counted once');
select is(public.get_rarity(900001) -> 'cells', 'null'::jsonb, 'cells hidden below 20 games');

-- Imported games never count.
select tests.authenticate_as((select id from u where name = 'c'));
select public.import_local('[{"puzzle_number":900001,"guesses":[{"cell":0,"trainee_id":"tt-11"}],"gave_up":true}]', '[]');
select is((public.get_rarity(900001) ->> 'finished_games')::int, 1, 'imported game not counted');

-- Guests.
select throws_ok($$ select public.submit_guest_result(900001, '[]', true) $$, 'P0001', 'guest_only', 'permanent users cannot submit as guests');
select tests.authenticate_as((select id from u where name = 'g1'), true);
select is(
  public.submit_guest_result(900001, '[{"cell":0,"trainee_id":"tt-11"},{"cell":1,"trainee_id":"tt-1"}]', true) ->> 'result',
  'ok', 'guest result accepted'
);
select is((public.get_rarity(900001) ->> 'finished_games')::int, 2, 'guest game counted');
select throws_ok($$ select public.submit_guest_result(900001, '[]', true) $$, 'P0001', 'already_submitted', 'one result per guest and puzzle');

select tests.authenticate_as((select id from u where name = 'g2'), true);
select throws_ok(
  $$ select public.submit_guest_result(900001, '[{"cell":0,"trainee_id":"tt-1"}]', false) $$,
  'P0001', 'not_finished', 'unfinished games rejected'
);
select throws_ok(
  $$ select public.submit_guest_result(900001, '[{"cell":0,"trainee_id":"tt-1"},{"cell":0,"trainee_id":"tt-11"}]', true) $$,
  'P0001', 'cell_filled', 'guest guesses replayed with the game rules'
);
select throws_ok($$ select public.submit_guest_result(900002, '[]', true) $$, 'P0001', 'puzzle_unavailable', 'future puzzle rejected');
select is((public.get_rarity(900001) ->> 'finished_games')::int, 2, 'rejected submissions not counted');

reset role;
update public.puzzle_stats set finished_games = 20 where puzzle_number = 900001;
select tests.authenticate_as(null);
select is(
  (select (c ->> 'picks')::int from jsonb_array_elements(public.get_rarity(900001) -> 'cells') c
   where (c ->> 'cell')::int = 0 and c ->> 'trainee_id' = 'tt-1'),
  1, 'per-answer picks shown from 20 games'
);
select throws_ok($$ select public.get_rarity(900002) $$, 'P0001', 'puzzle_unavailable', 'no rarity for future puzzles');
select throws_ok($$ select public.submit_guest_result(900001, '[]', true) $$, '42501', null, 'anon role cannot submit');

select * from finish();
rollback;
