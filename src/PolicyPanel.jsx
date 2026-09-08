import { useState } from "react";
import { C, store, audit, Tag, Btn } from "./common.jsx";

/* 개인정보 처리방침 관리 — V02
   법 30조는 정보주체를 이용자로 한정하지 않는다. 임직원·채용지원자도 정보주체이므로
   대상별로 방침을 수립하고, 각 정보주체가 쉽게 확인할 수 있는 곳에 공개해야 한다. */
export const POLICY_DEFS = [
  { id: "user", 대상: "이용자·고객", 기본공개: "회사 홈페이지 하단", 근거: "개인정보보호법 30조 · 시행령 31조(홈페이지 게재)" },
  { id: "emp", 대상: "임직원(재직·퇴직)", 기본공개: "사내 인트라넷·게시판", 근거: "개인정보보호법 30조 — 임직원도 정보주체. 인사·노무 목적 처리 대상" },
  { id: "applicant", 대상: "채용지원자", 기본공개: "채용 페이지·지원서 접수 화면", 근거: "개인정보보호법 30조 · 채용절차법(확정 후 반환·파기)" },
];

const blank = (d) => ({ 수립: false, 공개위치: d.기본공개, 버전: "", 개정일: "", 메모: "" });

export default function PolicyPanel() {
  const [rows, setRows] = useState(() => {
    const saved = store.get("policies", {});
    return Object.fromEntries(POLICY_DEFS.map((d) => [d.id, { ...blank(d), ...(saved[d.id] || {}) }]));
  });
  const [open, setOpen] = useState(true);

  const upd = (id, k, v) => {
    const next = { ...rows, [id]: { ...rows[id], [k]: v } };
    setRows(next); store.set("policies", next);
    const def = POLICY_DEFS.find((d) => d.id === id);
    if (k === "수립") audit("policy_state", "V02", { how: `${def.대상} 처리방침 ${v ? "수립·공개" : "미수립"}로 변경`, before: String(rows[id].수립), after: String(v) });
  };

  const done = POLICY_DEFS.filter((d) => rows[d.id].수립).length;

  return (
    <div className="rounded-sm" style={{ background: "#F7FAFD", border: `1px solid #D9E4EF` }}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 text-left">
        <span className="text-xs font-semibold" style={{ color: C.steel }}>처리방침 {POLICY_DEFS.length}종 관리</span>
        <span className="flex items-center gap-1.5">
          <Tag color={done === POLICY_DEFS.length ? "#2E7D5B" : "#B23A3A"}>{done}/{POLICY_DEFS.length} 수립</Tag>
          <span className="text-xs" style={{ color: C.mute }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs" style={{ color: C.mute }}>
            개인정보보호법 30조는 정보주체를 이용자로 한정하지 않습니다. 임직원·채용지원자 개인정보를 처리하면 그 대상의 처리방침도 수립·공개해야 합니다.
          </p>
          {POLICY_DEFS.map((d) => {
            const r = rows[d.id];
            return (
              <div key={d.id} className="bg-white px-2.5 py-2 rounded-sm" style={{ border: `1px solid ${r.수립 ? C.line : "#F0D5D5"}` }}>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium">
                    <input type="checkbox" checked={r.수립} onChange={(e) => upd(d.id, "수립", e.target.checked)} />
                    {d.대상}
                  </label>
                  <Tag color={r.수립 ? "#2E7D5B" : "#B23A3A"}>{r.수립 ? "수립·공개" : "미수립"}</Tag>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 mt-1.5">
                  <input value={r.공개위치} onChange={(e) => upd(d.id, "공개위치", e.target.value)} placeholder="공개 위치" className="text-xs px-1.5 py-1 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
                  <input value={r.버전} onChange={(e) => upd(d.id, "버전", e.target.value)} placeholder="버전 (예: v2.0)" className="text-xs px-1.5 py-1 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
                  <input value={r.개정일} onChange={(e) => upd(d.id, "개정일", e.target.value)} placeholder="최종 개정일 (2026-09-07)" className="text-xs px-1.5 py-1 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
                </div>
                <div className="text-xs mt-1" style={{ color: C.mute }}>{d.근거}</div>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Btn small onClick={() => {
              const body = ["\ufeff대상,수립,공개 위치,버전,최종 개정일,근거",
                ...POLICY_DEFS.map((d) => [d.대상, rows[d.id].수립 ? "수립·공개" : "미수립", rows[d.id].공개위치, rows[d.id].버전, rows[d.id].개정일, d.근거].map((v) => `"${String(v ?? "")}"`).join(","))].join("\n");
              const b = new Blob([body], { type: "text/csv;charset=utf-8" });
              const u = URL.createObjectURL(b); const a = document.createElement("a");
              a.href = u; a.download = `policy_list_${new Date().toISOString().slice(0, 10)}.csv`;
              document.body.appendChild(a); a.click();
              setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 1200);
              audit("pia_export", "V02", { how: "처리방침 목록 CSV 내보내기" });
            }}>목록 CSV</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
