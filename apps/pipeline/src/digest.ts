import { sql } from "./db.ts";

// The morning summary of the last 24 hours, sent to the owner by deploy/digest.sh. Lines that start with "!" are
// problems; the script puts them first and changes the header.

type Run = { kind: string; started_at: Date; finished_at: Date | null; stats: Record<string, number> | null };
type Open = { roles: number; companies: number };

const n = (x: number) => x.toLocaleString("en-US");

export function summarise(runs: Run[], open: Open, now = Date.now()): string[] {
  const ingest = runs.filter((r) => r.kind === "ingest");
  const done = ingest.filter((r) => r.finished_at);
  const sum = (k: string) => done.reduce((s, r) => s + (r.stats?.[k] ?? 0), 0);
  const lines: string[] = [];

  // The timer starts 4 runs a day; one still running is fine, one running for over 4 hours is stuck.
  const stuck = ingest.filter((r) => !r.finished_at && now - r.started_at.getTime() > 4 * 3600_000);
  if (stuck.length) lines.push(`! ingest: ${String(stuck.length)} run(s) never finished`);
  if (done.length < 3) lines.push(`! ingest: only ${String(done.length)} of 4 runs finished`);
  const reads = sum("boards");
  const failed = sum("failed");
  if (reads && failed / reads > 0.05) lines.push(`! ingest: ${n(failed)} of ${n(reads)} board reads failed`);

  const registers = runs.filter((r) => r.kind === "registers" && r.finished_at).at(-1);
  if (!registers) lines.push("! registers: not loaded in the last 24 h");

  const skipped = sum("skipped");
  lines.push(
    `Ingest: ${String(done.length)} runs, ${n(reads)} board reads, ${n(failed)} failed${skipped ? `, ${n(skipped)} skipped (Workday maintenance)` : ""}`,
  );
  // A board type down for one run only; two in a row fail the run, which alerts and shows below.
  const groups = done.filter((r) => (r.stats?.groups ?? 0) > 0).length;
  if (groups) lines.push(`Ingest: a whole board type failed in ${String(groups)} run(s), not twice in a row`);
  lines.push(
    `Roles: ${n(open.roles)} open at ${n(open.companies)} companies (+${n(sum("new"))} new, ${n(sum("closed"))} closed, ${n(sum("changed"))} changed)`,
  );
  if (registers?.stats)
    lines.push(`Registers: IND ${n(registers.stats.nl_ind ?? 0)}, UK ${n(registers.stats.uk_worker ?? 0)}`);
  const extract = runs.filter((r) => r.kind === "extract" && r.finished_at);
  if (extract.length) {
    const ex = (k: string) => extract.reduce((s, r) => s + (r.stats?.[k] ?? 0), 0);
    if (ex("error")) lines.push("! extraction: stopped early (usage limit or an error; see the alert)");
    lines.push(`Extraction: ${n(ex("postings"))} postings read, ${n(ex("failed"))} calls failed`);
  }
  return lines;
}

export async function digest() {
  const runs = await sql<Run[]>`
    select kind, started_at, finished_at, stats from run where started_at > now() - interval '24 hours' order by id`;
  const [open] = await sql<Open[]>`
    select count(*)::int as roles, count(distinct company_id)::int as companies from posting where closed_at is null`;
  for (const line of summarise(runs, open ?? { roles: 0, companies: 0 })) console.log(line);
}
