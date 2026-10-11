-- Vado: tabelle e funzioni del server per classifica, leghe e sfide.
--
-- Come si usa: nel pannello di Supabase aprire "SQL Editor", incollare tutto
-- questo file e premere "Run". Si può rilanciare quante volte si vuole: crea
-- solo ciò che manca e aggiorna le funzioni, senza toccare i dati.
--
-- Come è fatto:
--  - Le tabelle stanno nello schema "vado", che non è raggiungibile da fuori:
--    nessuno può leggerle o scriverle direttamente, nemmeno con la chiave
--    pubblica dell'app.
--  - L'app parla solo con le funzioni "vado_..." dello schema "public". Ogni
--    funzione riceve la chiave segreta del telefono (generata a caso alla
--    scelta del soprannome, mai mostrata), riconosce chi chiama e restituisce
--    solo ciò che quella persona può vedere: le leghe di cui fa parte, le
--    sfide a cui partecipa.
--  - Sul server finiscono: soprannome, leghe, sfide e, per ogni tragitto con
--    punti, l'ora di fine, i punti e il mezzo principale. Nessuna posizione,
--    nessuna distanza, nessun nome di stazione.
--  - Della chiave segreta si conserva solo l'impronta (SHA-256): chi leggesse
--    la tabella non potrebbe spacciarsi per un utente.

create schema if not exists vado;
revoke all on schema vado from public;

-- ---------------------------------------------------------------- tabelle

create table if not exists vado.users (
  id uuid primary key default gen_random_uuid(),
  secret_hash bytea not null unique,
  nickname text not null check (char_length(nickname) between 2 and 20),
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);

create table if not exists vado.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 24),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  owner uuid references vado.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists vado.members (
  league_id uuid not null references vado.leagues (id) on delete cascade,
  user_id uuid not null references vado.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists members_user on vado.members (user_id);

-- Un tragitto con punti: quanto serve per sommare i punti di una settimana,
-- di un mese o di una sfida. Niente di più.
create table if not exists vado.scores (
  user_id uuid not null references vado.users (id) on delete cascade,
  trip_id text not null,
  ended_at timestamptz not null,
  points integer not null check (points between 1 and 70),
  mode text,
  primary key (user_id, trip_id)
);
create index if not exists scores_user_time on vado.scores (user_id, ended_at);

create table if not exists vado.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 40),
  kind text not null check (kind in ('traguardo', 'tempo')),
  target integer not null default 0 check (target between 0 and 5000),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  teams boolean not null default false,
  owner uuid references vado.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists vado.challengers (
  challenge_id uuid not null references vado.challenges (id) on delete cascade,
  user_id uuid not null references vado.users (id) on delete cascade,
  team smallint not null default 0 check (team in (0, 1)),
  seat smallint not null default 0,
  primary key (challenge_id, user_id)
);
create index if not exists challengers_user on vado.challengers (user_id);

-- Sicurezza a livello di riga accesa e nessuna regola: l'accesso diretto alle
-- tabelle è negato a tutti. Passano solo le funzioni qui sotto.
alter table vado.users enable row level security;
alter table vado.leagues enable row level security;
alter table vado.members enable row level security;
alter table vado.scores enable row level security;
alter table vado.challenges enable row level security;
alter table vado.challengers enable row level security;

-- ---------------------------------------------------------- funzioni interne

-- Riconosce chi chiama dalla chiave segreta del telefono.
create or replace function vado.who(p_secret text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if p_secret is null or char_length(p_secret) < 32 then
    raise exception 'non-registrato';
  end if;
  update vado.users set seen_at = now()
    where secret_hash = sha256(convert_to(p_secret, 'UTF8'))
    returning id into v_id;
  if v_id is null then
    raise exception 'non-registrato';
  end if;
  return v_id;
end $$;

-- Toglie spazi doppi e ai bordi; rifiuta i testi troppo corti o troppo lunghi.
create or replace function vado.clean(p_text text, p_min integer, p_max integer) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_text text := btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
begin
  if char_length(v_text) < p_min or char_length(v_text) > p_max then
    raise exception 'testo-non-valido';
  end if;
  return v_text;
end $$;

create or replace function vado.ms(p_time timestamptz) returns bigint
language sql immutable set search_path = '' as $$
  select (extract(epoch from p_time) * 1000)::bigint
$$;

-- Due persone hanno almeno una lega in comune?
create or replace function vado.mates(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from vado.members a join vado.members b on b.league_id = a.league_id
    where a.user_id = p_a and b.user_id = p_b
  )
$$;

-- Una sfida con i partecipanti e i loro punti, vista da p_user.
create or replace function vado.challenge_json(p_id uuid, p_user uuid) returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'id', c.id,
    'title', c.title,
    'kind', c.kind,
    'target', c.target,
    'startsAt', vado.ms(c.starts_at),
    'endsAt', vado.ms(c.ends_at),
    'teams', c.teams,
    'mine', c.owner is not distinct from p_user,
    'people', (
      select coalesce(json_agg(json_build_object(
        'id', u.id,
        'name', u.nickname,
        'me', u.id = p_user,
        'team', p.team,
        'points', coalesce(t.points, 0),
        'mode', t.mode,
        'reachedAt', vado.ms(r.at)
      ) order by p.seat, u.nickname), '[]'::json)
      from vado.challengers p
      join vado.users u on u.id = p.user_id
      -- Punti dall'inizio della sfida a adesso (o alla fine, se è già finita).
      left join lateral (
        select
          sum(s.points)::integer as points,
          (select s2.mode from vado.scores s2
            where s2.user_id = p.user_id and s2.ended_at >= c.starts_at and s2.ended_at < c.ends_at
            group by s2.mode order by sum(s2.points) desc, s2.mode limit 1) as mode
        from vado.scores s
        where s.user_id = p.user_id and s.ended_at >= c.starts_at and s.ended_at < c.ends_at
      ) t on true
      -- Per le sfide a traguardo: l'istante in cui la somma (della persona, o
      -- della sua squadra) ha raggiunto il traguardo.
      left join lateral (
        select min(x.ended_at) as at
        from (
          select s.ended_at, sum(s.points) over (order by s.ended_at, s.user_id, s.trip_id) as running
          from vado.scores s
          join vado.challengers q on q.user_id = s.user_id and q.challenge_id = c.id
          where s.ended_at >= c.starts_at and s.ended_at < c.ends_at
            and case when c.teams then q.team = p.team else q.user_id = p.user_id end
        ) x
        where c.kind = 'traguardo' and x.running >= c.target
      ) r on true
      where p.challenge_id = c.id
    )
  )
  from vado.challenges c
  where c.id = p_id
$$;

-- --------------------------------------------- funzioni chiamate dall'app

-- Crea il profilo, oppure cambia il soprannome di un profilo che esiste già.
create or replace function public.vado_register(p_secret text, p_nickname text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_name text := vado.clean(p_nickname, 2, 20);
  v_id uuid;
begin
  if p_secret is null or char_length(p_secret) < 32 or char_length(p_secret) > 128 then
    raise exception 'segreto-non-valido';
  end if;
  insert into vado.users (secret_hash, nickname)
    values (sha256(convert_to(p_secret, 'UTF8')), v_name)
    on conflict (secret_hash) do update set nickname = excluded.nickname, seen_at = now()
    returning id into v_id;
  return json_build_object('id', v_id, 'nickname', v_name);
end $$;

create or replace function public.vado_me(p_secret text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  return (select json_build_object('id', u.id, 'nickname', u.nickname) from vado.users u where u.id = v_user);
end $$;

-- Riceve i tragitti con punti non ancora inviati. Quelli già presenti vengono
-- ignorati, quindi rimandare lo stesso elenco non fa danni.
create or replace function public.vado_push_scores(p_secret text, p_scores jsonb) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
  v_saved integer;
begin
  if p_scores is null or jsonb_typeof(p_scores) <> 'array' or jsonb_array_length(p_scores) > 500 then
    raise exception 'dati-non-validi';
  end if;
  insert into vado.scores (user_id, trip_id, ended_at, points, mode)
    select v_user, left(s ->> 'id', 40), (s ->> 'at')::timestamptz, (s ->> 'points')::integer, left(s ->> 'mode', 12)
    from jsonb_array_elements(p_scores) s
    where coalesce(s ->> 'id', '') <> ''
      -- Un tragitto vale al massimo 60 punti più 10 di bonus.
      and (s ->> 'points')::integer between 1 and 70
      -- Niente tragitti nel futuro, né più vecchi di due mesi.
      and (s ->> 'at')::timestamptz <= now() + interval '10 minutes'
      and (s ->> 'at')::timestamptz >= now() - interval '60 days'
    on conflict (user_id, trip_id) do nothing;
  get diagnostics v_saved = row_count;
  delete from vado.scores where user_id = v_user and ended_at < now() - interval '70 days';
  return json_build_object('saved', v_saved);
end $$;

create or replace function public.vado_leagues(p_secret text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  return (
    select coalesce(json_agg(json_build_object('id', l.id, 'name', l.name, 'code', l.code) order by m.joined_at), '[]'::json)
    from vado.members m join vado.leagues l on l.id = m.league_id
    where m.user_id = v_user
  );
end $$;

-- Classifica di una lega: punti di ogni partecipante tra p_from e p_to, e
-- quelli che aveva all'istante p_before (per la freccia su/giù).
create or replace function public.vado_board(p_secret text, p_league uuid, p_from timestamptz, p_to timestamptz, p_before timestamptz) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
  v_league vado.leagues;
begin
  select l.* into v_league
    from vado.leagues l join vado.members m on m.league_id = l.id
    where l.id = p_league and m.user_id = v_user;
  if not found then
    return null;
  end if;
  return json_build_object(
    'id', v_league.id,
    'name', v_league.name,
    'code', v_league.code,
    'entries', (
      select coalesce(json_agg(json_build_object(
        'id', u.id,
        'name', u.nickname,
        'me', u.id = v_user,
        'points', coalesce((select sum(s.points) from vado.scores s
          where s.user_id = u.id and s.ended_at >= p_from and s.ended_at < p_to), 0),
        'before', coalesce((select sum(s.points) from vado.scores s
          where s.user_id = u.id and s.ended_at >= p_from and s.ended_at < p_before), 0),
        'mode', (select s.mode from vado.scores s
          where s.user_id = u.id and s.ended_at >= p_from and s.ended_at < p_to
          group by s.mode order by sum(s.points) desc, s.mode limit 1)
      ) order by m.joined_at), '[]'::json)
      from vado.members m join vado.users u on u.id = m.user_id
      where m.league_id = v_league.id
    )
  );
end $$;

create or replace function public.vado_create_league(p_secret text, p_name text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
  v_name text := vado.clean(p_name, 2, 24);
  -- Lettere e cifre che non si confondono leggendole ad alta voce (niente O/0, I/1).
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_id uuid;
begin
  if (select count(*) from vado.members where user_id = v_user) >= 8 then
    raise exception 'troppe-leghe';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * 32)::integer, 1);
    end loop;
    begin
      insert into vado.leagues (name, code, owner) values (v_name, v_code, v_user) returning id into v_id;
      exit;
    exception when unique_violation then
      -- Codice già usato da un'altra lega: se ne estrae un altro.
      null;
    end;
  end loop;
  insert into vado.members (league_id, user_id) values (v_id, v_user);
  return json_build_object('id', v_id, 'name', v_name, 'code', v_code);
end $$;

create or replace function public.vado_join_league(p_secret text, p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
  v_league vado.leagues;
begin
  select l.* into v_league from vado.leagues l
    where l.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if not found then
    raise exception 'lega-inesistente';
  end if;
  if exists (select 1 from vado.members where league_id = v_league.id and user_id = v_user) then
    raise exception 'gia-dentro';
  end if;
  if (select count(*) from vado.members where user_id = v_user) >= 8 then
    raise exception 'troppe-leghe';
  end if;
  if (select count(*) from vado.members where league_id = v_league.id) >= 50 then
    raise exception 'lega-piena';
  end if;
  insert into vado.members (league_id, user_id) values (v_league.id, v_user);
  return json_build_object('id', v_league.id, 'name', v_league.name, 'code', v_league.code);
end $$;

-- Uscendo dall'ultima persona la lega viene cancellata.
create or replace function public.vado_leave_league(p_secret text, p_league uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  delete from vado.members where league_id = p_league and user_id = v_user;
  delete from vado.leagues l where l.id = p_league
    and not exists (select 1 from vado.members m where m.league_id = l.id);
  return json_build_object('ok', true);
end $$;

-- Chi si può sfidare: i compagni delle proprie leghe.
create or replace function public.vado_rivals(p_secret text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  return (
    select coalesce(json_agg(json_build_object('id', x.id, 'name', x.nickname) order by x.nickname, x.id), '[]'::json)
    from (
      select distinct u.id, u.nickname
      from vado.members mine
      join vado.members other on other.league_id = mine.league_id and other.user_id <> mine.user_id
      join vado.users u on u.id = other.user_id
      where mine.user_id = v_user
    ) x
  );
end $$;

-- Le sfide a cui si partecipa: quelle in corso e quelle finite da meno di 30 giorni.
create or replace function public.vado_challenges(p_secret text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  return (
    select coalesce(json_agg(vado.challenge_json(c.id, v_user) order by c.starts_at desc), '[]'::json)
    from vado.challenges c join vado.challengers p on p.challenge_id = c.id
    where p.user_id = v_user and c.ends_at > now() - interval '30 days'
  );
end $$;

create or replace function public.vado_create_challenge(p_secret text, p_title text, p_kind text, p_target integer, p_days integer, p_teams boolean, p_opponents uuid[]) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
  v_title text := vado.clean(p_title, 2, 40);
  v_others uuid[];
  v_id uuid;
begin
  if p_kind not in ('traguardo', 'tempo') then
    raise exception 'dati-non-validi';
  end if;
  -- Avversari senza doppioni e senza chi crea la sfida, nell'ordine ricevuto.
  select coalesce(array_agg(x.id order by x.first), '{}') into v_others
    from (select o.id, min(o.ord) as first
      from unnest(coalesce(p_opponents, '{}')) with ordinality as o(id, ord)
      where o.id <> v_user group by o.id) x;
  if cardinality(v_others) < 1 or cardinality(v_others) > 9 then
    raise exception 'avversari-non-validi';
  end if;
  if coalesce(p_teams, false) and cardinality(v_others) < 3 then
    raise exception 'squadre-troppo-piccole';
  end if;
  -- Si possono sfidare solo i compagni di lega.
  if exists (select 1 from unnest(v_others) as o(id) where not vado.mates(v_user, o.id)) then
    raise exception 'avversari-non-validi';
  end if;
  if p_kind = 'traguardo' and coalesce(p_target, 0) not between 1 and 5000 then
    raise exception 'dati-non-validi';
  end if;
  if p_kind = 'tempo' and coalesce(p_days, 0) not between 1 and 30 then
    raise exception 'dati-non-validi';
  end if;
  if (select count(*) from vado.challengers p join vado.challenges c on c.id = p.challenge_id
      where p.user_id = v_user and c.ends_at > now()) >= 12 then
    raise exception 'troppe-sfide';
  end if;

  insert into vado.challenges (title, kind, target, ends_at, teams, owner)
    values (
      v_title,
      p_kind,
      case when p_kind = 'traguardo' then p_target else 0 end,
      -- Una sfida a traguardo non resta aperta per sempre: 30 giorni.
      now() + make_interval(days => case when p_kind = 'tempo' then p_days else 30 end),
      coalesce(p_teams, false),
      v_user
    )
    returning id into v_id;
  insert into vado.challengers (challenge_id, user_id, team, seat) values (v_id, v_user, 0, 0);
  -- Squadre alternate, con chi crea la sfida nella prima.
  insert into vado.challengers (challenge_id, user_id, team, seat)
    select v_id, o.id, case when o.ord % 2 = 1 then 1 else 0 end, o.ord
    from unnest(v_others) with ordinality as o(id, ord);
  return vado.challenge_json(v_id, v_user);
end $$;

-- Chi ha creato la sfida la cancella per tutti; gli altri ne escono.
create or replace function public.vado_remove_challenge(p_secret text, p_challenge uuid) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  if exists (select 1 from vado.challenges where id = p_challenge and owner = v_user) then
    delete from vado.challenges where id = p_challenge;
  else
    delete from vado.challengers where challenge_id = p_challenge and user_id = v_user;
    delete from vado.challenges c where c.id = p_challenge
      and (select count(*) from vado.challengers p where p.challenge_id = c.id) < 2;
  end if;
  return json_build_object('ok', true);
end $$;

-- Sfida del mese: i propri punti, e quante persone tra quelle attive nel mese
-- hanno già raggiunto il traguardo.
create or replace function public.vado_monthly(p_secret text, p_from timestamptz, p_to timestamptz, p_target integer) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  return (
    select json_build_object(
      'points', coalesce((select sum(s.points) from vado.scores s
        where s.user_id = v_user and s.ended_at >= p_from and s.ended_at < p_to), 0),
      'people', greatest(1, (select count(*) from (
        select s.user_id from vado.scores s where s.ended_at >= p_from and s.ended_at < p_to group by s.user_id) a)),
      'reached', (select count(*) from (
        select s.user_id from vado.scores s where s.ended_at >= p_from and s.ended_at < p_to
        group by s.user_id having sum(s.points) >= p_target) b)
    )
  );
end $$;

-- Cancella il profilo e tutto ciò che gli appartiene.
create or replace function public.vado_delete_account(p_secret text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := vado.who(p_secret);
begin
  delete from vado.challenges where owner = v_user;
  delete from vado.users where id = v_user;
  delete from vado.leagues l where not exists (select 1 from vado.members m where m.league_id = l.id);
  delete from vado.challenges c where (select count(*) from vado.challengers p where p.challenge_id = c.id) < 2;
  return json_build_object('ok', true);
end $$;

-- ------------------------------------------------------------- permessi

-- Le funzioni interne non si chiamano da fuori; quelle dell'app sì, anche
-- senza accesso (l'app non ha utenti registrati: riconosce il telefono dalla
-- chiave segreta).
do $$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure from pg_catalog.pg_proc p
    where p.pronamespace = 'vado'::regnamespace
  loop
    execute format('revoke all on function %s from public', v_function);
  end loop;
  for v_function in
    select p.oid::regprocedure from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'vado\_%'
  loop
    execute format('revoke all on function %s from public', v_function);
    execute format('grant execute on function %s to anon, authenticated', v_function);
  end loop;
end $$;

-- Fa rileggere subito le funzioni nuove al servizio che le espone.
notify pgrst, 'reload schema';
