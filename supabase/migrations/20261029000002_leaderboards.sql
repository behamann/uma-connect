-- Leaderboards (FR-022, FR-023, research R8). Daily is computed on read; week/month/all-time come
-- from a materialized view that is always joined with live profiles (opt-out/deletion apply at once).

-- Rarity score of one finished game with the current counts (same formula as src/game/rarity.ts).
create function private.session_rarity(p_puzzle int, p_guesses jsonb) returns int
language sql
stable
set search_path = ''
as $$
  select round(900 - coalesce(sum(100 - least(100, coalesce(a.picks, 0) * 100.0 / st.finished_games)), 0))::int
  from jsonb_array_elements(p_guesses) g
  left join public.puzzle_stats st on st.puzzle_number = p_puzzle and st.finished_games > 0
  left join public.answer_counts a
    on a.puzzle_number = p_puzzle and a.cell = (g ->> 'cell')::smallint and a.trainee_id = g ->> 'trainee_id'
  where (g ->> 'correct')::boolean
$$;

create materialized view private.leaderboard_totals as
with games as (
  select s.user_id, s.score, private.session_rarity(s.puzzle_number, s.guesses) as rarity, p.date
  from public.daily_sessions s
  join public.puzzles p on p.puzzle_number = s.puzzle_number
  where s.status <> 'in_progress' and not s.is_guest
)
select
  k.period,
  k.period_key,
  g.user_id,
  sum(g.score)::int as score_sum,
  sum(g.rarity)::int as rarity_sum,
  count(*)::int as games,
  (count(*) filter (where g.score = 9))::int as perfect
from games g
cross join lateral (values
  ('week', to_char(g.date, 'IYYY-"W"IW')),
  ('month', to_char(g.date, 'YYYY-MM')),
  ('all', 'all')
) k(period, period_key)
group by k.period, k.period_key, g.user_id;

create unique index leaderboard_totals_key on private.leaderboard_totals (period, period_key, user_id);

create table private.leaderboard_refresh (
  id boolean primary key default true check (id),
  refreshed_at timestamptz not null
);
insert into private.leaderboard_refresh (refreshed_at) values (now());

create function public.refresh_leaderboards() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  refresh materialized view concurrently private.leaderboard_totals;
  update private.leaderboard_refresh set refreshed_at = now() where id;
end $$;

create function public.get_leaderboard(p_period text, p_key text) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_puzzle int;
  v_result jsonb;
begin
  if p_period = 'daily' then
    if p_key is null or p_key !~ '^[0-9]{1,9}$' then
      raise exception 'bad_input';
    end if;
    v_puzzle := p_key::int;
    perform private.check_puzzle(v_puzzle);

    with games as (
      select s.user_id, pr.display_name::text as display_name, s.score::int as score,
        private.session_rarity(s.puzzle_number, s.guesses) as rarity, s.finished_at
      from public.daily_sessions s
      join public.profiles pr on pr.id = s.user_id and not pr.leaderboard_opt_out
      where s.puzzle_number = v_puzzle and s.status <> 'in_progress' and not s.is_guest
    ), ranked as (
      select g.*, rank() over (order by g.score desc, g.rarity asc, g.finished_at asc) as rank
      from games g
    )
    select jsonb_build_object(
      'updated_at', now(),
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'rank', t.rank, 'display_name', t.display_name, 'score', t.score, 'rarity', t.rarity
        ) order by t.rank, t.display_name)
        from (select * from ranked order by rank, display_name limit 100) t
      ), '[]'::jsonb),
      'me', (
        select jsonb_build_object('rank', m.rank, 'display_name', m.display_name, 'score', m.score, 'rarity', m.rarity)
        from ranked m where m.user_id = v_uid
      )
    ) into v_result;
    return v_result;
  end if;

  if not (
    (p_period = 'week' and p_key ~ '^[0-9]{4}-W[0-9]{2}$')
    or (p_period = 'month' and p_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
    or p_period = 'all'
  ) then
    raise exception 'bad_input';
  end if;

  with ranked as (
    select t.user_id, pr.display_name::text as display_name, t.score_sum as score, t.rarity_sum as rarity,
      t.games, t.perfect,
      rank() over (order by
        t.score_sum desc,
        case when p_period = 'all' then 0 else t.rarity_sum end asc,
        case when p_period = 'all' then t.perfect else t.games end desc,
        case when p_period = 'all' then pr.created_at end asc
      ) as rank
    from private.leaderboard_totals t
    join public.profiles pr on pr.id = t.user_id and not pr.leaderboard_opt_out
    where t.period = p_period and t.period_key = case when p_period = 'all' then 'all' else p_key end
  )
  select jsonb_build_object(
    'updated_at', (select r.refreshed_at from private.leaderboard_refresh r),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', e.rank, 'display_name', e.display_name, 'score', e.score, 'rarity', e.rarity,
        'games', e.games, 'perfect', e.perfect
      ) order by e.rank, e.display_name)
      from (select * from ranked order by rank, display_name limit 100) e
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
        'rank', m.rank, 'display_name', m.display_name, 'score', m.score, 'rarity', m.rarity,
        'games', m.games, 'perfect', m.perfect
      )
      from ranked m where m.user_id = v_uid
    )
  ) into v_result;
  return v_result;
end $$;

revoke all on function public.get_leaderboard(text, text) from public, anon, authenticated;
revoke all on function public.refresh_leaderboards() from public, anon, authenticated;
grant execute on function public.get_leaderboard(text, text) to anon, authenticated;
grant execute on function public.refresh_leaderboards() to service_role;

select cron.schedule('refresh-leaderboards', '*/10 * * * *', $$select public.refresh_leaderboards()$$);
