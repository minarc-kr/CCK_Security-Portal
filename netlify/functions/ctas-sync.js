// ctas-sync — 스텁. Supabase 연결 후 구현.
// 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY, SLACK_BOT_TOKEN, (ctas-sync) CTAS_API_KEY
export default async () =>
  new Response(JSON.stringify({ ok: true, fn: "ctas-sync", note: "not implemented" }), { headers: { "content-type": "application/json" } });
