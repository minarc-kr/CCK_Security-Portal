-- CCK 보안포털 Supabase 스키마 v0.6 (활동 기반 구조)
-- 적용: Supabase SQL Editor에서 schema.sql → seed.sql 순서로 실행
create type role_t as enum ('employee','security','admin');
create type req_type_t as enum ('account','permission','pi_register','subject_request','incident','breach','trade_leak','other');
create type req_status_t as enum ('received','in_progress','done','rejected');
create type src_t as enum ('portal','gws','github','slack','jira','netlify','manual','ctas');
create type act_status_t as enum ('ok','warn','gap','na');

create table profiles (
  id uuid primary key references auth.users(id),
  email text unique not null, name text not null, dept text,
  role role_t not null default 'employee', created_at timestamptz default now()
);

-- 보안 영역(상위 메뉴 10개) ----------------------------------------------
create table domains (
  code text primary key,          -- D01..D10
  name text not null,             -- 보안조직·거버넌스 등
  sort int
);

-- 보안 활동(인증이 요구하는 활동 단위) --------------------------------------
create table activities (
  code text primary key,          -- G01, C01, L01 ...
  domain_code text references domains(code),
  title text not null,
  description text,
  cycle text,                     -- 상시/월/분기/반기/연
  owner uuid references profiles(id),
  auto_sources src_t[],           -- 자동 수집 소스
  status act_status_t default 'gap',
  next_due date
);
-- 활동 ↔ 인증 기준 항목 매핑 (활동 1개 : 기준 항목 N개)
create table activity_mappings (
  activity_code text references activities(code),
  standard text not null,         -- ISO27001 / ISO42001 / SOC2 / CSAP / PIPA / TRADE(부경법·산업기술보호법)
  clause text not null,
  primary key (activity_code, standard, clause)
);
-- 활동 수행 이력 (한 번 수행 = 1행, 증빙 연결)
create table activity_runs (
  id uuid primary key default gen_random_uuid(),
  activity_code text references activities(code),
  period text,                    -- 2026-Q3, 2026-09
  performed_by uuid references profiles(id),
  performed_at timestamptz default now(),
  result text, note text
);
create table evidences (
  id uuid primary key default gen_random_uuid(),
  activity_code text references activities(code),
  run_id uuid references activity_runs(id),
  source src_t not null,
  title text not null,
  storage_path text,              -- Supabase Storage
  period text,
  collected_at timestamptz default now(),
  collected_by uuid references profiles(id)
);

-- 공통 기능: 정책, 요청함 ------------------------------------------------
create table policies (
  id uuid primary key default gen_random_uuid(),
  code text not null, title text not null, category text,
  version text not null, body text, published_at date, is_current boolean default true,
  activity_code text references activities(code)   -- 보통 G01
);
create table policy_reads (
  policy_id uuid references policies(id), user_id uuid references profiles(id),
  read_at timestamptz default now(), primary key (policy_id, user_id, read_at)
);
create table requests (
  id uuid primary key default gen_random_uuid(),
  type req_type_t not null, title text not null, detail text,
  requester uuid references profiles(id), assignee uuid references profiles(id),
  status req_status_t default 'received',
  activity_code text references activities(code),  -- 처리 완료 시 증빙이 붙는 활동
  deadline timestamptz,                             -- 유출 신고 72시간 등
  created_at timestamptz default now(), closed_at timestamptz
);
create table request_logs (
  id bigserial primary key, request_id uuid references requests(id),
  actor uuid references profiles(id), action text, note text, at timestamptz default now()
);

-- 영역별 대장 -----------------------------------------------------------
create table assets (id uuid primary key default gen_random_uuid(), name text, kind text, owner uuid, classification text, source src_t, external_id text, last_seen timestamptz);
create table vulnerabilities (id uuid primary key default gen_random_uuid(), asset_id uuid references assets(id), severity text, title text, source src_t, found_at timestamptz, fixed_at timestamptz);
create table ai_systems (id uuid primary key default gen_random_uuid(), name text, purpose text, model_provider text, data_types text[], lifecycle_stage text, owner uuid, impact_assessed_at date);
create table pi_inventory (id uuid primary key default gen_random_uuid(), process_name text, items text[], purpose text, legal_basis text, retention text, system text, owner uuid);
create table pi_transfers (id uuid primary key default gen_random_uuid(), kind text, counterparty text, items text[], purpose text, contract_at date, reviewed_at date);
create table trade_secrets (id uuid primary key default gen_random_uuid(), name text, grade text, owner uuid, custodians uuid[], nda_ref text, designated_at date);
create table trainings (id uuid primary key default gen_random_uuid(), title text, kind text, held_on date, due_on date, activity_code text references activities(code));
create table training_results (training_id uuid references trainings(id), user_id uuid references profiles(id), completed_at timestamptz, result text, primary key (training_id, user_id));
create table audits (id uuid primary key default gen_random_uuid(), kind text, title text, standard text, planned_on date, done_on date, report_path text);
create table findings (id uuid primary key default gen_random_uuid(), audit_id uuid references audits(id), activity_code text references activities(code), severity text, title text, due_on date, closed_at timestamptz);

alter table profiles enable row level security;
alter table requests enable row level security;
alter table evidences enable row level security;

-- v0.3 추가: 외부 연결·일정·알림·변경이력 ---------------------------------
alter table activities
  add column drive_folder_id text,
  add column slack_channel_id text,
  add column cycle_month int[];          -- 연/반기 활동의 수행 월 (예: {12}, {6,12})
alter table evidences
  add column drive_file_id text,         -- 원본은 Drive, 포털은 링크·메타만
  add column slack_permalink text;

create type occ_status_t as enum ('planned','in_progress','done','delayed');
create table activity_occurrences (      -- 주기 활동의 회차 (12개월치 자동 생성)
  id uuid primary key default gen_random_uuid(),
  activity_code text references activities(code),
  period text not null,                  -- 2026-09 / 2026-Q4 / 2026-H2 / 2026
  start_on date not null,
  due_on date not null,
  status occ_status_t default 'planned', -- 기한 경과+미완료는 스케줄러가 delayed로 전환
  assignee uuid references profiles(id),
  gcal_event_id text,                    -- '보안활동' 전용 캘린더 이벤트
  run_id uuid references activity_runs(id),
  done_at timestamptz,
  unique (activity_code, period)
);
create type notif_kind_t as enum ('d7','d1','due','delayed_daily');
create table notifications (
  id bigserial primary key,
  occurrence_id uuid references activity_occurrences(id),
  kind notif_kind_t not null,
  channel text,                          -- slack_dm / slack_channel / gcal
  sent_at timestamptz default now()
);
create type actor_t as enum ('user','claude','scheduler');
create table change_log (                -- 누가(사람/Claude/스케줄러) 무엇을 바꿨는지
  id bigserial primary key,
  actor actor_t not null,
  actor_id uuid,
  target_table text, target_id text,
  action text, before jsonb, after jsonb,
  at timestamptz default now()
);

-- v0.4 추가: KISA C-TAS 위협정보 (사내 적용 전용, 외부 재배포 금지) ----------
create type ioc_kind_t as enum ('ip','domain','url','hash','email','cve');
create table threat_intel (
  id bigserial primary key,
  kind ioc_kind_t not null,
  value text not null,
  category text,                 -- 파밍/피싱/공격시도/C&C/유포지/악성코드
  tlp text,                      -- TLP:CLEAR/GREEN/AMBER/RED — AMBER 이상 외부 공유 금지
  source src_t default 'ctas',
  received_via text,             -- api / email / manual
  received_at timestamptz default now(),
  expires_at timestamptz,
  applied_to text[],             -- 반영한 장비: fw / ids / edr / mail
  applied_at timestamptz,
  last_seen_at timestamptz default now(),   -- 피드에 마지막으로 나온 시각 (ctas-sync가 갱신)
  unique (kind, value)
);
create table threat_alerts (     -- C-TAS 실시간 상황전파(이메일·알림톡) 수신 이력 → T05 연계
  id uuid primary key default gen_random_uuid(),
  title text, body text, severity text,
  received_via text, received_at timestamptz default now(),
  request_id uuid references requests(id)
);
-- 접근 통제: threat_intel/threat_alerts는 security·admin만 조회, 고객사·외부 API 노출 금지
alter table threat_intel enable row level security;
alter table threat_alerts enable row level security;

-- v0.5 추가: 운영 자동화·감사 대응 -------------------------------------------
-- 같은 회차에 같은 종류 알림을 두 번 보내지 않는다 (daily-brief)
alter table notifications add constraint notifications_once unique (occurrence_id, kind);

-- 지적사항·시정조치 추적 (U04) — 포털 '지적사항' 화면과 같은 필드
create type finding_status_t as enum ('received','in_progress','verifying','closed');
alter table findings
  add column source text,                -- 외부 심사 / 내부감사 / 자체점검 / 사고 후속
  add column standard text,              -- ISMSP / ISO27001 / CSAP ...
  add column clause text,
  add column owner uuid references profiles(id),
  add column status finding_status_t default 'received',
  add column root_cause text,
  add column corrective_action text,
  add column verified_by uuid references profiles(id),   -- 조치 담당자와 달라야 한다 (G08 직무 분리)
  add column opened_on date default current_date,
  add constraint findings_verifier_differs check (verified_by is null or owner is null or verified_by <> owner);

-- 증빙 원본: Storage 버킷 'evidence' (비공개). monthly-collect가 {YYYY-MM}/{gws|github|slack}.json 저장
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false) on conflict (id) do nothing;

-- v0.6 추가: 포털 DB 연결 (로그인·역할·감사로그·RLS) ----------------------------
create table portal_settings (key text primary key, value text not null);
-- Google SSO 허용 도메인 — 설치 후 회사 도메인으로 바꾼다 (다른 도메인 계정은 가입 자체가 거부됨)
insert into portal_settings values ('allowed_domain', 'example.com');

alter table evidences add column url text, add column note text;
alter table activity_runs add column performed_on date default current_date;
alter table findings add column ref text unique, add column history jsonb not null default '[]';
alter table requests add column channel text default '포털';

-- 작성자 컬럼은 로그인 사용자로 기본값 (클라이언트가 다른 사람 이름으로 쓰지 못하게 RLS와 함께 사용)
alter table requests alter column requester set default auth.uid();
alter table request_logs alter column actor set default auth.uid();
alter table activity_runs alter column performed_by set default auth.uid();
alter table evidences alter column collected_by set default auth.uid();
alter table policy_reads alter column user_id set default auth.uid();

-- 활동별 채택 방법 (요구 방법 패널)
create table method_choices (
  activity_code text primary key references activities(code),
  chosen int[] not null default '{}',
  memo text,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

-- 행위기반 감사로그 — 누가·언제·무엇을·어떻게·왜. 작성자·시각은 서버가 채우고 수정·삭제 경로가 없다 (L06 증빙)
create table audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid references profiles(id),
  who text,
  action text not null, target text, how text, before text, after text, why text, note text
);
create function audit_stamp() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.at := now();
  new.user_id := auth.uid();
  new.who := (select name from profiles where id = auth.uid());
  return new;
end $$;
create trigger audit_stamp before insert on audit_log for each row execute function audit_stamp();

-- 요청 기한은 서버가 계산한다: 유출 72시간(34조), 정보주체 요청 10일(35~37조)
create function request_deadline() returns trigger language plpgsql as $$
begin
  new.created_at := coalesce(new.created_at, now());
  if new.type = 'breach' then new.deadline := new.created_at + interval '72 hours';
  elsif new.type = 'subject_request' then new.deadline := new.created_at + interval '10 days';
  end if;
  return new;
end $$;
create trigger request_deadline before insert on requests for each row execute function request_deadline();

-- Google 로그인 첫 접속 시 프로필 생성 (기본 역할 employee — 역할 상향은 admin만)
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare dom text := (select value from portal_settings where key = 'allowed_domain');
begin
  if dom is not null and lower(split_part(new.email, '@', 2)) <> lower(dom) then
    raise exception '허용되지 않은 도메인입니다: %', new.email;
  end if;
  insert into profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- RLS ---------------------------------------------------------------------------
-- public 스키마의 모든 테이블에 RLS를 켠다. 정책이 없는 테이블은 anon·authenticated 모두 접근 불가.
-- 스케줄 함수는 service key로 RLS를 우회한다.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create function has_role(variadic roles role_t[]) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = any(roles))
$$;
create function is_security() returns boolean language sql stable security definer set search_path = public as $$
  select has_role('security', 'admin')
$$;

-- 기준 데이터: 로그인 사용자 읽기, 정보보호부문 쓰기
do $$ declare t text; begin
  foreach t in array array['domains','activities','activity_mappings','policies'] loop
    execute format('create policy read_all on public.%I for select to authenticated using (true)', t);
    execute format('create policy sec_write on public.%I for all to authenticated using (is_security()) with check (is_security())', t);
  end loop;
end $$;

-- 운영 데이터: 정보보호부문 전용 (개인정보 대장·영업비밀 대장 포함)
do $$ declare t text; begin
  foreach t in array array['activity_runs','evidences','method_choices','findings','activity_occurrences','audits',
                           'assets','vulnerabilities','ai_systems','pi_inventory','pi_transfers','trade_secrets','trainings'] loop
    execute format('create policy sec_all on public.%I for all to authenticated using (is_security()) with check (is_security())', t);
  end loop;
  foreach t in array array['notifications','change_log','threat_intel','threat_alerts'] loop
    execute format('create policy sec_read on public.%I for select to authenticated using (is_security())', t);
  end loop;
end $$;

-- 프로필: 본인·정보보호부문 조회, 역할 변경은 admin만
create policy self_read on profiles for select to authenticated using (id = auth.uid() or is_security());
create policy admin_update on profiles for update to authenticated using (has_role('admin')) with check (has_role('admin'));
create policy admin_only on portal_settings for all to authenticated using (has_role('admin')) with check (has_role('admin'));

-- 요청·신고: 본인 접수·조회, 처리는 정보보호부문
create policy own_insert on requests for insert to authenticated with check (requester = auth.uid() and status = 'received');
create policy own_read on requests for select to authenticated using (requester = auth.uid() or is_security());
create policy sec_update on requests for update to authenticated using (is_security()) with check (is_security());
create policy log_read on request_logs for select to authenticated
  using (is_security() or exists (select 1 from requests r where r.id = request_id and r.requester = auth.uid()));
create policy log_insert on request_logs for insert to authenticated with check (actor = auth.uid() and
  (is_security() or exists (select 1 from requests r where r.id = request_id and r.requester = auth.uid())));

-- 정책 열람 확인·교육 결과: 본인 기록, 정보보호부문 조회
create policy own_insert on policy_reads for insert to authenticated with check (user_id = auth.uid());
create policy own_read on policy_reads for select to authenticated using (user_id = auth.uid() or is_security());
create policy own_read on training_results for select to authenticated using (user_id = auth.uid() or is_security());
create policy sec_write on training_results for all to authenticated using (is_security()) with check (is_security());

-- 감사로그: 누구나 남기고(작성자는 트리거가 고정), 조회는 정보보호부문만, 수정·삭제 정책 없음
create policy any_insert on audit_log for insert to authenticated with check (true);
create policy sec_read on audit_log for select to authenticated using (is_security());
