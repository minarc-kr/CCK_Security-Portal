// 로컬 Supabase 게이트웨이 흉내: :54321/rest/v1 → PostgREST(:3000), CORS 허용. auth 엔드포인트는 404 (세션은 테스트가 localStorage에 직접 넣음)
// Supabase 게이트웨이 흉내: /rest/v1 → PostgREST, CORS 허용, auth는 404
import http from "node:http";
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS", "access-control-expose-headers": "content-range" };
http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  if (!req.url.startsWith("/rest/v1")) { console.log("non-rest", req.method, req.url); res.writeHead(404, cors); return res.end("{}"); }
  const up = http.request({ host: "localhost", port: 3000, path: req.url.slice(8) || "/", method: req.method, headers: { ...req.headers, host: "localhost:3000" } }, (r) => { res.writeHead(r.statusCode, { ...r.headers, ...cors }); r.pipe(res); });
  req.pipe(up);
}).listen(54321, () => console.log("proxy :54321"));
