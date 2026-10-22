// node --test netlify/lib — 스케줄 함수 순수 로직 검증
import { test } from "node:test";
import assert from "node:assert/strict";
import { kstToday, addDays, prevMonth, genOccurrences, classify, buildBrief, summarizeGws, summarizeGithub, summarizeSlack, normalizeIocs, shareable } from "./ops.js";

test("KST 날짜 — UTC 23:30은 다음 날 08:30", () => {
  assert.equal(kstToday(new Date("2026-10-18T23:30:00Z")), "2026-10-19");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(prevMonth("2027-01-01"), "2026-12");
});

test("회차 생성 — 월·분기·반기·연·상시", () => {
  const m = genOccurrences({ code: "L06", cycle: "월" }, "2026-10-19", 3);
  assert.deepEqual(m.map((o) => [o.period, o.due_on]), [["2026-10", "2026-10-31"], ["2026-11", "2026-11-30"], ["2026-12", "2026-12-31"]]);
  const q = genOccurrences({ code: "L03", cycle: "분기" }, "2026-10-19", 12);
  assert.deepEqual(q.map((o) => o.period), ["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3"]);
  assert.equal(q[0].due_on, "2026-10-15");
  const h = genOccurrences({ code: "P07", cycle: "반기" }, "2026-10-19", 12);
  assert.deepEqual(h.map((o) => o.due_on), ["2026-12-31", "2027-06-30"]);
  const y = genOccurrences({ code: "G04", cycle: "연", next_due: "2026-11-30" }, "2026-10-19", 12);
  assert.deepEqual(y.map((o) => [o.period, o.due_on]), [["2026", "2026-11-30"]]);
  const y2 = genOccurrences({ code: "V07", cycle: "연", cycle_month: [6, 12] }, "2026-10-19", 12);
  assert.deepEqual(y2.map((o) => o.period), ["2026", "2027"]);
  const y3 = genOccurrences({ code: "X", cycle: "연", cycle_month: [3, 9] }, "2027-01-01", 12);
  assert.deepEqual(y3.map((o) => o.period), ["2027", "2027-09"]);
  assert.deepEqual(genOccurrences({ code: "T05", cycle: "상시" }, "2026-10-19"), []);
});

test("분류 — 지연·D-7·D-1·당일, 완료·지연 상태 제외", () => {
  const occ = [
    { id: 1, due_on: "2026-10-15", status: "planned" },
    { id: 2, due_on: "2026-10-26", status: "in_progress" },
    { id: 3, due_on: "2026-10-20", status: "planned" },
    { id: 4, due_on: "2026-10-19", status: "planned" },
    { id: 5, due_on: "2026-10-01", status: "done" },
    { id: 6, due_on: "2026-10-01", status: "delayed" },
  ];
  const c = classify(occ, "2026-10-19");
  assert.deepEqual([c.toDelay, c.d7, c.d1, c.due].map((l) => l.map((o) => o.id)), [[1], [2], [3], [4]]);
});

test("브리프 — 캘린더 본문은 [섹션] / - 항목 형식", () => {
  const b = buildBrief({ today: "2026-10-19", delayed: [{ activity_code: "L03", period: "2026-Q4", due_on: "2026-10-15" }], titles: { L03: "분기 권한 검토" } });
  assert.equal(b.title, "[브리프] 보안 브리프 10/19");
  assert.match(b.desc, /^\[지연 활동\]\n- L03 분기 권한 검토 \(2026-Q4, 기한 10-15\)$/);
  assert.equal(b.count, 1);
  assert.match(buildBrief({ today: "2026-10-19" }).desc, /이상 없음/);
});

test("GWS 요약 — 정지 계정 제외, 2SV·90일 미접속·미로그인", () => {
  const s = summarizeGws([
    { primaryEmail: "a@x", isAdmin: true, isEnrolledIn2Sv: true, lastLoginTime: "2026-10-10T00:00:00Z" },
    { primaryEmail: "b@x", isEnrolledIn2Sv: false, lastLoginTime: "2026-06-01T00:00:00Z" },
    { primaryEmail: "c@x", isEnrolledIn2Sv: false, lastLoginTime: "1970-01-01T00:00:00.000Z" },
    { primaryEmail: "d@x", suspended: true, isEnrolledIn2Sv: false },
  ], "2026-10-19");
  assert.deepEqual([s.active, s.suspended, s.admins, s.no2sv, s.inactive90, s.neverLogin], [3, 1, ["a@x"], ["b@x", "c@x"], ["b@x"], ["c@x"]]);
});

test("GitHub·Slack 요약 — 권한 없으면 null 유지", () => {
  const g = summarizeGithub({ members: [{ login: "a" }], admins: [{ login: "a" }], outside: [{ login: "o" }], no2fa: null, repos: [{ name: "r", visibility: "public" }, { name: "p", visibility: "private", archived: true }], alerts: [{ security_advisory: { severity: "high" } }, { severity: "high" }] });
  assert.equal(g.no2fa, null);
  assert.deepEqual([g.publicRepos, g.archivedRepos, g.dependabot], [["r"], 1, { open: 2, high: 2 }]);
  const s = summarizeSlack([{ id: "U1", name: "a", is_admin: true }, { id: "U2", name: "g", is_restricted: true }, { id: "U3", name: "x", deleted: true }, { id: "B", name: "bot", is_bot: true }, { id: "USLACKBOT", name: "slackbot" }]);
  assert.deepEqual([s.active, s.deactivated, s.admins, s.guests, s.no2fa, s.bots], [2, 1, ["a"], ["g"], null, 1]);
});

test("C-TAS 정규화 — JSON·CSV, 종류 추정, 기본 TLP:AMBER", () => {
  const j = normalizeIocs({ data: [{ type: "IP", indicator: "1.2.3.4", tlp: "green" }, { indicator: "EVIL.example.com" }, { indicator: "CVE-2026-1234" }, { indicator: "??" }] });
  assert.deepEqual(j.iocs.map((i) => [i.kind, i.value, i.tlp]), [["ip", "1.2.3.4", "TLP:GREEN"], ["domain", "evil.example.com", "TLP:AMBER"], ["cve", "CVE-2026-1234", "TLP:AMBER"]]);
  assert.equal(j.rejected, 1);
  const c = normalizeIocs("# comment\nkind,value,category\nurl,https://a.example/x,피싱\nhash,D41D8CD98F00B204E9800998ECF8427E,악성코드");
  assert.deepEqual(c.iocs.map((i) => [i.kind, i.value, i.category]), [["url", "https://a.example/x", "피싱"], ["hash", "d41d8cd98f00b204e9800998ecf8427e", "악성코드"]]);
  assert.equal(shareable("TLP:AMBER"), false);
  assert.equal(shareable("tlp:green"), true);
});
