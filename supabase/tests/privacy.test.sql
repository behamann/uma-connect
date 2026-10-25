-- Profiles, display-name rules, export and deletion (FR-014..FR-019).
begin;
select plan(24);

select tests.seed_fixture_puzzles();
create temp table u(name text primary key, id uuid) on commit drop;
grant select on u to anon, authenticated;
insert into u values
  ('a', tests.create_user('a@example.com')),
  ('b', tests.create_user('b@example.com')),
  ('c', tests.create_user('c@example.com')),
  ('g', tests.create_user(null, true));

select matches(
  (select display_name::text from public.profiles where id = (select id from u where name = 'a')),
  '^Trainer-[0-9]{6}$', 'permanent user gets a default Trainer name'
);
select is(
  (select count(*)::int from public.profiles where id = (select id from u where name = 'g')), 0,
  'anonymous user has no profile'
);
update auth.users set is_anonymous = false, email = 'g@example.com' where id = (select id from u where name = 'g');
select is(
  (select count(*)::int from public.profiles where id = (select id from u where name = 'g')), 1,
  'profile created when an anonymous account becomes permanent'
);
delete from public.profiles where id = (select id from u where name = 'c');

-- Some anonymous aggregates that must survive account deletion.
insert into public.puzzle_stats values (900001, 7);
insert into public.answer_counts values (900001, 0, 'tt-1', 5);

select tests.authenticate_as((select id from u where name = 'a'));
select is(public.get_my_profile() ->> 'email', 'a@example.com', 'profile shows the sign-in email');
select throws_ok($$ select public.update_profile('ab') $$, 'P0001', 'name_length', 'too short');
select throws_ok($$ select public.update_profile(repeat('a', 21)) $$, 'P0001', 'name_length', 'too long');
select throws_ok($$ select public.update_profile('bad!name') $$, 'P0001', 'name_chars', 'bad characters');
select throws_ok($$ select public.update_profile('SuperAdmin') $$, 'P0001', 'name_reserved', 'reserved term');
select throws_ok($$ select public.update_profile('Umagrid fan') $$, 'P0001', 'name_reserved', 'brand term');
select is(public.update_profile('  Speedy  ') ->> 'display_name', 'Speedy', 'valid name saved (trimmed)');
select is((public.update_profile(null, true) ->> 'leaderboard_opt_out')::boolean, true, 'opt out saved');
select is(public.get_my_profile() ->> 'display_name', 'Speedy', 'opt-out keeps the name');
select public.record_guess(900001, 0, 0, 'tt-1');

select tests.authenticate_as((select id from u where name = 'b'));
select throws_ok($$ select public.update_profile('speedy') $$, 'P0001', 'name_taken', 'names are unique case-insensitively');
select public.record_guess(900001, 0, 1, 'tt-2');

select tests.authenticate_as((select id from u where name = 'c'));
select matches(public.get_my_profile() ->> 'display_name', '^Trainer-', 'missing profile is recreated');

select tests.authenticate_as((select id from u where name = 'a'));
select is(jsonb_array_length(public.export_my_data() -> 'sessions'), 1, 'export has only the caller''s sessions');
select is((public.export_my_data() -> 'sessions' -> 0 -> 'guesses' -> 0 ->> 'trainee_id'), 'tt-1', 'export includes guesses');
select is(public.export_my_data() -> 'profile' ->> 'email', 'a@example.com', 'export includes the profile');
select lives_ok($$ select public.delete_my_account() $$, 'account deleted');

reset role;
select is((select count(*)::int from auth.users where id = (select id from u where name = 'a')), 0, 'auth user removed');
select is((select count(*)::int from public.profiles where id = (select id from u where name = 'a')), 0, 'profile removed');
select is((select count(*)::int from public.daily_sessions where user_id = (select id from u where name = 'a')), 0, 'sessions removed');
select is((select picks from public.answer_counts where puzzle_number = 900001 and trainee_id = 'tt-1'), 5, 'rarity counts unchanged');

select tests.authenticate_as((select id from u where name = 'b'), true);
select throws_ok($$ select public.get_my_profile() $$, 'P0001', 'permanent_account_required', 'anonymous callers rejected');
select tests.authenticate_as(null);
select throws_ok($$ select public.delete_my_account() $$, '42501', null, 'anon cannot delete accounts');

select * from finish();
rollback;
