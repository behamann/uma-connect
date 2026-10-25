-- Profiles, display names, export and deletion (FR-014..FR-019, research R9).

create function private.ensure_profile(p_user uuid) returns void
language plpgsql
set search_path = ''
as $$
begin
  for i in 1..20 loop
    if exists (select 1 from public.profiles p where p.id = p_user) then
      return;
    end if;
    begin
      insert into public.profiles (id, display_name)
      values (p_user, 'Trainer-' || lpad(floor(random() * 1000000)::int::text, 6, '0'));
      return;
    exception when unique_violation then
      null; -- name clash (or concurrent insert): retry
    end;
  end loop;
  raise exception 'profile_name_exhausted';
end $$;

create function private.on_auth_user_change() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(new.is_anonymous, false) then
    perform private.ensure_profile(new.id);
  end if;
  return new;
end $$;

grant usage on schema private to supabase_auth_admin;
grant execute on function private.on_auth_user_change() to supabase_auth_admin;

create trigger on_auth_user_profile
after insert or update of is_anonymous on auth.users
for each row execute function private.on_auth_user_change();

-- Backfill accounts created before this migration.
select private.ensure_profile(u.id) from auth.users u where not coalesce(u.is_anonymous, false);

insert into public.reserved_names (term) values
  ('admin'), ('administrator'), ('moderator'), ('staff'), ('support'), ('official'), ('system'),
  ('root'), ('owner'), ('developer'), ('umagrid'), ('cygames'), ('supabase'),
  ('fuck'), ('shit'), ('bitch'), ('cunt'), ('nigg'), ('fag'), ('nazi'), ('hitler'), ('rape')
on conflict do nothing;

create function private.profile_json(p_user uuid) returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'display_name', p.display_name::text,
    'leaderboard_opt_out', p.leaderboard_opt_out,
    'created_at', p.created_at,
    'email', u.email
  )
  from public.profiles p join auth.users u on u.id = p.id
  where p.id = p_user
$$;

create function public.get_my_profile() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
begin
  perform private.ensure_profile(v_uid);
  return private.profile_json(v_uid);
end $$;

create function public.update_profile(p_display_name text default null, p_opt_out boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
  v_name text := btrim(p_display_name);
begin
  perform private.ensure_profile(v_uid);
  if v_name is not null then
    if char_length(v_name) < 3 or char_length(v_name) > 20 then
      raise exception 'name_length';
    end if;
    if v_name !~ '^[A-Za-z0-9 _.-]+$' then
      raise exception 'name_chars';
    end if;
    if exists (
      select 1 from public.reserved_names r where position(lower(r.term::text) in lower(v_name)) > 0
    ) then
      raise exception 'name_reserved';
    end if;
    begin
      update public.profiles set display_name = v_name where id = v_uid;
    exception when unique_violation then
      raise exception 'name_taken';
    end;
  end if;
  if p_opt_out is not null then
    update public.profiles set leaderboard_opt_out = p_opt_out where id = v_uid;
  end if;
  return private.profile_json(v_uid);
end $$;

create function public.export_my_data() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', private.profile_json(v_uid),
    'sessions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'puzzle_number', d.puzzle_number,
        'guesses', d.guesses,
        'status', d.status,
        'score', d.score,
        'imported', d.imported,
        'started_at', d.started_at,
        'finished_at', d.finished_at
      ) order by d.puzzle_number), '[]'::jsonb)
      from public.daily_sessions d where d.user_id = v_uid
    ),
    'legacy_history', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'puzzle_number', l.puzzle_number, 'score', l.score, 'status', l.status
      ) order by l.puzzle_number), '[]'::jsonb)
      from public.legacy_history l where l.user_id = v_uid
    )
  );
end $$;

-- Irreversible: cascades to profile, sessions and history; anonymous aggregates stay.
create function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user(true);
begin
  delete from auth.users where id = v_uid;
end $$;

revoke all on function public.get_my_profile() from public, anon, authenticated;
revoke all on function public.update_profile(text, boolean) from public, anon, authenticated;
revoke all on function public.export_my_data() from public, anon, authenticated;
revoke all on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.update_profile(text, boolean) to authenticated;
grant execute on function public.export_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
