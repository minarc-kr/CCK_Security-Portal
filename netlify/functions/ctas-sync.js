// ctas-sync — 매시간
// C-TAS IOC 피드를 threat_intel에 반영(값 기준 중복 제거·마지막 수신 갱신)하고,
// 장비 미반영 24시간 경과·만료 IOC를 집계해 상황이 있을 때만 Slack에 알린다.
// TLP:AMBER 이상은 값 자체를 Slack에 보내지 않는다 (사내 장비 반영 전용, 재배포 금지).
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, CTAS_FEED_URL, CTAS_API_KEY, (선택) CTAS_AUTH_HEADER(기본 Authorization),
//          SLACK_BOT_TOKEN, SLACK_THREAT_CHANNEL_ID(없으면 SLACK_CHANNEL_ID)
import { db, json, must, changeLog, slack } from "../lib/clients.js";
import { normalizeIocs } from "../lib/ops.js";

export default async () => {
  const sb = db();
  if (!sb) return json({ ok: false, error: "SUPABASE_URL/SUPABASE_SERVICE_KEY 없음" }, 500);
  const nowIso = new Date().toISOString();
  const res = { inserted: 0, rejected: 0 };

  if (process.env.CTAS_FEED_URL && process.env.CTAS_API_KEY) {
    const h = process.env.CTAS_AUTH_HEADER || "Authorization";
    const r = await fetch(process.env.CTAS_FEED_URL, { headers: { [h]: h.toLowerCase() === "authorization" ? `Bearer ${process.env.CTAS_API_KEY}` : process.env.CTAS_API_KEY } });
    if (!r.ok) return json({ ok: false, error: `C-TAS ${r.status}` }, 502);
    const body = (r.headers.get("content-type") || "").includes("json") ? await r.json() : await r.text();
    const { iocs, rejected } = normalizeIocs(body);
    res.rejected = rejected;
    if (iocs.length) {
      const rows = iocs.map((i) => ({ ...i, source: "ctas", received_via: "api", last_seen_at: nowIso }));
      // 이미 있는 값은 last_seen_at·만료만 갱신, applied_to/applied_at(장비 반영 기록)은 보존
      const data = must(await sb.from("threat_intel").upsert(rows, { onConflict: "kind,value", ignoreDuplicates: false }).select("id,received_at"));
      res.inserted = data.filter((d) => d.received_at >= nowIso.slice(0, 16)).length;
      res.seen = data.length;
    }
  } else res.feed = { skipped: "CTAS_FEED_URL/CTAS_API_KEY 없음 — 이메일 수신분은 포털에서 수동 등록" };

  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const pq = await sb.from("threat_intel").select("id", { count: "exact", head: true }).is("applied_at", null).lt("received_at", dayAgo).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (pq.error) throw new Error(pq.error.message);
  const pending = pq.count || 0;
  const expired = must(await sb.from("threat_intel").select("id,kind,applied_to").lt("expires_at", nowIso).not("applied_at", "is", null));
  // 만료됐는데 장비에 남아 있는 IOC — 오탐·성능 저하 방지를 위해 룰 정리 필요
  const stale = expired.filter((e) => (e.applied_to || []).length);
  Object.assign(res, { pending, expired: stale.length });

  const msgs = [];
  if (res.inserted) msgs.push(`신규 IOC ${res.inserted}건 수신 — 방화벽·메일·EDR 반영 후 포털 T08에서 반영 처리`);
  if (pending) msgs.push(`수신 24시간 경과 미반영 IOC ${pending}건`);
  if (stale.length) msgs.push(`만료 IOC ${stale.length}건이 장비에 남아 있음 — 룰 정리 필요`);
  if (res.rejected) msgs.push(`형식 불일치로 제외 ${res.rejected}건 — 피드 명세 확인`);
  res.slack = msgs.length ? await slack(`*C-TAS 동기화*\n${msgs.map((m) => `• ${m}`).join("\n")}`, process.env.SLACK_THREAT_CHANNEL_ID || process.env.SLACK_CHANNEL_ID) : { skipped: "알릴 상황 없음" };
  if (res.inserted) await changeLog(sb, [{ target_table: "threat_intel", target_id: "ctas", action: "ctas_sync", after: { inserted: res.inserted, rejected: res.rejected } }]);
  return json({ ok: true, ...res });
};
