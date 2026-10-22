# CCK 보안포털 (v0.6)

정보보호부문의 인증 요구 보안활동(10개 영역·88개 활동)을 관리하고, 임직원 요청·신고를 활동 증빙으로 연결하는 사내 포털.

> 다음 작업자는 [`HANDOFF.md`](HANDOFF.md)부터 읽는다 — 현재 상태·검증 방법·남은 일.

## 구조
- `src/App.jsx` — 전체 화면 (로그인 → 역할별 메뉴)
- `src/repo.js` — 데이터 접근 계층. Supabase 설정이 있으면 DB, 없으면 브라우저 저장소(데모 모드)
- `src/acts-data.js` — 활동·기준 매핑·요구 방법·결재라인 정의 (DB 초기 데이터의 원본)
- `scripts/gen-seed.mjs` — `acts-data.js` → `supabase/seed.sql` 생성
- `src/AuditPrep.jsx` — 감사 대응: 활동 수행 기록·증빙 등록·상태 변경, 지적사항·시정조치(U04), 기준별 심사 대응 패키지
- `supabase/schema.sql` — DB 스키마 v0.6 (활동·매핑·회차·증빙·요청·지적사항·감사로그·C-TAS·RLS)
- `supabase/seed.sql` — 영역·활동·기준 매핑·정책 초기 데이터 (자동 생성)
- `netlify/functions/` — 스케줄 함수 (일일 브리프, 월간 수집, C-TAS 동기화) + 캘린더 중계
- `netlify/lib/` — 스케줄 함수 공통 로직(`ops.js`, 단위 테스트 `ops.test.js`)과 외부 연결(`clients.js`)

## 실행
```
npm install
npm run dev
npm test        # 스케줄 함수 로직 테스트
```

## 감사 대응 기능 (v0.5)
| 화면 | 내용 |
|---|---|
| 영역 → 활동 상세 | 수행 기록, 증빙 등록(기간·출처·Drive 링크), 상태 변경(사유 필수). 현재 주기(월·분기·반기·최근 12개월) 증빙 유무 표시 |
| 지적사항 | 심사·내부감사·자체점검 지적을 접수 → 조치중 → 검증대기 → 종결로 추적. 조치 담당자는 직접 종결 검증 불가(G08 직무 분리). 대장 CSV |
| 심사 대응 패키지 | 기준 선택 → 조항·활동·상태·증빙·채택 방법·미종결 지적을 한 표로. 인쇄/PDF, 증빙 색인 CSV |

모든 변경은 로그점검(누가·언제·무엇을·왜)에 남는다.

## 실행 모드
| 모드 | 조건 | 로그인 | 저장 위치 |
|---|---|---|---|
| 데모 | `VITE_SUPABASE_URL` 없음 | 사이드바에서 샘플 사용자 전환 | 브라우저 저장소 (사용자별 공유 안 됨) |
| 운영 | `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` 설정 | 회사 Google 계정 (허용 도메인만 가입) | Supabase — 모든 사용자 공유, RLS 적용 |

운영 모드에서 DB로 저장되는 것: 활동 상태·수행 기록·증빙, 채택 방법, 지적사항, 요청·신고와 처리 이력, 정책 열람 확인, 감사로그.
아직 브라우저 저장소에 남는 것: 개인정보 흐름도·위험평가(Pia), 처리방침 3종 관리, 임직원 개인정보 현황 입력. 교육·서약 목록과 C-TAS 대시보드는 샘플 표시.

### 권한 (RLS)
| 역할 | 할 수 있는 것 |
|---|---|
| employee (가입 시 기본) | 정책 읽기·열람 확인, 본인 요청 접수·조회 |
| security | 위 + 활동·증빙·지적사항·요청 처리·감사로그 조회, 개인정보·영업비밀 대장 |
| admin | 위 + 역할 지정, 허용 도메인 설정 |

- public 스키마 전체 테이블에 RLS가 켜져 있고, 정책이 없는 테이블은 아무도 접근할 수 없다.
- 요청 기한(유출 72시간·정보주체 10일), 감사로그 작성자·시각은 서버가 채운다. 감사로그는 수정·삭제 경로가 없다.
- 지적사항 조치 담당자와 검증자가 같으면 DB가 거부한다 (G08 직무 분리).

## 운영 자동화 (스케줄 함수)
| 함수 | 주기(KST) | 하는 일 |
|---|---|---|
| `daily-brief` | 매일 08:30 | 활동 회차 12개월치 보충 → 기한 경과 회차 `delayed` 전환(change_log 기록) → D-7·D-1·당일 알림(같은 회차·종류는 1회만) → 요청 기한 24시간 이내·지적사항 기한 초과 집계 → Slack 발송 + '보안활동' 캘린더 `[브리프]` 등록 |
| `monthly-collect` | 매월 1일 09:00 | GWS(2단계 인증 미등록·90일 미접속·관리자), GitHub(멤버·관리자·외부 협업자·2FA 미설정·공개 저장소·Dependabot), Slack(관리자·게스트·비활성) 스냅샷 → Storage `evidence/{YYYY-MM}/` 원본 저장, L01·L03·L04·T01 증빙 행 생성, Slack 요약 |
| `ctas-sync` | 매시간 | C-TAS IOC 수집(값 기준 중복 제거), 24시간 미반영·만료 후 장비 잔존 IOC 알림. TLP:AMBER 이상은 값을 Slack에 보내지 않음 |

환경변수가 없는 연결은 건너뛰고 결과 JSON에 `skipped`로 남긴다.

| 환경변수 | 용도 |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | 스케줄 함수 DB 접근 (필수) |
| `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID`, `SLACK_THREAT_CHANNEL_ID` | 알림 (`chat:write`, 월간 수집은 `users:read`) |
| `GOOGLE_SA_JSON`, `GOOGLE_ADMIN_SUBJECT`, `SECURITY_CAL_ID` | 서비스계정 도메인 전체 위임 — `admin.directory.user.readonly`, `calendar.events` |
| `GITHUB_TOKEN`, `GITHUB_ORG` | 조직 읽기 (2FA 필터·Dependabot은 조직 소유자 권한 필요, 없으면 '확인 불가') |
| `CTAS_FEED_URL`, `CTAS_API_KEY`, `CTAS_AUTH_HEADER` | C-TAS 피드. 응답 명세 수령 후 `netlify/lib/ops.js`의 `FIELD` 매핑 조정 |
| `EVIDENCE_BUCKET` | 증빙 원본 Storage 버킷 (기본 `evidence`) |

## 배포
GitHub 푸시 → Netlify 연결 (netlify.toml 사용). 환경변수는 Netlify 대시보드에 등록.

## 운영 전환 순서
1. Supabase 프로젝트 생성 → SQL Editor에서 `supabase/schema.sql` → `supabase/seed.sql` 실행
2. `update portal_settings set value = '회사도메인' where key = 'allowed_domain';`
3. Authentication → Providers → Google 활성화 (Google Cloud OAuth 클라이언트 ID·Secret), Site URL·Redirect URL에 포털 주소 등록
4. Netlify 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`(브라우저용), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`(스케줄 함수용) 등 → 재배포
5. 첫 로그인 후 관리자 지정: `update profiles set role = 'admin' where email = '본인 이메일';` 이후 정보보호부문 인원은 `role = 'security'`
6. '보안활동' Google Calendar, Drive `보안포털/` 루트 폴더, 서비스계정 위임 설정 → 스케줄 함수 가동
7. 검증 후 사내 Supabase(Docker)로 이전 — 증빙 원본은 Drive·Storage에 있으므로 DB 덤프와 버킷만 이전

활동 정의를 바꾸면 `src/acts-data.js` 수정 → `node scripts/gen-seed.mjs` → `seed.sql` 재실행 (상태·증빙은 유지, 매핑은 교체).
