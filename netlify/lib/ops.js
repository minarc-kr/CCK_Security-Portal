/* 운영 자동화 공통 로직 — 스케줄 함수가 함께 쓰는 순수 함수 (DB·네트워크 없음, 단위 테스트 대상)
   회차 규칙은 src/acts-data.js의 occurrences()와 같다: 월=말일, 분기=1·4·7·10월 15일, 반기=6·12월 말일, 연=지정 월 */

const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// KST 기준 오늘 (스케줄은 UTC로 돌기 때문에 9시간을 더한다)
export const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
export const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
export const prevMonth = (d) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };

/* 활동 1개 → 오늘이 속한 달부터 months개월 치 회차
   act: { code, cycle, cycle_month?: int[], next_due?: 'YYYY-MM-DD' } */
export function genOccurrences(act, today, months = 12) {
  if (!act.cycle || act.cycle === "상시") return [];
  const out = [];
  const y0 = +today.slice(0, 4), m0 = +today.slice(5, 7);
  const annual = act.cycle_month?.length ? act.cycle_month : act.next_due ? [+act.next_due.slice(5, 7)] : [12];
  const half = act.cycle_month?.length ? act.cycle_month : [6, 12];
  for (let i = 0; i < months; i++) {
    const y = y0 + Math.floor((m0 - 1 + i) / 12), m = ((m0 - 1 + i) % 12) + 1;
    let due, period;
    if (act.cycle === "월") { due = `${y}-${pad(m)}-${pad(lastDay(y, m))}`; period = `${y}-${pad(m)}`; }
    else if (act.cycle === "분기" && [1, 4, 7, 10].includes(m)) { due = `${y}-${pad(m)}-15`; period = `${y}-Q${Math.ceil(m / 3)}`; }
    else if (act.cycle === "반기" && half.includes(m)) { due = `${y}-${pad(m)}-${pad(lastDay(y, m))}`; period = `${y}-H${m <= 6 ? 1 : 2}`; }
    else if (act.cycle === "연" && annual.includes(m)) {
      due = act.next_due && act.next_due.slice(0, 7) === `${y}-${pad(m)}` ? act.next_due : `${y}-${pad(m)}-${pad(lastDay(y, m))}`;
      period = `${y}`;
    }
    if (!due) continue;
    out.push({ activity_code: act.code, period, start_on: `${y}-${pad(m)}-01`, due_on: due });
  }
  // 연 활동이 같은 해 여러 달이면 period가 겹치므로 월을 붙인다
  const seen = new Set();
  return out.map((o) => { const p = seen.has(o.period) ? `${o.period}-${o.due_on.slice(5, 7)}` : o.period; seen.add(o.period); return { ...o, period: p }; });
}

/* 회차 분류: 지연 전환 대상과 D-7·D-1·당일 알림 대상 */
const OPEN = ["planned", "in_progress"];
export function classify(occs, today) {
  const open = occs.filter((o) => OPEN.includes(o.status));
  return {
    toDelay: open.filter((o) => o.due_on < today),
    d7: open.filter((o) => o.due_on === addDays(today, 7)),
    d1: open.filter((o) => o.due_on === addDays(today, 1)),
    due: open.filter((o) => o.due_on === today),
  };
}

/* 브리프 본문 — Slack 메시지와 캘린더 [브리프] 일정(포털 일정·브리프 화면이 [섹션] / "- 항목"으로 파싱) 두 형태 */
export function buildBrief({ today, delayed = [], d7 = [], d1 = [], due = [], requests = [], findings = [], ctas = null, titles = {} }) {
  const name = (o) => `${o.activity_code} ${titles[o.activity_code] || ""}`.trim();
  const secs = [];
  const push = (title, items) => { if (items.length) secs.push([title, items]); };
  push("오늘 기한", due.map((o) => `${name(o)} (${o.period})`));
  push("D-1", d1.map((o) => `${name(o)} (${o.period})`));
  push("D-7", d7.map((o) => `${name(o)} (기한 ${o.due_on.slice(5)})`));
  push("지연 활동", delayed.map((o) => `${name(o)} (${o.period}, 기한 ${o.due_on.slice(5)})`));
  push("요청 기한 임박", requests.map((r) => `${r.title} — 기한 ${String(r.deadline).replace("T", " ").slice(5, 16)}`));
  push("지적사항 기한 초과", findings.map((f) => `${f.title} (기한 ${f.due_on})`));
  if (ctas) push("C-TAS", [`신규 IOC ${ctas.inserted}건 · 장비 미반영 ${ctas.pending}건 · 만료 ${ctas.expired}건`]);
  if (!secs.length) secs.push(["요약", ["기한·지연·요청 모두 이상 없음"]]);
  const desc = secs.map(([t, items]) => `[${t}]\n${items.map((i) => `- ${i}`).join("\n")}`).join("\n\n");
  const text = `*보안 브리프 ${today}*\n\n` + secs.map(([t, items]) => `*${t}* ${items.length}건\n${items.map((i) => `• ${i}`).join("\n")}`).join("\n\n");
  return { title: `[브리프] 보안 브리프 ${today.slice(5).replace("-", "/")}`, desc, text, count: secs.reduce((a, [, i]) => a + i.length, 0) };
}

/* ─────────────── 월간 수집 요약 (응답 JSON → 증빙 요약) ─────────────── */
const daysAgo = (iso, today) => (iso ? (new Date(today + "T00:00:00Z") - new Date(iso)) / 86400000 : Infinity);

// Google Admin SDK users.list 결과
export function summarizeGws(users, today) {
  const active = users.filter((u) => !u.suspended && !u.archived);
  const never = (u) => !u.lastLoginTime || u.lastLoginTime.startsWith("1970");
  return {
    total: users.length,
    active: active.length,
    suspended: users.length - active.length,
    admins: active.filter((u) => u.isAdmin || u.isDelegatedAdmin).map((u) => u.primaryEmail),
    no2sv: active.filter((u) => !u.isEnrolledIn2Sv).map((u) => u.primaryEmail),
    inactive90: active.filter((u) => !never(u) && daysAgo(u.lastLoginTime, today) > 90).map((u) => u.primaryEmail),
    neverLogin: active.filter(never).map((u) => u.primaryEmail),
  };
}

// GitHub 조직 members / admins / outside collaborators / 2FA 미설정 / repos / Dependabot
export function summarizeGithub({ members = [], admins = [], outside = [], no2fa = null, repos = [], alerts = [] }) {
  const sev = {};
  for (const a of alerts) { const s = a.security_advisory?.severity || a.severity || "unknown"; sev[s] = (sev[s] || 0) + 1; }
  return {
    members: members.length,
    admins: admins.map((m) => m.login),
    outside: outside.map((m) => m.login),
    no2fa: no2fa === null ? null : no2fa.map((m) => m.login),
    repos: repos.length,
    publicRepos: repos.filter((r) => r.visibility === "public" || r.private === false).map((r) => r.name),
    archivedRepos: repos.filter((r) => r.archived).length,
    dependabot: { open: alerts.length, ...sev },
  };
}

// Slack users.list
export function summarizeSlack(members) {
  const humans = members.filter((m) => !m.is_bot && m.id !== "USLACKBOT");
  const live = humans.filter((m) => !m.deleted);
  return {
    total: humans.length,
    active: live.length,
    deactivated: humans.length - live.length,
    admins: live.filter((m) => m.is_admin || m.is_owner).map((m) => m.name),
    guests: live.filter((m) => m.is_restricted || m.is_ultra_restricted).map((m) => m.name),
    no2fa: live.some((m) => "has_2fa" in m) ? live.filter((m) => !m.has_2fa).map((m) => m.name) : null,
    bots: members.filter((m) => m.is_bot && !m.deleted).length,
  };
}

/* ─────────────── C-TAS 피드 정규화 ───────────────
   C-TAS API 응답 명세는 회원 가입 후 KISA가 제공한다. 명세를 받기 전까지는
   ① JSON 배열 / {data|items|iocs: [...]} ② CSV(kind,value,category,tlp,expires) 둘 다 받아
   threat_intel 행으로 바꾼다. 실제 명세를 받으면 FIELD 매핑만 고치면 된다. */
const KINDS = ["ip", "domain", "url", "hash", "email", "cve"];
const FIELD = { kind: ["kind", "type", "ioc_type"], value: ["value", "indicator", "ioc"], category: ["category", "threat_type"], tlp: ["tlp"], expires_at: ["expires_at", "expire_date", "valid_until"] };
const pick = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== "") return o[k]; return null; };
const kindOf = (k, v) => {
  const s = String(k || "").toLowerCase();
  if (KINDS.includes(s)) return s;
  if (/md5|sha|hash/.test(s)) return "hash";
  if (/^\d{1,3}(\.\d{1,3}){3}(\/\d+)?$/.test(v)) return "ip";
  if (/^cve-\d{4}-\d+$/i.test(v)) return "cve";
  if (/^https?:\/\//i.test(v)) return "url";
  if (/@/.test(v)) return "email";
  if (/^[a-f0-9]{32,128}$/i.test(v)) return "hash";
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)) return "domain";
  return null;
};
export function normalizeIocs(body) {
  let rows;
  if (typeof body === "string") {
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const head = lines[0]?.toLowerCase().includes("value") ? lines.shift().split(",").map((h) => h.trim().toLowerCase()) : ["kind", "value", "category", "tlp", "expires_at"];
    rows = lines.map((l) => Object.fromEntries(l.split(",").map((c, i) => [head[i], c.trim()])));
  } else rows = Array.isArray(body) ? body : body?.data || body?.items || body?.iocs || [];
  const out = [], bad = [];
  for (const r of rows) {
    const value = String(pick(r, FIELD.value) || "").trim();
    const kind = kindOf(pick(r, FIELD.kind), value);
    if (!value || !kind) { bad.push(r); continue; }
    const tlp = String(pick(r, FIELD.tlp) || "TLP:AMBER").toUpperCase().replace(/^(?!TLP:)/, "TLP:");
    out.push({ kind, value: kind === "hash" || kind === "domain" || kind === "email" ? value.toLowerCase() : value, category: pick(r, FIELD.category), tlp, expires_at: pick(r, FIELD.expires_at) });
  }
  return { iocs: out, rejected: bad.length };
}
// AMBER·RED는 Slack 등 외부 채널로 값 자체를 보내지 않는다 (사내 장비 반영 전용)
export const shareable = (tlp) => ["TLP:CLEAR", "TLP:WHITE", "TLP:GREEN"].includes(String(tlp).toUpperCase());
