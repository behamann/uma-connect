-- First sign-in import and account history (contracts/database-api.md).

create function public.import_local(p_sessions jsonb, p_history jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
  v_sessions jsonb := coalesce(p_sessions, '[]'::jsonb);
  v_history jsonb := coalesce(p_history, '[]'::jsonb);
  v_item jsonb;
  v_guess jsonb;
  v_puzzle int;
  v_status text;
  s public.daily_sessions;
  v_imported int := 0;
  v_skipped int := 0;
  v_legacy int := 0;
begin
  if jsonb_typeof(v_sessions) <> 'array' or jsonb_typeof(v_history) <> 'array' then
    raise exception 'bad_input';
  end if;
  if jsonb_array_length(v_sessions) > 400 or jsonb_array_length(v_history) > 400 then
    raise exception 'too_many_items';
  end if;

  -- Each session is replayed through the same validation; invalid ones are skipped as a whole.
  for v_item in select value from jsonb_array_elements(v_sessions) loop
    begin
      v_puzzle := (v_item ->> 'puzzle_number')::int;
      perform private.check_puzzle(v_puzzle);
      s := null;
      insert into public.daily_sessions (user_id, puzzle_number, imported)
      values (v_uid, v_puzzle, true)
      on conflict do nothing
      returning * into s;
      if s.user_id is null then
        -- First device wins: an existing account session is never overwritten.
        v_skipped := v_skipped + 1;
        continue;
      end if;
      for v_guess in select value from jsonb_array_elements(v_item -> 'guesses') loop
        s := private.apply_guess(s, (v_guess ->> 'cell')::int, v_guess ->> 'trainee_id');
      end loop;
      if coalesce((v_item ->> 'gave_up')::boolean, false) and s.status = 'in_progress' then
        s := private.apply_give_up(s);
      end if;
      v_imported := v_imported + 1;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  -- Results without guess data (local sessions older than 30 days).
  for v_item in select value from jsonb_array_elements(v_history) loop
    begin
      v_puzzle := (v_item ->> 'puzzle_number')::int;
      v_status := v_item ->> 'status';
      perform private.check_puzzle(v_puzzle);
      if coalesce(v_status in ('completed', 'out_of_guesses', 'gave_up'), false)
        and not exists (
          select 1 from public.daily_sessions d where d.user_id = v_uid and d.puzzle_number = v_puzzle
        ) then
        insert into public.legacy_history (user_id, puzzle_number, score, status)
        values (v_uid, v_puzzle, least(greatest(coalesce((v_item ->> 'score')::int, 0), 0), 9), v_status)
        on conflict do nothing;
        if found then
          v_legacy := v_legacy + 1;
        end if;
      end if;
    exception when others then
      null;
    end;
  end loop;

  return jsonb_build_object(
    'imported_sessions', v_imported,
    'skipped_sessions', v_skipped,
    'imported_history', v_legacy
  );
end $$;

create function public.get_my_history() returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
begin
  return (
    select coalesce(jsonb_agg(to_jsonb(h) order by h.puzzle_number), '[]'::jsonb)
    from (
      select d.puzzle_number, d.score, d.status, 'session' as source
      from public.daily_sessions d
      where d.user_id = v_uid and d.status <> 'in_progress'
      union all
      select l.puzzle_number, l.score, l.status, 'legacy' as source
      from public.legacy_history l
      where l.user_id = v_uid
        and not exists (
          select 1 from public.daily_sessions d
          where d.user_id = v_uid and d.puzzle_number = l.puzzle_number
        )
    ) h
  );
end $$;

revoke all on function public.import_local(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_my_history() from public, anon, authenticated;
grant execute on function public.import_local(jsonb, jsonb) to authenticated;
grant execute on function public.get_my_history() to authenticated;
