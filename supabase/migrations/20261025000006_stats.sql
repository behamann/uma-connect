-- Rarity aggregates, guest submissions and anonymous-user cleanup (FR-020, FR-021, research R3/R7).

create function private.count_finished_session() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Count each eligible game once, when it first becomes final; imported games never count.
  if new.imported or new.status = 'in_progress' or (tg_op = 'UPDATE' and old.status <> 'in_progress') then
    return new;
  end if;
  insert into public.puzzle_stats (puzzle_number, finished_games)
  values (new.puzzle_number, 1)
  on conflict (puzzle_number) do update set finished_games = public.puzzle_stats.finished_games + 1;
  insert into public.answer_counts (puzzle_number, cell, trainee_id, picks)
  select new.puzzle_number, (g ->> 'cell')::smallint, g ->> 'trainee_id', 1
  from jsonb_array_elements(new.guesses) g
  where (g ->> 'correct')::boolean
  on conflict (puzzle_number, cell, trainee_id) do update set picks = public.answer_counts.picks + 1;
  return new;
end $$;

create trigger daily_sessions_count_finished
after insert or update of status on public.daily_sessions
for each row execute function private.count_finished_session();

create function public.get_rarity(p_puzzle int) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_finished int;
begin
  perform private.check_puzzle(p_puzzle);
  select coalesce(max(s.finished_games), 0) into v_finished
  from public.puzzle_stats s where s.puzzle_number = p_puzzle;
  return jsonb_build_object(
    'finished_games', v_finished,
    'threshold', 20,
    'cells', case when v_finished < 20 then null else (
      select coalesce(jsonb_agg(jsonb_build_object('cell', a.cell, 'trainee_id', a.trainee_id, 'picks', a.picks)), '[]'::jsonb)
      from public.answer_counts a where a.puzzle_number = p_puzzle
    ) end
  );
end $$;

create function public.submit_guest_result(p_puzzle int, p_guesses jsonb, p_gave_up boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(false);
  v_guess jsonb;
  s public.daily_sessions;
begin
  if not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'guest_only';
  end if;
  perform private.check_puzzle(p_puzzle);
  if jsonb_typeof(p_guesses) <> 'array' or jsonb_array_length(p_guesses) > 9 then
    raise exception 'bad_input';
  end if;

  insert into public.daily_sessions (user_id, puzzle_number, is_guest)
  values (v_uid, p_puzzle, true)
  on conflict do nothing
  returning * into s;
  if s.user_id is null then
    raise exception 'already_submitted';
  end if;

  for v_guess in select value from jsonb_array_elements(p_guesses) loop
    s := private.apply_guess(s, (v_guess ->> 'cell')::int, v_guess ->> 'trainee_id');
  end loop;
  if coalesce(p_gave_up, false) and s.status = 'in_progress' then
    s := private.apply_give_up(s);
  end if;
  if s.status = 'in_progress' then
    raise exception 'not_finished';
  end if;
  return jsonb_build_object('result', 'ok');
end $$;

revoke all on function public.get_rarity(int) from public, anon, authenticated;
revoke all on function public.submit_guest_result(int, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.get_rarity(int) to anon, authenticated;
grant execute on function public.submit_guest_result(int, jsonb, boolean) to authenticated;

-- Anonymous guest users are only needed for dedupe; aggregates have no user id and stay.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'purge-anonymous-users',
  '17 3 * * *',
  $$delete from auth.users where is_anonymous and created_at < now() - interval '30 days'$$
);
