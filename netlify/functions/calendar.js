// calendar — '보안활동' 공개 Google Calendar를 읽어 JSON으로 돌려준다.
// 포털 브라우저는 CORS 때문에 Google을 직접 못 읽으므로 이 함수가 중계한다.
// - GOOGLE_CAL_API_KEY 가 있으면 Calendar API v3(실시간) 사용
// - 없으면 공개 ICS 피드 사용 (Google 쪽 캐시로 반영이 몇 시간 늦을 수 있음)
// - SECURITY_CAL_ID 로 캘린더를 바꿀 수 있음
const DEFAULT_CAL = "c_5e316fc6b6709fec6bd8244fa12ac7d62696671cf9c88442d9f812261f52db64@group.calendar.google.com";
const JSON_H = { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=300" };

const isBrief = (t) => /^\[브리프\]/.test(t || "");
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/* ── ICS 파서 ── */
const unesc = (s) => s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
function toKstDate(v) {
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return v;
  let d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  if (m[7] === "Z") d = new Date(d.getTime() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
function parseIcs(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const events = []; let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(":"); if (i < 0) continue;
    const key = line.slice(0, i).split(";")[0], val = line.slice(i + 1);
    if (key === "DTSTART") cur.date = toKstDate(val);
    else if (key === "DTEND") cur.end = toKstDate(val);
    else if (key === "SUMMARY") cur.title = unesc(val);
    else if (key === "DESCRIPTION") cur.desc = unesc(val);
    else if (key === "UID") cur.id = val;
  }
  return events.filter((e) => e.date && e.title).map((e) => ({ ...e, brief: isBrief(e.title) })).sort(byDateDesc);
}

/* ── 읽기 ── */
async function viaApi(calId, key) {
  const now = new Date();
  const min = new Date(now.getTime() - 120 * 86400000).toISOString();
  const max = new Date(now.getTime() + 120 * 86400000).toISOString();
  const u = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?key=${key}&singleEvents=true&orderBy=startTime&maxResults=500&timeMin=${min}&timeMax=${max}&timeZone=Asia/Seoul`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`API ${r.status}`);
  const j = await r.json();
  return (j.items || []).filter((e) => e.status !== "cancelled").map((e) => ({
    id: e.id,
    date: e.start?.date || (e.start?.dateTime || "").slice(0, 10),
    end: e.end?.date || (e.end?.dateTime || "").slice(0, 10),
    title: e.summary || "",
    desc: e.description || "",
    brief: isBrief(e.summary),
  })).sort(byDateDesc);
}
async function viaIcs(calId) {
  const r = await fetch(`https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`, { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`ICS ${r.status}`);
  return parseIcs(await r.text());
}

export default async () => {
  const calId = process.env.SECURITY_CAL_ID || DEFAULT_CAL;
  const key = process.env.GOOGLE_CAL_API_KEY;
  try {
    const events = key ? await viaApi(calId, key) : await viaIcs(calId);
    return new Response(JSON.stringify({ ok: true, source: key ? "api" : "ics", fetched: new Date().toISOString(), events }), { headers: JSON_H });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), events: [] }), { status: 502, headers: { "content-type": "application/json; charset=utf-8" } });
  }
};
