import { useState, useEffect, useRef } from "react";
import { C, store, audit, Tag, Btn, Card } from "./common.jsx";
import { INTRO_QUESTIONS, QUESTIONS } from "./pia-data.js";

const today = () => new Date().toISOString().slice(0, 10);
const dl = (blob, name) => {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(u); }, 1500);
};

const visibleQs = (provSkip) => QUESTIONS.filter((q) => !(q.cond === "prov" && provSkip));
const LABEL = { __provYN: "외부 제공" };

/* ─────────────── 말풍선 ─────────────── */
function Bubble({ m }) {
  if (m.r === "sys") return <div className="text-center text-xs py-1" style={{ color: C.mute }}>{m.t}</div>;
  const me = m.r === "me";
  return (
    <div className={"flex gap-2 mb-2.5 " + (me ? "flex-row-reverse" : "")}>
      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs"
        style={me ? { background: C.steel, color: "#fff" } : { background: "#E4EBF3", color: C.steel }}>{me ? "나" : "🙂"}</div>
      <div className="max-w-[78%]">
        <div className="text-sm px-3 py-2 whitespace-pre-line"
          style={me
            ? { background: C.steel, color: "#fff", borderRadius: "12px 12px 3px 12px" }
            : { background: "#fff", color: C.ink, border: `1px solid ${C.line}`, borderRadius: "12px 12px 12px 3px" }}>
          {m.t}
          {m.ex && <div className="text-xs mt-1.5" style={{ color: me ? "#D6E2EE" : C.mute }}>{m.ex}</div>}
          {m.hint && <div className="text-xs mt-1" style={{ color: me ? "#D6E2EE" : C.mute }}>{m.hint}</div>}
        </div>
      </div>
    </div>
  );
}

export default function EmpPia() {
  const d0 = store.get("piaDraft", {});
  const [intro, setIntro] = useState(d0.intro || { 부서: "", 담당자: "" });
  const [ii, setIi] = useState(d0.intro?.담당자 ? INTRO_QUESTIONS.length : 0);
  const [cur, setCur] = useState(d0.cur || {});
  const [qi, setQi] = useState(d0.qi || 0);
  const [tasks, setTasks] = useState(d0.tasks || []);
  const [log, setLog] = useState(d0.log || []);
  const [text, setText] = useState("");
  const [editTask, setEditTask] = useState(null);
  const endRef = useRef(null);

  const provSkip = cur.__provYN === "아니오, 내부만 이용";
  const qs = visibleQs(provSkip);
  const inIntro = ii < INTRO_QUESTIONS.length;
  const q = inIntro ? INTRO_QUESTIONS[ii] : qs[qi];
  const done = !inIntro && qi >= qs.length;
  const total = INTRO_QUESTIONS.length + qs.length;
  const pct = Math.min(100, Math.round(((inIntro ? ii : INTRO_QUESTIONS.length + qi) / total) * 100));

  const push = (m) => setLog((L) => [...L, m]);
  const say = (t, ex, hint) => push({ r: "bot", t, ex, hint });
  const sys = (t) => push({ r: "sys", t });

  useEffect(() => { store.set("piaDraft", { intro, cur, qi, tasks, log }); }, [intro, cur, qi, tasks, log]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [log]);

  // 첫 진입 인사
  useEffect(() => {
    if (log.length) return;
    say("안녕하세요. 정보보호부문입니다 🙂\n담당 업무에서 개인정보를 어떻게 다루시는지 몇 가지만 여쭤볼게요.", null, "용어는 몰라도 괜찮습니다. 잘못 답하셨으면 ‘이전’으로 되돌리거나 답변을 눌러 고칠 수 있어요.");
    const f = INTRO_QUESTIONS[0];
    say(f.q, f.ex, f.hint);
  }, []);

  const askAt = (isIntro, idx) => {
    const nq = isIntro ? INTRO_QUESTIONS[idx] : qs[idx];
    if (nq) say(nq.q, nq.ex, nq.hint);
  };

  const answer = (v) => {
    const val = String(v).trim();
    if (!val || done) return;
    push({ r: "me", t: val });
    setText("");
    if (inIntro) {
      const ni = ii + 1;
      setIntro({ ...intro, [q.key]: val }); setIi(ni);
      if (ni < INTRO_QUESTIONS.length) askAt(true, ni);
      else { sys("─ 업무 내용 ─"); askAt(false, qi); }
      return;
    }
    const next = { ...cur, [q.key]: val };
    setCur(next);
    const nqs = visibleQs(next.__provYN === "아니오, 내부만 이용");
    const ni = qi + 1;
    setQi(ni);
    if (ni < nqs.length) { const nq = nqs[ni]; say(nq.q, nq.ex, nq.hint); }
    else say(`「${next.업무명 || "이 업무"}」 다 여쭤봤습니다. 아래에서 저장하시면 다음 업무를 이어서 입력하실 수 있어요.`);
  };

  const back = () => {
    if (done) { setQi(qs.length - 1); sys("↩ 마지막 질문으로 돌아왔습니다"); askAt(false, qs.length - 1); return; }
    if (inIntro) {
      if (ii === 0) return;
      setIi(ii - 1); sys("↩ 이전 질문으로 돌아왔습니다"); askAt(true, ii - 1); return;
    }
    if (qi > 0) { setQi(qi - 1); sys("↩ 이전 질문으로 돌아왔습니다"); askAt(false, qi - 1); }
    else { setIi(INTRO_QUESTIONS.length - 1); sys("↩ 이전 질문으로 돌아왔습니다"); askAt(true, INTRO_QUESTIONS.length - 1); }
    setText("");
  };

  const jump = (key) => {
    const i = qs.findIndex((x) => x.key === key);
    if (i < 0) return;
    setQi(i); setText("");
    sys(`✎ ‘${LABEL[key] || key}’ 다시 여쭤볼게요`);
    askAt(false, i);
  };

  const stamp = (t) => ({ ...t, 부서: intro.부서, 담당자: intro.담당자, 수집담당자: intro.부서, 개인정보취급자: intro.부서, 파기담당자: intro.부서 });

  const finishTask = () => {
    if (!cur.업무명) return;
    const t = stamp({ ...cur }); delete t.__provYN;
    if (editTask !== null) { setTasks(tasks.map((x, i) => (i === editTask ? t : x))); setEditTask(null); sys(`✓ 「${t.업무명}」 수정했습니다`); }
    else { setTasks([...tasks, t]); sys(`✓ 「${t.업무명}」 저장했습니다`); }
    setCur({}); setQi(0);
    say("다른 업무도 있으신가요? 있으면 업무 이름부터 알려주세요.", "없으면 오른쪽 ‘정보보호부문에 제출’을 눌러주세요.");
  };

  const openTask = (i) => {
    const t = { ...tasks[i] };
    setCur({ ...t, __provYN: t.수신자 ? "예, 제공/위탁함" : "아니오, 내부만 이용" });
    setEditTask(i); setQi(0);
    sys(`✎ 「${t.업무명}」 수정 — 처음부터 다시 확인합니다`);
    askAt(false, 0);
  };
  const delTask = (i) => {
    const name = tasks[i].업무명;
    setTasks(tasks.filter((_, x) => x !== i));
    if (editTask === i) { setEditTask(null); setCur({}); setQi(0); }
    sys(`🗑 「${name}」 삭제했습니다`);
  };

  const submit = () => {
    const all = cur.업무명 ? [...tasks, (() => { const t = stamp({ ...cur }); delete t.__provYN; return t; })()] : tasks;
    if (!all.length) return sys("저장된 업무가 없습니다");
    const rec = { id: Date.now(), 부서: intro.부서, 담당자: intro.담당자, at: new Date().toISOString().slice(0, 16).replace("T", " "), tasks: all };
    store.set("piaIntake", [...store.get("piaIntake", []), rec]);
    audit("pia_intake", "V01", { how: `개인정보 현황 입력 제출 ${all.length}건`, note: `${intro.부서} · ${intro.담당자}` });
    setTasks([]); setCur({}); setQi(0); setEditTask(null);
    say(`${all.length}건 제출했습니다. 고맙습니다 🙂`, "정보보호부문이 흐름표·흐름도로 정리합니다.");
  };

  const saveJson = () => {
    const all = cur.업무명 ? [...tasks, cur] : tasks;
    dl(new Blob([JSON.stringify({ 부서: intro.부서, 담당자: intro.담당자, tasks: all }, null, 2)], { type: "application/json" }), `pia_intake_${today()}.json`);
  };

  const restart = () => {
    if (!confirm("입력 중인 내용을 모두 지우고 처음부터 시작할까요?")) return;
    store.set("piaDraft", {});
    setIntro({ 부서: "", 담당자: "" }); setIi(0); setCur({}); setQi(0); setTasks([]); setEditTask(null); setText("");
    setLog([{ r: "bot", t: "처음부터 다시 시작합니다 🙂", hint: null }, { r: "bot", t: INTRO_QUESTIONS[0].q, ex: INTRO_QUESTIONS[0].ex, hint: INTRO_QUESTIONS[0].hint }]);
  };

  const answered = qs.slice(0, qi).map((x) => [x.key, cur[x.key]]).filter(([, v]) => v);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">개인정보 현황 입력</h1>
        <div className="text-xs mt-1" style={{ color: C.mute }}>담당 업무에서 다루는 개인정보를 대화로 알려주시면 됩니다. 5분이면 끝납니다.</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-3">
          <div className="bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="text-sm font-semibold">개인정보 현황 도우미</div>
              <div className="flex items-center gap-2">
                {editTask !== null && <Tag color="#B7791F">수정 중</Tag>}
                <span className="text-xs" style={{ color: C.mute }}>{done ? "완료" : `${pct}%`}</span>
              </div>
            </div>
            <div className="h-1" style={{ background: C.line }}><div className="h-1" style={{ width: `${pct}%`, background: C.steel, transition: "width .25s" }} /></div>

            <div className="px-4 py-3 overflow-y-auto" style={{ background: C.bg, maxHeight: 400, minHeight: 260 }}>
              {log.map((m, i) => <Bubble key={i} m={m} />)}
              <div ref={endRef} />
            </div>

            <div className="px-4 py-3 space-y-2" style={{ borderTop: `1px solid ${C.line}` }}>
              {!done && q?.quick && (
                <div className="flex flex-wrap gap-1.5">
                  {q.quick.map((o) => (
                    <button key={o} onClick={() => answer(o)} className="text-xs px-2.5 py-1.5 rounded-full"
                      style={{ border: `1px solid #C7D6E5`, background: "#fff", color: C.steel }}>{o}</button>
                  ))}
                </div>
              )}
              {done ? (
                <div className="flex flex-wrap gap-2">
                  <Btn small primary onClick={finishTask}>{editTask !== null ? "수정 반영" : "이 업무 저장"}</Btn>
                  <Btn small onClick={back}>← 마지막 질문 고치기</Btn>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && answer(text)}
                      placeholder={(inIntro ? intro[q.key] : cur[q.key]) || "여기에 답을 적고 Enter"}
                      className="flex-1 text-sm px-3 py-2 rounded-full" style={{ border: `1px solid ${C.line}` }} />
                    <Btn primary small onClick={() => answer(text)}>보내기</Btn>
                  </div>
                  <div className="flex justify-between items-center">
                    <button onClick={back} disabled={inIntro && ii === 0} className="text-xs disabled:opacity-30" style={{ color: C.steel }}>← 이전 질문</button>
                    {!inIntro && cur[q.key] && <button onClick={() => { setQi(qi + 1); sys("건너뜀 — 기존 답 유지"); askAt(false, qi + 1); }} className="text-xs" style={{ color: C.mute }}>건너뛰기 →</button>}
                  </div>
                </>
              )}
            </div>
          </div>

          {answered.length > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-xs" style={{ color: C.mute }}>고칠 항목:</span>
              {answered.map(([k, v]) => (
                <button key={k} onClick={() => jump(k)} className="text-xs px-2 py-1 rounded-full"
                  style={{ background: "#fff", border: `1px solid ${C.line}`, color: C.ink }}>
                  {LABEL[k] || k} <span style={{ color: C.mute }}>{String(v).length > 10 ? String(v).slice(0, 9) + "…" : v}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Card title={`입력한 업무 ${tasks.length}건`}>
            {tasks.length === 0 ? <p className="text-xs" style={{ color: C.mute }}>아직 저장한 업무가 없습니다.</p> : (
              <ul className="text-xs divide-y" style={{ borderColor: C.line }}>
                {tasks.map((t, i) => (
                  <li key={i} className="py-1.5 flex items-center justify-between gap-1.5">
                    <span className="flex-1 truncate">{t.업무명}</span>
                    <button onClick={() => openTask(i)} className="px-1.5 py-0.5 rounded-sm shrink-0" style={{ border: `1px solid ${C.line}`, color: C.steel }}>수정</button>
                    <button onClick={() => delTask(i)} className="px-1.5 py-0.5 rounded-sm shrink-0" style={{ border: `1px solid ${C.line}`, color: "#B23A3A" }}>삭제</button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-col gap-2">
              <Btn small primary onClick={submit}>정보보호부문에 제출</Btn>
              <Btn small onClick={saveJson}>JSON으로 저장</Btn>
              <button onClick={restart} className="text-xs" style={{ color: C.mute }}>처음부터 다시</button>
            </div>
            <p className="text-xs mt-2" style={{ color: C.mute }}>{intro.부서 || "부서 미입력"} · {intro.담당자 || "담당자 미입력"} — 대화 내용은 이 브라우저에 자동 저장됩니다.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
