# CCK 보안포털 (프로토타입 v0.4)

정보보호부문의 인증 요구 보안활동(10개 영역·63개 활동)을 관리하고, 임직원 요청·신고를 활동 증빙으로 연결하는 사내 포털.

## 구조
- `src/App.jsx` — 전체 화면 (샘플 데이터 내장). 좌측 하단에서 임직원/정보보호부문 전환
- `supabase/schema.sql` — DB 스키마 v0.4 (활동·매핑·회차·증빙·요청·C-TAS)
- `netlify/functions/` — 스케줄 함수 스텁 (일일 갱신, 월간 수집, C-TAS 동기화)

## 실행
```
npm install
npm run dev
```

## 배포
GitHub 푸시 → Netlify 연결 (netlify.toml 사용). 환경변수는 Netlify 대시보드에 등록.

## 실운영 전환 순서
1. Supabase 프로젝트 생성 → `supabase/schema.sql` 적용 → `.env` 설정
2. Google 계정 SSO (Supabase Auth) 연결, 역할 3단계 지정
3. '보안활동' Google Calendar, Drive `보안포털/` 루트 폴더, Linear 보안 프로젝트 생성
4. `src/App.jsx`의 샘플 상수(ACTS, INIT_REQUESTS 등)를 `src/supabase.js` 조회로 교체
5. 스케줄 함수 구현 → Claude(MCP: Linear·Drive·Slack·Calendar·Supabase) 연결
6. 검증 후 사내 Supabase(Docker)로 이전 — 증빙 원본은 Drive에 있으므로 DB 덤프만 이전
