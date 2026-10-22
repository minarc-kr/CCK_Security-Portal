-- Supabase가 제공하는 auth·storage 스키마와 권한을 로컬 PostgreSQL에 흉내 낸다 (setup.sh가 schema.sql 전에 적용)
-- 역할(anon·authenticated·service_role·authenticator)은 클러스터 단위라 setup.sh가 따로 만든다
create schema auth;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean);
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated;
