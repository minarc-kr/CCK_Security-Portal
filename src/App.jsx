import { useState, useEffect } from "react";
import { BarChart, Bar as RBar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

/* ─────────────── 영역·활동 데이터 (인증 요구 활동 기준) ─────────────── */
const STD = ["ISO27001", "ISO42001", "SOC2", "CSAP", "PIPA", "TRADE"];
const STD_LABEL = { ISO27001: "27001", ISO42001: "42001", SOC2: "SOC2", CSAP: "CSAP", PIPA: "개인정보법", TRADE: "부경법·산기법" };

const DOMAINS = [
  { code: "D01", name: "보안조직·거버넌스" },
  { code: "D02", name: "보안컴플라이언스" },
  { code: "D03", name: "내부정보유출통제" },
  { code: "D04", name: "사이버위협통제" },
  { code: "D05", name: "제품·서비스 보안" },
  { code: "D06", name: "AI보안" },
  { code: "D07", name: "개인정보보호" },
  { code: "D08", name: "영업비밀보호" },
  { code: "D09", name: "보안인식제고" },
  { code: "D10", name: "보안감사" },
];

// a(code, domain, title, cycle, map, auto[], status, next, ev[])
const a = (code, d, title, cycle, map, auto, status, next, ev = []) => ({ code, d, title, cycle, map, auto, status, next, ev });
const ACTS = [
  // D01 거버넌스
  a("G01", "D01", "정책·규정 제·개정·승인·배포", "연", { ISO27001: "5.2, A.5.1", ISO42001: "5.2, A.2", SOC2: "CC2.2, CC5.3", CSAP: "정책·조직", PIPA: "30조, 안전조치 고시(내부관리계획)" }, ["portal"], "ok", "2027-07-01", [["portal", "정책 열람 확인 로그", "2026-09"], ["manual", "정책 개정 결재", "2026-07"]]),
  a("G02", "D01", "보안조직·역할 지정(CISO/CPO/담당자)", "연", { ISO27001: "5.3, A.5.2", ISO42001: "5.3, A.3", SOC2: "CC1.3", CSAP: "정책·조직", PIPA: "31조" }, [], "warn", "2026-09-30", [["manual", "임명장·조직도", "2026-01"]]),
  a("G03", "D01", "범위·이해관계자·법규 목록 관리", "연", { ISO27001: "4.1~4.3, A.5.31", ISO42001: "4.1~4.4", SOC2: "CC2.3", CSAP: "준거성" }, [], "gap", "2026-10-31"),
  a("G04", "D01", "위험평가·위험처리계획", "연", { ISO27001: "6.1.2~3, 8.2~3", ISO42001: "6.1.2~3, 8.2", SOC2: "CC3.1~4", CSAP: "관리체계" }, [], "gap", "2026-11-30"),
  a("G05", "D01", "경영진 검토", "연", { ISO27001: "9.3", ISO42001: "9.3", SOC2: "CC1.2, CC4", CSAP: "관리체계" }, [], "gap", "2026-12-15"),
  a("G06", "D01", "성과지표(KPI) 측정·보고", "분기", { ISO27001: "9.1", ISO42001: "9.1", SOC2: "CC4.1" }, ["portal"], "warn", "2026-10-05"),
  // D02 컴플라이언스
  a("C01", "D02", "통제 매핑(CCF) 유지", "반기", { ISO27001: "전체", ISO42001: "전체", SOC2: "전체", CSAP: "전체", PIPA: "전체" }, ["portal"], "ok", "2027-03-01", [["portal", "매핑표 v0.2", "2026-09"]]),
  a("C02", "D02", "증빙 자동수집·보관", "월", { ISO27001: "7.5", ISO42001: "7.5", SOC2: "CC2.1", CSAP: "관리체계" }, ["gws", "github", "slack", "jira"], "warn", "2026-10-01", [["gws", "권한·기기 덤프", "2026-09"], ["github", "저장소·PR 덤프", "2026-09"]]),
  a("C03", "D02", "외부자·공급망 목록·위험평가", "연", { ISO27001: "A.5.19~20", ISO42001: "A.10", SOC2: "CC9.2", CSAP: "공급망", PIPA: "26조" }, [], "warn", "2026-10-31", [["manual", "SaaS 공급자 목록", "2026-06"]]),
  a("C04", "D02", "계약 보안조항·SLA 점검", "연", { ISO27001: "A.5.20", ISO42001: "A.10", SOC2: "CC9.2", CSAP: "공급망", PIPA: "26조" }, [], "gap", "2026-11-30"),
  a("C05", "D02", "외부자 접근·점검", "분기", { ISO27001: "A.5.22", SOC2: "CC9.2", CSAP: "공급망", PIPA: "26조④" }, ["gws"], "gap", "2026-10-15"),
  // D03 내부유출
  a("L01", "D03", "정보자산 식별·분류·대장", "분기", { ISO27001: "A.5.9, A.5.12", ISO42001: "A.4", SOC2: "CC6.1", CSAP: "자산관리" }, ["gws", "github"], "ok", "2026-10-01", [["gws", "기기·계정 목록", "2026-09"], ["github", "저장소 목록", "2026-09"]]),
  a("L02", "D03", "계정·권한 신청·승인·회수", "상시", { ISO27001: "A.5.15~16, A.5.18", ISO42001: "A.9", SOC2: "CC6.1~3", CSAP: "접근통제", PIPA: "29조, 고시 접근권한" }, ["portal", "gws"], "ok", "—", [["portal", "권한요청 처리 이력", "2026-09"]]),
  a("L03", "D03", "분기 권한 검토", "분기", { ISO27001: "A.5.18", SOC2: "CC6.2", CSAP: "접근통제", PIPA: "고시 접근권한" }, ["gws", "github", "slack"], "warn", "2026-10-15", [["gws", "권한 덤프", "2026-08"], ["github", "협업자 덤프", "2026-08"]]),
  a("L04", "D03", "특권계정·MFA 관리", "월", { ISO27001: "A.8.2, A.8.5", SOC2: "CC6.1", CSAP: "접근통제", PIPA: "고시 접근통제" }, ["gws"], "warn", "2026-10-01", [["gws", "MFA 미설정 3건", "2026-09"]]),
  a("L05", "D03", "반출·매체·DLP 통제", "상시", { ISO27001: "A.5.10, A.5.14, A.7.10", SOC2: "CC6.7", CSAP: "데이터 보호", PIPA: "고시 출력·복사" }, [], "gap", "2026-11-30"),
  a("L06", "D03", "접속기록·감사로그 검토", "월", { ISO27001: "A.8.15~16", SOC2: "CC7.2", CSAP: "로그관리", PIPA: "고시 접속기록(월 1회)" }, ["gws"], "ok", "2026-10-01", [["gws", "감사로그 요약", "2026-09"]]),
  a("L07", "D03", "보안서약·입·퇴사 절차", "상시", { ISO27001: "A.6.1~2, A.6.5~6", SOC2: "CC1.4~5", CSAP: "인적보안", PIPA: "28조" }, ["portal"], "warn", "—", [["portal", "서약서 3건", "2026-09"]]),
  a("L08", "D03", "물리적 출입·사무환경·장비 반출입", "반기", { ISO27001: "A.7", SOC2: "CC6.4~5", CSAP: "물리적 보호", PIPA: "고시 물리적" }, [], "gap", "2026-12-31"),
  // D04 사이버위협
  a("T01", "D04", "취약점 점검·패치", "월", { ISO27001: "A.8.8", ISO42001: "A.6", SOC2: "CC7.1", CSAP: "취약점·시스템", PIPA: "고시 악성프로그램" }, ["github"], "warn", "2026-10-01", [["github", "Dependabot 알림", "2026-09"]]),
  a("T02", "D04", "악성코드·엔드포인트 보호", "월", { ISO27001: "A.8.7", SOC2: "CC6.8", CSAP: "시스템", PIPA: "고시 악성프로그램" }, [], "gap", "2026-10-01"),
  a("T03", "D04", "네트워크·원격접속 통제", "분기", { ISO27001: "A.8.20~22", SOC2: "CC6.6", CSAP: "네트워크", PIPA: "고시 접근통제" }, [], "warn", "2026-10-15"),
  a("T04", "D04", "암호화·키 관리", "반기", { ISO27001: "A.8.24", SOC2: "C1", CSAP: "암호화", PIPA: "29조, 고시 암호화" }, [], "warn", "2026-12-31"),
  a("T05", "D04", "사고 접수·분류·초동대응", "상시", { ISO27001: "A.5.24~26", ISO42001: "A.6", SOC2: "CC7.3~4", CSAP: "침해사고" }, ["portal"], "ok", "—", [["portal", "사고 신고·처리 이력", "2026-08"]]),
  a("T06", "D04", "사후 분석·재발방지", "상시", { ISO27001: "A.5.27", ISO42001: "10.1", SOC2: "CC7.5", CSAP: "침해사고" }, ["portal"], "ok", "—"),
  a("T08", "D04", "C-TAS 위협정보 수집·보안장비 반영", "월", { ISO27001: "A.5.7", SOC2: "CC7.1", CSAP: "침해사고" }, ["ctas"], "gap", "2026-10-31", [["manual", "C-TAS 가입 준비 중", "2026-09"]]),
  a("T07", "D04", "사고대응 모의훈련", "연", { ISO27001: "A.5.24", SOC2: "CC7.4", CSAP: "침해사고" }, [], "gap", "2026-11-30"),
  // D05 제품·서비스
  a("P01", "D05", "시큐어코딩·SDLC 보안", "상시", { ISO27001: "A.8.25~29", ISO42001: "A.6", SOC2: "CC8.1", CSAP: "개발·도입" }, ["github"], "warn", "—", [["github", "PR 리뷰 승인 이력", "2026-09"]]),
  a("P02", "D05", "변경관리·배포 승인", "상시", { ISO27001: "A.8.32", ISO42001: "A.6", SOC2: "CC8.1", CSAP: "개발·도입" }, ["github", "jira", "netlify"], "ok", "—", [["github", "PR·배포 이력", "2026-09"]]),
  a("P03", "D05", "서비스 취약점 진단(모의해킹)", "연", { ISO27001: "A.8.8, A.8.29", SOC2: "CC7.1", CSAP: "취약점" }, [], "gap", "2026-12-31"),
  a("P04", "D05", "클라우드 인프라 구성·가상화 보안", "분기", { ISO27001: "A.5.23, A.8.9", SOC2: "CC6.7", CSAP: "가상화·시스템" }, [], "warn", "2026-10-15"),
  a("P05", "D05", "고객 데이터 분리·암호화", "반기", { ISO27001: "A.8.24, A.8.12", SOC2: "C1", CSAP: "데이터 보호", PIPA: "29조" }, [], "warn", "2026-12-31"),
  a("P06", "D05", "서비스 로그·모니터링", "월", { ISO27001: "A.8.15~16", SOC2: "CC7.2", CSAP: "로그관리" }, [], "gap", "2026-10-01"),
  a("P07", "D05", "백업·복구·BCP/DR", "반기", { ISO27001: "A.5.29~30, A.8.13~14", SOC2: "A1.2~3", CSAP: "서비스 연속성", PIPA: "고시 재해·재난" }, [], "gap", "2026-12-31"),
  // D06 AI보안
  a("A01", "D06", "AI 시스템 목록·용도 관리", "분기", { ISO42001: "A.6.2, A.9", CSAP: "자산관리" }, ["portal"], "warn", "2026-10-01", [["manual", "AI 시스템 5건", "2026-08"]]),
  a("A02", "D06", "AI 사용 정책·가드레일 운영", "연", { ISO42001: "A.2, A.9", SOC2: "CC5" }, ["portal"], "ok", "2027-08-20", [["portal", "AI 개발·운영 규칙 v1.0", "2026-08"]]),
  a("A03", "D06", "AI 영향평가", "상시", { ISO42001: "6.1.4, 8.4, A.5", PIPA: "33조 연계" }, [], "gap", "2026-11-30"),
  a("A04", "D06", "AI 생애주기 기록(설계·검증·배포·폐기)", "상시", { ISO42001: "A.6.2", SOC2: "CC8.1", CSAP: "개발·도입" }, ["github", "jira"], "gap", "—"),
  a("A05", "D06", "학습·추론 데이터 출처·품질·보관", "분기", { ISO42001: "A.7.2~6", SOC2: "PI1", PIPA: "15조, 21조" }, [], "gap", "2026-10-31"),
  a("A06", "D06", "모델·API 공급자 관리", "연", { ISO42001: "A.10", ISO27001: "A.5.19", SOC2: "CC9.2", CSAP: "공급망", PIPA: "26조" }, [], "warn", "2026-10-31"),
  a("A07", "D06", "AI 위협 대응(프롬프트 인젝션·데이터 오염)", "분기", { ISO42001: "A.6, 8.4", SOC2: "CC7.1" }, [], "gap", "2026-10-31"),
  a("A08", "D06", "이해관계자 고지·투명성", "연", { ISO42001: "A.8", PIPA: "30조" }, [], "gap", "2026-12-31"),
  // D07 개인정보
  a("V01", "D07", "개인정보 처리현황·흐름도 관리", "반기", { ISO27001: "A.5.34", ISO42001: "A.7", SOC2: "P1", PIPA: "안전조치 고시(내부관리계획)" }, ["portal"], "warn", "2026-12-31", [["manual", "처리현황 대장", "2026-03"]]),
  a("V02", "D07", "처리방침 수립·공개·버전", "연", { ISO27001: "A.5.34", ISO42001: "A.8", SOC2: "P1", PIPA: "30조" }, ["portal"], "warn", "2026-09-30", [["portal", "처리방침 v2.0 검토 중", "2026-08"]]),
  a("V03", "D07", "수집·이용 동의 관리", "상시", { ISO42001: "A.7", SOC2: "P2~3", PIPA: "15조, 22조" }, [], "gap", "—"),
  a("V04", "D07", "제3자 제공·위탁 대장", "분기", { ISO27001: "A.5.19~21", ISO42001: "A.10", SOC2: "P6", PIPA: "17조, 26조" }, [], "warn", "2026-10-15"),
  a("V05", "D07", "정보주체 요청 처리(열람·정정·삭제·처리정지)", "상시", { SOC2: "P5", PIPA: "35~37조(10일 내)" }, ["portal"], "ok", "—"),
  a("V06", "D07", "개인정보 영향평가", "상시", { ISO42001: "A.7", SOC2: "P1", PIPA: "33조" }, [], "gap", "2026-12-31"),
  a("V07", "D07", "보유기간·파기", "반기", { ISO27001: "A.5.10", ISO42001: "A.7", SOC2: "P4", PIPA: "21조, 고시 파기" }, [], "gap", "2026-12-31"),
  a("V08", "D07", "유출 통지·신고(72시간)", "상시", { ISO27001: "A.5.26", SOC2: "P6, CC7.4", PIPA: "34조" }, ["portal"], "ok", "—"),
  // D08 영업비밀
  a("S01", "D08", "영업비밀·핵심기술 지정·등급", "연", { TRADE: "부경법 2조, 산기법 9조", ISO27001: "A.5.9, A.5.12" }, [], "gap", "2026-11-30"),
  a("S02", "D08", "비밀유지계약(NDA)·서약 관리", "상시", { TRADE: "부경법 2조③", ISO27001: "A.6.6" }, ["portal"], "warn", "—", [["manual", "NDA 12건", "2026-08"]]),
  a("S03", "D08", "비밀 자료 접근·열람 이력", "월", { TRADE: "부경법 2조", ISO27001: "A.5.13, A.8.15" }, ["gws"], "gap", "2026-10-01"),
  a("S04", "D08", "퇴직자·전직 관리", "상시", { TRADE: "부경법 10조", ISO27001: "A.6.5" }, ["portal"], "gap", "—"),
  a("S05", "D08", "기술유출 신고·대응", "상시", { TRADE: "산기법 15조" }, ["portal"], "gap", "—"),
  // D09 인식제고
  a("E01", "D09", "보안·개인정보·AI 교육", "연", { ISO27001: "7.2~3, A.6.3", ISO42001: "7.2~3, A.4", SOC2: "CC1.4", CSAP: "인적보안", PIPA: "28조" }, ["portal"], "warn", "2026-09-30", [["portal", "수료 6/9", "2026-09"]]),
  a("E02", "D09", "피싱 모의훈련", "분기", { ISO27001: "A.6.3", SOC2: "CC1.4", CSAP: "인적보안" }, ["portal"], "ok", "2026-12-15", [["portal", "9월 훈련 결과", "2026-09"]]),
  a("E03", "D09", "보안 공지·캠페인", "월", { ISO27001: "A.6.3", SOC2: "CC2.2" }, ["slack"], "ok", "2026-10-01", [["slack", "#security 공지 4건", "2026-09"]]),
  a("E04", "D09", "위반·징계 처리", "상시", { ISO27001: "A.6.4", SOC2: "CC1.5", CSAP: "인적보안" }, ["portal"], "ok", "—"),
  // D10 감사
  a("U01", "D10", "연간 감사계획", "연", { ISO27001: "9.2", ISO42001: "9.2", SOC2: "CC4.1", CSAP: "관리체계" }, [], "gap", "2026-12-31"),
  a("U02", "D10", "자체점검(체크리스트)", "분기", { ISO27001: "9.1~2", SOC2: "CC4.1", CSAP: "관리체계", PIPA: "안전조치 점검" }, ["portal"], "gap", "2026-10-31"),
  a("U03", "D10", "내부감사 실시·보고", "연", { ISO27001: "9.2", ISO42001: "9.2", SOC2: "CC4.1" }, [], "gap", "2026-12-31"),
  a("U04", "D10", "지적사항·시정조치 추적", "상시", { ISO27001: "10.1", ISO42001: "10.1", SOC2: "CC4.2" }, ["portal"], "gap", "—"),
  a("U05", "D10", "외부 심사 대응(일정·지적사항)", "상시", { ISO27001: "심사", ISO42001: "심사", SOC2: "심사", CSAP: "심사" }, ["portal"], "warn", "2026-10-01", [["manual", "CSAP 사전환경조사 결과", "2026-07"]]),
];

const INIT_REQUESTS = [
  { id: 1, type: "권한", title: "GitHub cck-guardrail 쓰기 권한", by: "김개발", at: "09-03", status: "접수", act: "L02", src: "포털", linear: "" , log: ["09-03 포털 접수"] },
  { id: 2, type: "계정", title: "신규 입사자 Slack·GWS 계정 (정하늘)", by: "박영업", at: "09-02", status: "처리중", act: "L02", src: "Slack", linear: "SEC-151", log: ["09-02 #security 접수", "09-02 Linear SEC-151 생성", "09-03 GWS 계정 생성 완료"] },
  { id: 3, type: "정보주체", title: "고객 A사 담당자 개인정보 삭제 요청", by: "박영업", at: "09-01", status: "접수", act: "V05", due: "09-11", src: "Gmail", linear: "SEC-149", log: ["09-01 privacy@ 메일 수신 → Claude 등록", "기한 10일: 09-11"] },
  { id: 4, type: "개인정보 등록", title: "신규 마케팅 이벤트 수집 항목 등록", by: "박영업", at: "08-30", status: "처리중", act: "V01", src: "포털", linear: "SEC-147", log: ["08-30 포털 접수", "09-01 처리현황 대장 초안 검토 중"] },
  { id: 5, type: "사고", title: "피싱 의심 메일 (송장 첨부)", by: "박영업", at: "08-28", status: "완료", act: "T05", src: "Slack", linear: "SEC-144", log: ["08-28 #security 신고", "08-28 발신 차단·전사 공지", "08-29 종결 → T05 증빙 저장"] },
  { id: 6, type: "유출", title: "협력사 메일 오발송 (고객 연락처 3건)", by: "김개발", at: "09-04", status: "접수", act: "V08", due: "09-07 09:20", src: "Claude", linear: "SEC-152", log: ["09-04 09:20 Claude로 신고 → 72시간 기한 09-07 09:20", "Linear SEC-152 긴급 생성"] },
];
const REQ_TYPES = ["계정", "권한", "개인정보 등록", "정보주체", "사고", "유출", "기술유출", "기타"];
const TYPE_ACT = { 계정: "L02", 권한: "L02", "개인정보 등록": "V01", 정보주체: "V05", 사고: "T05", 유출: "V08", 기술유출: "S05", 기타: "T05" };
const TYPE_DUE = { 정보주체: "10일", 유출: "72시간" };
const POLICIES = [
  { code: "SEC-POL-01", cat: "정책", title: "정보보호 정책", ver: "v3.0", date: "2026-07-01", read: true, body: "회사의 정보자산을 보호하기 위한 기본 원칙과 책임을 정한다. 전 임직원은 본 정책과 하위 지침을 준수한다." },
  { code: "SEC-GDL-04", cat: "지침", title: "접근권한 관리 지침", ver: "v2.1", date: "2026-08-12", read: true, body: "계정과 권한은 최소권한 원칙으로 부여한다. 부서 이동·퇴직 시 3일 이내 회수하고, 분기 1회 전체 권한을 검토한다." },
  { code: "AI-RUL-01", cat: "규칙", title: "AI 개발·운영 개인정보보호 규칙", ver: "v1.0", date: "2026-08-20", read: false, body: "AI 기능 개발 시 학습·추론 데이터의 개인정보 처리 기준, 로그 보관, 제3자 정보 처리 근거를 정한다." },
  { code: "SEC-GDL-09", cat: "지침", title: "보안사고 대응 지침", ver: "v1.4", date: "2026-05-03", read: false, body: "사고 인지 즉시 포털 또는 #security 채널로 신고한다. 정보보호부문은 1시간 내 초동 대응을 시작한다." },
];
const MY_TRAININGS = [
  { kind: "보안교육", title: "2026 하반기 정보보호 교육", due: "09-30", done: false },
  { kind: "개인정보교육", title: "개인정보보호 연간 교육", due: "09-30", done: true },
  { kind: "모의훈련", title: "9월 피싱 모의훈련", due: "09-15", done: true },
  { kind: "서약", title: "2026 정보보호 서약서", due: "09-30", done: false },
];
/* 외부 연결 (예시 3개, 나머지는 규칙으로 자동 생성) */
const LINKS = {
  L03: { linear: "SEC-142 26-4Q 권한 검토", drive: "보안포털/03_내부유출/L03/2026-Q4", slack: "#security-access" },
  E02: { linear: "SEC-131 9월 피싱 모의훈련", drive: "보안포털/09_인식제고/E02/2026-Q3", slack: "#security" },
  U05: { linear: "SEC-098 CSAP 사전환경조사 대응", drive: "보안포털/10_감사/U05/CSAP", slack: "#csap" },
  T08: { linear: "SEC-150 C-TAS 가입·연동", drive: "보안포털/04_사이버위협/T08/", slack: "#security-threat" },
};
const linkOf = (x) => LINKS[x.code] || { linear: "(이슈 없음)", drive: `보안포털/${x.d.slice(1)}_${DOMAINS.find((d) => d.code === x.d).name.slice(0, 4)}/${x.code}/`, slack: "#security" };

/* 주기 → 회차 생성 (2026-07 ~ 2027-06) */
const TODAY = "2026-09-04";
const pad = (n) => String(n).padStart(2, "0");
const lastDay = (y, m) => new Date(y, m, 0).getDate();
function occurrences() {
  const out = [];
  for (const x of ACTS) {
    if (x.cycle === "상시") continue;
    const nextM = x.next !== "—" ? +x.next.slice(5, 7) : 12;
    for (let i = 0; i < 12; i++) {
      const y = i < 6 ? 2026 : 2027, m = i < 6 ? 7 + i : i - 5;
      let hit = false, due, period;
      if (x.cycle === "월") { hit = true; due = `${y}-${pad(m)}-${pad(lastDay(y, m))}`; period = `${y}-${pad(m)}`; }
      if (x.cycle === "분기" && [1, 4, 7, 10].includes(m)) { hit = true; due = `${y}-${pad(m)}-15`; period = `${y}-Q${Math.ceil(m / 3)}`; }
      if (x.cycle === "반기" && [6, 12].includes(m)) { hit = true; due = `${y}-${pad(m)}-${pad(lastDay(y, m))}`; period = `${y}-H${m === 6 ? 1 : 2}`; }
      if (x.cycle === "연" && m === nextM) { hit = true; due = x.next !== "—" ? x.next : `${y}-12-31`; period = `${y}`; }
      if (!hit) continue;
      const start = `${y}-${pad(m)}-01`;
      let status = "planned";
      if (due < TODAY) status = x.status === "ok" ? "done" : "delayed";
      else if (start <= TODAY) status = x.status === "ok" ? "done" : x.status === "warn" ? "in_progress" : "planned";
      out.push({ act: x, period, start, due, status });
    }
  }
  return out;
}
const OCC = occurrences();
const OST = { planned: ["예정", "#6B7686"], in_progress: ["진행", "#2E5C8A"], done: ["완료", "#2E7D5B"], delayed: ["지연", "#B23A3A"] };

/* C-TAS 샘플 (사내 전용) */
const CTAS = {
  level: "관심", levels: ["정상", "관심", "주의", "경계", "심각"],
  today: { ip: 1284, domain: 312, url: 96, hash: 58 },
  applied: { fw: 1284, mail: 408, edr: 58 }, pending: 0,
  alerts: [
    { at: "09-04 07:10", sev: "주의", t: "국내 기업 대상 송장 위장 피싱메일 유포 — 첨부 .lnk", via: "email" },
    { at: "09-02 16:40", sev: "관심", t: "Next.js SSRF 취약점(CVE) 악용 시도 증가", via: "email" },
    { at: "08-29 09:00", sev: "관심", t: "특정 C&C 도메인 12건 추가 공유", via: "api" },
  ],
  lastSync: "09-04 08:00", via: "API",
  daily: ["8/22","8/23","8/24","8/25","8/26","8/27","8/28","8/29","8/30","8/31","9/1","9/2","9/3","9/4"].map((d, i) => {
    const base = [910, 640, 590, 1120, 1180, 1050, 1230, 1410, 700, 660, 1290, 1520, 1380, 1284][i];
    return { d, IP: base, 도메인: Math.round(base * 0.24), URL: Math.round(base * 0.075), 해시: Math.round(base * 0.045), 반영률: [100,100,100,100,98,100,100,96,100,100,100,99,100,100][i] };
  }),
};
const SRC = { ctas: "KISA C-TAS", portal: "포털", gws: "Google Workspace", github: "GitHub", slack: "Slack", jira: "Jira", netlify: "Netlify", manual: "수동" };
const ST = { ok: ["충족", "#2E7D5B"], warn: ["보완", "#B7791F"], gap: ["미비", "#B23A3A"] };
const C = { ink: "#1B2432", rail: "#141C28", bg: "#F3F5F8", line: "#DCE1E8", mute: "#6B7686", steel: "#2E5C8A" };

/* ─────────────── 공통 UI ─────────────── */
const Tag = ({ children, color = C.mute }) => <span className="inline-block text-xs px-1.5 py-0.5 rounded-sm whitespace-nowrap" style={{ background: color + "1A", color }}>{children}</span>;
const Btn = ({ children, onClick, primary, small }) => (
  <button onClick={onClick} className={(small ? "text-xs px-2.5 py-1 " : "text-sm px-3.5 py-1.5 ") + "rounded-sm font-medium focus:outline-none focus:ring-2"} style={primary ? { background: C.steel, color: "#fff" } : { background: "#fff", color: C.ink, border: `1px solid ${C.line}` }}>{children}</button>
);
const Card = ({ title, right, children }) => (
  <section className="bg-white" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
    {title && <header className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}><h3 className="text-sm font-semibold">{title}</h3>{right}</header>}
    <div className="p-4">{children}</div>
  </section>
);
const Dot = ({ s }) => <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: ST[s][1] }} />;
const Bar = ({ v, color }) => <div className="h-1.5 rounded-full w-full" style={{ background: C.line }}><div className="h-1.5 rounded-full" style={{ width: `${v}%`, background: color || C.steel }} /></div>;

/* ─────────────── 현황 ─────────────── */
function Overview({ go, std, setStd }) {
  const acts = std === "ALL" ? ACTS : ACTS.filter((x) => x.map[std]);
  const cnt = (list) => ({ ok: list.filter((x) => x.status === "ok").length, warn: list.filter((x) => x.status === "warn").length, gap: list.filter((x) => x.status === "gap").length });
  const tot = cnt(acts);
  const soon = ACTS.filter((x) => x.next !== "—" && x.next <= "2026-10-15").sort((p, q) => p.next.localeCompare(q.next)).slice(0, 8);
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-semibold">보안활동 현황</h1>
        <div className="flex gap-1">{["ALL", ...STD].map((s) => <button key={s} onClick={() => setStd(s)} className="text-xs px-2.5 py-1 rounded-sm" style={{ background: std === s ? C.ink : "#fff", color: std === s ? "#fff" : C.ink, border: `1px solid ${C.line}` }}>{s === "ALL" ? "전체" : STD_LABEL[s]}</button>)}</div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[["대상 활동", acts.length, C.ink], ["충족", tot.ok, ST.ok[1]], ["보완 필요", tot.warn, ST.warn[1]], ["미비", tot.gap, ST.gap[1]]].map(([l, v, c]) => (
          <div key={l} className="bg-white px-4 py-3" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-2xl font-semibold mt-1" style={{ color: c }}>{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3">
          <Card title="영역별 이행률">
            <div className="space-y-2.5">
              {DOMAINS.map((d) => {
                const l = acts.filter((x) => x.d === d.code); if (!l.length) return null;
                const c = cnt(l); const pct = Math.round((c.ok / l.length) * 100);
                return (
                  <button key={d.code} onClick={() => go(d.code)} className="w-full flex items-center gap-3 text-left text-sm focus:outline-none focus:ring-2 rounded-sm">
                    <span className="w-36 shrink-0">{d.name}</span>
                    <Bar v={pct} color={pct === 100 ? ST.ok[1] : pct >= 50 ? C.steel : ST.warn[1]} />
                    <span className="text-xs w-20 text-right" style={{ color: C.mute }}>{c.ok}/{l.length} · 미비 {c.gap}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="col-span-2">
          <Card title="기한 임박 (10/15까지)">
            <ul className="text-sm divide-y" style={{ borderColor: C.line }}>
              {soon.map((x) => <li key={x.code} className="py-2 flex items-center gap-2"><Dot s={x.status} /><span className="text-xs w-8" style={{ color: C.mute }}>{x.code}</span><span className="truncate">{x.title}</span><span className="ml-auto text-xs shrink-0" style={{ color: x.next <= "2026-09-30" ? ST.gap[1] : C.mute }}>{x.next.slice(5)}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>
      <Card title="KISA C-TAS 위협정보" right={<span className="text-xs" style={{ color: C.mute }}>{CTAS.via} 동기화 {CTAS.lastSync} · 사내 전용</span>}>
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3">
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
          <div className="col-span-2">
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
function Domain({ code, std }) {
  const d = DOMAINS.find((x) => x.code === code);
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
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
          <table className="w-full text-sm">
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
          </table>
        </div>
        <div className="col-span-2">
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
                  <div className="text-xs mb-1" style={{ color: C.mute }}>증빙 {x.ev.length}건</div>
                  {x.ev.length ? <ul className="divide-y" style={{ borderColor: C.line }}>{x.ev.map((e, i) => <li key={i} className="py-1.5 flex justify-between"><span>{e[1]}</span><span className="text-xs" style={{ color: C.mute }}>{SRC[e[0]]} · {e[2]}</span></li>)}</ul> : <div className="text-xs py-2" style={{ color: ST.gap[1] }}>증빙이 없습니다. 담당자와 수집 방법을 정하세요.</div>}
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>연결</div>
                  {(() => { const l = linkOf(x); return (
                    <table className="w-full text-xs"><tbody>
                      <tr><td className="py-0.5 w-16" style={{ color: C.mute }}>Linear</td><td className="py-0.5" style={{ color: l.linear.startsWith("(") ? C.mute : C.steel }}>{l.linear}</td></tr>
                      <tr><td className="py-0.5" style={{ color: C.mute }}>Drive</td><td className="py-0.5" style={{ color: C.steel }}>{l.drive}</td></tr>
                      <tr><td className="py-0.5" style={{ color: C.mute }}>Slack</td><td className="py-0.5" style={{ color: C.steel }}>{l.slack}</td></tr>
                    </tbody></table>
                  ); })()}
                </div>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>자동 수집</div>
                  <p className="text-xs">{x.auto.length ? `${x.auto.map((s) => SRC[s]).join(", ")}에서 ${x.cycle === "상시" ? "이벤트 발생 시" : "주기마다"} 수집` : "없음 — 수동 업로드로 관리"}</p>
                </div>
                <div className="flex gap-2 pt-3" style={{ borderTop: `1px solid ${C.line}` }}><Btn small primary>수행 기록</Btn><Btn small>파일 업로드 → Drive</Btn><Btn small>Linear 이슈 생성</Btn></div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 요청함 (정보보호부문) ─────────────── */
function Inbox({ requests, setRequests, go }) {
  const col = { 접수: ST.warn[1], 처리중: C.steel, 완료: ST.ok[1], 반려: ST.gap[1] };
  const [sel, setSel] = useState(requests[0]?.id);
  const r = requests.find((x) => x.id === sel) || requests[0];
  const act = r && ACTS.find((x) => x.code === r.act);
  const upd = (id, patch, note) => setRequests(requests.map((x) => (x.id === id ? { ...x, ...patch, log: [...x.log, `09-04 ${note}`] } : x)));
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between"><h1 className="text-xl font-semibold">요청함</h1><span className="text-xs" style={{ color: C.mute }}>포털·Slack·Gmail·Claude에서 접수 → Linear 처리 → 활동 증빙</span></div>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-white overflow-hidden" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-left" style={{ color: C.mute, background: C.bg }}><th className="px-3 py-2 font-normal">유형</th><th className="px-2 py-2 font-normal">내용</th><th className="px-2 py-2 font-normal">접수</th><th className="px-2 py-2 font-normal">기한</th><th className="px-2 py-2 font-normal">상태</th></tr></thead>
            <tbody className="divide-y" style={{ borderColor: C.line }}>
              {requests.map((x) => (
                <tr key={x.id} onClick={() => setSel(x.id)} className="cursor-pointer" style={{ background: r?.id === x.id ? "#EEF3F9" : undefined }}>
                  <td className="px-3 py-2.5"><Tag color={["사고", "유출", "기술유출"].includes(x.type) ? ST.gap[1] : C.mute}>{x.type}</Tag></td>
                  <td className="px-2 py-2.5"><div>{x.title}</div><div className="text-xs" style={{ color: C.mute }}>{x.by} · {x.src}{x.linear ? ` · ${x.linear}` : ""}</div></td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: C.mute }}>{x.at}</td>
                  <td className="px-2 py-2.5 text-xs" style={{ color: x.due ? ST.gap[1] : C.mute }}>{x.due || "—"}</td>
                  <td className="px-2 py-2.5"><Tag color={col[x.status]}>{x.status}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="col-span-2">
          {r && (
            <Card title={r.title} right={<Tag color={col[r.status]}>{r.status}</Tag>}>
              <div className="text-sm space-y-4">
                <table className="w-full text-xs"><tbody>
                  <tr><td className="py-0.5 w-16" style={{ color: C.mute }}>접수 경로</td><td>{r.src} · {r.by} · {r.at}</td></tr>
                  <tr><td className="py-0.5" style={{ color: C.mute }}>Linear</td><td style={{ color: r.linear ? C.steel : C.mute }}>{r.linear || "미생성"}</td></tr>
                  <tr><td className="py-0.5" style={{ color: C.mute }}>기한</td><td style={{ color: r.due ? ST.gap[1] : C.mute }}>{r.due ? `${r.due} (${TYPE_DUE[r.type]})` : "없음"}</td></tr>
                  <tr><td className="py-0.5" style={{ color: C.mute }}>증빙 활동</td><td><button className="focus:outline-none" style={{ color: C.steel }} onClick={() => go(act.d)}>{act.code} {act.title}</button></td></tr>
                </tbody></table>
                <div>
                  <div className="text-xs mb-1" style={{ color: C.mute }}>처리 이력</div>
                  <ul className="text-xs space-y-1">{r.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  {r.status === "접수" && !r.linear && <Btn small onClick={() => upd(r.id, { linear: "SEC-15" + r.id }, `Linear SEC-15${r.id} 생성`)}>Linear 이슈 생성</Btn>}
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
      <div className="grid grid-cols-3 gap-3">
        {[["읽지 않은 정책·규칙", unread, unread ? ST.warn[1] : ST.ok[1], "policies"], ["미완료 교육·서약", todo, todo ? ST.warn[1] : ST.ok[1], "training"], ["내 요청", mine.length, C.ink, "requests"]].map(([l, v, c, pg]) => (
          <button key={l} onClick={() => go(pg)} className="text-left bg-white px-4 py-3 focus:outline-none focus:ring-2 rounded-sm" style={{ border: `1px solid ${C.line}`, borderRadius: 6 }}><div className="text-xs" style={{ color: C.mute }}>{l}</div><div className="text-2xl font-semibold mt-1" style={{ color: c }}>{v}</div></button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
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
    <div className="grid grid-cols-5 gap-4">
      <ul className="col-span-2 bg-white divide-y" style={{ border: `1px solid ${C.line}`, borderRadius: 6, borderColor: C.line }}>
        {POLICIES.map((x, i) => <li key={x.code} onClick={() => setSel(i)} className="px-4 py-3 cursor-pointer" style={{ background: sel === i ? "#EEF3F9" : undefined }}><div className="flex justify-between"><span className="text-sm font-medium">{x.title}</span>{read[i] ? <Tag color={ST.ok[1]}>열람</Tag> : <Tag color={ST.warn[1]}>미열람</Tag>}</div><div className="text-xs mt-0.5" style={{ color: C.mute }}>{x.code} {x.cat} {x.ver} 시행 {x.date}</div></li>)}
      </ul>
      <div className="col-span-3"><Card title={`${p.code} ${p.title}`} right={<Tag>{p.ver}</Tag>}>
        <p className="text-sm leading-7">{p.body}</p>
        <div className="mt-6 pt-4 flex items-center gap-3" style={{ borderTop: `1px solid ${C.line}` }}><Btn primary onClick={() => setRead(read.map((r, i) => (i === sel ? true : r)))}>{read[sel] ? "열람 확인함" : "읽고 이해했습니다"}</Btn><span className="text-xs" style={{ color: C.mute }}>열람 확인은 G01 활동 증빙으로 저장됩니다.</span></div>
      </Card></div>
    </div>
  );
}
function EmpRequests({ requests, setRequests }) {
  const [f, setF] = useState({ type: "권한", title: "", detail: "" });
  const mine = requests.filter((r) => r.by === "김개발");
  const submit = () => { if (!f.title.trim()) return; const due = f.type === "정보주체" ? "09-14" : f.type === "유출" ? "09-07 " + new Date().toTimeString().slice(0, 5) : undefined; setRequests([{ id: Date.now(), type: f.type, title: f.title, by: "김개발", at: "09-04", status: "접수", act: TYPE_ACT[f.type], src: "포털", linear: "", due, log: ["09-04 포털 접수" + (due ? ` (기한 ${TYPE_DUE[f.type]}: ${due})` : "")] }, ...requests]); setF({ type: "권한", title: "", detail: "" }); };
  const col = { 접수: ST.warn[1], 처리중: C.steel, 완료: ST.ok[1], 반려: ST.gap[1] };
  return (
    <div className="grid grid-cols-5 gap-4">
      <div className="col-span-2"><Card title="요청·신고">
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1.5">{REQ_TYPES.map((t) => <button key={t} onClick={() => setF({ ...f, type: t })} className="px-2.5 py-1 rounded-sm text-xs" style={{ background: f.type === t ? C.steel : "#fff", color: f.type === t ? "#fff" : C.ink, border: `1px solid ${C.line}` }}>{t}</button>)}</div>
          {TYPE_DUE[f.type] && <div className="text-xs" style={{ color: ST.gap[1] }}>{f.type === "유출" ? "접수 시각부터 72시간 내 신고 기한이 자동 계산됩니다." : "접수일부터 10일 내 처리 기한이 자동 계산됩니다."}</div>}
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={["사고", "유출", "기술유출"].includes(f.type) ? "무슨 일이 있었나요?" : "무엇이 필요한가요?"} className="w-full px-3 py-2 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
          <textarea value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} rows={4} placeholder="대상 시스템, 기간, 사유" className="w-full px-3 py-2 rounded-sm" style={{ border: `1px solid ${C.line}` }} />
          <Btn primary onClick={submit}>{["사고", "유출", "기술유출"].includes(f.type) ? "신고하기" : "신청하기"}</Btn>
          <p className="text-xs" style={{ color: C.mute }}>Slack #security 또는 Claude에서도 같은 요청을 할 수 있습니다.</p>
        </div>
      </Card></div>
      <div className="col-span-3"><Card title="내 요청">
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
          <div className="grid grid-cols-3 gap-4">
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
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3"><h1 className="text-xl font-semibold">{y}년 {m}월</h1><Btn small onClick={() => move(-1)}>‹</Btn><Btn small onClick={() => move(1)}>›</Btn></div>
        <div className="flex items-center gap-3 text-xs">
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
              <div key={i} className="min-h-24 p-1.5" style={{ borderTop: `1px solid ${C.line}`, borderLeft: i % 7 ? `1px solid ${C.line}` : undefined, background: d ? "#fff" : C.bg }}>
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
  "이번 주 활동 업데이트": "Linear·Drive·Slack을 확인했습니다.\n\n변경 3건\n· L03 권한 검토 — Drive에 GWS 권한 덤프(09-03) 추가 → 증빙 1건 저장, 상태 진행\n· E02 모의훈련 — Linear SEC-131 완료 → 수행 기록 생성, 상태 완료\n· U05 CSAP 대응 — #csap에 디딤 회신 스레드 → 증빙 링크 저장\n\n지연 2건\n· G02 조직·역할 지정 (기한 09-30, 임명 문서 미등록)\n· V02 처리방침 v2.0 (기한 09-30)\n\n조치가 필요한 것은 없습니다. change_log에 3건 기록했습니다.",
  "L03 권한 검토 시작": "L03 26-Q4 회차를 시작합니다.\n\n· Linear 이슈 SEC-142 생성 (담당 이정민, 기한 10-15)\n· Drive 폴더 보안포털/03_내부유출/L03/2026-Q4 생성\n· #security-access에 시작 공지\n· 캘린더 이벤트 [L03] 분기 권한 검토 등록\n· 포털 상태 예정 → 진행\n\nGWS·GitHub·Slack 권한 덤프는 10-01 자동 수집 예정입니다.",
  "지연 활동 알려줘": "지연 5건 (09-04 기준)\n\n· G03 법규 목록 — 담당 미지정\n· L05 반출·DLP — 도구 미도입\n· T02 엔드포인트 — 도구 미도입\n· P06 서비스 로그 — 수집 구성 필요\n· A03 AI 영향평가 — 가드레일 대상 1건 미평가\n\n담당자 지정이 먼저 필요한 것은 G03·A03입니다. 지정해 드릴까요?",
};
function ClaudePanel() {
  const [msgs, setMsgs] = useState([{ r: "c", t: "보안포털에 연결돼 있습니다. Linear·Drive·Slack·Calendar를 읽고 활동 상태·증빙·일정을 갱신합니다. 권한 회수 같은 실제 조치는 제안만 하고 담당자가 실행합니다." }]);
  const [q, setQ] = useState("");
  const ask = (t) => { if (!t.trim()) return; const a = CANNED[t] || "프로토타입에서는 예시 3개만 응답합니다. 실운영에서는 Claude API + MCP(Linear·Drive·Slack·Calendar·Supabase)로 처리합니다."; setMsgs([...msgs, { r: "u", t }, { r: "c", t: a }]); setQ(""); };
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Claude</h1>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-white flex flex-col" style={{ border: `1px solid ${C.line}`, borderRadius: 6, minHeight: 480 }}>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {msgs.map((m, i) => <div key={i} className={"text-sm whitespace-pre-line max-w-lg px-3 py-2 rounded-md " + (m.r === "u" ? "ml-auto text-white" : "")} style={{ background: m.r === "u" ? C.steel : C.bg }}>{m.t}</div>)}
          </div>
          <div className="p-3 flex gap-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask(q)} placeholder="활동 업데이트, 회차 시작, 지연 확인…" className="flex-1 text-sm px-3 py-2 rounded-sm focus:outline-none focus:ring-2" style={{ border: `1px solid ${C.line}` }} />
            <Btn primary onClick={() => ask(q)}>보내기</Btn>
          </div>
        </div>
        <div className="col-span-2 space-y-3">
          <Card title="바로 요청">
            <div className="flex flex-col gap-2">{Object.keys(CANNED).map((k) => <Btn key={k} small onClick={() => ask(k)}>{k}</Btn>)}</div>
          </Card>
          <Card title="정기 갱신">
            <ul className="text-xs space-y-1.5" style={{ color: C.ink }}>
              <li>매일 08:30 — Linear·Drive·Slack 변경분 반영, 지연 목록 #security 발송</li>
              <li>매월 1일 — GWS·GitHub·Slack 권한·자산 덤프 수집</li>
              <li>매주 월 — 이번 주 기한 활동 담당자 DM</li>
            </ul>
            <p className="text-xs mt-3" style={{ color: C.mute }}>모든 변경은 change_log에 actor=claude로 남습니다.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── 앱 ─────────────── */
const EMP_NAV = [["ehome", "홈"], ["policies", "정책·규칙 읽기"], ["requests", "요청·신고"], ["training", "내 교육·서약"]];
export default function App() {
  const [role, setRole] = useState("security");
  const [page, setPage] = useState("overview");
  const [std, setStd] = useState("ALL");
  const [requests, setRequests] = useState(INIT_REQUESTS);
  const nav = [["overview", "현황"], ["calendar", "일정·브리프"], ["inbox", "요청함"], ["claude", "Claude"]];
  const open = requests.filter((r) => ["접수", "처리중"].includes(r.status)).length;
  const switchRole = (r) => { setRole(r); setPage(r === "employee" ? "ehome" : "overview"); };
  const isEmp = role === "employee";
  const body = isEmp
    ? page === "policies" ? <EmpPolicies /> : page === "requests" ? <EmpRequests requests={requests} setRequests={setRequests} /> : page === "training" ? <EmpTraining /> : <EmpHome requests={requests} go={setPage} />
    : page === "overview" ? <Overview go={setPage} std={std} setStd={setStd} /> : page === "calendar" ? <Calendar go={setPage} /> : page === "inbox" ? <Inbox requests={requests} setRequests={setRequests} go={setPage} /> : page === "claude" ? <ClaudePanel /> : <Domain key={page + std} code={page} std={std} />;
  return (
    <div className="min-h-screen flex" style={{ background: C.bg, color: C.ink, fontFamily: "Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif" }}>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      <aside className="w-52 shrink-0 flex flex-col text-white" style={{ background: C.rail }}>
        <div className="px-5 pt-5 pb-4"><div className="text-base font-semibold tracking-tight">CCK 보안포털</div><div className="text-xs mt-0.5" style={{ color: "#8A97AB" }}>{isEmp ? "임직원" : "정보보호부문 · 관리자"}</div></div>
        <nav className="flex-1 px-2 overflow-y-auto">
          {(isEmp ? EMP_NAV : nav).map(([k, v]) => <button key={k} onClick={() => setPage(k)} className="w-full flex items-center text-left text-sm px-3 py-2 rounded-sm mb-0.5 focus:outline-none focus:ring-2" style={{ background: page === k ? "rgba(255,255,255,.12)" : "transparent", color: page === k ? "#fff" : "#B5BFCD" }}>{v}{k === "inbox" && open > 0 && <span className="ml-auto text-xs px-1.5 rounded-sm" style={{ background: "rgba(183,121,31,.35)", color: "#F0D9A8" }}>{open}</span>}</button>)}
          {!isEmp && <>
            <div className="text-xs px-3 pt-4 pb-1.5" style={{ color: "#6E7C91" }}>보안 영역</div>
            {DOMAINS.map((d, i) => {
              const gap = ACTS.filter((x) => x.d === d.code && x.status === "gap").length;
              return (
                <button key={d.code} onClick={() => setPage(d.code)} className="w-full flex items-center text-left text-sm px-3 py-2 rounded-sm mb-0.5 focus:outline-none focus:ring-2" style={{ background: page === d.code ? "rgba(255,255,255,.12)" : "transparent", color: page === d.code ? "#fff" : "#B5BFCD" }}>
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
      <main className="flex-1 min-w-0 px-8 py-6 max-w-6xl">{body}</main>
    </div>
  );
}
