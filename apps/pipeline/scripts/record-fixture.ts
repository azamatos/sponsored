// Records a real board for the adapter tests: runs the adapter and the first posting's detail() with a recording
// fetch, trims every list to two jobs, and writes test/fixtures/<ats>.json. Pick a board that isn't private.
//   node scripts/record-fixture.ts <ats> <slug> [--eu]
import { writeFileSync } from "node:fs";
import { ADAPTERS, ATS_LIST, type Ats } from "../src/adapters/index.ts";
import { requestKey, type Fixture } from "../test/replay.ts";

const [ats, slug] = process.argv.slice(2);
if (!ats || !slug || !ATS_LIST.includes(ats as Ats))
  throw new Error("usage: record-fixture.ts <ats> <slug> [--eu]");
const board = { ats: ats as Ats, slug, eu: process.argv.includes("--eu") };

const responses: Record<string, string> = {};
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const res = await realFetch(input, init);
  const text = await res.text();
  if (res.ok) responses[requestKey(input, init)] = text;
  return new Response(text, { status: res.status, statusText: res.statusText });
};

const { postings } = await ADAPTERS[board.ats](board);
await postings[0]?.detail?.();
for (const [k, body] of Object.entries(responses)) responses[k] = trim(body);
const fixture: Fixture = { board, responses };
writeFileSync(
  new URL(`../test/fixtures/${board.ats}.json`, import.meta.url),
  JSON.stringify(fixture, null, 1) + "\n",
);
console.log(
  `${board.ats}: ${String(postings.length)} postings read, ${String(Object.keys(responses).length)} responses saved`,
);

// Two jobs per list, and totals cut to match, so paging stops where the recording does.
function trim(body: string): string {
  if (body.trimStart().startsWith("<")) {
    const positions = [...body.matchAll(/<position>[\s\S]*?<\/position>/g)].map((m) => m[0]);
    if (!positions.length) return body;
    const start = body.indexOf("<position>");
    const end = body.lastIndexOf("</position>") + "</position>".length;
    return body.slice(0, start) + positions.slice(0, 2).join("\n") + body.slice(end);
  }
  const j = JSON.parse(body) as unknown;
  if (Array.isArray(j)) return JSON.stringify(j.slice(0, 2));
  if (j && typeof j === "object") {
    const o = j as Record<string, unknown>;
    for (const k of ["jobs", "offers", "content", "jobPostings"]) {
      const list = o[k];
      if (Array.isArray(list)) o[k] = list.slice(0, 2);
    }
    for (const k of ["totalFound", "total"]) if (typeof o[k] === "number") o[k] = Math.min(o[k], 2);
  }
  return JSON.stringify(j);
}
