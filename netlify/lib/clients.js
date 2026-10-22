/* 외부 연결 — Supabase(서비스 키) · Slack · Google 서비스계정 · GitHub
   환경변수가 없으면 해당 연결은 건너뛰고 결과에 skipped로 남긴다 (부분 설정으로도 함수가 돈다). */
import { createClient } from "@supabase/supabase-js";
import { createSign } from "node:crypto";

const env = (k) => process.env[k] || "";

export const db = () => (env("SUPABASE_URL") && env("SUPABASE_SERVICE_KEY") ? createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_KEY"), { auth: { persistSession: false } }) : null);

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8" } });

// 쿼리 결과에서 error를 던져 스케줄 실패가 Netlify 로그에 남게 한다
export const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export async function changeLog(sb, rows) {
  if (!rows.length) return;
  must(await sb.from("change_log").insert(rows.map((r) => ({ actor: "scheduler", ...r }))));
}

/* Slack — chat.postMessage */
export async function slack(text, channel = env("SLACK_CHANNEL_ID")) {
  if (!env("SLACK_BOT_TOKEN") || !channel) return { skipped: "SLACK_BOT_TOKEN/채널 없음" };
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", authorization: `Bearer ${env("SLACK_BOT_TOKEN")}` },
    body: JSON.stringify({ channel, text, unfurl_links: false }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`slack ${j.error}`);
  return { ok: true, ts: j.ts };
}
export async function slackPaged(method, key) {
  const out = []; let cursor = "";
  do {
    const r = await fetch(`https://slack.com/api/${method}?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, { headers: { authorization: `Bearer ${env("SLACK_BOT_TOKEN")}` } });
    const j = await r.json();
    if (!j.ok) throw new Error(`slack ${method} ${j.error}`);
    out.push(...(j[key] || []));
    cursor = j.response_metadata?.next_cursor || "";
  } while (cursor);
  return out;
}

/* Google 서비스계정 (도메인 전체 위임) — GOOGLE_SA_JSON: 키 JSON 원문 또는 base64
   GOOGLE_ADMIN_SUBJECT: 위임받을 관리자 계정 (Admin SDK 조회·캘린더 쓰기 주체) */
function saKey() {
  const raw = env("GOOGLE_SA_JSON");
  if (!raw) return null;
  return JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
}
export const hasGoogle = () => !!env("GOOGLE_SA_JSON");
export async function googleToken(scopes) {
  const k = saKey();
  const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claim = { iss: k.client_email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
  if (env("GOOGLE_ADMIN_SUBJECT")) claim.sub = env("GOOGLE_ADMIN_SUBJECT");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64(claim)}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(k.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`google token ${j.error || r.status}`);
  return j.access_token;
}
export async function gcalInsert(calId, ev) {
  const token = await googleToken(["https://www.googleapis.com/auth/calendar.events"]);
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(ev),
  });
  if (!r.ok) throw new Error(`gcal ${r.status}`);
  return (await r.json()).id;
}

/* GitHub — Link 헤더 따라 전부 읽는다 */
export async function ghAll(path) {
  const out = []; let url = `https://api.github.com${path}${path.includes("?") ? "&" : "?"}per_page=100`;
  while (url) {
    const r = await fetch(url, { headers: { authorization: `Bearer ${env("GITHUB_TOKEN")}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
    if (!r.ok) { const e = new Error(`github ${path} ${r.status}`); e.status = r.status; throw e; }
    out.push(...(await r.json()));
    url = (r.headers.get("link") || "").match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
  }
  return out;
}
