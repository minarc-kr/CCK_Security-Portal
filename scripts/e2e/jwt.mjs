// 테스트용 JWT 서명 — 비밀값은 scripts/e2e/postgrest.conf의 jwt-secret과 같아야 한다 (로컬 전용 값)
import { createHmac } from "node:crypto";
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
export const sign = (p) => { const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64url"); const u = `${b({ alg: "HS256", typ: "JWT" })}.${b(p)}`; return `${u}.${createHmac("sha256", SECRET).update(u).digest("base64url")}`; };
if (process.argv[2] === "anon") console.log(sign({ role: "anon", iss: "supabase", exp: 4102444800 }));
