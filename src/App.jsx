import { useState, useEffect } from "react";
import { C, store, audit, ACTION_LABEL, pad, nowStr, setUser, getUser, Tag, Btn, Card, Bar } from "./common.jsx";
import { STD, STD_LABEL, DOMAINS, ACTS, INIT_REQUESTS, REQ_TYPES, TYPE_ACT, TYPE_DUE, POLICIES, MY_TRAININGS, linkOf, TODAY, OCC, OST, CTAS, SRC, ST, METHODS, APPROVAL, applyActivityOverrides } from "./acts-data.js";
import { ActivityLog, FindingsPage, AuditPackage, evidenceGap } from "./AuditPrep.jsx";
import PiaTool from "./Pia.jsx";
import EmpPia from "./EmpPia.jsx";
import PolicyPanel from "./PolicyPanel.jsx";
import { BarChart, Bar as RBar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ─────────────── 공통 UI ─────────────── */
applyActivityOverrides(store.get("acts", {}));
const Dot = ({ s }) => <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: ST[s][1] }} />;

/* ─────────────── 현황 ─────────────── */
function Overview({ go, std, setStd }) {
  const acts = std === "ALL" ? ACTS : ACTS.filter((x) => x.map[std]);
  const cnt = (list) => ({ ok: list.filter((x) => x.status === "ok").length, warn: list.filter((x) => x.status === "warn").length, gap: list.filter((x) => x.status === "gap").length });
  const tot = cnt(acts);
  const soon = ACTS.filter((x) => x.next !== "—" && x.next <= "2026-10-15").sort((p, q) => p.next.localeCompare(q.next)).slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-semibold">보안활동 현황</h1>
        <div className="flex flex-wrap gap-1"><Btn small onClick={() => printReport(std)}>리포트 출력</Btn>{["ALL", ...STD].map((s) => <button key={s} onClick={() => setStd(s)} className="text-xs px-2.5 py-1 rounded-sm" style={{ background: std === s ? C.ink : "#fff", color: std === s ? "#fff" : C.ink, border: `1px solid ${C.line}` }}>{s === "ALL" ? "전체" : STD_LABEL[s]}</button>)}</div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["대상 활동", acts.length, C.ink], ["충족", tot.ok, ST.ok[1]], ["보완 필요", tot.warn, ST.warn[1]], ["미비", tot.gap, ST.gap[1]]].map(([l, v, c]) => (
          <div key={l} className="bg-white px-4 py-3" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-2xl font-semibold mt-1" style={{ color: c }}>{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3">
          <Card title="영역별 이행률">
            <div className="space-y-2.5">
              {DOMAINS.map((d) => {
                const l = acts.filter((x) => x.d === d.code); if (!l.length) return null;
                const c = cnt(l); const pct = Math.round((c.ok / l.length) * 100);
                return (
                  <button key={d.code} onClick={() => go(d.code)} className="w-full flex items-center gap-3 text-left text-sm focus:outline-none focus:ring-2 rounded-sm">
                    <span className="w-28 md:w-36 shrink-0 truncate">{d.name}</span>
                    <Bar v={pct} color={pct === 100 ? ST.ok[1] : pct >= 50 ? C.steel : ST.warn[1]} />
                    <span className="text-xs w-24 text-right whitespace-nowrap shrink-0" style={{ color: C.mute }}>{c.ok}/{l.length} · 미비 {c.gap}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="md:col-span-2">
          <Card title="기한 임박 (10/15까지)">
            <ul className="text-sm divide-y" style={{ borderColor: C.line }}>
              {soon.map((x) => <li key={x.code} className="py-2 flex items-center gap-2"><Dot s={x.status} /><span className="text-xs w-8" style={{ color: C.mute }}>{x.code}</span><span className="truncate">{x.title}</span><span className="ml-auto text-xs shrink-0" style={{ color: x.next <= "2026-09-30" ? ST.gap[1] : C.mute }}>{x.next.slice(5)}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
      <Card title="KISA C-TAS 위협정보" right={<span className="text-xs" style={{ color: C.mute }}>{CTAS.via} 동기화 {CTAS.lastSync} · 사내 전용</span>}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3">
            <div className="text-xs mb-1" style={{ color: C.mute }}>최근 14일 수신 IOC</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={CTAS.daily} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 4 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <RBar dataKey="IP" stackId="a" fill="#2E5C8A" />
                <RBar dataKey="도메인" stackId="a" fill="#6C8FB8" />
                <RBar dataKey="URL" stackId="a" fill="#A9BFD6" />
                <RBar dataKey="해시" stackId="a" fill="#B7791F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs mb-1" style={{ color: C.mute }}>보안장비 반영률 (%)</div>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={CTAS.daily} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                <XAxis dataKey="d" hide />
                <YAxis domain={[90, 100]} tick={{ fontSize: 10, fill: C.mute }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${C.line}`, borderRadius: 4 }} />
                <Line type="monotone" dataKey="반영률" stroke="#2E7D5B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs" style={{ color: C.mute }}>경보단계</span>
              <div className="flex gap-1 flex-1">{CTAS.levels.map((l, i) => { const on = l === CTAS.level; const col = ["#2E7D5B", "#2E5C8A", "#B7791F", "#C4632F", "#B23A3A"][i]; return <div key={l} className="flex-1 text-center text-xs py-1 rounded-sm" style={{ background: on ? col : col + "22", color: on ? "#fff" : col, fontWeight: on ? 600 : 400 }}>{l}</div>; })}</div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between mb-1"><span className="text-xs" style={{ color: C.mute }}>실시간 상황전파</span><Btn small onClick={() => go("D04")}>T08 활동으로</Btn></div>
          <ul className="text-sm divide-y" style={{ borderColor: C.line }}>
            {CTAS.alerts.map((al, i) => <li key={i} className="py-1.5 flex items-center gap-2"><Tag color={al.sev === "주의" ? ST.warn[1] : C.steel}>{al.sev}</Tag><span className="truncate">{al.t}</span><span className="ml-auto text-xs shrink-0" style={{ color: C.mute }}>{al.at}</span></li>)}
          </ul>
        </div>
      </Card>
    </div>
  );
}

/* ─────────────── 영역 화면 ─────────────── */
function Domain({ code, std, go, onChange }) {
  const d = DOMAINS.find((x) => x.code === code);
  useEffect(() => { audit("view", code, { how: `${d.name} 영역 열람` }); }, [code]);
  const all = ACTS.filter((x) => x.d === code);
  const acts = std === "ALL" ? all : all.filter((x) => x.map[std]);
  const [sel, setSel] = useState(acts[0]?.code);
  const x = ACTS.find((y) => y.code === sel) || acts[0];
  const stds = STD.filter((s) => all.some((y) => y.map[s]));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{d.name}</h1>
        <div className="flex items-center gap-2 mt-1.5 text-xs" style={{ color: C.mute }}>
          <span>이 영역이 충족하는 기준</span>{stds.map((s) => <Tag key={s} color={std === s ? C.steel : C.mute}>{STD_LABEL[s]} {all.filter((y) => y.map[s]).length}</Tag>)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-left" style={{ color: C.mute, background: C.bg }}><th className="px-3 py-2 font-normal">활동</th><th className="px-2 py-2 font-normal">주기</th><th className="px-2 py-2 font-normal">다음 기한</th><th className="px-2 py-2 font-normal">수집</th><th className="px-2 py-2 font-normal">상태</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: C.line }}>
              {acts.map((r) => (
                <tr key={r.code} onClick={() => setSel(r.code)} className="cursor-pointer" style={{ background: x?.code === r.code ? "#EEF3F9" : undefined }}>
                  <td className="px-3 py-2.5"><div className="flex items-center gap-2"><Dot s={r.status} /><span className="text-xs w-8" style={{ color: C.mute }}>{r.code}</span><span>{r.title}</span></div></td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: C.mute }}>{r.cycle}</td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: r.next !== "—" && r.next <= "2026-09-30" ? ST.gap[1] : C.mute }}>{r.next}</td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: C.mute }}>{r.auto.length ? "자동" : "수동"}</td>
                  <td className="px-2 py-2.5"><Tag color={ST[r.status][1]}>{ST[r.status][0]}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className="md:col-span-2">
          {x && (
            <Card title={`${x.code} ${x.title}`} right={<Tag color={ST[x.status][1]}>{ST[x.status][0]}</Tag>}>
              <div className="text-sm space-y-4">
                <div>
                  <div className="text-xs mb-1.5" style={{ color: C.mute }}>요구 기준</div>
                  <table className="w-full text-xs"><tbody>{STD.filter((s) => x.map[s]).map((s) => <tr key={s}><td className="py-0.5 w-24" style={{ color: C.mute }}>{STD_LABEL[s]}</td><td className="py-0.5">{x.map[s]}</td></tr>)}</tbody></table>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><div style={{ color: C.mute }}>주기</div><div className="text-sm">{x.cycle}</div></div>
                  <div><div style={{ color: C.mute }}>다음 기한</div><div className="text-sm">{x.next}</div></div>
                </div>
                <div>
                  <div className="text-xs mb-1 flex items-center gap-2" style={{ color: C.mute }}>증빙 {x.ev.length}건{(() => { const g = evidenceGap(x); return g && <Tag color={g.ok ? ST.ok[1] : ST.gap[1]}>{g.period} {g.ok ? "증빙 있음" : "증빙 없음"}</Tag>; })()}</div>
                  {x.ev.length ? <ul className="divide-y" style={{ borderColor: C.line }}>{x.ev.map((e, i) => <li key={i} className="py-1.5 flex justify-between gap-2"><span>{e[3]?.url ? <a href={e[3].url} target="_blank" rel="noreferrer" style={{ color: C.steel }}>{e[1]}</a> : e[1]}</span><span className="text-xs" style={{ color: C.mute }}>{SRC[e[0]]} · {e[2]}</span></li>)}</ul> : <div className="text-xs py-2" style={{ color: ST.gap[1] }}>증빙이 없습니다. 담당자와 수집 방법을 정하세요.</div>}
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>연결</div>
                  {(() => { const l = linkOf(x); return (
                    <table className="w-full text-xs"><tbody>
                      <tr><td className="py-0.5 w-16" style={{ color: C.mute }}>Drive</td><td className="py-0.5" style={{ color: C.steel }}>{l.drive}</td></tr>
                      <tr><td className="py-0.5" style={{ color: C.mute }}>Slack</td><td className="py-0.5" style={{ color: C.steel }}>{l.slack}</td></tr>
                    </tbody></table>
                  ); })()}
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>자동 수집</div>
                  <p className="text-xs">{x.auto.length ? `${x.auto.map((s) => SRC[s]).join(", ")}에서 ${x.cycle === "상시" ? "이벤트 발생 시" : "주기마다"} 수집` : "없음 — 수동 업로드로 관리"}</p>
                </div>
                {APPROVAL[x.code] && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: C.mute }}>결재라인 (결재·전결 기준표 v1.2)</div>
                    <table className="w-full text-xs"><tbody>
                      {[["기안", APPROVAL[x.code].draft], ["검토", APPROVAL[x.code].review], ["전결", APPROVAL[x.code].approve], ["보고", APPROVAL[x.code].report]].map(([k, v]) => <tr key={k}><td className="py-0.5 w-16" style={{ color: C.mute }}>{k}</td><td className="py-0.5" style={{ color: v === "—" ? C.mute : C.ink }}>{v}</td></tr>)}
                      <tr><td className="py-0.5" style={{ color: C.mute }}>근거</td><td className="py-0.5" style={{ color: C.mute }}>{APPROVAL[x.code].basis}</td></tr>
                    </tbody></table>
                  </div>
                )}
                {x.code === "V02" && <PolicyPanel />}
                {["V01", "V06"].includes(x.code) && (
                  <div className="px-3 py-2.5 rounded-sm" style={{ background: "#EEF3F9", border: `1px solid #D3E0EE` }}>
                    <div className="text-xs mb-1.5" style={{ color: C.steel }}>이 활동은 포털 도구로 수행합니다</div>
                    <p className="text-xs mb-2" style={{ color: C.mute }}>{x.code === "V01" ? "처리업무별 흐름표를 입력하면 개인정보 흐름도가 자동으로 그려집니다." : "흐름표를 바탕으로 위험요인 29개 분야를 자체 점검하고 결과를 Word로 내려받습니다. 법 33조 영향평가는 공공기관 의무라 당사는 대상이 아니며, ISMS-P 1.2.3·ISO 42001 A.7 위험평가 근거로 씁니다."}</p>
                    <Btn small primary onClick={() => go("pia")}>개인정보 흐름도·영향평가 열기</Btn>
                  </div>
                )}
                <MethodPanel act={x} />
                <ActivityLog act={x} onChange={onChange} />
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 요구 방법 패널 (활동 상세) ─────────────── */
function MethodPanel({ act }) {
  const list = METHODS[act.code] || [];
  const saved = store.get("methods", {})[act.code] || { chosen: [], memo: "" };
  const [chosen, setChosen] = useState(saved.chosen);
  const [memo, setMemo] = useState(saved.memo);
  const [open, setOpen] = useState(true);
  const [hover, setHover] = useState(null);
  const dirty = JSON.stringify(chosen) !== JSON.stringify(saved.chosen) || memo !== saved.memo;
  const save = () => {
    const all = store.get("methods", {});
    const before = all[act.code];
    all[act.code] = { chosen, memo, by: getUser(), at: nowStr() };
    store.set("methods", all);
    audit("method", act.code, { how: `채택 방법 ${chosen.length}개 저장`, before: before ? before.chosen.map((i) => `${list[i]?.[0]}#${i + 1}`).join(", ") : "(없음)", after: chosen.map((i) => `${list[i]?.[0]}#${i + 1}`).join(", "), why: memo || "(사유 미기재)", note: act.title });
    setOpen(true);
  };
  if (!list.length) return (
    <div className="text-xs py-2 px-3 rounded-sm" style={{ background: C.bg, color: C.mute }}>이 활동의 요구 방법 안내가 아직 없습니다.</div>
  );
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <button onClick={() => setOpen(!open)} className="text-xs font-semibold focus:outline-none" style={{ color: C.steel }}>{open ? "▾" : "▸"} 각 기준이 제시하는 방법 {list.length}개 · 채택 {chosen.length}개</button>
        {saved.at && <span className="text-xs" style={{ color: C.mute }}>{saved.by} · {saved.at.slice(0, 16)} 저장</span>}
      </div>
      {open && (
        <div className="space-y-1.5">
          {list.map(([std, text], i) => {
            const on = chosen.includes(i);
            return (
              <label key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-sm cursor-pointer" style={{ background: on ? "#EEF3F9" : hover === i ? C.bg : "#fff", border: `1px solid ${on ? C.steel : C.line}` }}>
                <input type="checkbox" checked={on} onChange={() => setChosen(on ? chosen.filter((k) => k !== i) : [...chosen, i].sort((p, q) => p - q))} className="mt-0.5" />
                <span className="shrink-0"><Tag color={C.steel}>{STD_LABEL[std]}</Tag></span>
                <span style={{ color: C.ink }}>{text}</span>
              </label>
            );
          })}
          <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="채택 사유·적용 범위 메모 (예: 공공 SaaS는 KCMVP 모듈, 사내는 AES-256)" className="w-full text-xs px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
          <div className="flex items-center gap-2"><Btn small primary onClick={save}>{dirty ? "채택 방법 저장" : "저장됨"}</Btn><span className="text-xs" style={{ color: C.mute }}>저장 시 누가·언제·무엇을·왜 로그가 남습니다.</span></div>
        </div>
      )}
    </div>
  );
}

/* ─────────────── 로그점검 (행위기반 감사로그) ─────────────── */
function AuditPage() {
  const [logs, setLogs] = useState(() => store.get("audit", []));
  const [who, setWho] = useState("ALL"); const [kind, setKind] = useState("ALL"); const [days, setDays] = useState(30);
  const users = [...new Set(logs.map((l) => l.who))];
  const since = (() => { const d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); })();
  const rows = logs.filter((l) => (who === "ALL" || l.who === who) && (kind === "ALL" || l.action === kind) && l.at.slice(0, 10) >= since);
  const checks = store.get("logchecks", []);
  const confirm = () => { audit("logcheck", "감사로그", { how: `최근 ${days}일 ${rows.length}건 점검`, note: "L06 접속기록·감사로그 검토 증빙" }); const c = [{ at: nowStr(), by: getUser(), n: rows.length }, ...checks]; store.set("logchecks", c.slice(0, 100)); setLogs(store.get("audit", [])); };
  const csv = () => { const h = ["일시", "사용자", "행위", "대상", "내용", "이전", "이후", "사유"]; const body = rows.map((l) => [l.at, l.who, ACTION_LABEL[l.action] || l.action, l.target, l.how || "", l.before || "", l.after || "", l.why || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")); const blob = new Blob(["\ufeff" + [h.join(","), ...body].join("\n")], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `audit_${TODAY}.csv`; a.click(); audit("report", "감사로그 CSV", { how: `${rows.length}건 내보내기` }); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-xl font-semibold">로그점검</h1><p className="text-xs mt-1" style={{ color: C.mute }}>포털 내 모든 행위를 누가·언제·무엇을·어떻게(이전→이후)·왜 기준으로 기록합니다. 월 1회 점검 확인은 L06 증빙으로 남습니다.</p></div>
        <div className="flex flex-wrap gap-2"><Btn small onClick={csv}>CSV 내보내기</Btn><Btn small primary onClick={confirm}>점검 확인</Btn></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["기록 건수(기간 내)", rows.length, C.ink], ["사용자 수", users.length, C.steel], ["방법 채택", logs.filter((l) => l.action === "method").length, ST.ok[1]], ["최근 점검", checks[0] ? checks[0].at.slice(5, 16) : "없음", checks[0] ? ST.ok[1] : ST.warn[1]]].map(([l, v, c]) => (
          <div key={l} className="bg-white px-4 py-3" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-xl font-semibold mt-1" style={{ color: c }}>{v}</div></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        <select value={days} onChange={(e) => setDays(+e.target.value)} className="rounded-sm px-2 py-1" style={{ border: `1px solid ${C.line}` }}>{[7, 30, 90, 365].map((d) => <option key={d} value={d}>최근 {d}일</option>)}</select>
        <select value={who} onChange={(e) => setWho(e.target.value)} className="rounded-sm px-2 py-1" style={{ border: `1px solid ${C.line}` }}><option value="ALL">모든 사용자</option>{users.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-sm px-2 py-1" style={{ border: `1px solid ${C.line}` }}><option value="ALL">모든 행위</option>{Object.entries(ACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className="bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
        <div className="overflow-x-auto"><table className="w-full text-xs min-w-[720px]">
          <thead><tr className="text-left" style={{ color: C.mute, background: C.bg }}><th className="px-3 py-2 font-normal">일시</th><th className="px-2 py-2 font-normal">사용자</th><th className="px-2 py-2 font-normal">행위</th><th className="px-2 py-2 font-normal">대상</th><th className="px-2 py-2 font-normal">내용(이전 → 이후)</th><th className="px-2 py-2 font-normal">사유</th></tr></thead>
          <tbody className="divide-y" style={{ borderColor: C.line }}>
            {rows.length ? rows.map((l) => (
              <tr key={l.id}><td className="px-3 py-1.5 whitespace-nowrap" style={{ color: C.mute }}>{l.at}</td><td className="px-2 py-1.5 whitespace-nowrap">{l.who}</td><td className="px-2 py-1.5 whitespace-nowrap"><Tag color={l.action === "method" ? C.steel : l.action === "logcheck" ? ST.ok[1] : C.mute}>{ACTION_LABEL[l.action] || l.action}</Tag></td><td className="px-2 py-1.5 whitespace-nowrap">{l.target}</td><td className="px-2 py-1.5">{l.how}{l.before || l.after ? <div style={{ color: C.mute }}>{l.before || "—"} → {l.after || "—"}</div> : null}{l.note && <div style={{ color: C.mute }}>{l.note}</div>}</td><td className="px-2 py-1.5" style={{ color: C.mute }}>{l.why || ""}</td></tr>
            )) : <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: C.mute }}>조건에 맞는 기록이 없습니다.</td></tr>}
          </tbody>
        </table></div>
      </div>
      {checks.length > 0 && <p className="text-xs" style={{ color: C.mute }}>점검 이력: {checks.slice(0, 5).map((c) => `${c.at.slice(0, 16)} ${c.by}(${c.n}건)`).join(" · ")}</p>}
    </div>
  );
}

/* ─────────────── 활동현황 리포트 (인쇄·PDF) ─────────────── */
function printReport(std) {
  const acts = std === "ALL" ? ACTS : ACTS.filter((x) => x.map[std]);
  const cnt = (l) => ({ ok: l.filter((x) => x.status === "ok").length, warn: l.filter((x) => x.status === "warn").length, gap: l.filter((x) => x.status === "gap").length });
  const tot = cnt(acts);
  const methods = store.get("methods", {});
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));
  const stdRows = STD.map((s) => { const l = ACTS.filter((x) => x.map[s]); const c = cnt(l); return `<tr><td>${STD_LABEL[s]}</td><td>${l.length}</td><td>${c.ok}</td><td>${c.warn}</td><td>${c.gap}</td><td>${l.length ? Math.round((c.ok / l.length) * 100) : 0}%</td></tr>`; }).join("");
  const domRows = DOMAINS.map((d) => { const l = acts.filter((x) => x.d === d.code); if (!l.length) return ""; const c = cnt(l); return `<tr><td>${d.name}</td><td>${l.length}</td><td>${c.ok}</td><td>${c.warn}</td><td>${c.gap}</td><td>${Math.round((c.ok / l.length) * 100)}%</td></tr>`; }).join("");
  const gapRows = acts.filter((x) => x.status !== "ok").sort((p, q) => (p.next === "—" ? "9" : p.next).localeCompare(q.next === "—" ? "9" : q.next)).map((x) => `<tr><td>${x.code}</td><td>${esc(x.title)}</td><td>${DOMAINS.find((d) => d.code === x.d).name}</td><td>${x.cycle}</td><td>${x.next}</td><td>${ST[x.status][0]}</td><td>${x.ev.length}</td></tr>`).join("");
  const mRows = Object.entries(methods).map(([code, m]) => { const x = ACTS.find((a) => a.code === code); const list = METHODS[code] || []; return `<tr><td>${code}</td><td>${esc(x?.title)}</td><td>${m.chosen.map((i) => list[i] ? `[${STD_LABEL[list[i][0]]}] ${esc(list[i][1])}` : "").join("<br>")}</td><td>${esc(m.memo)}</td><td>${esc(m.by)}<br>${esc(m.at?.slice(0, 16))}</td></tr>`; }).join("");
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>보안활동 현황 리포트 ${TODAY}</title>
<style>body{font-family:Pretendard,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#1B2432;margin:32px;font-size:12px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:24px 0 8px;border-bottom:1px solid #DCE1E8;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #DCE1E8;padding:4px 6px;text-align:left;vertical-align:top}th{background:#F3F5F8;font-weight:600}.kpi{display:flex;gap:12px;margin:12px 0}.kpi div{flex:1;border:1px solid #DCE1E8;padding:8px 10px}.kpi b{display:block;font-size:20px}.mute{color:#6B7686}@media print{body{margin:12mm}button{display:none}}</style></head><body>
<button onclick="window.print()" style="float:right;padding:6px 12px">인쇄 / PDF 저장</button>
<h1>CCK 보안활동 현황 리포트</h1><div class="mute">기준일 ${TODAY} · 필터 ${std === "ALL" ? "전체" : STD_LABEL[std]} · 작성 ${esc(getUser())} · 출력 ${nowStr()}</div>
<div class="kpi"><div>대상 활동<b>${acts.length}</b></div><div>충족<b style="color:#2E7D5B">${tot.ok}</b></div><div>보완 필요<b style="color:#B7791F">${tot.warn}</b></div><div>미비<b style="color:#B23A3A">${tot.gap}</b></div><div>이행률<b>${acts.length ? Math.round((tot.ok / acts.length) * 100) : 0}%</b></div></div>
<h2>1. 기준별 이행 현황</h2><table><tr><th>기준</th><th>대상</th><th>충족</th><th>보완</th><th>미비</th><th>이행률</th></tr>${stdRows}</table>
<h2>2. 영역별 이행 현황</h2><table><tr><th>영역</th><th>대상</th><th>충족</th><th>보완</th><th>미비</th><th>이행률</th></tr>${domRows}</table>
<h2>3. 미충족 활동 목록 (기한순)</h2><table><tr><th>코드</th><th>활동</th><th>영역</th><th>주기</th><th>다음 기한</th><th>상태</th><th>증빙</th></tr>${gapRows}</table>
<h2>4. 채택한 요구 방법</h2>${mRows ? `<table><tr><th>코드</th><th>활동</th><th>채택 방법</th><th>사유</th><th>채택자·일시</th></tr>${mRows}</table>` : "<p class=\"mute\">채택된 방법이 없습니다.</p>"}
<p class="mute">본 리포트는 보안포털 활동 현황을 기준으로 자동 생성되었습니다. 경영진 검토(G05)·외부 심사 대응(U05) 증빙으로 사용합니다.</p></body></html>`;
  const w = window.open("", "_blank"); if (!w) { console.warn("popup blocked"); return; } w.document.write(html); w.document.close();
  audit("report", "활동현황 리포트", { how: `${std === "ALL" ? "전체" : STD_LABEL[std]} 기준 ${acts.length}개 활동 출력` });
}

/* ─────────────── 요청함 (정보보호부문) ─────────────── */
function Inbox({ requests, setRequests, go }) {
  const col = { 접수: ST.warn[1], 처리중: C.steel, 완료: ST.ok[1], 반려: ST.gap[1] };
  const [sel, setSel] = useState(requests[0]?.id);
  const r = requests.find((x) => x.id === sel) || requests[0];
  const act = r && ACTS.find((x) => x.code === r.act);
  const upd = (id, patch, note) => { const cur = requests.find((x) => x.id === id); audit("process", `요청 #${id}`, { how: note, before: cur?.status, after: patch.status || cur?.status, note: cur?.title }); setRequests(requests.map((x) => (x.id === id ? { ...x, ...patch, log: [...x.log, `09-04 ${note}`] } : x))); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2"><h1 className="text-xl font-semibold">요청함</h1><span className="text-xs" style={{ color: C.mute }}>포털·Slack·Gmail·Claude에서 접수 → 처리 → 활동 증빙</span></div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[520px]">
            <thead><tr className="text-xs text-left" style={{ color: C.mute, background: C.bg }}><th className="px-3 py-2 font-normal">유형</th><th className="px-2 py-2 font-normal">내용</th><th className="px-2 py-2 font-normal">접수</th><th className="px-2 py-2 font-normal">기한</th><th className="px-2 py-2 font-normal">상태</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: C.line }}>
              {requests.map((x) => (
                <tr key={x.id} onClick={() => setSel(x.id)} className="cursor-pointer" style={{ background: r?.id === x.id ? "#EEF3F9" : undefined }}>
                  <td className="px-3 py-2.5"><Tag color={["사고", "유출", "기술유출"].includes(x.type) ? ST.gap[1] : C.mute}>{x.type}</Tag></td>
                  <td className="px-2 py-2.5"><div>{x.title}</div><div className="text-xs" style={{ color: C.mute }}>{x.by} · {x.src}</div></td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: C.mute }}>{x.at}</td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: x.due ? ST.gap[1] : C.mute }}>{x.due || "—"}</td>
                  <td className="px-2 py-2.5"><Tag color={col[x.status]}>{x.status}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
        <div className="md:col-span-2">
          {r && (
            <Card title={r.title} right={<Tag color={col[r.status]}>{r.status}</Tag>}>
              <div className="text-sm space-y-4">
                <table className="w-full text-xs"><tbody>
                  <tr><td className="py-0.5 w-16" style={{ color: C.mute }}>접수 경로</td><td>{r.src} · {r.by} · {r.at}</td></tr>
                  <tr><td className="py-0.5" style={{ color: C.mute }}>기한</td><td style={{ color: r.due ? ST.gap[1] : C.mute }}>{r.due ? `${r.due} (${TYPE_DUE[r.type]})` : "없음"}</td></tr>
                  <tr><td className="py-0.5" style={{ color: C.mute }}>증빙 활동</td><td><button className="focus:outline-none" style={{ color: C.steel }} onClick={() => go(act.d)}>{act.code} {act.title}</button></td></tr>
                </tbody></table>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>처리 이력</div>
                  <ul className="text-xs space-y-1">{r.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  {r.status === "접수" && <Btn small primary onClick={() => upd(r.id, { status: "처리중" }, "처리 시작")}>처리 시작</Btn>}
                  {r.status === "처리중" && <Btn small primary onClick={() => upd(r.id, { status: "완료" }, `처리 완료 → ${r.act} 증빙 저장`)}>완료</Btn>}
                  {["접수", "처리중"].includes(r.status) && <Btn small onClick={() => upd(r.id, { status: "반려" }, "반려")}>반려</Btn>}
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 임직원 화면 ─────────────── */
function EmpHome({ requests, go }) {
  const unread = POLICIES.filter((p) => !p.read).length, todo = MY_TRAININGS.filter((t) => !t.done).length, mine = requests.filter((r) => r.by === "김개발");
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">김개발님, 오늘 할 일</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[["읽지 않은 정책·규칙", unread, unread ? ST.warn[1] : ST.ok[1], "policies"], ["미완료 교육·서약", todo, todo ? ST.warn[1] : ST.ok[1], "training"], ["내 요청", mine.length, C.ink, "requests"]].map(([l, v, c, pg]) => (
          <button key={l} onClick={() => go(pg)} className="text-left bg-white px-4 py-3 focus:outline-none focus:ring-2 rounded-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-2xl font-semibold mt-1" style={{ color: c }}>{v}</div></button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card title="바로 하기"><div className="flex flex-wrap gap-2"><Btn primary onClick={() => go("requests")}>계정·권한 신청</Btn><Btn onClick={() => go("requests")}>보안사고·유출 신고</Btn><Btn onClick={() => go("requests")}>개인정보 처리 등록</Btn></div></Card>
        <Card title="정보보호부문 공지"><p className="text-sm leading-6">9월 피싱 모의훈련이 진행 중입니다. 송장·결제 위장 메일은 열지 말고 신고해 주세요. 정보보호 서약서는 9/30까지 제출 바랍니다.</p></Card>
      </div>
    </div>
  );
}
function EmpPolicies() {
  const [sel, setSel] = useState(0); const [read, setRead] = useState(POLICIES.map((p) => p.read));
  const p = POLICIES[sel];
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <ul className="md:col-span-2 bg-white divide-y" style={{ border: `1px solid ${C.line}`, borderRadius: 6, borderColor: C.line }}>
        {POLICIES.map((x, i) => <li key={x.code} onClick={() => setSel(i)} className="px-4 py-3 cursor-pointer" style={{ background: sel === i ? "#EEF3F9" : undefined }}><div className="flex justify-between"><span className="text-sm font-medium">{x.title}</span>{read[i] ? <Tag color={ST.ok[1]}>열람</Tag> : <Tag color={ST.warn[1]}>미열람</Tag>}</div><div className="text-xs mt-0.5" style={{ color: C.mute }}>{x.code} {x.cat} {x.ver} 시행 {x.date}</div></li>)}
      </ul>
      <div className="md:col-span-3"><Card title={`${p.code} ${p.title}`} right={<Tag>{p.ver}</Tag>}>
        <p className="text-sm leading-7">{p.body}</p>
        <div className="mt-6 pt-4 flex items-center gap-3" style={{ borderTop: `1px solid ${C.line}` }}><Btn primary onClick={() => { if (!read[sel]) audit("policy", p.code, { how: "열람 확인", note: p.title }); setRead(read.map((r, i) => (i === sel ? true : r))); }}>{read[sel] ? "열람 확인함" : "읽고 이해했습니다"}</Btn><span className="text-xs" style={{ color: C.mute }}>열람 확인은 G01 활동 증빙으로 저장됩니다.</span></div>
      </Card></div>
    </div>
  );
}
function EmpRequests({ requests, setRequests }) {
  const [f, setF] = useState({ type: "권한", title: "", detail: "" });
  const mine = requests.filter((r) => r.by === "김개발");
  const submit = () => { if (!f.title.trim()) return; audit("request", f.type, { how: "포털 요청 접수", note: f.title }); const due = f.type === "정보주체" ? "09-14" : f.type === "유출" ? "09-07 " + new Date().toTimeString().slice(0, 5) : undefined; setRequests([{ id: Date.now(), type: f.type, title: f.title, by: "김개발", at: "09-04", status: "접수", act: TYPE_ACT[f.type], src: "포털", due, log: ["09-04 포털 접수" + (due ? ` (기한 ${TYPE_DUE[f.type]}: ${due})` : "")] }, ...requests]); setF({ type: "권한", title: "", detail: "" }); };
  const col = { 접수: ST.warn[1], 처리중: C.steel, 완료: ST.ok[1], 반려: ST.gap[1] };
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <div className="md:col-span-2"><Card title="요청·신고">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">{REQ_TYPES.map((t) => <button key={t} onClick={() => setF({ ...f, type: t })} className="px-2.5 py-1 rounded-sm text-xs" style={{ background: f.type === t ? C.steel : "#fff", color: f.type === t ? "#fff" : C.ink, border: `1px solid ${C.line}` }}>{t}</button>)}</div>
          {TYPE_DUE[f.type] && <div className="text-xs" style={{ color: ST.gap[1] }}>{f.type === "유출" ? "접수 시각부터 72시간 내 신고 기한이 자동 계산됩니다." : "접수일부터 10일 내 처리 기한이 자동 계산됩니다."}</div>}
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={["사고", "유출", "기술유출"].includes(f.type) ? "무슨 일이 있었나요?" : "무엇이 필요한가요?"} className="w-full px-3 py-2 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
          <textarea value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} rows={4} placeholder="대상 시스템, 기간, 사유" className="w-full px-3 py-2 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
          <Btn primary onClick={submit}>{["사고", "유출", "기술유출"].includes(f.type) ? "신고하기" : "신청하기"}</Btn>
          <p className="text-xs" style={{ color: C.mute }}>Slack #security 또는 Claude에서도 같은 요청을 할 수 있습니다.</p>
        </div>
      </Card></div>
      <div className="md:col-span-3"><Card title="내 요청">
        <ul className="divide-y text-sm" style={{ borderColor: C.line }}>{mine.map((r) => <li key={r.id} className="py-2.5"><div className="flex items-center gap-2"><Tag>{r.type}</Tag><span>{r.title}</span><Tag color={col[r.status]}>{r.status}</Tag></div><div className="text-xs mt-0.5" style={{ color: C.mute }}>{r.log[r.log.length - 1]}</div></li>)}</ul>
      </Card></div>
    </div>
  );
}
function EmpTraining() {
  return (
    <Card title="내 교육·훈련·서약">
      <ul className="divide-y text-sm" style={{ borderColor: C.line }}>{MY_TRAININGS.map((t) => <li key={t.title} className="py-3 flex items-center gap-3"><Tag>{t.kind}</Tag><span>{t.title}</span><span className="text-xs" style={{ color: C.mute }}>마감 {t.due}</span><span className="ml-auto">{t.done ? <Tag color={ST.ok[1]}>완료</Tag> : <Btn small primary>{t.kind === "서약" ? "서명하기" : "수강하기"}</Btn>}</span></li>)}</ul>
    </Card>
  );
}

/* ─────────────── 일정·브리프 ('보안활동' Google Calendar) ─────────────── */
function useSecurityCalendar() {
  const [state, setState] = useState({ loading: true, events: [], error: null });
  useEffect(() => {
    let alive = true;
    fetch("/.netlify/functions/calendar")
      .then((r) => r.json())
      .then((j) => alive && setState({ loading: false, events: j.events || [], error: j.ok ? null : j.error || "읽기 실패" }))
      .catch((e) => alive && setState({ loading: false, events: [], error: String(e) }));
    return () => { alive = false; };
  }, []);
  return state;
}
// 브리프 본문: "[보안 뉴스]" 같은 대괄호 제목으로 구간을 나누고, "- " 줄을 항목으로 본다
function parseBrief(desc) {
  const secs = []; let cur = null;
  for (const raw of (desc || "").split("\n")) {
    const line = raw.trim(); if (!line) continue;
    const h = line.match(/^\[(.+)\]$/);
    if (h) { cur = { title: h[1], items: [] }; secs.push(cur); continue; }
    if (!cur) { cur = { title: "", items: [] }; secs.push(cur); }
    cur.items.push(line.replace(/^[-·•]\s*/, ""));
  }
  return secs;
}
const fmtDate = (d) => { if (!d) return ""; const [yy, mm, dd] = d.split("-"); const w = ["일", "월", "화", "수", "목", "금", "토"][new Date(+yy, +mm - 1, +dd).getDay()]; return `${+mm}/${+dd}(${w})`; };
function BriefCard({ brief, briefs, onPick, loading, error }) {
  const secs = parseBrief(brief?.desc);
  const isToday = brief?.date === TODAY;
  return (
    <div className="bg-white p-4" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-semibold">{isToday ? "오늘의 보안 브리프" : "보안 브리프"}</h2>
        {brief && <Tag color={isToday ? ST.ok[1] : C.mute}>{fmtDate(brief.date)}</Tag>}
        {!loading && !error && briefs.length > 1 && (
          <select value={brief?.id || ""} onChange={(e) => onPick(briefs.find((b) => b.id === e.target.value))} className="ml-auto text-xs rounded-sm px-2 py-1" style={{ border: `1px solid ${C.line}` }}>
            {briefs.map((b) => <option key={b.id} value={b.id}>{fmtDate(b.date)} 브리프</option>)}
          </select>
        )}
      </div>
      {loading ? <p className="text-xs" style={{ color: C.mute }}>'보안활동' 캘린더를 읽는 중…</p>
        : error ? <p className="text-xs" style={{ color: ST.gap[1] }}>캘린더를 읽지 못했습니다. ({error})</p>
        : !brief ? <p className="text-xs" style={{ color: C.mute }}>등록된 브리프가 없습니다. 매일 08:30 모닝 브리프가 '보안활동' 캘린더에 [브리프] 일정으로 등록되면 여기에 표시됩니다.</p>
        : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {secs.map((s, i) => (
              <div key={i}>
                {s.title && <div className="text-xs font-semibold mb-1.5" style={{ color: C.steel }}>{s.title}</div>}
                <ul className="text-xs space-y-1" style={{ color: C.ink }}>{s.items.map((t, j) => <li key={j} className="flex gap-1.5"><span style={{ color: C.mute }}>·</span><span>{t}</span></li>)}</ul>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
function Calendar({ go }) {
  const [ym, setYm] = useState([2026, 9]);
  const [filter, setFilter] = useState("ALL");
  const { loading, events, error } = useSecurityCalendar();
  const briefs = events.filter((e) => e.brief);
  const [picked, setPicked] = useState(null);
  const brief = picked || briefs.find((b) => b.date === TODAY) || briefs[0] || null;
  const [y, m] = ym;
  const first = new Date(y, m - 1, 1).getDay();
  const days = lastDay(y, m);
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const inMonth = OCC.filter((o) => o.due.startsWith(`${y}-${pad(m)}`) && (filter === "ALL" || o.act.d === filter));
  const byDay = {}; inMonth.forEach((o) => { const d = +o.due.slice(8); (byDay[d] = byDay[d] || []).push(o); });
  // Google Calendar 일정(브리프 포함)을 날짜별로
  const gByDay = {}; events.filter((e) => e.date.startsWith(`${y}-${pad(m)}`)).forEach((e) => { const d = +e.date.slice(8); (gByDay[d] = gByDay[d] || []).push(e); });
  const cnt = (s) => inMonth.filter((o) => o.status === s).length;
  const move = (k) => { let [yy, mm] = ym; mm += k; if (mm < 1) { mm = 12; yy--; } if (mm > 12) { mm = 1; yy++; } setYm([yy, mm]); };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">일정·브리프</h1>
      <BriefCard brief={brief} briefs={briefs} onPick={setPicked} loading={loading} error={error} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{y}년 {m}월</h1><Btn small onClick={() => move(-1)}>‹</Btn><Btn small onClick={() => move(1)}>›</Btn></div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {Object.entries(OST).map(([k, [l, c]]) => <span key={k} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: c }} />{l} {cnt(k)}</span>)}
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-sm px-2 py-1" style={{ border: `1px solid ${C.line}` }}><option value="ALL">모든 영역</option>{DOMAINS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
        </div>
      </div>
      <div className="bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
        <div className="grid grid-cols-7 text-xs" style={{ background: C.bg, color: C.mute }}>{["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}</div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const today = d && `${y}-${pad(m)}-${pad(d)}` === TODAY;
            return (
              <div key={i} className="min-h-14 md:min-h-24 p-1 md:p-1.5" style={{ borderTop: `1px solid ${C.line}`, borderLeft: i % 7 ? `1px solid ${C.line}` : undefined, background: d ? "#fff" : C.bg }}>
                {d && <div className="text-xs mb-1 w-5 h-5 flex items-center justify-center rounded-full" style={{ background: today ? C.ink : undefined, color: today ? "#fff" : C.mute }}>{d}</div>}
                {(gByDay[d] || []).map((e) => (
                  <button key={e.id} onClick={() => e.brief && setPicked(e)} title={e.title} className="w-full text-left text-xs px-1 py-0.5 mb-0.5 rounded-sm truncate focus:outline-none focus:ring-2" style={{ background: e.brief ? C.steel : C.bg, color: e.brief ? "#fff" : C.ink, border: e.brief ? undefined : `1px solid ${C.line}` }}>{e.brief ? "브리프" : e.title}</button>
                ))}
                {(byDay[d] || []).slice(0, 4).map((o) => (
                  <button key={o.act.code + o.period} onClick={() => go(o.act.d)} className="w-full text-left text-xs px-1 py-0.5 mb-0.5 rounded-sm truncate focus:outline-none focus:ring-2" style={{ background: OST[o.status][1] + "1A", color: OST[o.status][1], textDecoration: o.status === "done" ? "line-through" : undefined }}>{o.act.code} {o.act.title}</button>
                ))}
                {(byDay[d] || []).length > 4 && <div className="text-xs px-1" style={{ color: C.mute }}>+{byDay[d].length - 4}</div>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs" style={{ color: C.mute }}>'보안활동' Google Calendar를 5분 간격으로 읽어옵니다. 모닝 브리프는 매일 08:30 [브리프] 일정으로 등록됩니다. 알림: D-7·D-1 Slack DM, 기한 당일 #security, 지연 건은 매일 아침 묶음 발송.</p>
    </div>
  );
}

/* ─────────────── Claude 창 ─────────────── */
const CANNED = {
  "이번 주 활동 업데이트": "Drive·Slack·Calendar를 확인했습니다.\n\n변경 3건\n· L03 권한 검토 — Drive에 GWS 권한 덤프(09-03) 추가 → 증빙 1건 저장, 상태 진행\n· E02 모의훈련 — 결과 보고서 Drive 등록 → 수행 기록 생성, 상태 완료\n· U05 CSAP 대응 — #csap에 디딤 회신 스레드 → 증빙 링크 저장\n\n지연 2건\n· G02 조직·역할 지정 (기한 09-30, 임명 문서 미등록)\n· V02 처리방침 v2.0 (기한 09-30)\n\n조치가 필요한 것은 없습니다. change_log에 3건 기록했습니다.",
  "L03 권한 검토 시작": "L03 26-Q4 회차를 시작합니다.\n\n· 회차 2026-Q4 담당 이정민, 기한 10-15 지정\n· Drive 폴더 보안포털/03_내부유출/L03/2026-Q4 생성\n· #security-access에 시작 공지\n· 캘린더 이벤트 [L03] 분기 권한 검토 등록\n· 포털 상태 예정 → 진행\n\nGWS·GitHub·Slack 권한 덤프는 10-01 자동 수집 예정입니다.",
  "지연 활동 알려줘": "지연 5건 (09-04 기준)\n\n· G03 법규 목록 — 담당 미지정\n· L05 반출·DLP — 도구 미도입\n· T02 엔드포인트 — 도구 미도입\n· P06 서비스 로그 — 수집 구성 필요\n· A03 AI 영향평가 — 가드레일 대상 1건 미평가\n\n담당자 지정이 먼저 필요한 것은 G03·A03입니다. 지정해 드릴까요?",
};
function ClaudePanel() {
  const [msgs, setMsgs] = useState([{ r: "c", t: "보안포털에 연결돼 있습니다. Drive·Slack·Calendar를 읽고 활동 상태·증빙·일정을 갱신합니다. 권한 회수 같은 실제 조치는 제안만 하고 담당자가 실행합니다." }]);
  const [q, setQ] = useState("");
  const ask = (t) => { if (!t.trim()) return; const a = CANNED[t] || "프로토타입에서는 예시 3개만 응답합니다. 실운영에서는 Claude API + MCP(Drive·Slack·Calendar·Supabase)로 처리합니다."; setMsgs([...msgs, { r: "u", t }, { r: "c", t: a }]); setQ(""); };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Claude</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-3 bg-white flex flex-col" style={{ border: `1px solid ${C.line}`, borderRadius: 6, minHeight: 480 }}>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {msgs.map((m, i) => <div key={i} className={"text-sm whitespace-pre-line max-w-lg px-3 py-2 rounded-md " + (m.r === "u" ? "ml-auto text-white" : "")} style={{ background: m.r === "u" ? C.steel : C.bg }}>{m.t}</div>)}
          </div>
          <div className="p-3 flex gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} placeholder="활동 업데이트, 회차 시작, 지연 확인…" className="flex-1 text-sm px-3 py-2 rounded-sm focus:outline-none focus:ring-2" style={{ border: `1px solid ${C.line}` }} />
            <Btn primary onClick={() => ask(q)}>보내기</Btn>
          </div>
        </div>
        <div className="md:col-span-2 space-y-3">
          <Card title="바로 요청">
            <div className="flex flex-col gap-2">{Object.keys(CANNED).map((k) => <Btn key={k} small onClick={() => ask(k)}>{k}</Btn>)}</div>
          </Card>
          <Card title="정기 갱신">
            <ul className="text-xs space-y-1.5" style={{ color: C.ink }}>
              <li>매일 08:30 — 회차 지연 전환, D-7·D-1·당일 기한·요청 기한·지적사항 기한을 #security 발송, [브리프] 캘린더 등록</li>
              <li>매월 1일 — GWS·GitHub·Slack 권한·자산 스냅샷 수집 → L01·L03·L04 증빙 저장</li>
              <li>매시간 — C-TAS IOC 수집, 24시간 미반영·만료 IOC를 #security-threat 알림</li>
            </ul>
            <p className="text-xs mt-3" style={{ color: C.mute }}>모든 변경은 change_log에 actor=claude로 남습니다.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 앱 ─────────────── */
const EMP_NAV = [["ehome", "홈"], ["policies", "정책·규칙 읽기"], ["requests", "요청·신고"], ["epia", "개인정보 현황 입력"], ["training", "내 교육·서약"]];
export default function App() {
  const [role, setRole] = useState("security");
  const [page, setPage] = useState("overview");
  const [std, setStd] = useState("ALL");
  const [requests, setRequests] = useState(INIT_REQUESTS);
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const nav = [["overview", "현황"], ["calendar", "일정·브리프"], ["inbox", "요청함"], ["findings", "지적사항"], ["package", "심사 대응 패키지"], ["audit", "로그점검"], ["claude", "Claude"]];
  const open = requests.filter((r) => ["접수", "처리중"].includes(r.status)).length;
  const switchRole = (r) => { setUser(r === "employee" ? "김개발" : "이정민"); audit("login", "보안포털", { how: `${r === "employee" ? "임직원" : "정보보호부문"} 역할로 접속` }); setRole(r); setPage(r === "employee" ? "ehome" : "overview"); };
  const isEmp = role === "employee";
  const body = isEmp
    ? page === "policies" ? <EmpPolicies /> : page === "requests" ? <EmpRequests requests={requests} setRequests={setRequests} /> : page === "epia" ? <EmpPia /> : page === "training" ? <EmpTraining /> : <EmpHome requests={requests} go={setPage} />
    : page === "overview" ? <Overview go={setPage} std={std} setStd={setStd} /> : page === "calendar" ? <Calendar go={setPage} /> : page === "inbox" ? <Inbox requests={requests} setRequests={setRequests} go={setPage} /> : page === "pia" ? <PiaTool go={setPage} /> : page === "audit" ? <AuditPage /> : page === "findings" ? <FindingsPage go={setPage} /> : page === "package" ? <AuditPackage std={std} setStd={setStd} /> : page === "claude" ? <ClaudePanel /> : <Domain key={page + std} code={page} std={std} go={setPage} onChange={refresh} />;
  const [menu, setMenu] = useState(false);
  const goPage = (k) => { setPage(k); setMenu(false); };
  const title = isEmp ? (EMP_NAV.find(([k]) => k === page) || [])[1] : page === "pia" ? "개인정보 흐름도·영향평가" : (nav.find(([k]) => k === page) || [])[1] || DOMAINS.find((d) => d.code === page)?.name || "";
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: C.bg, color: C.ink, fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif" }}>
      <header className="md:hidden flex items-center gap-3 px-4 py-3 text-white sticky top-0 z-30" style={{ background: C.rail }}>
        <button onClick={() => setMenu(!menu)} aria-label="메뉴" className="w-9 h-9 flex items-center justify-center rounded-sm focus:outline-none focus:ring-2" style={{ background: "rgba(255,255,255,.1)" }}>
          <span className="text-lg leading-none">{menu ? "✕" : "☰"}</span>
        </button>
        <div className="min-w-0"><div className="text-sm font-semibold truncate">CCK 보안포털</div><div className="text-xs truncate" style={{ color: "#8A97AB" }}>{title}</div></div>
      </header>
      {menu && <div className="md:hidden fixed inset-0 z-30" style={{ background: "rgba(0,0,0,.45)", top: 56 }} onClick={() => setMenu(false)} />}
      <aside className={(menu ? "flex" : "hidden") + " md:flex fixed md:static z-40 md:z-auto left-0 w-64 md:w-52 shrink-0 flex-col text-white overflow-y-auto"} style={{ background: C.rail, top: 56, bottom: 0 }}>
        <div className="px-5 pt-5 pb-4"><div className="text-base font-semibold tracking-tight">CCK 보안포털</div><div className="text-xs mt-0.5" style={{ color: "#8A97AB" }}>{isEmp ? "임직원" : "정보보호부문 · 관리자"}</div></div>
        <nav className="flex-1 px-2 overflow-y-auto">
          {(isEmp ? EMP_NAV : nav).map(([k, v]) => <button key={k} onClick={() => goPage(k)} className="w-full flex items-center text-left text-sm px-3 py-2 rounded-sm mb-0.5 focus:outline-none focus:ring-2" style={{ background: page === k ? "rgba(255,255,255,.12)" : "transparent", color: page === k ? "#fff" : "#B5BFCD" }}>{v}{k === "inbox" && open > 0 && <span className="ml-auto text-xs px-1.5 rounded-sm" style={{ background: "rgba(183,121,31,.35)", color: "#F0D9A8" }}>{open}</span>}</button>)}
          {!isEmp && <>
            <div className="text-xs px-3 pt-4 pb-1.5" style={{ color: "#6E7C91" }}>보안 영역</div>
            {DOMAINS.map((d, i) => {
              const gap = ACTS.filter((x) => x.d === d.code && x.status === "gap").length;
              return (
                <button key={d.code} onClick={() => goPage(d.code)} className="w-full flex items-center text-left text-sm px-3 py-2 rounded-sm mb-0.5 focus:outline-none focus:ring-2" style={{ background: page === d.code ? "rgba(255,255,255,.12)" : "transparent", color: page === d.code ? "#fff" : "#B5BFCD" }}>
                  <span className="text-xs w-5 shrink-0" style={{ color: "#6E7C91" }}>{i + 1}</span><span className="truncate">{d.name}</span>
                  {gap > 0 && <span className="ml-auto text-xs px-1.5 rounded-sm" style={{ background: "rgba(178,58,58,.35)", color: "#F2B8B8" }}>{gap}</span>}
                </button>
              );
            })}
          </>}
        </nav>
        <div className="px-3 py-3 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <div className="mb-1.5" style={{ color: "#8A97AB" }}>프로토타입 · 사용자 전환</div>
          <select value={role} onChange={(e) => switchRole(e.target.value)} className="w-full rounded-sm px-2 py-1.5 text-white" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)" }}>
            <option value="security" style={{ color: "#000" }}>이정민 · 정보보호부문</option>
            <option value="employee" style={{ color: "#000" }}>김개발 · 임직원</option>
          </select>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-4 py-4 md:px-8 md:py-6 max-w-6xl">{body}</main>
    </div>
  );
}
