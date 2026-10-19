# CCK 보안포털 (프로토타입 v0.5)

정보보호부문의 인증 요구 보안활동(10개 영역·63개 활동)을 관리하고, 임직원 요청·신고를 활동 증빙으로 연결하는 사내 포털.

## 구조
- `src/App.jsx` — 전체 화면. 좌측 하단에서 임직원/정보보호부문 전환
- `src/acts-data.js` — 활동·기준 매핑·요구 방법·결재라인 샘플 데이터
- `src/AuditPrep.jsx` — 감사 대응: 활동 수행 기록·증빙 등록·상태 변경, 지적사항·시정조치(U04), 기준별 심사 대응 패키지
- `supabase/schema.sql` — DB 스키마 v0.5 (활동·매핑·회차·증빙·요청·지적사항·C-TAS·RLS)
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

모든 변경은 로그점검(누가·언제·무엇을·왜)에 남는다. DB 연결 전에는 브라우저 저장소(`sp.acts`, `sp.findings`)에 저장된다.

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

## 실운영 전환 순서
1. Supabase 프로젝트 생성 → `supabase/schema.sql` 적용 → `.env` 설정
2. Google 계정 SSO (Supabase Auth) 연결, 역할 3단계 지정
3. '보안활동' Google Calendar, Drive `보안포털/` 루트 폴더 생성, 서비스계정 위임 설정
4. `src/acts-data.js` 샘플 상수와 브라우저 저장분을 `src/supabase.js` 조회로 교체
5. Netlify 환경변수 등록 → 스케줄 함수 가동 → Claude(MCP: Drive·Slack·Calendar·Supabase) 연결
6. 검증 후 사내 Supabase(Docker)로 이전 — 증빙 원본은 Drive·Storage에 있으므로 DB 덤프와 버킷만 이전
