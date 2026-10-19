// daily-brief — 매일 08:30 KST
// ① 활동 회차 12개월치 보충 ② 기한 경과 회차 지연 전환 ③ D-7·D-1·당일 알림(중복 발송 방지)
// ④ 요청 기한(유출 72시간·정보주체 10일) 24시간 이내 ⑤ 지적사항 기한 초과 ⑥ Slack 발송 + '보안활동' 캘린더 [브리프] 등록
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, SLACK_BOT_TOKEN, SLACK_CHANNEL_ID,
//          (선택) GOOGLE_SA_JSON, GOOGLE_ADMIN_SUBJECT, SECURITY_CAL_ID
import { db, json, must, changeLog, slack, hasGoogle, gcalInsert } from "../lib/clients.js";
import { kstToday, addDays, genOccurrences, classify, buildBrief } from "../lib/ops.js";

export default async () => {
  const sb = db();
  if (!sb) return json({ ok: false, error: "SUPABASE_URL/SUPABASE_SERVICE_KEY 없음" }, 500);
  const today = kstToday();
  const result = { today };

  // ① 회차 보충 — 이미 있는 (activity_code, period)는 건드리지 않는다
  const acts = must(await sb.from("activities").select("code,title,cycle,cycle_month,next_due,owner"));
  const titles = Object.fromEntries(acts.map((a) => [a.code, a.title]));
  const occRows = acts.flatMap((a) => genOccurrences(a, today).map((o) => ({ ...o, assignee: a.owner })));
  if (occRows.length) must(await sb.from("activity_occurrences").upsert(occRows, { onConflict: "activity_code,period", ignoreDuplicates: true }));
  result.occurrences = occRows.length;

  // ② 지연 전환 / ③ 알림 대상
  const open = must(await sb.from("activity_occurrences").select("id,activity_code,period,due_on,status,assignee").in("status", ["planned", "in_progress"]).lte("due_on", addDays(today, 7)));
  const c = classify(open, today);
  if (c.toDelay.length) {
    must(await sb.from("activity_occurrences").update({ status: "delayed" }).in("id", c.toDelay.map((o) => o.id)));
    await changeLog(sb, c.toDelay.map((o) => ({ target_table: "activity_occurrences", target_id: o.id, action: "auto_delay", before: { status: o.status }, after: { status: "delayed" } })));
  }
  const delayed = must(await sb.from("activity_occurrences").select("id,activity_code,period,due_on").eq("status", "delayed").order("due_on"));
  result.delayed = delayed.length;

  const ids = [...c.d7, ...c.d1, ...c.due].map((o) => o.id);
  const sent = new Set(ids.length ? must(await sb.from("notifications").select("occurrence_id,kind").in("occurrence_id", ids)).map((n) => `${n.occurrence_id}:${n.kind}`) : []);
  const fresh = (list, kind) => list.filter((o) => !sent.has(`${o.id}:${kind}`));
  const d7 = fresh(c.d7, "d7"), d1 = fresh(c.d1, "d1"), due = fresh(c.due, "due");

  // ④ 요청 기한 — 미완료 + 24시간 이내(이미 지난 것 포함)
  const soon = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const requests = must(await sb.from("requests").select("id,title,type,deadline,status").in("status", ["received", "in_progress"]).not("deadline", "is", null).lte("deadline", soon).order("deadline"));

  // ⑤ 지적사항 기한 초과
  const findings = must(await sb.from("findings").select("id,title,due_on,activity_code").is("closed_at", null).lt("due_on", today).order("due_on"));

  const brief = buildBrief({ today, delayed, d7, d1, due, requests, findings, titles });
  result.slack = await slack(brief.text);
  const notif = [...d7.map((o) => [o, "d7"]), ...d1.map((o) => [o, "d1"]), ...due.map((o) => [o, "due"])].map(([o, kind]) => ({ occurrence_id: o.id, kind, channel: "slack_channel" }));
  if (notif.length && result.slack.ok) must(await sb.from("notifications").insert(notif));

  // ⑥ 캘린더 [브리프] — 포털 '일정·브리프' 화면이 읽는다
  if (hasGoogle() && process.env.SECURITY_CAL_ID) {
    result.calendar = await gcalInsert(process.env.SECURITY_CAL_ID, { summary: brief.title, description: brief.desc, start: { date: today }, end: { date: addDays(today, 1) } });
  } else result.calendar = { skipped: "GOOGLE_SA_JSON/SECURITY_CAL_ID 없음" };

  return json({ ok: true, ...result, notified: notif.length, requests: requests.length, findings: findings.length });
};
