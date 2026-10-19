// supabase/seed.sql 생성 — src/acts-data.js의 영역·활동·기준 매핑·정책을 DB 초기 데이터로 옮긴다
// 실행: node scripts/gen-seed.mjs  (acts-data.js를 고친 뒤 다시 돌린다. 이미 있는 행은 갱신)
import { writeFileSync } from "node:fs";
import { DOMAINS, ACTS, POLICIES } from "../src/acts-data.js";

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a, t) => (a.length ? `array[${a.map(q).join(",")}]::${t}[]` : `'{}'::${t}[]`);
const out = ["-- 자동 생성: node scripts/gen-seed.mjs — 직접 고치지 말고 src/acts-data.js를 고친다", "begin;"];

out.push("insert into domains (code, name, sort) values");
out.push(DOMAINS.map((d, i) => `  (${q(d.code)}, ${q(d.name)}, ${i + 1})`).join(",\n") + "\non conflict (code) do update set name = excluded.name, sort = excluded.sort;");

out.push("insert into activities (code, domain_code, title, cycle, auto_sources, status, next_due) values");
out.push(ACTS.map((x) => `  (${q(x.code)}, ${q(x.d)}, ${q(x.title)}, ${q(x.cycle)}, ${arr(x.auto, "src_t")}, ${q(x.status)}, ${x.next === "—" ? "null" : q(x.next)})`).join(",\n")
  + "\non conflict (code) do update set domain_code = excluded.domain_code, title = excluded.title, cycle = excluded.cycle, auto_sources = excluded.auto_sources;");

out.push("delete from activity_mappings;");
out.push("insert into activity_mappings (activity_code, standard, clause) values");
out.push(ACTS.flatMap((x) => Object.entries(x.map).map(([s, c]) => `  (${q(x.code)}, ${q(s)}, ${q(c)})`)).join(",\n") + ";");

out.push("insert into policies (code, category, title, version, body, published_at, is_current, activity_code)");
out.push("select v.* from (values");
out.push(POLICIES.map((p) => `  (${q(p.code)}, ${q(p.cat)}, ${q(p.title)}, ${q(p.ver)}, ${q(p.body)}, ${q(p.date)}::date, true, 'G01')`).join(",\n"));
out.push(") as v(code, category, title, version, body, published_at, is_current, activity_code)");
out.push("where not exists (select 1 from policies p where p.code = v.code and p.version = v.version);");
out.push("commit;", "");

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), out.join("\n"));
console.log(`seed.sql: 영역 ${DOMAINS.length} · 활동 ${ACTS.length} · 매핑 ${ACTS.reduce((n, x) => n + Object.keys(x.map).length, 0)} · 정책 ${POLICIES.length}`);
