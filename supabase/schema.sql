-- CCK 보안포털 Supabase 스키마 v0.5 (활동 기반 구조)
create type role_t as enum ('employee','security','admin');
create type req_type_t as enum ('account','permission','pi_register','subject_request','incident','breach','other');
create type req_status_t as enum ('received','in_progress','done','rejected');
create type src_t as enum ('portal','gws','github','slack','jira','netlify','manual');
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
alter type src_t add value 'ctas';
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

-- RLS 보강: 정보보호부문(security·admin)만 운영 테이블 접근, 스케줄 함수는 service key로 RLS 우회
create or replace function is_security() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('security','admin'))
$$;
alter table findings enable row level security;
alter table activity_occurrences enable row level security;
alter table notifications enable row level security;
alter table change_log enable row level security;
create policy sec_all on findings for all using (is_security()) with check (is_security());
create policy sec_all on activity_occurrences for all using (is_security()) with check (is_security());
create policy sec_read on notifications for select using (is_security());
create policy sec_read on change_log for select using (is_security());
create policy sec_all on evidences for all using (is_security()) with check (is_security());
create policy sec_read on threat_intel for select using (is_security());
create policy sec_read on threat_alerts for select using (is_security());

