/* 개인정보 흐름도 SVG 생성 — 흐름표 입력에서 생명주기 4단계 격자 도식을 만든다.
   세로축: 수집 → 보유 → 이용·제공 → 파기 / 가로축: 정보주체 · 취급부서(부서별 레인) · 외부기관
   task = null 이면 총괄 흐름도, 업무명을 주면 그 업무만 그린다. */

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cut = (s, n) => (String(s || "").length > n ? String(s).slice(0, n - 1) + "…" : String(s || ""));
const has = (v) => v && !/^(없음|없|해당없음|모르겠음|미상|x|-)$/i.test(String(v).trim());
const uniq = (a) => [...new Set(a.filter(Boolean))];

import { SUBJECT_GROUP, SUBJECT_COLOR } from "./pia-data.js";

const LC = ["수집", "보유", "이용·제공", "파기"];
const LCC = { 수집: "#2E5C8A", 보유: "#6D5BA8", "이용·제공": "#2E7D5B", 파기: "#B7791F" };

export function buildFlowData(state, task, subject) {
  // subject(정보주체 유형)로 거르면 해당 유형 업무만 남긴다
  const subjTasks = subject ? new Set((state.collection || []).filter((r) => (r.정보주체유형 || "(미분류)") === subject).map((r) => r.업무명)) : null;
  const f = (rows) => (rows || []).filter((r) => r.업무명 && (!task || r.업무명 === task) && (!subjTasks || subjTasks.has(r.업무명)));
  const coll = f(state.collection), ret = f(state.retention), prov = f(state.provision);
  const tasks = uniq([...coll, ...ret, ...prov].map((r) => r.업무명));
  const handlers = uniq([...coll.map((r) => r.수집담당자), ...ret.map((r) => r.개인정보취급자), ...prov.map((r) => r.제공자)]);
  const externals = uniq(prov.map((r) => r.수신자));
  const subjects = uniq(coll.map((r) => r.정보주체유형 || "(미분류)"));
  return { coll, ret, prov, tasks, handlers, externals, subjects };
}

export function flowDiagramSVG(state, task, subject) {
  const d = buildFlowData(state, task, subject);
  if (!d.tasks.length) return null;

  const handlers = (d.handlers.length ? d.handlers : ["담당부서"]).slice(0, 4);
  const externals = d.externals.slice(0, 4);
  // 정보주체 열은 유형별로 나눈다 (임직원 / 이용자 / 거래처 …)
  const subjects = (d.subjects.length ? d.subjects : ["정보주체"]).slice(0, 4);
  // 수집 연결선 경로를 먼저 세어 헤더 아래 여유 폭을 정한다 (헤더 침범 방지)
  const routeCount = handlers.reduce((n, h) => n + Math.max(1, new Set(d.coll.filter((r) => (r.수집담당자 || handlers[0]) === h).map((r) => r.정보주체유형 || "(미분류)")).size), 0);
  const band = Math.min(96, 20 + routeCount * 11);
  const cols = [...subjects.map((t) => ({ t, type: "subject" })), ...handlers.map((t) => ({ t, type: "handler" })), ...externals.map((t) => ({ t, type: "external" }))];
  const sIdx = (name) => Math.max(0, subjects.indexOf(name));

  const colW = Math.max(160, Math.min(230, Math.floor(1100 / cols.length)));
  const padL = 92, titleH = 34, headY = titleH + 8, headH = 42, rowH = 126;
  const padT = headY + headH + band;
  const W = padL + cols.length * colW + 24;
  const H = padT + LC.length * rowH + 30;
  const colX = (ci) => padL + ci * colW + colW / 2;
  const hIdx = (name) => subjects.length + handlers.indexOf(name);
  const eIdx = (name) => subjects.length + handlers.length + externals.indexOf(name);

  const rowsOf = (rows, h, key) => rows.filter((r) => (r[key] || handlers[0]) === h);

  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="#ffffff"/>`;
  s += `<defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#6B7686"/></marker>`;
  s += `<marker id="arE" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#B23A3A"/></marker></defs>`;
  const title = task ? `개인정보 흐름도 — ${cut(task, 26)}` : subject ? `개인정보 흐름도 — ${subject}` : "총괄 개인정보 흐름도";
  s += `<text x="14" y="23" font-size="14" font-weight="700" fill="#1B2432">${esc(title)}</text>`;
  s += `<text x="${W - 14}" y="23" text-anchor="end" font-size="10" fill="#94A3B8">업무 ${d.tasks.length}건 · 정보주체 ${subjects.length} · 부서 ${handlers.length} · 외부 ${externals.length}</text>`;

  LC.forEach((lc, r) => {
    const y = padT + r * rowH;
    s += `<rect x="8" y="${y + 12}" width="76" height="${rowH - 24}" rx="7" fill="${LCC[lc]}1A" stroke="${LCC[lc]}66"/>`;
    s += `<text x="46" y="${y + rowH / 2}" text-anchor="middle" dominant-baseline="middle" font-size="12.5" font-weight="700" fill="${LCC[lc]}">${lc}</text>`;
    s += `<line x1="${padL - 4}" y1="${y}" x2="${W - 12}" y2="${y}" stroke="#EEF1F5"/>`;
  });

  cols.forEach((c, ci) => {
    const x = padL + ci * colW;
    const sc = c.type === "subject" ? (SUBJECT_COLOR[SUBJECT_GROUP[c.t]] || "#6B7686") : null;
    const fill = c.type === "subject" ? sc + "14" : c.type === "external" ? "#FDF6DA" : "#F1F5F9";
    const stroke = c.type === "subject" ? sc + "AA" : c.type === "external" ? "#C9A227" : "#94A3B8";
    s += `<rect x="${x + 8}" y="${headY}" width="${colW - 16}" height="${headH}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    s += `<text x="${x + colW / 2}" y="${headY + 19}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#334155">${esc(cut(c.t, 14))}</text>`;
    s += `<text x="${x + colW / 2}" y="${headY + 33}" text-anchor="middle" font-size="9" fill="#94A3B8">${c.type === "subject" ? "정보주체 · " + (SUBJECT_GROUP[c.t] || "기타") : c.type === "external" ? "외부기관·수탁자" : "취급부서"}</text>`;
    s += `<line x1="${x}" y1="${headY + headH + 4}" x2="${x}" y2="${H - 14}" stroke="#F5F7FA"/>`;
  });

  const BW = Math.min(126, colW - 34), BH = 54;
  const box = (cx, cy, title, sub, fill, stroke, w) => {
    const bw = w || BW, x = cx - bw / 2, y = cy - BH / 2;
    let o = `<rect x="${x}" y="${y}" width="${bw}" height="${BH}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>`;
    o += `<text x="${cx}" y="${y + 21}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#1B2432">${esc(cut(title, 15))}</text>`;
    if (sub) o += `<text x="${cx}" y="${y + 36}" text-anchor="middle" font-size="8.5" fill="#6B7686">${esc(cut(sub, 18))}</text>`;
    return o;
  };
  const stroked = (o = {}) => `stroke="${o.enc ? "#B23A3A" : "#6B7686"}" stroke-width="${o.enc ? 2.4 : 1.4}" fill="none"${o.offline ? ' stroke-dasharray="5 3"' : ""} marker-end="url(#${o.enc ? "arE" : "ar"})"`;
  const vArrow = (x, y1, y2, o) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" ${stroked(o)}/>`;
  const label = (x, y, t, o = {}) => {
    const lab = cut(t, 20), w = lab.length * 6.2 + 10;
    return `<rect x="${x - w / 2}" y="${y - 9}" width="${w}" height="15" rx="3" fill="#fff" stroke="#E2E8F0"/><text x="${x}" y="${y + 2}" text-anchor="middle" font-size="9" fill="${o.enc ? "#B23A3A" : "#475569"}">${esc(lab)}</text>`;
  };
  // 위로 우회해 다른 레인을 넘어가는 연결선
  const routed = (x1, x2, yBox, yUp, text, o = {}) => {
    let r = `<path d="M ${x1} ${yBox} L ${x1} ${yUp} L ${x2} ${yUp} L ${x2} ${yBox - 6}" ${stroked(o)}/>`;
    if (text) r += label((x1 + x2) / 2, yUp - 4, text, o);
    return r;
  };

  const yRow = (i) => padT + i * rowH + rowH / 2;
  const yC = yRow(0), yR = yRow(1), yP = yRow(2), yD = yRow(3);

  // 정보주체 — 유형별 박스
  subjects.forEach((sb, si) => {
    const c = SUBJECT_COLOR[SUBJECT_GROUP[sb]] || "#6B7686";
    const detail = uniq(d.coll.filter((r) => (r.정보주체유형 || "(미분류)") === sb).map((r) => r.수집대상)).slice(0, 2).join(", ");
    s += box(colX(si), yC, sb, detail || "수집대상", c + "14", c + "88");
  });

  let lane = 0;
  handlers.forEach((h, k) => {
    const x = colX(hIdx(h));
    const cRows = rowsOf(d.coll, h, "수집담당자"), rRows = rowsOf(d.ret, h, "개인정보취급자"), pRows = rowsOf(d.prov, h, "제공자");
    const myTasks = uniq([...cRows, ...rRows, ...pRows].map((r) => r.업무명));
    if (!myTasks.length) return;

    // 수집: 정보주체 → 부서 (레인 위로 우회)
    const off = cRows.some((r) => /오프라인|서면|종이|대면|방문|우편|FAX|팩스/i.test(r.수집경로 || ""));
    const mySubjects = uniq(cRows.map((r) => r.정보주체유형 || "(미분류)"));
    (mySubjects.length ? mySubjects : [subjects[0]]).forEach((sb, si) => {
      const items = uniq(cRows.filter((r) => (r.정보주체유형 || "(미분류)") === sb).map((r) => r.수집항목)).join(" / ") || "개인정보";
      s += routed(colX(sIdx(sb)), x, yC - BH / 2, padT - 12 - (lane++) * 11, items, { offline: off });
    });
    s += box(x, yC, myTasks.length === 1 ? myTasks[0] : `업무 ${myTasks.length}건`, cRows[0]?.수집경로 || h, "#F1F5F9", "#94A3B8");

    // 보유
    if (rRows.length) {
      const encRow = rRows.find((r) => has(r.암호화항목));
      s += vArrow(x, yC + BH / 2, yR - BH / 2 - 4);
      s += box(x, yR, rRows[0].보유형태 || "보관", uniq(rRows.map((r) => r.이용항목)).join(", ") || "개인정보", "#fff", encRow ? "#B23A3A" : "#94A3B8");
      s += `<text x="${x}" y="${yR + BH / 2 + 14}" text-anchor="middle" font-size="8.5" fill="${encRow ? "#B23A3A" : "#94A3B8"}">${encRow ? "암호화 " + esc(cut(encRow.암호화항목, 16)) : "암호화 미확인"}</text>`;
    }

    // 이용·제공
    const useSub = uniq(rRows.map((r) => r.이용목적)).join(", ") || uniq(pRows.map((r) => r.제공목적)).join(", ") || "이용목적";
    s += vArrow(x, (rRows.length ? yR : yC) + BH / 2 + (rRows.length ? 16 : 0), yP - BH / 2 - 4);
    s += box(x, yP, "이용", useSub, "#EAF4EF", "#2E7D5B");

    // 외부 제공·위탁 — 옆 칸이면 직선, 다른 레인을 넘어가야 하면 위로 우회
    pRows.filter((r) => r.수신자 && externals.includes(r.수신자)).forEach((r, i) => {
      const ei = eIdx(r.수신자), ex = colX(ei);
      const enc = /암호화|VPN|SSL|TLS|API|전용선/i.test(r.제공방법 || "");
      const offp = /우편|등기|인편|FAX|팩스|대면|종이|USB/i.test(r.제공방법 || "");
      const o = { enc, offline: offp };
      const x1 = x + BW / 2, x2 = ex - BW / 2;
      if (ei === hIdx(h) + 1) {
        const yy = yP - 10 + i * 16;
        s += `<line x1="${x1}" y1="${yy}" x2="${x2 - 4}" y2="${yy}" ${stroked(o)}/>` + label((x1 + x2) / 2, yy - 6, r.제공정보 || "제공정보", o);
      } else {
        const yUp = yP - BH / 2 - 20 - i * 13, xo = x1 + 16;
        s += `<path d="M ${x1} ${yP - 10} L ${xo} ${yP - 10} L ${xo} ${yUp} L ${ex} ${yUp} L ${ex} ${yP - BH / 2 - 6}" ${stroked(o)}/>` + label((xo + ex) / 2, yUp - 4, r.제공정보 || "제공정보", o);
      }
    });

    // 파기
    if (pRows.length) {
      const pr = pRows.find((r) => r.파기절차) || pRows[0];
      s += vArrow(x, yP + BH / 2, yD - BH / 2 - 4);
      s += box(x, yD, "파기", (pr.보관기간 || "보관기간") + " · " + (pr.파기절차 || "파기절차"), LCC["파기"] + "14", LCC["파기"] + "88");
    }
  });

  externals.forEach((e) => {
    const x = colX(eIdx(e));
    const pr = d.prov.find((r) => r.수신자 === e) || {};
    s += box(x, yP, e, pr.제공방법 || "제공방식", "#FDF6DA", "#C9A227");
  });

  s += "</svg>";
  return s;
}
