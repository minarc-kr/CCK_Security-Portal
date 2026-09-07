import { useState, useEffect, useMemo, useRef } from "react";
import { C, store, audit, Tag, Btn, Card } from "./common.jsx";
import { COLL_COLS, RET_COLS, PROV_COLS, IMP_COLS, RISK_ITEMS, RISK_LEVELS, RISK_COLOR, RISK_FILL_DOCX, STEPS, newRow, blankPia, INTRO_QUESTIONS, QUESTIONS, tasksToRows, SENS_RE } from "./pia-data.js";
import { flowDiagramSVG } from "./pia-flow.js";

const today = () => new Date().toISOString().slice(0, 10);
const dl = (blob, name) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 1500);
};
const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/* ─────────────── 저장소 ─────────────── */
function loadPia() { const s = store.get("pia", null); return s ? { ...blankPia(), ...s } : blankPia(); }
function savePia(s) { store.set("pia", { ...s, updatedAt: new Date().toISOString() }); }

/* ─────────────── 표 편집기 ─────────────── */
function TableEditor({ rows, cols, onChange, empty }) {
  const set = (ri, k, v) => { const n = rows.map((r, i) => (i === ri ? { ...r, [k]: v } : r)); onChange(n); };
  const del = (ri) => onChange(rows.filter((_, i) => i !== ri));
  return (
    <div>
      <div className="overflow-x-auto bg-white" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
        <table className="text-xs" style={{ minWidth: cols.reduce((a, c) => a + c.w, 40) }}>
          <thead><tr style={{ background: C.bg, color: C.mute }}>
            {cols.map((c) => <th key={c.k} className="px-2 py-2 font-normal text-left" style={{ minWidth: c.w }}>{c.l}</th>)}
            <th style={{ width: 34 }} />
          </tr></thead>
          <tbody className="divide-y" style={{ borderColor: C.line }}>
            {rows.length === 0 && <tr><td colSpan={cols.length + 1} className="px-3 py-6 text-center" style={{ color: C.mute }}>{empty || "행이 없습니다. 아래 ‘행 추가’ 또는 현업 입력 불러오기를 이용하세요."}</td></tr>}
            {rows.map((r, ri) => (
              <tr key={ri} className="align-top">
                {cols.map((c) => (
                  <td key={c.k} className="px-1.5 py-1.5">
                    {c.type === "select"
                      ? <select value={r[c.k] || ""} onChange={(e) => set(ri, c.k, e.target.value)} className="w-full text-xs px-1 py-1 rounded-sm" style={{ border: `1px solid ${C.line}` }}>
                          <option value="">선택</option>{c.opts.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      : <textarea rows={2} value={r[c.k] || ""} onChange={(e) => set(ri, c.k, e.target.value)} placeholder={c.l} className="w-full text-xs px-1.5 py-1 rounded-sm resize-y" style={{ border: `1px solid ${C.line}`, minWidth: c.w - 10 }} />}
                  </td>
                ))}
                <td className="px-1 py-1.5 text-center"><button onClick={() => del(ri)} className="text-xs px-1.5 py-0.5 rounded-sm" style={{ color: "#B23A3A", border: `1px solid ${C.line}` }}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex gap-2"><Btn small onClick={() => onChange([...rows, newRow(cols)])}>행 추가</Btn><span className="text-xs self-center" style={{ color: C.mute }}>{rows.length}행</span></div>
    </div>
  );
}

/* ─────────────── 입력 현황 통계 ─────────────── */
function StatsPanel({ s }) {
  const st = useMemo(() => {
    const coll = s.collection.filter((r) => r.업무명), ret = s.retention.filter((r) => r.업무명), prov = s.provision.filter((r) => r.업무명);
    const tasks = [...new Set([...coll, ...ret, ...prov].map((r) => r.업무명))];
    const byDept = {}; coll.forEach((r) => { const d = r.수집담당자 || "(미지정)"; byDept[d] = (byDept[d] || 0) + 1; });
    const sens = coll.filter((r) => SENS_RE.test(r.수집항목 || "")).map((r) => r.업무명);
    const provT = prov.filter((r) => r.수신자).map((r) => r.업무명);
    const enc = ret.filter((r) => r.암호화항목 && !/^(없음|없|모르겠음|x)$/i.test(String(r.암호화항목).trim())).map((r) => r.업무명);
    const missing = [];
    coll.forEach((r) => { const m = []; ["수집근거", "수집항목", "수집목적"].forEach((k) => { if (!r[k]) m.push(k); }); if (m.length) missing.push(`${r.업무명}: ${m.join("·")}`); });
    prov.forEach((r) => { if (!r.보관기간) missing.push(`${r.업무명}: 보관기간`); });
    return { tasks, byDept, sens: [...new Set(sens)], provT: [...new Set(provT)], enc: [...new Set(enc)], missing };
  }, [s]);
  if (!st.tasks.length) return null;
  const risk = st.sens.filter((t) => !st.enc.includes(t));
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[["처리업무", st.tasks.length, C.steel], ["민감·고유식별정보", st.sens.length, st.sens.length ? "#B7791F" : C.mute], ["외부 제공·위탁", st.provT.length, st.provT.length ? "#B7791F" : C.mute], ["암호화 미확인", risk.length, risk.length ? "#B23A3A" : "#2E7D5B"]].map(([l, v, c]) => (
        <div key={l} className="bg-white px-3 py-2.5" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
          <div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-lg font-semibold" style={{ color: c }}>{v}</div>
        </div>
      ))}
      {(risk.length > 0 || st.missing.length > 0) && (
        <div className="col-span-2 md:col-span-4 text-xs px-3 py-2.5 space-y-1" style={{ background: "#FFF7F7", border: `1px solid #F0D5D5`, borderRadius: 6 }}>
          {risk.length > 0 && <div><b style={{ color: "#B23A3A" }}>민감정보를 다루면서 암호화가 확인되지 않은 업무 {risk.length}건</b> — {risk.slice(0, 6).join(", ")}{risk.length > 6 ? " 외" : ""}</div>}
          {st.missing.length > 0 && <div style={{ color: C.mute }}>필수 항목 미입력 {st.missing.length}건 — {st.missing.slice(0, 4).join(" / ")}{st.missing.length > 4 ? " 외" : ""}</div>}
        </div>
      )}
      {Object.keys(st.byDept).length > 0 && (
        <div className="col-span-2 md:col-span-4 text-xs flex flex-wrap gap-1.5">
          <span style={{ color: C.mute }}>부서별</span>{Object.entries(st.byDept).map(([d, n]) => <Tag key={d}>{d} {n}</Tag>)}
        </div>
      )}
    </div>
  );
}

/* ─────────────── 흐름도 화면 ─────────────── */
function FlowView({ s }) {
  const tasks = useMemo(() => [...new Set([...s.collection, ...s.retention, ...s.provision].filter((r) => r.업무명).map((r) => r.업무명))], [s]);
  const [sel, setSel] = useState("__ALL__");
  const task = sel === "__ALL__" ? null : sel;
  const svg = useMemo(() => flowDiagramSVG(s, task), [s, task]);
  const wrap = useRef(null);

  const saveSvg = () => { if (!svg) return; dl(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `pia_flowmap_${task ? "task" : "all"}_${today()}.svg`); audit("pia_export", "V01", { how: "흐름도 SVG 내보내기", note: task || "총괄" }); };
  const savePng = () => {
    if (!svg) return;
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = img.width * 2; cv.height = img.height * 2;
      const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob((b) => dl(b, `pia_flowmap_${task ? "task" : "all"}_${today()}.png`));
      audit("pia_export", "V01", { how: "흐름도 PNG 내보내기", note: task || "총괄" });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={sel} onChange={(e) => { setSel(e.target.value); audit("pia_flow", "V01", { how: "흐름도 생성", note: e.target.value === "__ALL__" ? "총괄" : e.target.value }); }} className="text-sm px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }}>
          <option value="__ALL__">총괄 흐름도 (전체 업무)</option>
          {tasks.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Btn small onClick={saveSvg} disabled={!svg}>SVG 저장</Btn>
        <Btn small onClick={savePng} disabled={!svg}>PNG 저장</Btn>
      </div>
      {svg ? (
        <>
          <div ref={wrap} className="bg-white overflow-x-auto p-3" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }} dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="flex flex-wrap gap-4 text-xs" style={{ color: C.mute }}>
            <span><span className="inline-block w-6 align-middle" style={{ borderTop: `2px solid ${C.mute}` }} /> 온라인(실선)</span>
            <span><span className="inline-block w-6 align-middle" style={{ borderTop: `2px dashed ${C.mute}` }} /> 오프라인(점선)</span>
            <span><span className="inline-block w-6 align-middle" style={{ borderTop: "3px solid #B23A3A" }} /> 암호화·보호전송</span>
            <span>흰색 정보주체 · 회색 취급부서 · 노랑 외부기관</span>
          </div>
        </>
      ) : (
        <div className="text-sm px-4 py-8 text-center bg-white" style={{ border: `1px solid ${C.line}`, borderRadius: 6, color: C.mute }}>
          수집·보유·제공 흐름표에 업무명을 먼저 입력하면 흐름도가 자동으로 그려집니다.
        </div>
      )}
    </div>
  );
}

/* ─────────────── 침해요인 분석 ─────────────── */
function RiskView({ s, onChange }) {
  const set = (code, field, v) => onChange({ ...s, risks: { ...s.risks, [code]: { ...(s.risks[code] || {}), [field]: v } } });
  const areas = [...new Set(RISK_ITEMS.map((r) => r.area))];
  const done = RISK_ITEMS.filter((r) => s.risks[r.code]?.level).length;
  const bad = RISK_ITEMS.filter((r) => ["미이행", "부분이행"].includes(s.risks[r.code]?.level));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Tag color={C.steel}>평가 {done}/{RISK_ITEMS.length}</Tag>
        <Tag color={bad.length ? "#B23A3A" : "#2E7D5B"}>미이행·부분이행 {bad.length}</Tag>
        <span style={{ color: C.mute }}>미이행·부분이행 항목은 7단계 개선계획으로 자동 넘길 수 있습니다.</span>
      </div>
      {areas.map((a) => (
        <div key={a} className="bg-white" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
          <div className="px-3 py-2 text-sm font-semibold" style={{ borderBottom: `1px solid ${C.line}`, background: C.bg }}>{a}</div>
          <div className="divide-y" style={{ borderColor: C.line }}>
            {RISK_ITEMS.filter((r) => r.area === a).map((r) => {
              const v = s.risks[r.code] || {};
              return (
                <div key={r.code} className="px-3 py-2 grid grid-cols-1 md:grid-cols-12 gap-2 items-start">
                  <div className="md:col-span-4 text-sm"><span className="text-xs mr-1.5" style={{ color: C.mute }}>{r.code}</span>{r.item}{r.act && <span className="ml-1.5"><Tag>{r.act}</Tag></span>}</div>
                  <div className="md:col-span-3 flex gap-1 flex-wrap">
                    {RISK_LEVELS.map((lv) => (
                      <button key={lv} onClick={() => { set(r.code, "level", lv); audit("pia_risk", r.code, { how: `침해요인 평가 ${lv}`, before: v.level || "미평가", after: lv, note: r.item }); }}
                        className="text-xs px-2 py-1 rounded-sm" style={v.level === lv ? { background: RISK_COLOR[lv], color: "#fff" } : { border: `1px solid ${C.line}`, color: C.mute, background: "#fff" }}>{lv}</button>
                    ))}
                  </div>
                  <div className="md:col-span-5"><input value={v.memo || ""} onChange={(e) => set(r.code, "memo", e.target.value)} placeholder="현황·근거 메모" className="w-full text-xs px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── 관리자 도구 본체 ─────────────── */
export default function PiaTool() {
  const [s, setS] = useState(loadPia);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const upd = (n) => { setS(n); savePia(n); };
  useEffect(() => { audit("view", "V01", { how: "개인정보 흐름도·영향평가 도구 열람" }); }, []);
  const note = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3500); };

  const importTasks = (tasks, dept, src) => {
    const { coll, ret, prov } = tasksToRows(tasks, dept);
    const n = { ...s, collection: [...s.collection, ...coll], retention: [...s.retention, ...ret], provision: [...s.provision, ...prov], intakeLog: [...s.intakeLog, { 부서: dept, 업무수: tasks.length, 출처: src, at: today() }] };
    upd(n);
    audit("pia_import", "V01", { how: `현업 입력 불러오기 ${tasks.length}건`, note: `${dept} · ${src}` });
    note(`${dept} ${tasks.length}건을 흐름표에 추가했습니다.`);
  };

  const pullSubmissions = () => {
    const subs = store.get("piaIntake", []);
    const used = new Set(s.intakeLog.filter((l) => l.출처?.startsWith("포털")).map((l) => l.출처));
    const fresh = subs.filter((x) => !used.has(`포털 제출 ${x.id}`));
    if (!fresh.length) return note("새로 제출된 현업 입력이 없습니다.");
    fresh.forEach((x) => importTasks(x.tasks, x.부서 || "(미상)", `포털 제출 ${x.id}`));
  };

  const importFiles = (files) => {
    Array.from(files || []).forEach((f) => {
      const rd = new FileReader();
      rd.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const tasks = Array.isArray(data) ? data : data.tasks || [];
          if (!tasks.length) return note(`${f.name}: 업무 데이터가 없습니다.`);
          importTasks(tasks, data.부서 || (tasks.find((t) => t.수집담당자) || {}).수집담당자 || "(미상)", `파일 ${f.name}`);
        } catch (err) { note(`${f.name}: JSON 형식이 아닙니다.`); }
      };
      rd.readAsText(f);
    });
  };

  const fillImprovement = () => {
    const bad = RISK_ITEMS.filter((r) => ["미이행", "부분이행"].includes(s.risks[r.code]?.level));
    if (!bad.length) return note("미이행·부분이행 항목이 없습니다.");
    const have = new Set(s.improvement.map((r) => r.평가항목));
    const add = bad.filter((r) => !have.has(`${r.code} ${r.item}`)).map((r) => ({
      평가항목: `${r.code} ${r.item}`, 위험수준: s.risks[r.code].level === "미이행" ? "높음" : "보통",
      현황: s.risks[r.code].memo || "", 개선방안: "", 담당부서: "", 이행기한: s.risks[r.code].level === "미이행" ? "단기(2개월이내)" : "장기(1년이내)",
    }));
    if (!add.length) return note("이미 모두 개선계획에 있습니다.");
    upd({ ...s, improvement: [...s.improvement, ...add] });
    note(`${add.length}건을 개선계획에 추가했습니다.`);
  };

  const exportCsv = () => {
    const sec = (title, cols, rows) => [title, cols.map((c) => csvCell(c.l)).join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c.k])).join(",")), ""].join("\n");
    const body = ["\ufeff개인정보 흐름표 — " + (s.project.systemName || "미입력") + " / " + today(), "",
      sec("[수집]", COLL_COLS, s.collection), sec("[보유·이용]", RET_COLS, s.retention), sec("[제공·파기]", PROV_COLS, s.provision),
      sec("[개선계획]", IMP_COLS, s.improvement),
      "[침해요인]", "코드,영역,평가항목,평가,메모",
      ...RISK_ITEMS.map((r) => [r.code, r.area, r.item, s.risks[r.code]?.level || "", s.risks[r.code]?.memo || ""].map(csvCell).join(",")),
    ].join("\n");
    dl(new Blob([body], { type: "text/csv;charset=utf-8" }), `pia_flowtable_${today()}.csv`);
    audit("pia_export", "V01", { how: "흐름표 CSV 내보내기" });
  };

  const [busy, setBusy] = useState(false);
  const exportDocx = async () => {
    setBusy(true);
    try {
      const svg = flowDiagramSVG(s, null);
      let png = null;
      if (svg) png = await new Promise((res) => {
        const img = new Image();
        img.onload = () => { const cv = document.createElement("canvas"); cv.width = img.width * 1.6; cv.height = img.height * 1.6; const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height); cv.toBlob((b) => b.arrayBuffer().then(res), "image/png"); };
        img.onerror = () => res(null);
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
      });
      const d = await import("docx");
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType, ImageRun } = d;
      const bd = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
      const borders = { top: bd, bottom: bd, left: bd, right: bd };
      const margins = { top: 80, bottom: 80, left: 110, right: 110 };
      const HEAD = "2E5C8A";
      const cell = (t, head, fill) => new TableCell({ borders, margins, ...(head || fill ? { shading: { fill: head ? HEAD : fill, type: ShadingType.CLEAR } } : {}), children: [new Paragraph({ alignment: head ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text: String(t ?? ""), bold: !!head, color: head ? "FFFFFF" : "000000", size: 16, font: "맑은 고딕" })] })] });
      const table = (cols, rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: cols.map((c) => cell(c.l, true)) }), ...(rows.length ? rows : [newRow(cols)]).map((r) => new TableRow({ children: cols.map((c) => cell(r[c.k])) }))] });
      const h = (t, lvl) => new Paragraph({ heading: lvl || HeadingLevel.HEADING_2, spacing: { before: 260, after: 120 }, children: [new TextRun({ text: t, bold: true, font: "맑은 고딕" })] });
      const p = (t) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, size: 18, font: "맑은 고딕" })] });
      const pr = s.project;
      const kids = [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: "개인정보 흐름 분석 및 영향평가", bold: true, size: 36, font: "맑은 고딕" })] }),
        p(`대상 시스템: ${pr.systemName || "미입력"}   /   기관: ${pr.orgName || "미입력"}`),
        p(`평가기간: ${pr.evalPeriod || "미입력"}   /   유형: ${pr.systemType}   /   작성일: ${today()}`),
        h("1. 사업 개요"),
        table([{ k: "항목", l: "항목", w: 100 }, { k: "내용", l: "내용", w: 300 }], [
          { 항목: "정보주체", 내용: pr.dataSubject }, { 항목: "처리 규모", 내용: pr.personalDataCount },
          { 항목: "민감정보 처리", 내용: pr.sensitivData }, { 항목: "제3자 제공", 내용: pr.thirdPartyProvision },
          { 항목: "AI 시스템 포함", 내용: pr.aiSystem }, { 항목: "평가 목적", 내용: pr.evalPurpose },
          { 항목: "평가팀", 내용: pr.evalTeam }, { 항목: "추진 배경", 내용: pr.background },
        ]),
        h("2. 수집 흐름표"), table(COLL_COLS, s.collection),
        h("3. 보유·이용 흐름표"), table(RET_COLS, s.retention),
        h("4. 제공·파기 흐름표"), table(PROV_COLS, s.provision),
        h("5. 개인정보 흐름도"),
      ];
      if (png) kids.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: png, transformation: { width: 600, height: Math.round(600 * 0.62) } })] }));
      else kids.push(p("(흐름표 입력이 없어 흐름도를 생성하지 못했습니다.)"));
      kids.push(h("6. 침해요인 분석"));
      kids.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({ children: [cell("코드", true), cell("영역", true), cell("평가항목", true), cell("평가", true), cell("현황·메모", true)] }),
        ...RISK_ITEMS.map((r) => { const v = s.risks[r.code] || {}; return new TableRow({ children: [cell(r.code), cell(r.area), cell(r.item), cell(v.level || "미평가", false, RISK_FILL_DOCX[v.level]), cell(v.memo || "")] }); })],
      }));
      kids.push(h("7. 개선계획"), table(IMP_COLS, s.improvement));
      const doc = new Document({ sections: [{ children: kids }] });
      const blob = await Packer.toBlob(doc);
      dl(blob, `pia_report_${today()}.docx`);
      audit("pia_export", "V06", { how: "영향평가서 docx 내보내기", note: pr.systemName || "" });
      note("Word 문서를 내려받았습니다.");
    } catch (e) { note("문서 생성 실패: " + e.message); }
    setBusy(false);
  };

  const reset = () => {
    if (!confirm("입력한 흐름표·평가 내용을 모두 지웁니다. 계속할까요?")) return;
    const n = blankPia(); upd(n); setStep(0);
    audit("pia_reset", "V01", { how: "개인정보 흐름표 초기화" });
  };

  const sid = STEPS[step].id;
  const P = s.project, setP = (k, v) => upd({ ...s, project: { ...P, [k]: v } });
  const field = (k, label, ph, opts) => (
    <div><label className="block text-xs mb-1" style={{ color: C.mute }}>{label}</label>
      {opts ? <select value={P[k]} onChange={(e) => setP(k, e.target.value)} className="w-full text-sm px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
        : <input value={P[k]} onChange={(e) => setP(k, e.target.value)} placeholder={ph} className="w-full text-sm px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }} />}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">개인정보 흐름도·영향평가</h1>
          <div className="text-xs mt-1" style={{ color: C.mute }}>V01 처리현황·흐름도 관리 · V06 개인정보 영향평가 — 개인정보보호법 33조, ISMS-P 3.2.1</div>
        </div>
        <div className="flex gap-2"><Btn small onClick={exportCsv}>흐름표 CSV</Btn><Btn small primary onClick={exportDocx} disabled={busy}>{busy ? "생성 중…" : "영향평가서 Word"}</Btn><Btn small onClick={reset}>초기화</Btn></div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STEPS.map((st, i) => (
          <button key={st.id} onClick={() => setStep(i)} className="text-xs px-2.5 py-1.5 rounded-sm" style={step === i ? { background: C.steel, color: "#fff" } : { background: "#fff", border: `1px solid ${C.line}`, color: C.mute }}>{st.label}</button>
        ))}
      </div>

      {msg && <div className="text-xs px-3 py-2 rounded-sm" style={{ background: "#EEF3F9", color: C.steel }}>{msg}</div>}

      {sid === "project" && (
        <div className="space-y-4">
          <Card title="현업 입력 불러오기" right={<Tag>{s.intakeLog.length}회 반영</Tag>}>
            <p className="text-xs mb-2" style={{ color: C.mute }}>임직원이 포털 「개인정보 현황 입력」에서 제출한 내용을 가져오거나, 내려받은 .json 파일을 올리면 수집·보유·제공 흐름표가 자동으로 채워집니다. 여러 부서 것을 연달아 불러오면 누적됩니다.</p>
            <p className="text-xs mb-3 px-2 py-1.5 rounded-sm" style={{ background: "#FFF9EC", color: "#8A6516" }}>DB 연결 전이라 「포털 제출분」은 <b>같은 브라우저에서 입력한 것만</b> 보입니다. 다른 부서 것은 담당자가 「JSON으로 저장」해 보낸 파일을 올려주세요. Supabase 연결 후 자동으로 모이게 바뀝니다.</p>
            <div className="flex flex-wrap gap-2 items-center">
              <Btn small primary onClick={pullSubmissions}>포털 제출분 가져오기</Btn>
              <label className="text-xs px-2.5 py-1 rounded-sm cursor-pointer" style={{ border: `1px solid ${C.line}` }}>JSON 파일 선택<input type="file" accept=".json,application/json" multiple className="hidden" onChange={(e) => importFiles(e.target.files)} /></label>
            </div>
            {s.intakeLog.length > 0 && <ul className="mt-3 text-xs divide-y" style={{ borderColor: C.line }}>{s.intakeLog.slice(-6).reverse().map((l, i) => <li key={i} className="py-1.5 flex justify-between"><span>{l.부서} · {l.업무수}건</span><span style={{ color: C.mute }}>{l.출처} · {l.at}</span></li>)}</ul>}
          </Card>
          <StatsPanel s={s} />
          <Card title="사업 개요">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {field("orgName", "기관·회사명", "예: CCK솔루션")}
              {field("systemName", "대상 시스템명", "예: AI 업무 플랫폼")}
              {field("evalPeriod", "평가기간", "예: 2026.09 ~ 2026.10")}
              {field("systemType", "시스템 유형", "", ["신규구축", "기존변경", "운영중"])}
              {field("dataSubject", "정보주체", "예: 임직원, 고객, 지원자")}
              {field("personalDataCount", "처리 규모", "예: 약 5만 명")}
              {field("sensitivData", "민감정보 처리", "", ["없음", "있음"])}
              {field("thirdPartyProvision", "제3자 제공·위탁", "", ["없음", "있음"])}
              {field("aiSystem", "AI 시스템 포함", "", ["없음", "있음"])}
              {field("evalTeam", "평가팀", "예: 정보보호부문, 개발팀")}
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="block text-xs mb-1" style={{ color: C.mute }}>평가 목적</label><textarea rows={3} value={P.evalPurpose} onChange={(e) => setP("evalPurpose", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }} /></div>
              <div><label className="block text-xs mb-1" style={{ color: C.mute }}>추진 배경</label><textarea rows={3} value={P.background} onChange={(e) => setP("background", e.target.value)} className="w-full text-sm px-2 py-1.5 rounded-sm" style={{ border: `1px solid ${C.line}` }} /></div>
            </div>
          </Card>
        </div>
      )}

      {sid === "collection" && <TableEditor rows={s.collection} cols={COLL_COLS} onChange={(r) => { upd({ ...s, collection: r }); audit("pia_save", "V01", { how: "수집 흐름표 편집" }); }} />}
      {sid === "retention" && <TableEditor rows={s.retention} cols={RET_COLS} onChange={(r) => { upd({ ...s, retention: r }); audit("pia_save", "V01", { how: "보유·이용 흐름표 편집" }); }} />}
      {sid === "provision" && <TableEditor rows={s.provision} cols={PROV_COLS} onChange={(r) => { upd({ ...s, provision: r }); audit("pia_save", "V01", { how: "제공·파기 흐름표 편집" }); }} />}
      {sid === "flowmap" && <FlowView s={s} />}
      {sid === "risk" && <RiskView s={s} onChange={upd} />}
      {sid === "improvement" && (
        <div className="space-y-3">
          <div className="flex gap-2"><Btn small onClick={fillImprovement}>미이행·부분이행 항목 불러오기</Btn></div>
          <TableEditor rows={s.improvement} cols={IMP_COLS} onChange={(r) => upd({ ...s, improvement: r })} empty="침해요인 분석에서 미이행·부분이행 항목을 불러오거나 직접 추가하세요." />
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Btn small onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>← 이전</Btn>
        <Btn small primary onClick={() => setStep(Math.min(STEPS.length - 1, step + 1))} disabled={step === STEPS.length - 1}>다음 →</Btn>
      </div>
    </div>
  );
}

/* ══════════════ 임직원: 개인정보 현황 입력 봇 ══════════════ */
const visibleQs = (provSkip) => QUESTIONS.filter((q) => !(q.cond === "prov" && provSkip));

export function EmpPia() {
  const [intro, setIntro] = useState(() => store.get("piaDraft", {}).intro || { 부서: "", 담당자: "" });
  const [ii, setIi] = useState(() => (store.get("piaDraft", {}).intro?.담당자 ? 2 : 0));
  const [cur, setCur] = useState(() => store.get("piaDraft", {}).cur || {});
  const [qi, setQi] = useState(() => store.get("piaDraft", {}).qi || 0);
  const [tasks, setTasks] = useState(() => store.get("piaDraft", {}).tasks || []);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [editTask, setEditTask] = useState(null);
  const provSkip = cur.__provYN === "아니오, 내부만 이용";
  const qs = visibleQs(provSkip);
  const inIntro = ii < INTRO_QUESTIONS.length;
  const q = inIntro ? INTRO_QUESTIONS[ii] : qs[qi];
  const done = !inIntro && qi >= qs.length;

  useEffect(() => { store.set("piaDraft", { intro, cur, qi, tasks }); }, [intro, cur, qi, tasks]);
  const note = (t) => { setMsg(t); setTimeout(() => setMsg(""), 3000); };

  const answer = (v) => {
    if (!String(v).trim()) return;
    if (inIntro) { setIntro({ ...intro, [q.key]: v }); setIi(ii + 1); }
    else { setCur({ ...cur, [q.key]: v }); setQi(qi + 1); }
    setText("");
  };
  const back = () => {
    if (done) { setQi(qs.length - 1); return; }
    if (inIntro) { if (ii > 0) setIi(ii - 1); return; }
    if (qi > 0) setQi(qi - 1); else setIi(INTRO_QUESTIONS.length - 1);
    setText("");
  };
  const jump = (key) => {
    const i = qs.findIndex((x) => x.key === key);
    if (i >= 0) { setQi(i); setText(""); }
  };

  const finishTask = () => {
    if (!cur.업무명) return note("업무명이 없습니다.");
    const t = { ...cur, 부서: intro.부서, 담당자: intro.담당자, 수집담당자: intro.부서, 개인정보취급자: intro.부서, 파기담당자: intro.부서 };
    delete t.__provYN;
    if (editTask !== null) { setTasks(tasks.map((x, i) => (i === editTask ? t : x))); setEditTask(null); note("업무를 수정했습니다."); }
    else { setTasks([...tasks, t]); note(`「${t.업무명}」 저장했습니다.`); }
    setCur({}); setQi(0);
  };
  const openTask = (i) => { const t = { ...tasks[i] }; setCur({ ...t, __provYN: t.수신자 ? "예, 제공/위탁함" : "아니오, 내부만 이용" }); setEditTask(i); setQi(0); note("수정 모드입니다. 끝까지 진행하면 반영됩니다."); };
  const delTask = (i) => { setTasks(tasks.filter((_, x) => x !== i)); if (editTask === i) { setEditTask(null); setCur({}); setQi(0); } };

  const submit = () => {
    const all = cur.업무명 ? [...tasks, { ...cur, 부서: intro.부서, 담당자: intro.담당자, 수집담당자: intro.부서, 개인정보취급자: intro.부서, 파기담당자: intro.부서 }] : tasks;
    if (!all.length) return note("저장된 업무가 없습니다.");
    const rec = { id: Date.now(), 부서: intro.부서, 담당자: intro.담당자, at: new Date().toISOString().slice(0, 16).replace("T", " "), tasks: all.map((t) => { const c = { ...t }; delete c.__provYN; return c; }) };
    store.set("piaIntake", [...store.get("piaIntake", []), rec]);
    audit("pia_intake", "V01", { how: `개인정보 현황 입력 제출 ${all.length}건`, note: `${intro.부서} · ${intro.담당자}` });
    setTasks([]); setCur({}); setQi(0); setEditTask(null);
    note(`${all.length}건을 정보보호부문에 제출했습니다.`);
  };
  const saveJson = () => {
    const all = cur.업무명 ? [...tasks, cur] : tasks;
    dl(new Blob([JSON.stringify({ 부서: intro.부서, 담당자: intro.담당자, tasks: all }, null, 2)], { type: "application/json" }), `pia_intake_${today()}.json`);
  };

  const answered = qs.slice(0, qi).map((x) => [x.key, cur[x.key]]).filter(([, v]) => v);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">개인정보 현황 입력</h1>
        <div className="text-xs mt-1" style={{ color: C.mute }}>담당 업무에서 개인정보를 어떻게 다루는지 질문에 답해주세요. 용어를 몰라도 괜찮습니다. 잘못 답했으면 ‘이전’이나 답변 목록에서 고칠 수 있습니다.</div>
      </div>
      {msg && <div className="text-xs px-3 py-2 rounded-sm" style={{ background: "#EEF3F9", color: C.steel }}>{msg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <Card title={done ? "입력 완료" : `${inIntro ? "시작" : q.sec} — ${inIntro ? ii + 1 : qi + 1}/${inIntro ? INTRO_QUESTIONS.length : qs.length}`}
            right={<Tag color={editTask !== null ? "#B7791F" : C.mute}>{editTask !== null ? "수정 중" : `업무 ${tasks.length}건`}</Tag>}>
            {done ? (
              <div className="space-y-3">
                <p className="text-sm">「{cur.업무명}」 업무 입력이 끝났습니다. 저장하고 다음 업무를 이어서 입력하거나, 제출하세요.</p>
                <div className="flex flex-wrap gap-2"><Btn small primary onClick={finishTask}>{editTask !== null ? "수정 반영" : "이 업무 저장"}</Btn><Btn small onClick={back}>← 마지막 질문으로</Btn></div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm whitespace-pre-line">{q.q}</p>
                  {q.ex && <p className="text-xs mt-1" style={{ color: C.mute }}>{q.ex}</p>}
                  {q.hint && <p className="text-xs mt-1" style={{ color: C.mute }}>{q.hint}</p>}
                </div>
                {q.quick && <div className="flex flex-wrap gap-1.5">{q.quick.map((o) => <button key={o} onClick={() => answer(o)} className="text-xs px-2.5 py-1 rounded-sm" style={{ border: `1px solid ${C.line}`, background: "#fff" }}>{o}</button>)}</div>}
                <div className="flex gap-2">
                  <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && answer(text)} placeholder={(inIntro ? intro[q.key] : cur[q.key]) || "여기에 입력하고 Enter"} className="flex-1 text-sm px-2.5 py-2 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
                  <Btn primary small onClick={() => answer(text)}>답변</Btn>
                </div>
                <div className="flex justify-between">
                  <Btn small onClick={back} disabled={inIntro && ii === 0}>← 이전 질문</Btn>
                  {!inIntro && cur[q.key] && <Btn small onClick={() => setQi(qi + 1)}>건너뛰기 (기존 답 유지) →</Btn>}
                </div>
              </div>
            )}
          </Card>

          {!inIntro && answered.length > 0 && (
            <Card title="지금까지 답변 — 고칠 항목을 누르세요">
              <ul className="text-xs divide-y" style={{ borderColor: C.line }}>
                {answered.map(([k, v]) => (
                  <li key={k} className="py-1.5 flex items-start justify-between gap-2">
                    <span style={{ color: C.mute, minWidth: 84 }}>{k === "__provYN" ? "외부 제공" : k}</span>
                    <span className="flex-1">{v}</span>
                    <button onClick={() => jump(k)} className="text-xs px-1.5 py-0.5 rounded-sm shrink-0" style={{ border: `1px solid ${C.line}`, color: C.steel }}>수정</button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <Card title={`입력한 업무 ${tasks.length}건`}>
            {tasks.length === 0 ? <p className="text-xs" style={{ color: C.mute }}>아직 저장한 업무가 없습니다.</p> : (
              <ul className="text-xs divide-y" style={{ borderColor: C.line }}>
                {tasks.map((t, i) => (
                  <li key={i} className="py-1.5 flex items-center justify-between gap-2">
                    <span className="flex-1">{t.업무명}</span>
                    <button onClick={() => openTask(i)} className="px-1.5 py-0.5 rounded-sm" style={{ border: `1px solid ${C.line}`, color: C.steel }}>수정</button>
                    <button onClick={() => delTask(i)} className="px-1.5 py-0.5 rounded-sm" style={{ border: `1px solid ${C.line}`, color: "#B23A3A" }}>삭제</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-col gap-2">
              <Btn small primary onClick={submit}>정보보호부문에 제출</Btn>
              <Btn small onClick={saveJson}>JSON으로 저장</Btn>
            </div>
            <p className="text-xs mt-2" style={{ color: C.mute }}>{intro.부서 || "부서 미입력"} · {intro.담당자 || "담당자 미입력"} — 입력 중인 내용은 이 브라우저에 자동 저장됩니다.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
