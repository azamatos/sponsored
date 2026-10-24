import { readFileSync } from "node:fs";
import { finishRun, sql, startRun } from "./db.ts";
import { fetchJson, fetchText } from "./http.ts";
import { decode, errorText, norm } from "./text.ts";

// The official sponsor registers. A register entry is a legal entity ("Adyen N.V."); a board is a brand ("Adyen"),
// so matching compares the name without its legal suffixes, and a manual override table comes later.

const LEGAL =
  /\b(b v|bv|n v|nv|gmbh|ag|se|ltd|limited|plc|inc|llc|llp|lp|co|corp|corporation|company|holding|holdings|group|international|technologies|technology|tech|services|software|labs|nederland|netherlands|uk|europe|emea|the)\b/g;
export const core = (s: string) => norm(s).replace(LEGAL, " ").replace(/\s+/g, " ").trim();

type Entry = { name: string; extra: Record<string, string> };

async function ind(): Promise<Entry[]> {
  const html = await fetchText("https://ind.nl/en/public-register-recognised-sponsors/public-register-work", {
    timeout: 120_000,
  });
  return [...html.matchAll(/<th scope="row">([^<]+)<\/th>\s*<td>([^<]*)<\/td>/g)].map(
    ([, name = "", kvk = ""]) => ({
      name: decode(name).replace(/""/g, '"').trim(),
      extra: { kvk: kvk.trim() },
    }),
  );
}

async function ukWorker(): Promise<Entry[]> {
  // The CSV's file name changes with every update; the publication's API lists the current one.
  const meta = await fetchJson<{ details?: { attachments?: { url?: string }[] } }>(
    "https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers",
  );
  const url = meta.details?.attachments?.find((a) => /\.csv$/i.test(a.url ?? ""))?.url;
  if (!url) throw new Error("UK register: CSV link not found");
  const rows = parseCsv(await fetchText(url, { timeout: 300_000 }));
  const header = rows.shift()?.map((h) => h.trim().toLowerCase()) ?? [];
  const col = (name: string) => header.findIndex((h) => h.startsWith(name));
  const [iName, iTown, iRating, iRoute] = [col("organisation"), col("town"), col("type"), col("route")];
  const out = new Map<string, Entry>();
  for (const r of rows) {
    if (!/skilled worker/i.test(r[iRoute] ?? "")) continue;
    const name = r[iName]?.trim();
    if (name)
      out.set(name, { name, extra: { town: r[iTown]?.trim() ?? "", rating: r[iRating]?.trim() ?? "" } });
  }
  return [...out.values()];
}

// RFC 4180: quoted fields may hold commas, quotes ("") and line breaks.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text.charAt(i + 1) === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f !== ""));
}

const SOURCES = { nl_ind: ind, uk_worker: ukWorker };

export async function loadRegisters() {
  const runId = await startRun("registers");
  const stats: Record<string, number | string> = {};
  for (const [register, load] of Object.entries(SOURCES)) {
    try {
      const entries = await load();
      // A register that suddenly shrinks is a parsing problem, not thousands of lost licences.
      const [row] = await sql<
        { count: number }[]
      >`select count(*)::int as count from register_entry where register = ${register}`;
      const before = row?.count ?? 0;
      if (entries.length < 1000 || entries.length < before * 0.8)
        throw new Error(`only ${entries.length} entries (had ${before}); keeping the old copy`);
      const fetchedAt = new Date();
      await sql.begin(async (tx) => {
        await tx`delete from register_entry where register = ${register}`;
        for (let i = 0; i < entries.length; i += 2000)
          await tx`insert into register_entry ${tx(
            entries.slice(i, i + 2000).map((e) => ({
              register,
              name: e.name,
              core: core(e.name),
              extra: e.extra,
              fetched_at: fetchedAt,
            })),
          )} on conflict do nothing`;
      });
      stats[register] = entries.length;
      console.log(`${register}: ${entries.length} entries`);
    } catch (e) {
      stats[register] = `failed: ${errorText(e)}`;
      console.error(`${register}: ${stats[register]}`);
    }
  }
  await finishRun(runId, stats);
  await matchCompanies();
}

// Automatic matches: the board's company name (or slug) without legal suffixes equals the entry's, or the entry
// starts with it as whole words ("Mollie" → "Mollie B.V.", not "Mollier Engineering"). Names shorter than 3
// characters never match.
export async function matchCompanies() {
  await sql`delete from company_register where method = 'auto'`;
  const companies = await sql<{ id: number; name: string | null; slug: string }[]>`
    select id, name, slug from company where status = 'active'`;
  let matched = 0;
  for (const c of companies) {
    const key = core(c.name ?? c.slug.replace(/[-_]/g, " "));
    if (key.length < 3) continue;
    const rows = await sql`
      insert into company_register (company_id, register, entry_name, method)
      select ${c.id}, register, name, 'auto' from register_entry
      where core = ${key} or core like ${key + " %"}
      on conflict do nothing`;
    if (rows.count) matched++;
  }
  console.log(`register matches: ${matched} of ${companies.length} active companies`);
}

type Review = {
  company_id: number;
  register: string;
  verdict: "listed" | "not_listed" | "unsure";
  entry_name: string | null;
  evidence: string;
  reviewed_by?: string;
};

// Loads reviewed register statuses (JSON lines, one per company and register) into register_review. Every "listed"
// must name an entry that is on the register now, character for character; a file with any bad line loads nothing.
export async function loadReviews(file: string, by = "agent") {
  const reviews = readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Review);
  const problems: string[] = [];
  for (const r of reviews) {
    const at = `company ${String(r.company_id)}`;
    if (!["nl_ind", "uk_worker"].includes(r.register)) problems.push(`${at}: unknown register ${r.register}`);
    if (!["listed", "not_listed", "unsure"].includes(r.verdict))
      problems.push(`${at}: unknown verdict ${r.verdict}`);
    if (!r.evidence.trim()) problems.push(`${at}: no evidence`);
    if ((r.verdict === "listed") !== Boolean(r.entry_name))
      problems.push(`${at}: entry_name goes with listed only`);
    if (r.verdict === "listed" && r.entry_name) {
      const [hit] =
        await sql`select 1 from register_entry where register = ${r.register} and name = ${r.entry_name}`;
      if (!hit) problems.push(`${at}: "${r.entry_name}" is not on ${r.register}`);
    }
  }
  if (problems.length) throw new Error(`reviews not loaded:\n${problems.join("\n")}`);
  await sql.begin(async (tx) => {
    for (const r of reviews)
      await tx`
        insert into register_review ${tx({
          company_id: r.company_id,
          register: r.register,
          verdict: r.verdict,
          entry_name: r.verdict === "listed" ? r.entry_name : null,
          evidence: r.evidence.trim(),
          reviewed_by: r.reviewed_by ?? by,
        })}
        on conflict (company_id, register) do update set verdict = excluded.verdict, entry_name = excluded.entry_name,
          evidence = excluded.evidence, reviewed_by = excluded.reviewed_by, reviewed_at = now()`;
  });
  const count = (v: string) => reviews.filter((r) => r.verdict === v).length;
  console.log(
    `reviews: ${String(reviews.length)} loaded (${String(count("listed"))} listed, ${String(count("not_listed"))} not listed, ${String(count("unsure"))} unsure)`,
  );
}
