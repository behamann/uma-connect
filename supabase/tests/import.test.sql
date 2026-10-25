-- import_local / get_my_history (first sign-in import, first device wins).
begin;
select plan(16);

select tests.seed_fixture_puzzles();
create temp table u(name text primary key, id uuid) on commit drop;
grant select on u to anon, authenticated;
insert into u values
  ('a', tests.create_user('ia@example.com')),
  ('b', tests.create_user('ib@example.com')),
  ('c', tests.create_user('ic@example.com')),
  ('g', tests.create_user(null, true));

select tests.authenticate_as((select id from u where name = 'a'));
select is(
  public.import_local(
    '[{"puzzle_number": 900001, "guesses": [{"cell": 0, "trainee_id": "tt-1"}, {"cell": 1, "trainee_id": "tt-5"}], "gave_up": false},
      {"puzzle_number": 900002, "guesses": [{"cell": 0, "trainee_id": "tt-1"}]}]'::jsonb,
    '[{"puzzle_number": 900001, "score": 5, "status": "completed"}]'::jsonb
  ),
  '{"imported_sessions": 1, "skipped_sessions": 1, "imported_history": 0}'::jsonb,
  'valid session imported, future puzzle skipped, history ignored when a session exists'
);
select is(jsonb_array_length(public.get_my_daily(900001) -> 'guesses'), 2, 'guesses replayed');
select is((public.get_my_daily(900001) ->> 'score')::int, 1, 'correctness recomputed by the server');
select is(
  public.import_local('[{"puzzle_number": 900001, "guesses": [{"cell": 4, "trainee_id": "tt-5"}]}]'::jsonb, '[]'::jsonb) ->> 'skipped_sessions',
  '1', 'existing account session is never overwritten'
);
select is(jsonb_array_length(public.get_my_daily(900001) -> 'guesses'), 2, 'account session unchanged');
select is(public.record_guess(900001, 2, 2, 'tt-3') ->> 'result', 'correct', 'imported game continues online');

-- Player B: invalid session is skipped as a whole; give-up is replayed.
select tests.authenticate_as((select id from u where name = 'b'));
select is(
  public.import_local('[{"puzzle_number": 900001, "guesses": [{"cell": 0, "trainee_id": "tt-1"}, {"cell": 9, "trainee_id": "tt-2"}]}]'::jsonb, null) ->> 'skipped_sessions',
  '1', 'session with an invalid guess skipped'
);
select is(public.get_my_daily(900001), null, 'no partial session stored');
select is(
  public.import_local('[{"puzzle_number": 900001, "guesses": [{"cell": 0, "trainee_id": "tt-1"}], "gave_up": true}]'::jsonb, null) ->> 'imported_sessions',
  '1', 'given-up session imported'
);
select is(public.get_my_daily(900001) ->> 'status', 'gave_up', 'give-up replayed');

-- Player C: legacy history only.
select tests.authenticate_as((select id from u where name = 'c'));
select is(
  public.import_local('[]'::jsonb, '[{"puzzle_number": 900001, "score": 15, "status": "completed"},
                                      {"puzzle_number": 900002, "score": 3, "status": "completed"},
                                      {"puzzle_number": 900001, "score": 1, "status": "in_progress"}]'::jsonb) ->> 'imported_history',
  '1', 'only valid past history stored'
);
select is(
  public.get_my_history(),
  '[{"puzzle_number": 900001, "score": 9, "status": "completed", "source": "legacy"}]'::jsonb,
  'score clamped and returned as legacy history'
);
select throws_ok(
  $$ select public.import_local((select jsonb_agg('{}'::jsonb) from generate_series(1, 401)), null) $$,
  'P0001', 'too_many_items', 'max 400 items'
);

reset role;
select is(
  (select imported from public.daily_sessions where user_id = (select id from u where name = 'a')),
  true, 'imported sessions are flagged'
);

select tests.authenticate_as((select id from u where name = 'a'));
select is(
  public.get_my_history(), '[]'::jsonb, 'in-progress sessions are not history'
);

select tests.authenticate_as((select id from u where name = 'g'), true);
select throws_ok($$ select public.import_local('[]', '[]') $$, 'P0001', 'permanent_account_required', 'anonymous users cannot import');

select * from finish();
rollback;
