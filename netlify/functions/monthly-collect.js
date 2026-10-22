// monthly-collect — 매월 1일 09:00 KST
// Google Workspace·GitHub·Slack 계정·권한·자산 스냅샷을 Supabase Storage에 원본 JSON으로 저장하고,
// 활동별 증빙(evidences) 행과 Slack 요약을 남긴다. 기간(period)은 막 끝난 달.
//   GWS    → L01 계정 목록, L03 관리자 권한, L04 2단계 인증 미등록
//   GitHub → L01 저장소, L03 멤버·외부 협업자, L04 관리자·2FA 미설정, T01 Dependabot
//   Slack  → L03 관리자·게스트·비활성 계정
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, EVIDENCE_BUCKET(기본 evidence), SLACK_BOT_TOKEN, SLACK_CHANNEL_ID,
//          GOOGLE_SA_JSON + GOOGLE_ADMIN_SUBJECT (admin.directory.user.readonly 위임), GITHUB_TOKEN + GITHUB_ORG
import { db, json, must, changeLog, slack, slackPaged, hasGoogle, googleToken, ghAll } from "../lib/clients.js";
import { kstToday, prevMonth, summarizeGws, summarizeGithub, summarizeSlack } from "../lib/ops.js";

async function gws() {
  const token = await googleToken(["https://www.googleapis.com/auth/admin.directory.user.readonly"]);
  const users = []; let page = "";
  do {
    const r = await fetch(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&projection=basic${page ? `&pageToken=${page}` : ""}`, { headers: { authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`admin sdk ${r.status}`);
    const j = await r.json();
    users.push(...(j.users || []).map((u) => ({ primaryEmail: u.primaryEmail, isAdmin: u.isAdmin, isDelegatedAdmin: u.isDelegatedAdmin, isEnrolledIn2Sv: u.isEnrolledIn2Sv, isEnforcedIn2Sv: u.isEnforcedIn2Sv, suspended: u.suspended, archived: u.archived, lastLoginTime: u.lastLoginTime, creationTime: u.creationTime, orgUnitPath: u.orgUnitPath })));
    page = j.nextPageToken || "";
  } while (page);
  return users;
}

async function github(org) {
  const [members, admins, outside, repos] = await Promise.all([
    ghAll(`/orgs/${org}/members`), ghAll(`/orgs/${org}/members?role=admin`), ghAll(`/orgs/${org}/outside_collaborators`), ghAll(`/orgs/${org}/repos?type=all`),
  ]);
  // 2FA 필터·Dependabot은 조직 소유자 권한이 필요하다 — 권한이 없으면 null/빈 값으로 둔다
  const no2fa = await ghAll(`/orgs/${org}/members?filter=2fa_disabled`).catch(() => null);
  const alerts = await ghAll(`/orgs/${org}/dependabot/alerts?state=open`).catch(() => []);
  const slim = (l) => l.map((m) => ({ login: m.login }));
  return { members: slim(members), admins: slim(admins), outside: slim(outside), no2fa: no2fa && slim(no2fa), repos: repos.map((r) => ({ name: r.name, private: r.private, visibility: r.visibility, archived: r.archived, pushed_at: r.pushed_at })), alerts: alerts.map((a) => ({ severity: a.security_advisory?.severity, package: a.dependency?.package?.name, repo: a.repository?.name, created_at: a.created_at })) };
}

async function slackUsers() {
  return (await slackPaged("users.list", "members")).map((m) => ({ id: m.id, name: m.name, deleted: m.deleted, is_bot: m.is_bot, is_admin: m.is_admin, is_owner: m.is_owner, is_restricted: m.is_restricted, is_ultra_restricted: m.is_ultra_restricted, ...("has_2fa" in m ? { has_2fa: m.has_2fa } : {}) }));
}

const n = (v) => (v === null ? "확인 불가(권한)" : Array.isArray(v) ? `${v.length}` : v);

export default async () => {
  const sb = db();
  if (!sb) return json({ ok: false, error: "SUPABASE_URL/SUPABASE_SERVICE_KEY 없음" }, 500);
  const today = kstToday();
  const period = prevMonth(today);
  const bucket = process.env.EVIDENCE_BUCKET || "evidence";
  const done = {}, lines = [], evid = [];

  const collectors = [
    ["gws", hasGoogle() && process.env.GOOGLE_ADMIN_SUBJECT, async () => {
      const raw = await gws(); const s = summarizeGws(raw, today);
      lines.push(`*Google Workspace* 활성 ${s.active} · 관리자 ${s.admins.length} · 2단계 인증 미등록 ${s.no2sv.length} · 90일 미접속 ${s.inactive90.length} · 미로그인 ${s.neverLogin.length}`);
      evid.push(["L01", `GWS 계정 목록 ${s.total}건`], ["L03", `GWS 관리자 ${s.admins.length}명 · 90일 미접속 ${s.inactive90.length}명`], ["L04", `GWS 2단계 인증 미등록 ${s.no2sv.length}명`]);
      return { raw, summary: s };
    }],
    ["github", process.env.GITHUB_TOKEN && process.env.GITHUB_ORG, async () => {
      const raw = await github(process.env.GITHUB_ORG); const s = summarizeGithub(raw);
      lines.push(`*GitHub* 멤버 ${s.members} · 관리자 ${s.admins.length} · 외부 협업자 ${s.outside.length} · 2FA 미설정 ${n(s.no2fa)} · 공개 저장소 ${s.publicRepos.length} · Dependabot ${s.dependabot.open}건 (critical ${s.dependabot.critical || 0}, high ${s.dependabot.high || 0})`);
      evid.push(["L01", `GitHub 저장소 ${s.repos}개 (공개 ${s.publicRepos.length})`], ["L03", `GitHub 멤버 ${s.members} · 외부 협업자 ${s.outside.length}`], ["L04", `GitHub 관리자 ${s.admins.length} · 2FA 미설정 ${n(s.no2fa)}`], ["T01", `Dependabot 미조치 ${s.dependabot.open}건`]);
      return { raw, summary: s };
    }],
    ["slack", process.env.SLACK_BOT_TOKEN, async () => {
      const raw = await slackUsers(); const s = summarizeSlack(raw);
      lines.push(`*Slack* 활성 ${s.active} · 관리자 ${s.admins.length} · 게스트 ${s.guests.length} · 비활성 ${s.deactivated} · 2FA 미설정 ${n(s.no2fa)}`);
      evid.push(["L03", `Slack 관리자 ${s.admins.length} · 게스트 ${s.guests.length} · 비활성 ${s.deactivated}`]);
      return { raw, summary: s };
    }],
  ];

  for (const [src, ready, run] of collectors) {
    if (!ready) { done[src] = { skipped: "환경변수 없음" }; continue; }
    try {
      const before = evid.length;
      const out = await run();
      const path = `${period}/${src}.json`;
      must(await sb.storage.from(bucket).upload(path, JSON.stringify({ collected_at: new Date().toISOString(), period, ...out }, null, 2), { contentType: "application/json", upsert: true }));
      const rows = evid.slice(before).map(([activity_code, title]) => ({ activity_code, source: src, title, period, storage_path: `${bucket}/${path}` }));
      must(await sb.from("evidences").insert(rows));
      done[src] = { ok: true, path, evidences: rows.length, summary: out.summary };
    } catch (e) {
      done[src] = { ok: false, error: String(e.message || e) };
      lines.push(`*${src}* 수집 실패 — ${e.message || e}`);
    }
  }

  await changeLog(sb, Object.entries(done).filter(([, v]) => v.ok).map(([src, v]) => ({ target_table: "evidences", target_id: v.path, action: "monthly_collect", after: { period, source: src, evidences: v.evidences } })));
  const slackRes = lines.length ? await slack(`*월간 증빙 수집 ${period}*\n\n${lines.join("\n")}\n\n원본: Storage ${bucket}/${period}/ · L03 분기 권한 검토 때 이 스냅샷을 대조하세요.`) : { skipped: "수집 대상 없음" };
  return json({ ok: true, period, sources: done, slack: slackRes });
};
