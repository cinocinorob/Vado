-- Solo per le prove automatiche: su un database vuoto crea i ruoli che
-- Supabase ha già, così supabase/schema.sql si può applicare tale e quale.
-- NON va incollato nel pannello di Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create role authenticator login password 'prova' noinherit;
grant anon, authenticated to authenticator;
grant usage on schema public to anon, authenticated;
