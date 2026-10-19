import { useState, useMemo } from "react";
import { C, store, audit, nowStr, getUser, Tag, Btn, Card } from "./common.jsx";
import { STD, STD_LABEL, DOMAINS, ACTS, METHODS, TODAY, SRC, ST, applyActivityOverrides } from "./acts-data.js";

/* 감사 대응 — 활동 수행·증빙 기록(D10 U04 연계), 지적사항 추적, 기준별 심사 대응 패키지
   DB 연결 전에는 브라우저 저장소(sp.acts, sp.findings)에 두고, 실운영에서는
   activity_runs·evidences·findings 테이블로 옮긴다. */

const dl = (blob, name) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 1500);
};
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = (head, rows) => new Blob(["﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
const input = "text-xs px-2 py-1 rounded-sm w-full";
const box = { border: `1px solid ${C.line}` };

/* ─────────────── 현재 주기 증빙 판정 ─────────────── */
// 증빙 기간은 YYYY-MM. 활동 주기의 현재 구간(월·분기·반기, 연·상시는 최근 12개월) 안에 증빙이 있는지 본다.
export function currentWindow(cycle, today = TODAY) {
  const y = +today.slice(0, 4), m = +today.slice(5, 7);
  const ym = (yy, mm) => `${yy}-${String(mm).padStart(2, "0")}`;
  if (cycle === "월") return { label: ym(y, m), from: ym(y, m), to: ym(y, m) };
  if (cycle === "분기") { const q = Math.ceil(m / 3); return { label: `${y}-Q${q}`, from: ym(y, q * 3 - 2), to: ym(y, q * 3) }; }
  if (cycle === "반기") { const h = m <= 6 ? 1 : 2; return { label: `${y}-H${h}`, from: ym(y, h === 1 ? 1 : 7), to: ym(y, h === 1 ? 6 : 12) }; }
  const fm = m === 12 ? 1 : m + 1, fy = m === 12 ? y : y - 1;
  return { label: "최근 12개월", from: ym(fy, fm), to: ym(y, m) };
}
export function evidenceGap(x) {
  const w = currentWindow(x.cycle);
  const ok = x.ev.some((e) => e[2] >= w.from && e[2] <= w.to);
  return { period: w.label, ok };
}

/* ─────────────── 활동 상세: 상태 변경·수행 기록·증빙 등록 ─────────────── */
function saveAct(code, patch) {
  const all = store.get("acts", {});
  all[code] = { ...(all[code] || {}), ...patch };
  store.set("acts", all);
  applyActivityOverrides(all);
}

export function ActivityLog({ act, onChange }) {
  const saved = store.get("acts", {})[act.code] || {};
  const [tab, setTab] = useState(null);
  const [st, setSt] = useState({ status: act.status, why: "" });
  const [run, setRun] = useState({ date: TODAY, result: "", note: "" });
  const [ev, setEv] = useState({ title: "", period: TODAY.slice(0, 7), src: "manual", url: "" });
  const [err, setErr] = useState("");
  const done = (msg) => { setErr(""); setTab(null); onChange?.(); if (msg) setErr(msg); };

  const saveStatus = () => {
    if (st.status === act.status) return setErr("상태가 바뀌지 않았습니다.");
    if (!st.why.trim()) return setErr("변경 사유를 적어야 합니다 (심사 시 근거로 제시).");
    const before = act.status;
    saveAct(act.code, { status: st.status });
    audit("status", act.code, { how: "활동 상태 변경", before: ST[before][0], after: ST[st.status][0], why: st.why, note: act.title });
    setSt({ ...st, why: "" }); done();
  };
  const saveRun = () => {
    if (!run.result.trim()) return setErr("수행 결과를 적어야 합니다.");
    const r = { ...run, by: getUser(), at: nowStr() };
    saveAct(act.code, { runs: [r, ...(saved.runs || [])].slice(0, 50) });
    audit("run", act.code, { how: `수행 기록 등록 (${run.date})`, after: run.result, note: act.title });
    setRun({ date: TODAY, result: "", note: "" }); done();
  };
  const saveEv = () => {
    if (!ev.title.trim()) return setErr("증빙 제목을 적어야 합니다.");
    if (!/^\d{4}-\d{2}$/.test(ev.period)) return setErr("증빙 기간은 YYYY-MM 형식입니다.");
    if (ev.url && !/^https:\/\//.test(ev.url)) return setErr("링크는 https:// 로 시작해야 합니다 (Drive 공유 링크).");
    const e = { ...ev, by: getUser(), at: nowStr() };
    saveAct(act.code, { ev: [...(saved.ev || []), e] });
    audit("evidence", act.code, { how: `증빙 등록 · ${SRC[ev.src]} · ${ev.period}`, after: ev.title, note: ev.url || act.title });
    setEv({ title: "", period: TODAY.slice(0, 7), src: "manual", url: "" }); done();
  };

  const runs = saved.runs || [];
  return (
    <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${C.line}` }}>
      {runs.length > 0 && (
        <div>
          <div className="text-xs mb-1" style={{ color: C.mute }}>수행 기록 {runs.length}건</div>
          <ul className="text-xs space-y-1">{runs.slice(0, 3).map((r, i) => <li key={i}><span style={{ color: C.mute }}>{r.date}</span> {r.result} <span style={{ color: C.mute }}>· {r.by}</span></li>)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {[["run", "수행 기록"], ["ev", "증빙 등록"], ["status", "상태 변경"]].map(([k, l]) => <Btn key={k} small primary={tab === k} onClick={() => { setTab(tab === k ? null : k); setErr(""); }}>{l}</Btn>)}
      </div>
      {tab === "run" && (
        <div className="space-y-1.5">
          <input type="date" value={run.date} onChange={(e) => setRun({ ...run, date: e.target.value })} className={input} style={box} />
          <input value={run.result} onChange={(e) => setRun({ ...run, result: e.target.value })} placeholder="수행 결과 (예: 분기 권한 검토 완료 — 회수 4건)" className={input} style={box} />
          <textarea rows={2} value={run.note} onChange={(e) => setRun({ ...run, note: e.target.value })} placeholder="비고" className={input} style={box} />
          <Btn small primary onClick={saveRun}>저장</Btn>
        </div>
      )}
      {tab === "ev" && (
        <div className="space-y-1.5">
          <input value={ev.title} onChange={(e) => setEv({ ...ev, title: e.target.value })} placeholder="증빙 제목 (예: 2026-Q4 권한 검토 결과서)" className={input} style={box} />
          <div className="grid grid-cols-2 gap-1.5">
            <input type="month" value={ev.period} onChange={(e) => setEv({ ...ev, period: e.target.value })} className={input} style={box} />
            <select value={ev.src} onChange={(e) => setEv({ ...ev, src: e.target.value })} className={input} style={box}>{Object.entries(SRC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </div>
          <input value={ev.url} onChange={(e) => setEv({ ...ev, url: e.target.value })} placeholder="Drive 공유 링크 (https://drive.google.com/…)" className={input} style={box} />
          <Btn small primary onClick={saveEv}>저장</Btn>
        </div>
      )}
      {tab === "status" && (
        <div className="space-y-1.5">
          <select value={st.status} onChange={(e) => setSt({ ...st, status: e.target.value })} className={input} style={box}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
          <input value={st.why} onChange={(e) => setSt({ ...st, why: e.target.value })} placeholder="변경 사유 (필수)" className={input} style={box} />
          <Btn small primary onClick={saveStatus}>저장</Btn>
        </div>
      )}
      {err && <p className="text-xs" style={{ color: ST.gap[1] }}>{err}</p>}
      <p className="text-xs" style={{ color: C.mute }}>저장하면 로그점검에 누가·언제·무엇을·왜가 남습니다.</p>
    </div>
  );
}

/* ─────────────── 지적사항·시정조치 (U04) ─────────────── */
export const F_SRC = ["외부 심사", "내부감사", "자체점검", "사고 후속"];
export const F_SEV = ["결함", "경결함", "관찰", "개선권고"];
export const F_ST = ["접수", "조치중", "검증대기", "종결"];
const F_SEV_COLOR = { 결함: "#B23A3A", 경결함: "#B7791F", 관찰: "#2E5C8A", 개선권고: "#6B7686" };
const F_ST_COLOR = { 접수: "#B7791F", 조치중: "#2E5C8A", 검증대기: "#6D5BA8", 종결: "#2E7D5B" };

const SAMPLE_FINDINGS = [
  { id: "F-2026-001", src: "외부 심사", std: "CSAP", clause: "접근통제", act: "L04", title: "관리 콘솔 접근 IP 제한 미적용", sev: "결함", owner: "인프라 담당", due: "2026-09-30", opened: "2026-07-22", status: "조치중", cause: "", action: "", log: ["2026-07-22 CSAP 사전환경조사 지적 등록 (샘플)"] },
  { id: "F-2026-002", src: "자체점검", std: "ISMSP", clause: "2.5.6", act: "L03", title: "퇴사자 GitHub 계정 1건 미회수", sev: "경결함", owner: "이정민", due: "2026-09-10", opened: "2026-08-20", status: "검증대기", cause: "퇴사 체크리스트에 GitHub 항목 누락", action: "계정 회수, 체크리스트 개정", log: ["2026-08-20 자체점검 등록 (샘플)", "2026-09-02 조치 완료 → 검증 요청"] },
];
const loadF = () => store.get("findings", null) || SAMPLE_FINDINGS;
const nextId = (list) => { const y = TODAY.slice(0, 4); const n = list.filter((f) => f.id.startsWith(`F-${y}-`)).map((f) => +f.id.slice(7)).reduce((a, b) => Math.max(a, b), 0); return `F-${y}-${String(n + 1).padStart(3, "0")}`; };
export const isOverdue = (f) => f.status !== "종결" && f.due && f.due < TODAY;

export function FindingsPage({ go }) {
  const [list, setList] = useState(loadF);
  const [sel, setSel] = useState(list[0]?.id);
  const [filter, setFilter] = useState("open");
  const [form, setForm] = useState(null);
  const [err, setErr] = useState("");
  const persist = (n) => { setList(n); store.set("findings", n); };
  const f = list.find((x) => x.id === sel);
  const rows = list.filter((x) => filter === "all" || (filter === "open" ? x.status !== "종결" : filter === "overdue" ? isOverdue(x) : x.status === "종결"));

  const kpi = useMemo(() => {
    const closed = list.filter((x) => x.status === "종결" && x.closedAt);
    const days = closed.map((x) => (new Date(x.closedAt.slice(0, 10)) - new Date(x.opened || x.closedAt.slice(0, 10))) / 86400000);
    return { open: list.filter((x) => x.status !== "종결").length, overdue: list.filter(isOverdue).length, major: list.filter((x) => x.status !== "종결" && x.sev === "결함").length, avg: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : "—" };
  }, [list]);

  const create = () => {
    if (!form.title.trim() || !form.due) return setErr("내용과 조치 기한은 필수입니다.");
    const id = nextId(list);
    const item = { ...form, id, status: "접수", opened: TODAY, cause: "", action: "", log: [`${nowStr().slice(0, 16)} ${getUser()} 등록`] };
    persist([item, ...list]); setSel(id); setForm(null); setErr("");
    audit("finding", id, { how: `지적사항 등록 · ${form.src} · ${form.sev}`, after: form.title, note: `${form.act} 연계, 기한 ${form.due}` });
  };
  const update = (patch, note) => {
    const before = f.status;
    if (patch.status === "종결") {
      if (!f.action.trim()) return setErr("시정조치 내용을 적어야 종결할 수 있습니다.");
      if (f.owner === getUser()) return setErr("조치 담당자가 직접 종결 검증할 수 없습니다 (직무 분리, G08). 다른 담당자가 검증하세요.");
      patch = { ...patch, closedAt: nowStr(), verifier: getUser() };
    }
    setErr("");
    const n = list.map((x) => (x.id === f.id ? { ...x, ...patch, log: [...x.log, `${nowStr().slice(0, 16)} ${getUser()} ${note}`] } : x));
    persist(n);
    audit("finding", f.id, { how: note, before, after: patch.status || before, note: f.title });
  };
  const edit = (k, v) => persist(list.map((x) => (x.id === f.id ? { ...x, [k]: v } : x)));

  const exportCsv = () => {
    dl(csv(["번호", "출처", "기준", "조항", "활동", "내용", "등급", "담당", "기한", "상태", "근본원인", "시정조치", "검증자", "종결일"],
      list.map((x) => [x.id, x.src, STD_LABEL[x.std] || x.std, x.clause, x.act, x.title, x.sev, x.owner, x.due, x.status, x.cause, x.action, x.verifier || "", (x.closedAt || "").slice(0, 10)])), `findings_${TODAY}.csv`);
    audit("report", "지적사항 대장", { how: `${list.length}건 CSV 내보내기` });
  };

  const blank = { src: "자체점검", std: "ISMSP", clause: "", act: "U04", title: "", sev: "경결함", owner: "", due: "" };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold">지적사항·시정조치</h1><p className="text-xs mt-1" style={{ color: C.mute }}>심사·감사·자체점검 지적을 원인 → 조치 → 검증 → 종결까지 추적합니다. U04 활동 증빙으로 쓰입니다.</p></div>
        <div className="flex gap-2"><Btn small onClick={exportCsv}>대장 CSV</Btn><Btn small primary onClick={() => { setForm(blank); setErr(""); }}>지적사항 등록</Btn></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["미종결", kpi.open, C.ink], ["기한 초과", kpi.overdue, kpi.overdue ? ST.gap[1] : ST.ok[1]], ["미종결 결함", kpi.major, kpi.major ? ST.gap[1] : ST.ok[1]], ["평균 조치일", kpi.avg, C.steel]].map(([l, v, c]) => (
          <div key={l} className="bg-white px-4 py-3" style={{ ...box, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-2xl font-semibold mt-1" style={{ color: c }}>{v}</div></div>
        ))}
      </div>
      {form && (
        <Card title="지적사항 등록" right={<Btn small onClick={() => setForm(null)}>닫기</Btn>}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <select value={form.src} onChange={(e) => setForm({ ...form, src: e.target.value })} className={input} style={box}>{F_SRC.map((v) => <option key={v}>{v}</option>)}</select>
            <select value={form.std} onChange={(e) => setForm({ ...form, std: e.target.value })} className={input} style={box}>{STD.map((s) => <option key={s} value={s}>{STD_LABEL[s]}</option>)}</select>
            <input value={form.clause} onChange={(e) => setForm({ ...form, clause: e.target.value })} placeholder="조항 (예: 2.5.6)" className={input} style={box} />
            <select value={form.act} onChange={(e) => setForm({ ...form, act: e.target.value })} className={input} style={box}>{ACTS.map((a) => <option key={a.code} value={a.code}>{a.code} {a.title.slice(0, 18)}</option>)}</select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="지적 내용" className={input + " col-span-2 md:col-span-4"} style={box} />
            <select value={form.sev} onChange={(e) => setForm({ ...form, sev: e.target.value })} className={input} style={box}>{F_SEV.map((v) => <option key={v}>{v}</option>)}</select>
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="조치 담당" className={input} style={box} />
            <input type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} className={input} style={box} />
            <Btn small primary onClick={create}>등록</Btn>
          </div>
          {err && <p className="text-xs mt-2" style={{ color: ST.gap[1] }}>{err}</p>}
        </Card>
      )}
      <div className="flex gap-1 text-xs">
        {[["open", "미종결"], ["overdue", "기한 초과"], ["closed", "종결"], ["all", "전체"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="px-2.5 py-1 rounded-sm" style={{ background: filter === k ? C.ink : "#fff", color: filter === k ? "#fff" : C.ink, ...box }}>{l}</button>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white overflow-hidden" style={{ ...box, borderRadius: 6 }}>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[560px]">
            <thead><tr className="text-xs text-left" style={{ color: C.mute, background: C.bg }}><th className="px-3 py-2 font-normal">번호</th><th className="px-2 py-2 font-normal">내용</th><th className="px-2 py-2 font-normal">등급</th><th className="px-2 py-2 font-normal">기한</th><th className="px-2 py-2 font-normal">상태</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: C.line }}>
              {rows.length ? rows.map((x) => (
                <tr key={x.id} onClick={() => { setSel(x.id); setErr(""); }} className="cursor-pointer" style={{ background: f?.id === x.id ? "#EEF3F9" : undefined }}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: C.mute }}>{x.id}</td>
                  <td className="px-2 py-2.5"><div>{x.title}</div><div className="text-xs" style={{ color: C.mute }}>{x.src} · {STD_LABEL[x.std] || x.std} {x.clause} · {x.act}</div></td>
                  <td className="px-2 py-2.5"><Tag color={F_SEV_COLOR[x.sev]}>{x.sev}</Tag></td>
                  <td className="px-2 py-2.5 text-xs whitespace-nowrap" style={{ color: isOverdue(x) ? ST.gap[1] : C.mute }}>{x.due}{isOverdue(x) && " 초과"}</td>
                  <td className="px-2 py-2.5"><Tag color={F_ST_COLOR[x.status]}>{x.status}</Tag></td>
                </tr>
              )) : <tr><td colSpan={5} className="px-3 py-6 text-center text-xs" style={{ color: C.mute }}>해당하는 지적사항이 없습니다.</td></tr>}
            </tbody>
          </table></div>
        </div>
        <div className="md:col-span-2">
          {f && (
            <Card title={`${f.id} ${f.title}`} right={<Tag color={F_ST_COLOR[f.status]}>{f.status}</Tag>}>
              <div className="text-sm space-y-3">
                <table className="w-full text-xs"><tbody>
                  {[["출처", f.src], ["기준", `${STD_LABEL[f.std] || f.std} ${f.clause}`], ["등급", f.sev], ["담당", f.owner || "미지정"], ["기한", f.due], ["검증", f.verifier ? `${f.verifier} · ${f.closedAt?.slice(0, 16)}` : "—"]].map(([k, v]) => <tr key={k}><td className="py-0.5 w-12" style={{ color: C.mute }}>{k}</td><td>{v}</td></tr>)}
                  <tr><td className="py-0.5" style={{ color: C.mute }}>활동</td><td><button style={{ color: C.steel }} onClick={() => go(ACTS.find((a) => a.code === f.act)?.d)}>{f.act} {ACTS.find((a) => a.code === f.act)?.title}</button></td></tr>
                </tbody></table>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>근본 원인</div>
                  <textarea rows={2} disabled={f.status === "종결"} value={f.cause} onChange={(e) => edit("cause", e.target.value)} className={input} style={box} />
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>시정조치 (재발방지 포함)</div>
                  <textarea rows={3} disabled={f.status === "종결"} value={f.action} onChange={(e) => edit("action", e.target.value)} className={input} style={box} />
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>이력</div>
                  <ul className="text-xs space-y-0.5">{f.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  {f.status === "접수" && <Btn small primary onClick={() => update({ status: "조치중" }, "조치 착수")}>조치 착수</Btn>}
                  {f.status === "조치중" && <Btn small primary onClick={() => f.action.trim() ? update({ status: "검증대기" }, "조치 완료 → 검증 요청") : setErr("시정조치 내용을 먼저 적으세요.")}>검증 요청</Btn>}
                  {f.status === "검증대기" && <><Btn small primary onClick={() => update({ status: "종결" }, "효과성 확인 → 종결")}>검증·종결</Btn><Btn small onClick={() => update({ status: "조치중" }, "검증 반려 → 재조치")}>반려</Btn></>}
                </div>
                {err && <p className="text-xs" style={{ color: ST.gap[1] }}>{err}</p>}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 심사 대응 패키지 (기준별 적용성·증빙 색인) ─────────────── */
function packageRows(std) {
  const methods = store.get("methods", {});
  const findings = loadF();
  return ACTS.filter((x) => x.map[std]).map((x) => {
    const g = evidenceGap(x);
    const m = methods[x.code];
    const list = METHODS[x.code] || [];
    return {
      x, clause: x.map[std], gap: g,
      domain: DOMAINS.find((d) => d.code === x.d).name,
      lastRun: (x.runs || [])[0],
      chosen: m ? m.chosen.map((i) => list[i]).filter(Boolean).filter(([s]) => s === std).map(([, t]) => t) : [],
      open: findings.filter((f) => f.act === x.code && f.status !== "종결"),
    };
  });
}

export function AuditPackage({ std: std0, setStd }) {
  const std = std0 === "ALL" ? "ISMSP" : std0;
  const [only, setOnly] = useState(false);
  const all = packageRows(std);
  const rows = only ? all.filter((r) => !r.gap.ok || r.x.status !== "ok" || r.open.length) : all;
  const k = { n: all.length, ok: all.filter((r) => r.x.status === "ok").length, noEv: all.filter((r) => !r.gap.ok).length, open: all.reduce((a, r) => a + r.open.length, 0) };

  const printPkg = () => {
    const body = all.map((r) => `<tr><td>${esc(r.clause)}</td><td>${r.x.code}<br>${esc(r.x.title)}</td><td>${r.x.cycle}</td><td>${ST[r.x.status][0]}</td><td>${r.lastRun ? `${esc(r.lastRun.date)}<br>${esc(r.lastRun.result)}` : "—"}</td><td>${r.x.ev.map((e) => `${esc(e[1])} <span class="mute">(${esc(SRC[e[0]])} · ${esc(e[2])})</span>`).join("<br>") || '<span class="red">없음</span>'}${r.gap.ok ? "" : `<br><span class="red">${esc(r.gap.period)} 증빙 없음</span>`}</td><td>${r.chosen.map(esc).join("<br>") || "—"}</td><td>${r.open.map((f) => `${f.id} ${esc(f.title)} (${f.due})`).join("<br>") || "—"}</td></tr>`).join("");
    const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${STD_LABEL[std]} 심사 대응 패키지 ${TODAY}</title>
<style>body{font-family:Pretendard,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#1B2432;margin:32px;font-size:11px}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #DCE1E8;padding:4px 6px;text-align:left;vertical-align:top}th{background:#F3F5F8}.kpi{display:flex;gap:12px;margin:12px 0}.kpi div{flex:1;border:1px solid #DCE1E8;padding:8px 10px}.kpi b{display:block;font-size:18px}.mute{color:#6B7686}.red{color:#B23A3A}@media print{body{margin:10mm}button{display:none}}</style></head><body>
<button onclick="window.print()" style="float:right;padding:6px 12px">인쇄 / PDF 저장</button>
<h1>${STD_LABEL[std]} 심사 대응 패키지</h1><div class="mute">기준일 ${TODAY} · 작성 ${esc(getUser())} · 출력 ${nowStr()}</div>
<div class="kpi"><div>대상 활동<b>${k.n}</b></div><div>충족<b>${k.ok}</b></div><div>현재 주기 증빙 없음<b class="red">${k.noEv}</b></div><div>미종결 지적<b>${k.open}</b></div></div>
<table><tr><th>조항</th><th>활동</th><th>주기</th><th>상태</th><th>최근 수행</th><th>증빙</th><th>채택 방법(${STD_LABEL[std]})</th><th>미종결 지적</th></tr>${body}</table>
<p class="mute">보안포털 활동·증빙·지적사항 기준으로 자동 생성. 증빙 원본은 Drive 보안포털/ 폴더에 있습니다.</p></body></html>`;
    const w = window.open("", "_blank"); if (!w) return; w.document.write(html); w.document.close();
    audit("package", STD_LABEL[std], { how: `심사 대응 패키지 출력 · 활동 ${k.n}개 · 증빙 공백 ${k.noEv}개` });
  };
  const indexCsv = () => {
    const out = [];
    for (const r of all) for (const e of r.x.ev) out.push([STD_LABEL[std], r.clause, r.x.code, r.x.title, e[1], SRC[e[0]], e[2], e[3]?.url || ""]);
    dl(csv(["기준", "조항", "활동", "활동명", "증빙", "출처", "기간", "링크"], out), `evidence_index_${std}_${TODAY}.csv`);
    audit("package", STD_LABEL[std], { how: `증빙 색인 CSV ${out.length}건 내보내기` });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold">심사 대응 패키지</h1><p className="text-xs mt-1" style={{ color: C.mute }}>기준을 고르면 조항 ↔ 활동 ↔ 증빙 ↔ 채택 방법 ↔ 미종결 지적을 한 표로 묶습니다. 심사원 제출용 PDF와 증빙 색인 CSV를 내보냅니다.</p></div>
        <div className="flex gap-2"><Btn small onClick={indexCsv}>증빙 색인 CSV</Btn><Btn small primary onClick={printPkg}>패키지 출력</Btn></div>
      </div>
      <div className="flex flex-wrap gap-1">{STD.map((s) => <button key={s} onClick={() => setStd(s)} className="text-xs px-2.5 py-1 rounded-sm" style={{ background: std === s ? C.ink : "#fff", color: std === s ? "#fff" : C.ink, ...box }}>{STD_LABEL[s]}</button>)}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["대상 활동", k.n, C.ink], ["충족", k.ok, ST.ok[1]], ["현재 주기 증빙 없음", k.noEv, k.noEv ? ST.gap[1] : ST.ok[1]], ["미종결 지적", k.open, k.open ? ST.warn[1] : ST.ok[1]]].map(([l, v, c]) => (
          <div key={l} className="bg-white px-4 py-3" style={{ ...box, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-2xl font-semibold mt-1" style={{ color: c }}>{v}</div></div>
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} />보완이 필요한 활동만 보기</label>
      <div className="bg-white overflow-hidden" style={{ ...box, borderRadius: 6 }}>
        <div className="overflow-x-auto"><table className="w-full text-xs min-w-[760px]">
          <thead><tr className="text-left" style={{ color: C.mute, background: C.bg }}><th className="px-3 py-2 font-normal">조항</th><th className="px-2 py-2 font-normal">활동</th><th className="px-2 py-2 font-normal">상태</th><th className="px-2 py-2 font-normal">현재 주기 증빙</th><th className="px-2 py-2 font-normal">최근 수행</th><th className="px-2 py-2 font-normal">미종결 지적</th></tr></thead>
          <tbody className="divide-y" style={{ borderColor: C.line }}>
            {rows.map((r) => (
              <tr key={r.x.code} className="align-top">
                <td className="px-3 py-2" style={{ color: C.mute }}>{r.clause}</td>
                <td className="px-2 py-2"><span style={{ color: C.mute }}>{r.x.code}</span> {r.x.title}<div style={{ color: C.mute }}>{r.domain} · {r.x.cycle}</div></td>
                <td className="px-2 py-2"><Tag color={ST[r.x.status][1]}>{ST[r.x.status][0]}</Tag></td>
                <td className="px-2 py-2 whitespace-nowrap"><Tag color={r.gap.ok ? ST.ok[1] : ST.gap[1]}>{r.gap.period} {r.gap.ok ? "있음" : "없음"}</Tag><div style={{ color: C.mute }}>누적 {r.x.ev.length}건</div></td>
                <td className="px-2 py-2">{r.lastRun ? `${r.lastRun.date} ${r.lastRun.result}` : <span style={{ color: C.mute }}>—</span>}</td>
                <td className="px-2 py-2">{r.open.length ? r.open.map((f) => <div key={f.id} style={{ color: isOverdue(f) ? ST.gap[1] : C.ink }}>{f.id} {f.title}</div>) : <span style={{ color: C.mute }}>—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
