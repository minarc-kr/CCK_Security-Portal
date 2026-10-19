/* 데이터 접근 계층 — 화면은 이 모듈만 쓴다.
   VITE_SUPABASE_URL이 있으면 Supabase(로그인·RLS), 없으면 브라우저 저장소(데모 모드)로 동작한다.
   활동 목록(ACTS)·채택 방법은 부팅 때 읽어 메모리에 두고, 쓰기는 저장 후 메모리를 갱신한다. */
import { supabase } from "./supabase.js";
import { store, nowStr, setUser, getUserId, setAuditSink } from "./common.jsx";
import { ACTS, INIT_REQUESTS, POLICIES, TYPE_ACT, applyActivityOverrides } from "./acts-data.js";

export const mode = supabase ? "db" : "local";
const today = () => new Date().toISOString().slice(0, 10);
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

/* ─────────────── 코드 ↔ DB 값 ─────────────── */
const REQ_TYPE = { 계정: "account", 권한: "permission", "개인정보 등록": "pi_register", 정보주체: "subject_request", 사고: "incident", 유출: "breach", 기술유출: "trade_leak", 기타: "other" };
const REQ_ST = { 접수: "received", 처리중: "in_progress", 완료: "done", 반려: "rejected" };
const F_ST = { 접수: "received", 조치중: "in_progress", 검증대기: "verifying", 종결: "closed" };
const inv = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const REQ_TYPE_KO = inv(REQ_TYPE), REQ_ST_KO = inv(REQ_ST), F_ST_KO = inv(F_ST);
const md = (iso) => (iso ? iso.slice(5, 10) : "");
const mdhm = (iso) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(5, 16) : "");

/* ─────────────── 로그인·부팅 ─────────────── */
// 데모 모드 사용자 (사이드바에서 전환)
export const DEMO_USERS = [
  { id: "이정민", name: "이정민", role: "security", dept: "정보보호부문" },
  { id: "김개발", name: "김개발", role: "employee", dept: "개발" },
];
let me = null;
let methods = {};
export const currentUser = () => me;
export const methodsCache = () => methods;

function useUser(u) {
  me = u;
  if (u) setUser(u.name, u.id);
}

export async function boot() {
  if (mode === "local") {
    useUser(store.get("demoUser", null) ? DEMO_USERS.find((u) => u.id === store.get("demoUser")) || DEMO_USERS[0] : DEMO_USERS[0]);
    applyActivityOverrides(store.get("acts", {}));
    methods = store.get("methods", {});
    return me;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const prof = must(await supabase.from("profiles").select("id,name,email,role,dept").eq("id", data.session.user.id).single());
  useUser(prof);
  setAuditSink((row) => supabase.from("audit_log").insert(row).then(({ error }) => error && console.error("audit_log", error.message)));
  if (prof.role !== "employee") await Promise.all([loadActivities(), loadMethods()]);
  return me;
}
export function switchDemoUser(id) { store.set("demoUser", id); return boot(); }
export async function signIn() {
  return supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } } });
}
export async function signOut() { await supabase.auth.signOut(); me = null; }
export const onAuthChange = (fn) => supabase?.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN" || ev === "SIGNED_OUT") fn(ev); });

export async function listUsers() {
  if (mode === "local") return DEMO_USERS;
  return must(await supabase.from("profiles").select("id,name,role").order("name"));
}

/* ─────────────── 활동·증빙·수행 기록 ─────────────── */
async function loadActivities() {
  const [acts, maps, evs, runs] = await Promise.all([
    supabase.from("activities").select("code,domain_code,title,cycle,auto_sources,status,next_due"),
    supabase.from("activity_mappings").select("activity_code,standard,clause"),
    supabase.from("evidences").select("id,activity_code,source,title,period,url,storage_path,collected_at,collector:profiles!collected_by(name)").order("collected_at"),
    supabase.from("activity_runs").select("id,activity_code,performed_on,result,note,performed_at,performer:profiles!performed_by(name)").order("performed_at", { ascending: false }),
  ]).then((rs) => rs.map(must));
  const byCode = (rows) => rows.reduce((m, r) => ((m[r.activity_code] ||= []).push(r), m), {});
  const M = byCode(maps), E = byCode(evs), R = byCode(runs);
  const order = Object.fromEntries(ACTS.map((x, i) => [x.code, i]));
  const next = acts.map((a) => ({
    code: a.code, d: a.domain_code, title: a.title, cycle: a.cycle, auto: a.auto_sources || [], status: a.status, next: a.next_due || "—",
    map: Object.fromEntries((M[a.code] || []).map((m) => [m.standard, m.clause])),
    ev: (E[a.code] || []).map((e) => [e.source, e.title, e.period, { url: e.url, path: e.storage_path, by: e.collector?.name, at: e.collected_at }]),
    runs: (R[a.code] || []).map((r) => ({ date: r.performed_on, result: r.result, note: r.note, by: r.performer?.name, at: r.performed_at })),
  })).sort((p, q) => (order[p.code] ?? 999) - (order[q.code] ?? 999) || p.code.localeCompare(q.code));
  ACTS.splice(0, ACTS.length, ...next);
}

function saveLocalAct(code, patch) {
  const all = store.get("acts", {});
  all[code] = { ...(all[code] || {}), ...patch };
  store.set("acts", all);
  applyActivityOverrides(all);
}
const actOf = (code) => ACTS.find((x) => x.code === code);

export async function setStatus(code, status) {
  if (mode === "local") return saveLocalAct(code, { status });
  must(await supabase.from("activities").update({ status }).eq("code", code));
  actOf(code).status = status;
}
export async function addRun(code, run) {
  if (mode === "local") {
    const r = { ...run, by: me.name, at: nowStr() };
    return saveLocalAct(code, { runs: [r, ...(store.get("acts", {})[code]?.runs || [])].slice(0, 50) });
  }
  must(await supabase.from("activity_runs").insert({ activity_code: code, performed_on: run.date, period: run.date.slice(0, 7), result: run.result, note: run.note }));
  actOf(code).runs = [{ ...run, by: me.name, at: new Date().toISOString() }, ...(actOf(code).runs || [])];
}
export async function addEvidence(code, ev) {
  if (mode === "local") {
    const e = { ...ev, by: me.name, at: nowStr() };
    return saveLocalAct(code, { ev: [...(store.get("acts", {})[code]?.ev || []), e] });
  }
  must(await supabase.from("evidences").insert({ activity_code: code, source: ev.src, title: ev.title, period: ev.period, url: ev.url || null }));
  actOf(code).ev.push([ev.src, ev.title, ev.period, { url: ev.url, by: me.name }]);
}

/* ─────────────── 채택 방법 ─────────────── */
async function loadMethods() {
  const rows = must(await supabase.from("method_choices").select("activity_code,chosen,memo,updated_at,editor:profiles!updated_by(name)"));
  methods = Object.fromEntries(rows.map((r) => [r.activity_code, { chosen: r.chosen, memo: r.memo || "", by: r.editor?.name, at: mdhm(r.updated_at) }]));
}
export async function saveMethod(code, { chosen, memo }) {
  const v = { chosen, memo, by: me.name, at: nowStr() };
  if (mode === "local") { methods = { ...methods, [code]: v }; store.set("methods", methods); return v; }
  must(await supabase.from("method_choices").upsert({ activity_code: code, chosen, memo, updated_by: me.id, updated_at: new Date().toISOString() }));
  methods = { ...methods, [code]: v };
  return v;
}

/* ─────────────── 지적사항 ─────────────── */
const F_COLS = "id,ref,source,standard,clause,activity_code,title,severity,owner,due_on,status,root_cause,corrective_action,verified_by,opened_on,closed_at,history";
const fromF = (r) => ({ id: r.ref || r.id, dbId: r.id, src: r.source, std: r.standard, clause: r.clause || "", act: r.activity_code, title: r.title, sev: r.severity, owner: r.owner, due: r.due_on, status: F_ST_KO[r.status], cause: r.root_cause || "", action: r.corrective_action || "", verifier: r.verified_by, opened: r.opened_on, closedAt: r.closed_at, log: r.history || [] });
export async function listFindings(sample) {
  if (mode === "local") return store.get("findings", null) || sample;
  return must(await supabase.from("findings").select(F_COLS).order("opened_on", { ascending: false })).map(fromF);
}
export async function saveFinding(f, list) {
  if (mode === "local") { const n = list.some((x) => x.id === f.id) ? list.map((x) => (x.id === f.id ? f : x)) : [f, ...list]; store.set("findings", n); return n; }
  const row = { ref: f.id, source: f.src, standard: f.std, clause: f.clause, activity_code: f.act, title: f.title, severity: f.sev, owner: f.owner || null, due_on: f.due || null, status: F_ST[f.status], root_cause: f.cause, corrective_action: f.action, verified_by: f.verifier || null, closed_at: f.closedAt || null, history: f.log };
  if (f.opened) row.opened_on = f.opened;
  const saved = fromF(must(await (f.dbId ? supabase.from("findings").update(row).eq("id", f.dbId) : supabase.from("findings").insert(row)).select(F_COLS).single()));
  return list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...list];
}

/* ─────────────── 요청·신고 ─────────────── */
const fromReq = (r) => ({
  id: r.id, type: REQ_TYPE_KO[r.type], title: r.title, detail: r.detail, by: r.requester_profile?.name || "", byId: r.requester, at: md(r.created_at),
  status: REQ_ST_KO[r.status], act: r.activity_code || TYPE_ACT[REQ_TYPE_KO[r.type]], src: r.channel || "포털", due: r.deadline ? mdhm(r.deadline) : undefined,
  log: (r.request_logs || []).sort((p, q) => (p.at < q.at ? -1 : 1)).map((l) => `${mdhm(l.at)} ${l.note}`),
});
const REQ_SEL = "id,type,title,detail,status,activity_code,channel,deadline,created_at,requester,requester_profile:profiles!requester(name),request_logs(note,at)";
export async function listRequests() {
  if (mode === "local") return store.get("requests", null) || INIT_REQUESTS;
  return must(await supabase.from("requests").select(REQ_SEL).order("created_at", { ascending: false })).map(fromReq);
}
export async function createRequest({ type, title, detail }, list) {
  if (mode === "local") {
    const d = new Date(), stamp = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const due = type === "정보주체" ? new Date(d.getTime() + 10 * 864e5).toISOString().slice(5, 10) : type === "유출" ? mdhm(new Date(d.getTime() + 72 * 36e5).toISOString()) : undefined;
    const r = { id: Date.now(), type, title, detail, by: me.name, byId: me.id, at: stamp, status: "접수", act: TYPE_ACT[type], src: "포털", due, log: [`${stamp} 포털 접수`] };
    const n = [r, ...list]; store.set("requests", n); return n;
  }
  const row = must(await supabase.from("requests").insert({ type: REQ_TYPE[type], title, detail, activity_code: TYPE_ACT[type], channel: "포털" }).select("id").single());
  must(await supabase.from("request_logs").insert({ request_id: row.id, action: "create", note: "포털 접수" }));
  return listRequests();
}
export async function updateRequest(id, patch, note, list) {
  if (mode === "local") {
    const n = list.map((x) => (x.id === id ? { ...x, ...patch, log: [...x.log, `${mdhm(new Date().toISOString())} ${note}`] } : x));
    store.set("requests", n); return n;
  }
  const up = {};
  if (patch.status) { up.status = REQ_ST[patch.status]; if (["완료", "반려"].includes(patch.status)) up.closed_at = new Date().toISOString(); }
  must(await supabase.from("requests").update(up).eq("id", id));
  must(await supabase.from("request_logs").insert({ request_id: id, action: up.status || "note", note }));
  return listRequests();
}

/* ─────────────── 정책 열람 ─────────────── */
export async function listPolicies() {
  if (mode === "local") { const read = store.get("policyReads", {}); return POLICIES.map((p) => ({ ...p, id: p.code, read: read[p.code] ?? p.read })); }
  const [pols, reads] = await Promise.all([
    supabase.from("policies").select("id,code,category,title,version,body,published_at").eq("is_current", true).order("code"),
    supabase.from("policy_reads").select("policy_id").eq("user_id", me.id),
  ]).then((rs) => rs.map(must));
  const done = new Set(reads.map((r) => r.policy_id));
  return pols.map((p) => ({ id: p.id, code: p.code, cat: p.category, title: p.title, ver: p.version, date: p.published_at, body: p.body, read: done.has(p.id) }));
}
export async function markPolicyRead(p) {
  if (mode === "local") { store.set("policyReads", { ...store.get("policyReads", {}), [p.code]: true }); return; }
  must(await supabase.from("policy_reads").insert({ policy_id: p.id }));
}

/* ─────────────── 감사로그 ─────────────── */
export async function listAudit(days) {
  const since = new Date(Date.now() - days * 864e5);
  if (mode === "local") return store.get("audit", []).filter((l) => l.at.slice(0, 10) >= since.toISOString().slice(0, 10));
  const rows = must(await supabase.from("audit_log").select("id,at,who,action,target,how,before,after,why,note").gte("at", since.toISOString()).order("at", { ascending: false }).limit(5000));
  return rows.map((r) => ({ ...r, at: new Date(r.at).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }) }));
}

export const isSelf = (ownerId) => ownerId && ownerId === getUserId();
export { today };
