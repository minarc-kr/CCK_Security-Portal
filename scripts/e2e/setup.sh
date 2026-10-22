#!/usr/bin/env bash
# 로컬에서 운영(DB) 모드를 띄운다: PostgreSQL 16 + PostgREST + 게이트웨이(:54321) + DB 모드 미리보기(:4174)
#   bash scripts/e2e/setup.sh        전체 기동 (처음 1회)
#   bash scripts/e2e/setup.sh reset  DB만 초기화 (schema.sql → seed.sql → 테스트 계정 3명)
# 필요: /usr/lib/postgresql/16/bin, curl. 클라우드 세션은 root라 nobody 계정으로 postgres를 돌린다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
W="${E2E_WORK:-/var/tmp/cck-e2e}"; PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
P="psql -h $W -p 55432 -U postgres -v ON_ERROR_STOP=1 -q"
asdb() { if [ "$(id -u)" = 0 ]; then su nobody -s /bin/sh -c "$*"; else sh -c "$*"; fi; }

reset_db() {
  kill $(pgrep -x postgrest) 2>/dev/null || true; sleep 1
  $P -c "drop database if exists portal" -c "create database portal"
  $P -d portal -f "$HERE/supabase-stub.sql"
  $P -d portal --single-transaction -f "$REPO/supabase/schema.sql"
  $P -d portal -f "$REPO/supabase/seed.sql"
  $P -d portal <<'SQL'
update portal_settings set value = 'cck.test';
insert into auth.users values ('00000000-0000-0000-0000-00000000000a','sec@cck.test','{"full_name":"이정민"}'),
                              ('00000000-0000-0000-0000-00000000000b','dev@cck.test','{"full_name":"김개발"}'),
                              ('00000000-0000-0000-0000-00000000000c','infra@cck.test','{"full_name":"박인프라"}');
update profiles set role = 'security' where email in ('sec@cck.test','infra@cck.test');
SQL
  (setsid "$W/postgrest" "$HERE/postgrest.conf" > "$W/postgrest.log" 2>&1 &); sleep 2
  tail -1 "$W/postgrest.log"
}

if [ "${1:-}" = reset ]; then reset_db; exit; fi

mkdir -p "$W"; [ "$(id -u)" = 0 ] && chown nobody "$W"
if [ ! -d "$W/data" ]; then asdb "$PGBIN/initdb -D $W/data -U postgres >/dev/null"; fi
asdb "$PGBIN/pg_ctl -D $W/data -o '-k $W -p 55432 -c listen_addresses=localhost' -l $W/pg.log start" || true; sleep 2
$P -c "do \$\$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create role authenticator login password 'pw' noinherit; grant anon, authenticated, service_role to authenticator;
  end if; end \$\$"
if [ ! -x "$W/postgrest" ]; then
  curl -sSL -o "$W/pgrst.tar.xz" https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz
  tar xJf "$W/pgrst.tar.xz" -C "$W"
fi
reset_db
(setsid node "$HERE/gateway.mjs" > "$W/gateway.log" 2>&1 &)
ANON=$(cd "$HERE" && node -e 'import("./jwt.mjs").then((m) => console.log(m.sign({ role: "anon", exp: 4102444800 })))')
cd "$REPO" && VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=$ANON npx vite build --outDir "$W/dist-db" >/dev/null
(setsid npx vite preview --outDir "$W/dist-db" --port 4174 > "$W/preview.log" 2>&1 &); sleep 3
echo "DB 모드 미리보기: http://localhost:4174  (로그인은 db-mode.mjs처럼 localStorage에 세션을 넣어 흉내 낸다)"
