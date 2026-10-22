# 인수인계 — CCK 보안포털 v0.6

최종 갱신 2026-10-22. 다음 세션은 이 문서와 `README.md`부터 읽는다.

## 1. 현재 상태
| 항목 | 값 |
|---|---|
| 저장소 | `minarc-kr/CCK_Security-Portal` |
| 작업 브랜치 | `feat/ops-automation-audit-prep` (main 대비 커밋 5개 + 이 문서) |
| PR | https://github.com/minarc-kr/CCK_Security-Portal/pull/1 — 열림, **미병합** |
| 미리보기 | https://deploy-preview-1--cck-security-portal.netlify.app (Netlify 사이트 `cck-security-portal`) |
| 운영 사이트 | main 병합 시 반영. 병합하면 스케줄 함수 3개가 운영에서 돌기 시작한다 |
| Supabase | 프로젝트 미생성. 운영 모드는 로컬 PostgreSQL+PostgREST로만 검증 |

에피(사용자)가 미리보기에서 데모 모드를 테스트하는 단계에서 이 세션이 끝났다. 테스트 피드백을 받은 뒤 병합 여부를 결정한다.

## 2. 이번 작업에서 한 것 (커밋 순)
| 커밋 | 내용 |
|---|---|
| 9b06368 | 스케줄 함수 3종 구현(daily-brief·monthly-collect·ctas-sync), 감사 대응(수행 기록·증빙·상태 변경, 지적사항, 심사 대응 패키지), Linear 연결 전부 제거, 활동 데이터 `src/acts-data.js` 분리, `CURRENT_USER` 미import ReferenceError 수정 |
| 82344c7 | package-lock.json 추가 |
| 09b04a5 | Tailwind CDN 스크립트·Pretendard CDN 제거 → 빌드 포함 |
| dd4818a | Supabase 연결: `src/repo.js` 데이터 계층, Google SSO, 역할별 RLS(전 테이블), 감사로그 DB, 서버 기한 계산, seed 생성 스크립트, 패널 key 버그 수정 |

## 3. 구조 요점
- **두 실행 모드** — `src/repo.js`가 `VITE_SUPABASE_URL` 유무로 결정
  - 데모: 브라우저 저장소(`localStorage`의 `sp.*` 키), 사이드바에서 샘플 사용자(이정민 security / 김개발 employee) 전환, 기준일 `TODAY = 2026-09-04`(샘플)
  - 운영: Supabase, 실제 오늘 날짜
- **화면은 `repo.js`만 호출한다.** 새 기능도 repo에 데모·DB 두 경로를 함께 만든다.
- `ACTS`(활동 목록)는 부팅 시 메모리에 올린 가변 배열. DB 모드에선 `loadActivities()`가 내용을 교체한다.
- 감사로그: `common.jsx`의 `audit()` → DB 모드에선 `setAuditSink`로 `audit_log` insert. 작성자·시각은 트리거 `audit_stamp`가 덮어씀.
- 스키마: `supabase/schema.sql`(v0.6) → `supabase/seed.sql`(자동 생성, `node scripts/gen-seed.mjs`). Supabase SQL Editor처럼 **단일 트랜잭션으로 적용돼야** 한다 — enum 값 추가는 `create type`에 직접 넣었다.
- RLS: `do $$` 루프로 public 전 테이블 활성화 → `is_security()`/`has_role()` 정책. 새 테이블을 만들면 정책을 반드시 같이 추가(없으면 아무도 접근 불가).

## 4. 검증 방법
```
npm test                                   # 스케줄 함수 순수 로직 7개
bash scripts/e2e/setup.sh                  # 로컬 PG16 + PostgREST + 게이트웨이(:54321) + DB 모드 미리보기(:4174)
PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node scripts/e2e/db-mode.mjs
bash scripts/e2e/setup.sh reset            # DB 초기화 (db-mode.mjs는 매번 초기화 후 실행)
npx vite build && npx vite preview --port 4173 &
PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright node scripts/e2e/demo-mode.mjs
```
- 2026-10-22 기준 두 E2E 모두 통과, 브라우저 오류 0건.
- 로그인은 실제 OAuth가 아니라 테스트가 `localStorage`에 Supabase 세션(JWT)을 넣어 흉내 낸다.
- 클라우드 세션 주의: netlify.app 접속은 프록시가 막는다(403) — 미리보기는 사용자가 직접 확인해야 한다. `pkill -f`는 자기 셸까지 죽이니 쓰지 말 것(`pgrep -x` 또는 PID 지정).

## 5. 다음 할 일 (우선순위순)
1. **미리보기 테스트 피드백 반영** → PR #1 병합 결정 (병합 = 운영 반영 + 스케줄 함수 가동)
2. **Supabase 운영 전환** — README '운영 전환 순서' 1~5단계. 실제 Google OAuth 로그인은 미검증이니 첫 로그인에서 확인
3. **개인정보 화면 DB 이전** — 아직 브라우저 저장소에 남음:
   - `src/Pia.jsx`(흐름도·위험평가, 키 `sp.pia`), `src/PolicyPanel.jsx`(처리방침 3종, `sp.policies`), `src/EmpPia.jsx`(임직원 현황 입력)
   - 스키마에 `pi_inventory`·`pi_transfers`가 있으나 Pia 상태 구조와 다르다 → 테이블 설계부터
4. 교육·서약(`MY_TRAININGS` 샘플 → `trainings`·`training_results`), C-TAS 대시보드(`CTAS` 샘플 → `threat_intel`) 실데이터 연결
5. 스케줄 함수 실연동 검증 — Slack·Google 서비스계정·GitHub 토큰은 실제로 호출해 본 적 없음. C-TAS 피드 명세 수령 후 `netlify/lib/ops.js`의 `FIELD` 매핑 조정
6. 정리 거리: JS 번들 500kB 경고(코드 분할), CSS 533kB(Pretendard dynamic subset), 데모 모드 `Calendar` 초기 월 `[2026, 9]` 고정

## 6. 결정 사항 (다시 논의하지 않음)
- Linear 연동은 쓰지 않는다 (사용자 결정). 코드·스키마·문구에서 모두 제거됨.
- 지적사항 조치 담당자는 본인 건을 종결 검증할 수 없다 (G08 직무 분리 — 화면·DB 제약 둘 다).
- TLP:AMBER 이상 IOC 값은 Slack으로 보내지 않는다.
- 활동 정의의 원본은 `src/acts-data.js`. DB는 seed로 동기화한다.

## 7. 작업 환경 메모
- GitHub 푸시: Claude GitHub App이 개인 계정 `minarc-kr`에 설치돼 있어야 한다(이번 세션 중 설치 완료).
- `gh pr create`는 GraphQL 차단으로 실패 → `gh api repos/minarc-kr/CCK_Security-Portal/pulls ...` REST로 만든다.
- 커밋 작성자: `effie <effie2id@gmail.com>`.
- 사용자 호칭은 '에피'.
