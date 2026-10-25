-- Gameplay RPCs (contracts/database-api.md). Rules mirror src/game/session.ts; answers come from
-- puzzle_answers, which sync-puzzles computes with the TypeScript engine.

create function private.today_utc() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'utc')::date $$;

create function private.require_user(p_permanent boolean) returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_permanent and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'permanent_account_required';
  end if;
  return v_uid;
end $$;

create function private.check_puzzle(p_puzzle int) returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.puzzles p
    where p.puzzle_number = p_puzzle and p.date <= private.today_utc()
  ) then
    raise exception 'puzzle_unavailable';
  end if;
end $$;

create function private.session_json(s public.daily_sessions) returns jsonb
language sql immutable
set search_path = ''
as $$
  select case when s.user_id is null then null else jsonb_build_object(
    'puzzle_number', s.puzzle_number,
    'guesses', s.guesses,
    'status', s.status,
    'score', s.score
  ) end
$$;

-- Locks the caller's session row; creates it first when p_create. Returns an all-null row if absent.
create function private.lock_session(
  p_user uuid, p_puzzle int, p_create boolean,
  p_imported boolean default false, p_guest boolean default false
) returns public.daily_sessions
language plpgsql
set search_path = ''
as $$
declare
  s public.daily_sessions;
begin
  if p_create then
    insert into public.daily_sessions (user_id, puzzle_number, imported, is_guest)
    values (p_user, p_puzzle, p_imported, p_guest)
    on conflict do nothing;
  end if;
  select * into s from public.daily_sessions
  where user_id = p_user and puzzle_number = p_puzzle
  for update;
  return s;
end $$;

-- Appends one validated guess to a locked session (same checks and transitions as submitGuess).
create function private.apply_guess(s public.daily_sessions, p_cell int, p_trainee text)
returns public.daily_sessions
language plpgsql
set search_path = ''
as $$
declare
  v_correct boolean;
  v_guesses jsonb;
  v_score int;
  v_status text;
begin
  if p_trainee is null or not exists (select 1 from public.trainees t where t.id = p_trainee) then
    raise exception 'unknown_trainee';
  end if;
  if p_cell is null or p_cell < 0 or p_cell > 8 then
    raise exception 'bad_cell';
  end if;
  if s.status <> 'in_progress' or jsonb_array_length(s.guesses) >= 9 then
    raise exception 'game_over';
  end if;
  if exists (
    select 1 from jsonb_array_elements(s.guesses) g
    where (g ->> 'correct')::boolean and (g ->> 'cell')::int = p_cell
  ) then
    raise exception 'cell_filled';
  end if;
  if exists (
    select 1 from jsonb_array_elements(s.guesses) g
    where (g ->> 'correct')::boolean and g ->> 'trainee_id' = p_trainee
  ) then
    raise exception 'trainee_used';
  end if;

  v_correct := exists (
    select 1 from public.puzzle_answers a
    where a.puzzle_number = s.puzzle_number and a.cell = p_cell and a.trainee_id = p_trainee
  );
  v_guesses := s.guesses || jsonb_build_array(jsonb_build_object(
    'cell', p_cell, 'trainee_id', p_trainee, 'correct', v_correct, 'at', now()
  ));
  v_score := s.score + case when v_correct then 1 else 0 end;
  v_status := case
    when v_score = 9 then 'completed'
    when jsonb_array_length(v_guesses) >= 9 then 'out_of_guesses'
    else 'in_progress'
  end;

  update public.daily_sessions d
  set guesses = v_guesses,
      score = v_score,
      status = v_status,
      finished_at = case when v_status <> 'in_progress' then now() end
  where d.user_id = s.user_id and d.puzzle_number = s.puzzle_number
  returning d.* into s;
  return s;
end $$;

create function private.apply_give_up(s public.daily_sessions) returns public.daily_sessions
language plpgsql
set search_path = ''
as $$
begin
  if s.status <> 'in_progress' then
    raise exception 'game_over';
  end if;
  update public.daily_sessions d
  set status = 'gave_up', finished_at = now()
  where d.user_id = s.user_id and d.puzzle_number = s.puzzle_number
  returning d.* into s;
  return s;
end $$;

create function public.record_guess(p_puzzle int, p_index int, p_cell int, p_trainee text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
  s public.daily_sessions;
begin
  perform private.check_puzzle(p_puzzle);
  s := private.lock_session(v_uid, p_puzzle, p_index = 0);
  if coalesce(jsonb_array_length(s.guesses), 0) <> p_index then
    return jsonb_build_object('result', 'conflict', 'session', private.session_json(s));
  end if;
  s := private.apply_guess(s, p_cell, p_trainee);
  return jsonb_build_object(
    'result', case when (s.guesses -> -1 ->> 'correct')::boolean then 'correct' else 'incorrect' end,
    'session', private.session_json(s)
  );
end $$;

create function public.give_up(p_puzzle int, p_index int) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
  s public.daily_sessions;
begin
  perform private.check_puzzle(p_puzzle);
  s := private.lock_session(v_uid, p_puzzle, p_index = 0);
  if coalesce(jsonb_array_length(s.guesses), 0) <> p_index then
    return jsonb_build_object('result', 'conflict', 'session', private.session_json(s));
  end if;
  s := private.apply_give_up(s);
  return jsonb_build_object('result', 'ok', 'session', private.session_json(s));
end $$;

create function public.get_my_daily(p_puzzle int) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
  s public.daily_sessions;
begin
  select * into s from public.daily_sessions d
  where d.user_id = v_uid and d.puzzle_number = p_puzzle;
  return private.session_json(s);
end $$;

revoke all on function public.record_guess(int, int, int, text) from public, anon, authenticated;
revoke all on function public.give_up(int, int) from public, anon, authenticated;
revoke all on function public.get_my_daily(int) from public, anon, authenticated;
grant execute on function public.record_guess(int, int, int, text) to authenticated;
grant execute on function public.give_up(int, int) to authenticated;
grant execute on function public.get_my_daily(int) to authenticated;
