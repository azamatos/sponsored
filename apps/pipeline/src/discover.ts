import { readFileSync } from "node:fs";
import type { Ats } from "./adapters/index.ts";
import { sql } from "./db.ts";
import { DuckDBInstance } from "@duckdb/node-api";
import { fetchJson } from "./http.ts";
import { errorText } from "./text.ts";

// Finds companies' job boards. Two ways in:
// 1. seed: a JSON list of { ats, slug, eu?, company? }.
// 2. Common Crawl: every job-board URL the crawler saw on the boards' hosts gives a company's slug. New boards
//    start as status "new"; the next ingest reads each once and keeps those with engineering roles in Europe.

type Found = { ats: Ats; slug: string; eu: boolean };
type Seed = { ats: Ats; slug: string; eu?: boolean; company?: string };

const SOURCES: { host: string; read: (u: URL) => Found | null }[] = [
  { host: "jobs.ashbyhq.com", read: (u) => first(u, "ashby", false) },
  { host: "job-boards.greenhouse.io", read: (u) => greenhouse(u, false) },
  { host: "boards.greenhouse.io", read: (u) => greenhouse(u, false) },
  { host: "job-boards.eu.greenhouse.io", read: (u) => greenhouse(u, true) },
  { host: "jobs.lever.co", read: (u) => first(u, "lever", false) },
  { host: "jobs.eu.lever.co", read: (u) => first(u, "lever", true) },
  { host: "apply.workable.com", read: (u) => first(u, "workable", false) },
  { host: "jobs.smartrecruiters.com", read: (u) => first(u, "smartrecruiters", false) },
  { host: "*.recruitee.com", read: (u) => sub(u, "recruitee", ".recruitee.com", false) },
  { host: "*.jobs.personio.de", read: (u) => sub(u, "personio", ".jobs.personio.de", false) },
  { host: "*.jobs.personio.com", read: (u) => sub(u, "personio", ".jobs.personio.com", true) },
];

// Path words that aren't company slugs.
const RESERVED = new Set(
  "api embed j oops v1 v2 static assets favicon.ico robots.txt sitemap.xml login signin search jobs careers apply oneclick-ui sr-jobs widget".split(
    " ",
  ),
);
const SLUG = /^[a-z0-9][a-z0-9._-]{1,80}$/i;

function first(u: URL, ats: Ats, eu: boolean): Found | null {
  const seg = decodeURIComponent(u.pathname.split("/")[1] ?? "").trim();
  if (!seg || RESERVED.has(seg.toLowerCase()) || !SLUG.test(seg.replace(/ /g, "-"))) return null;
  return { ats, slug: ats === "smartrecruiters" ? seg : seg.toLowerCase(), eu };
}
function greenhouse(u: URL, eu: boolean): Found | null {
  const forParam = u.searchParams.get("for");
  if (forParam) return SLUG.test(forParam) ? { ats: "greenhouse", slug: forParam.toLowerCase(), eu } : null;
  return first(u, "greenhouse", eu);
}
function sub(u: URL, ats: Ats, suffix: string, eu: boolean): Found | null {
  if (!u.hostname.endsWith(suffix)) return null;
  const slug = u.hostname.slice(0, -suffix.length);
  if (!SLUG.test(slug) || slug.includes(".") || ["www", "api", "app", "careers", "jobs"].includes(slug))
    return null;
  return { ats, slug, eu };
}

// Common Crawl's columnar index (Parquet files on its CDN), read with DuckDB. The files are sorted by SURT key, so a
// key range per host touches only a few row groups: seconds per host. The CDX query server answers the same
// question with 504s whenever it's busy.
export async function discoverCommonCrawl(crawls = 2) {
  const list = await fetchJson<{ id: string }[]>("https://index.commoncrawl.org/collinfo.json");
  const db = await DuckDBInstance.create(":memory:");
  const con = await db.connect();
  // Gently: Common Crawl's CDN answers 403 to bursts. The metadata caches keep the 300 files' footers between
  // queries, so only the first host of a crawl reads them.
  await con.run(`INSTALL httpfs; LOAD httpfs; SET threads = 2;
    SET parquet_metadata_cache = true; SET enable_http_metadata_cache = true;`);
  const found = new Map<string, Found>();
  const failed: string[] = [];
  // Boards are saved after every crawl, so a later failure can't lose what was found.
  for (const { id } of list.slice(0, crawls)) {
    let files: string;
    try {
      const paths = await withRetry(() =>
        con.runAndReadAll(
          `select path from read_csv('https://data.commoncrawl.org/crawl-data/${id}/cc-index-table.paths.gz',
             header = false, columns = {'path': 'VARCHAR'}) where path like '%/subset=warc/%'`,
        ),
      );
      files = paths
        .getRowObjectsJson()
        .map((r) => `'https://data.commoncrawl.org/${str(r.path)}'`)
        .join(", ");
    } catch (e) {
      failed.push(`${id}: ${errorText(e)}`);
      continue;
    }
    for (const source of SOURCES) {
      const [from, to] = surtRange(source.host);
      const before = found.size;
      try {
        const rows = await withRetry(() =>
          con.runAndReadAll(
            `select distinct url_host_name as host, split_part(url_path, '/', 2) as seg
             from read_parquet([${files}]) where url_surtkey >= '${from}' and url_surtkey < '${to}'`,
          ),
        );
        for (const r of rows.getRowObjectsJson()) {
          let f: Found | null = null;
          try {
            f = source.read(new URL(`https://${str(r.host)}/${str(r.seg)}`));
          } catch {
            // a host or path that doesn't make a URL isn't a board
          }
          if (f) found.set(`${f.ats}|${f.slug.toLowerCase()}|${String(f.eu)}`, f);
        }
        console.log(`${id} ${source.host}: +${found.size - before} slugs`);
      } catch (e) {
        failed.push(`${id} ${source.host}: ${errorText(e)}`);
      }
    }
    const added = await addBoards([...found.values()], "commoncrawl");
    console.log(`${id}: ${found.size} slugs so far, ${added} new boards`);
  }
  con.closeSync();
  if (failed.length) throw new Error(`common crawl, failed:\n  ${failed.join("\n  ")}`);
}

// Three tries, 2 and then 4 minutes apart: long enough for the CDN's rate limit to reset.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= 3) throw e;
      console.error(`  retrying in ${2 * attempt} min: ${errorText(e).split("\n")[0] ?? ""}`);
      await new Promise((r) => setTimeout(r, attempt * 120_000));
    }
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

// "jobs.ashbyhq.com" → keys from "com,ashbyhq,jobs)/" up to "com,ashbyhq,jobs)0"; "*.recruitee.com" → every
// subdomain, from "com,recruitee," up to "com,recruitee-".
export function surtRange(host: string): [string, string] {
  if (host.startsWith("*.")) {
    const p = host.slice(2).split(".").reverse().join(",") + ",";
    return [p, p.slice(0, -1) + "-"];
  }
  const p = host.split(".").reverse().join(",") + ")/";
  return [p, p.slice(0, -1) + "0"];
}

export async function seed(file: string) {
  const rows = JSON.parse(readFileSync(file, "utf8")) as Seed[];
  const added = await addBoards(rows, "seed");
  console.log(`seed: ${rows.length} boards, ${added} new`);
}

async function addBoards(rows: Seed[], origin: string) {
  let added = 0;
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await sql`
      insert into company ${sql(
        rows
          .slice(i, i + 1000)
          .map((b) => ({ ats: b.ats, slug: b.slug, eu: b.eu ?? false, name: b.company ?? null, origin })),
      )}
      on conflict (ats, slug, eu) do nothing`;
    added += r.count;
  }
  return added;
}
