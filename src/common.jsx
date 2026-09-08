/* 공통 상수·저장소·감사로그·UI 원자 — App.jsx와 Pia.jsx가 함께 사용 */

export const pad = (n) => String(n).padStart(2, "0");
export const C = { ink: "#1B2432", rail: "#141C28", bg: "#F3F5F8", line: "#DCE1E8", mute: "#6B7686", steel: "#2E5C8A" };

export const store = {
  get(k, d) { try { const v = localStorage.getItem("sp." + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("sp." + k, JSON.stringify(v)); } catch (e) {} },
};

export const nowStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

// 행위기반 감사로그: 누가 · 언제 · 무엇을(대상) · 어떻게(행위, 이전→이후) · 왜(사유)
let CURRENT_USER = "이정민";
export const setUser = (u) => { CURRENT_USER = u; };
export const getUser = () => CURRENT_USER;

export function audit(action, target, detail = {}) {
  const logs = store.get("audit", []);
  logs.unshift({ id: Date.now() + Math.random().toString(36).slice(2, 6), at: nowStr(), who: CURRENT_USER, action, target, ...detail });
  store.set("audit", logs.slice(0, 5000));
}

export const ACTION_LABEL = {
  login: "로그인(역할 전환)", view: "화면 열람", method: "요구방법 채택", status: "활동 상태 변경",
  request: "요청 접수", process: "요청 처리", policy: "정책 열람 확인", brief: "브리프 조회",
  report: "리포트 출력", logcheck: "로그 점검 확인",
  pia_save: "개인정보 흐름표 저장", pia_flow: "개인정보 흐름도 생성", pia_risk: "침해요인 평가",
  pia_export: "개인정보 흐름도·평가 내보내기", pia_intake: "현업 개인정보 현황 입력 제출",
  pia_import: "현업 입력 불러오기", pia_reset: "개인정보 흐름표 초기화", policy_state: "처리방침 수립 상태 변경",
};

/* ─────────────── 공통 UI ─────────────── */
export const Tag = ({ children, color = C.mute }) => <span className="inline-block text-xs px-1.5 py-0.5 rounded-sm whitespace-nowrap" style={{ background: color + "1A", color }}>{children}</span>;

export const Btn = ({ children, onClick, primary, small, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={(small ? "text-xs px-2.5 py-1 " : "text-sm px-3.5 py-1.5 ") + "rounded-sm font-medium focus:outline-none focus:ring-2 disabled:opacity-40"} style={primary ? { background: C.steel, color: "#fff" } : { background: "#fff", color: C.ink, border: `1px solid ${C.line}` }}>{children}</button>
);

export const Card = ({ title, right, children }) => (
  <section className="bg-white" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
    {title && <header className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}><h3 className="text-sm font-semibold">{title}</h3>{right}</header>}
    <div className="p-4">{children}</div>
  </section>
);

export const Bar = ({ v, color }) => <div className="h-1.5 rounded-full w-full" style={{ background: C.line }}><div className="h-1.5 rounded-full" style={{ width: `${v}%`, background: color || C.steel }} /></div>;
