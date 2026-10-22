// DB 모드 E2E — 3개 계정(김개발 employee, 이정민·박인프라 security) 시나리오. setup.sh로 DB·게이트웨이·미리보기(4174)를 먼저 띄운다.
// 실행: PLAYWRIGHT_MODULE=<playwright 경로> node scripts/e2e/db-mode.mjs   (DB는 매 실행 전 setup.sh reset으로 초기화)
import { createRequire } from "module";
import { sign } from "./jwt.mjs";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || "playwright");
const U = { sec: ["00000000-0000-0000-0000-00000000000a", "sec@cck.test"], dev: ["00000000-0000-0000-0000-00000000000b", "dev@cck.test"], infra: ["00000000-0000-0000-0000-00000000000c", "infra@cck.test"] };
const b = await chromium.launch();
const out = {}, errs = [];
async function as(who) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  if (who) {
    const [id, email] = U[who];
    const exp = 4102444800;
    const session = { access_token: sign({ sub: id, email, role: "authenticated", aud: "authenticated", exp }), token_type: "bearer", expires_in: 3600, expires_at: exp, refresh_token: "r", user: { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {} } };
    await ctx.addInitScript((s) => localStorage.setItem("sb-localhost-auth-token", s), JSON.stringify(session));
  }
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${who}: ${e.message}`)); p.on("console", (m) => m.type() === "error" && errs.push(`${who}: ${m.text()}`));
  await p.goto("http://localhost:4174/"); await p.waitForTimeout(1200);
  return p;
}
// A. 비로그인
let p = await as(null);
out.loginScreen = await p.getByRole("button", { name: "Google 계정으로 로그인" }).count();

// B. 임직원
p = await as("dev");
out.empTitle = await p.getByText("김개발님, 오늘 할 일").count();
out.empNoSecurityNav = await p.getByRole("button", { name: "로그점검" }).count();
await p.getByRole("button", { name: "요청·신고" }).first().click();
await p.getByRole("button", { name: "유출", exact: true }).click();
await p.getByPlaceholder("무슨 일이 있었나요?").fill("협력사 메일 오발송");
await p.getByPlaceholder("대상 시스템, 기간, 사유").fill("고객 연락처 3건 포함");
await p.getByRole("button", { name: "신고하기" }).click(); await p.waitForTimeout(800);
out.empReq = await p.locator("li", { hasText: "협력사 메일 오발송" }).innerText().catch((e) => "ERR " + e.message);
await p.getByRole("button", { name: "정책·규칙 읽기" }).click(); await p.waitForTimeout(600);
await p.getByText("보안사고 대응 지침").click();
await p.getByRole("button", { name: "읽고 이해했습니다" }).click(); await p.waitForTimeout(600);
out.empRead = await p.getByRole("button", { name: "열람 확인함" }).count();

// C. 정보보호 담당 이정민
p = await as("sec");
await p.getByRole("button", { name: /요청함/ }).click(); await p.waitForTimeout(800);
await p.getByText("협력사 메일 오발송").first().click();
out.secSeesDetail = await p.getByText("고객 연락처 3건 포함").count();
await p.getByRole("button", { name: "처리 시작" }).click(); await p.waitForTimeout(800);
out.secReqLog = await p.getByText(/처리 시작/).count();
await p.getByRole("button", { name: /내부정보유출통제/ }).first().click();
await p.getByText("분기 권한 검토").first().click();
await p.getByRole("button", { name: "증빙 등록" }).click();
await p.getByPlaceholder(/증빙 제목/).fill("2026-Q4 권한 검토 결과서");
await p.locator('input[type="month"]').fill("2026-10");
await p.getByPlaceholder(/Drive 공유 링크/).fill("https://drive.google.com/file/d/abc");
await p.getByRole("button", { name: "저장", exact: true }).click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: "상태 변경" }).click();
await p.locator("select").filter({ hasText: "충족" }).last().selectOption("ok");
await p.getByPlaceholder("변경 사유 (필수)").fill("Q4 검토 완료");
await p.getByRole("button", { name: "저장", exact: true }).click(); await p.waitForTimeout(800);
await p.locator("label", { hasText: "2.5.6 접근권한 검토" }).locator("input").check();
await p.getByRole("button", { name: "채택 방법 저장" }).click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: "지적사항", exact: true }).click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: "지적사항 등록" }).click();
await p.getByPlaceholder("지적 내용").fill("퇴사자 Slack 계정 미회수");
await p.locator("select").filter({ hasText: "조치 담당 선택" }).selectOption({ label: "이정민" });
await p.locator('input[type="date"]').fill("2026-10-31");
await p.getByRole("button", { name: "등록", exact: true }).click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: "조치 착수" }).click(); await p.waitForTimeout(600);
await p.locator("textarea").nth(1).fill("계정 회수, 퇴사 체크리스트에 Slack 추가");
await p.getByText("근본 원인").click(); await p.waitForTimeout(600);
await p.getByRole("button", { name: "검증 요청" }).click(); await p.waitForTimeout(600);
await p.getByRole("button", { name: "검증·종결" }).click(); await p.waitForTimeout(400);
out.sodBlocked = await p.getByText(/직접 종결 검증할 수 없습니다/).count();

// 다른 담당자(박인프라)가 새로고침 후에도 유지된 데이터로 종결
p = await as("infra");
await p.getByRole("button", { name: "지적사항", exact: true }).click(); await p.waitForTimeout(800);
await p.getByText("퇴사자 Slack 계정 미회수").first().click();
out.actionPersisted = await p.locator("textarea").nth(1).inputValue();
await p.getByRole("button", { name: "검증·종결" }).click(); await p.waitForTimeout(800);
out.closedBy = await p.locator("tr", { hasText: "검증" }).first().innerText();
await p.getByRole("button", { name: /내부정보유출통제/ }).first().click();
await p.getByText("분기 권한 검토").first().click(); await p.waitForTimeout(300);
out.evidencePersisted = await p.getByText("2026-Q4 권한 검토 결과서").count();
out.methodPersisted = await p.getByText(/이정민 · .* 저장/).count();
await p.getByRole("button", { name: "심사 대응 패키지" }).click(); await p.waitForTimeout(800);
out.pkgL03 = (await p.locator("tr", { hasText: "L03" }).first().innerText()).replace(/\s+/g, " ");
await p.getByRole("button", { name: "로그점검" }).click(); await p.waitForTimeout(800);
out.auditRows = await p.locator("tbody tr").count();
out.auditWho = [...new Set(await p.locator("tbody tr td:nth-child(2)").allInnerTexts())];
out.errs = errs;
console.log(JSON.stringify(out, null, 1)); await b.close();
