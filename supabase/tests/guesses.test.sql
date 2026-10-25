-- record_guess / give_up / get_my_daily: rejections, conflicts, transitions (data-model.md).
begin;
select plan(27);

select tests.seed_fixture_puzzles();
create temp table u(name text primary key, id uuid) on commit drop;
grant select on u to anon, authenticated;
insert into u values
  ('a', tests.create_user('a@example.com')),
  ('b', tests.create_user('b@example.com')),
  ('c', tests.create_user('c@example.com')),
  ('g', tests.create_user(null, true));

-- Player A: rejections, conflict, then runs out of guesses.
select tests.authenticate_as((select id from u where name = 'a'));
select throws_ok($$ select public.record_guess(900002, 0, 0, 'tt-1') $$, 'P0001', 'puzzle_unavailable', 'future puzzle rejected');
select throws_ok($$ select public.record_guess(123456, 0, 0, 'tt-1') $$, 'P0001', 'puzzle_unavailable', 'unknown puzzle rejected');
select throws_ok($$ select public.record_guess(900001, 0, 0, 'nope') $$, 'P0001', 'unknown_trainee', 'unknown trainee rejected');
select throws_ok($$ select public.record_guess(900001, 0, 9, 'tt-1') $$, 'P0001', 'bad_cell', 'bad cell rejected');
select is(public.get_my_daily(900001), null, 'rejections leave no session');

select is(public.record_guess(900001, 0, 0, 'tt-1') ->> 'result', 'correct', 'correct guess');
select is(public.record_guess(900001, 0, 1, 'tt-2') ->> 'result', 'conflict', 'index mismatch is a conflict');
select is(
  jsonb_array_length(public.record_guess(900001, 5, 1, 'tt-2') -> 'session' -> 'guesses'), 1,
  'conflict returns the server session'
);
select throws_ok($$ select public.record_guess(900001, 1, 0, 'tt-11') $$, 'P0001', 'cell_filled', 'filled cell rejected');
select throws_ok($$ select public.record_guess(900001, 1, 1, 'tt-1') $$, 'P0001', 'trainee_used', 'used trainee rejected');
select is(public.record_guess(900001, 1, 1, 'tt-5') ->> 'result', 'incorrect', 'incorrect guess');
select is(public.record_guess(900001, 2, 1, 'tt-2') ->> 'result', 'correct', 'incorrect trainee does not block the cell');

select public.record_guess(900001, i, i - 1, 'tt-' || i) from generate_series(3, 8) i;
select is(public.get_my_daily(900001) ->> 'status', 'out_of_guesses', '9 guesses without a full board end the game');
select is((public.get_my_daily(900001) ->> 'score')::int, 8, 'score counts correct cells');
select is(jsonb_array_length(public.get_my_daily(900001) -> 'guesses'), 9, 'all guesses stored');
select throws_ok($$ select public.record_guess(900001, 9, 8, 'tt-9') $$, 'P0001', 'game_over', 'no guesses after the end');
select throws_ok($$ select public.give_up(900001, 9) $$, 'P0001', 'game_over', 'cannot give up a finished game');

-- Player B completes the board.
select tests.authenticate_as((select id from u where name = 'b'));
select public.record_guess(900001, i, i, 'tt-' || (i + 1)) from generate_series(0, 8) i;
select is(public.get_my_daily(900001) ->> 'status', 'completed', '9 correct cells complete the game');
select is((public.get_my_daily(900001) ->> 'score')::int, 9, 'perfect score');

-- Player C gives up.
select tests.authenticate_as((select id from u where name = 'c'));
select is(public.give_up(900001, 3) ->> 'result', 'conflict', 'give_up checks the index');
select is(public.give_up(900001, 0) ->> 'result', 'ok', 'give up without guesses');
select is(public.get_my_daily(900001) ->> 'status', 'gave_up', 'status gave_up');

reset role;
select isnt(
  (select finished_at from public.daily_sessions where user_id = (select id from u where name = 'c')),
  null, 'finished_at set on final status'
);

-- Anonymous and signed-out callers.
select tests.authenticate_as((select id from u where name = 'g'), true);
select throws_ok($$ select public.record_guess(900001, 0, 0, 'tt-1') $$, 'P0001', 'permanent_account_required', 'anonymous user cannot record guesses');
select throws_ok($$ select public.get_my_daily(900001) $$, 'P0001', 'permanent_account_required', 'anonymous user has no daily sync');

select tests.authenticate_as(null);
select throws_ok($$ select public.record_guess(900001, 0, 0, 'tt-1') $$, '42501', null, 'anon cannot call record_guess');
select throws_ok($$ select public.get_my_daily(900001) $$, '42501', null, 'anon cannot call get_my_daily');

select * from finish();
rollback;
