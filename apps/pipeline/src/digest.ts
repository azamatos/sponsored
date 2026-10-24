import { sql } from "./db.ts";
import { PROMPT_VERSION } from "./extract.ts";
import { MENTIONS_RE } from "./signals.ts";

// The morning summary of the last 24 hours, sent to the owner on Telegram (HTML) by deploy/digest.sh. One section
// per part of the system, each with a signal: 🟢 fine, 🟡 worth knowing, 🔴 a problem. Sections with problems come
// first and any problem turns the header from ✅ to ⚠️, so a glance is enough. No message at all means the server
// is down.

type Run = { kind: string; started_at: Date; finished_at: Date | null; stats: Record<string, number> | null };
type Open = { roles: number; companies: number; unread: number };
// What only the server knows, passed in by deploy/digest.sh. Times are Unix seconds.
export type Host = {
  backup?: { bytes: number; at: number } | null; // the newest database dump
  disk?: number | null; // % of the disk used
  failedRuns: number; // units that failed in the last 24 h (each sent an alert)
  failing: { unit: string; since: number }[]; // units whose last run failed
};

type Signal = "ok" | "note" | "problem";
export type Section = {
  title: string;
  signal: Signal;
  issues: { signal: Signal; text: string }[];
  facts: string[];
};

const RANK = { ok: 0, note: 1, problem: 2 } as const;
const DOT = { ok: "🟢", note: "🟡", problem: "🔴" } as const;

const n = (x: number) => x.toLocaleString("en-US");
const count = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;
const esc = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const day = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});
const at = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const time = (ms: number) => `${at.format(ms)} UTC`;
export const unitName = (unit: string) => unit.replace(/^sponsored-/, "").replace(/\.service$/, "");

function section(title: string): Section {
  return { title, signal: "ok", issues: [], facts: [] };
}
function flag(s: Section, signal: Signal, text: string) {
  if (RANK[signal] > RANK[s.signal]) s.signal = signal;
  s.issues.push({ signal, text });
}

export function summarise(runs: Run[], open: Open, host: Host, now = Date.now()): Section[] {
  const sum = (list: Run[], k: string) => list.reduce((s, r) => s + (r.stats?.[k] ?? 0), 0);

  const boards = section("Job boards");
  const ingest = runs.filter((r) => r.kind === "ingest");
  const done = ingest.filter((r) => r.finished_at);
  // The timer starts 4 runs a day; one still running is fine, one running for over 4 hours is stuck.
  const stuck = ingest.filter((r) => !r.finished_at && now - r.started_at.getTime() > 4 * 3600_000);
  if (stuck.length) flag(boards, "problem", `${count(stuck.length, "run")} never finished`);
  if (done.length < 3) flag(boards, "problem", `Only ${n(done.length)} of 4 runs finished`);
  const reads = sum(done, "boards");
  const failed = sum(done, "failed");
  if (reads && failed / reads > 0.05) flag(boards, "problem", `${n(failed)} of ${n(reads)} reads failed`);
  // A board type down for one run only; down two runs in a row fails the run, which alerts.
  const groups = done.filter((r) => (r.stats?.groups ?? 0) > 0).length;
  if (groups)
    flag(boards, "note", `A whole board type was down in ${count(groups, "run")}; it alerts if that repeats`);
  boards.facts.push(`${count(done.length, "run")} · ${n(reads)} reads · ${n(failed)} failed`);
  const skipped = sum(done, "skipped");
  if (skipped) boards.facts.push(`${n(skipped)} Workday reads skipped: Workday's weekly maintenance`);

  const roles = section("Roles");
  if (done.length >= 3 && !sum(done, "new")) flag(roles, "note", "No new roles in 24 hours");
  roles.facts.push(
    `${n(open.roles)} open at ${n(open.companies)} companies`,
    `+${n(sum(done, "new"))} new · ${n(sum(done, "closed"))} closed · ${n(sum(done, "changed"))} changed`,
  );

  const extraction = section("Extraction");
  const extract = runs.filter((r) => r.kind === "extract" && r.finished_at);
  if (!extract.length) flag(extraction, "problem", "Didn't run in the last 24 hours");
  else if (sum(extract, "error"))
    flag(extraction, "problem", "Stopped early: a usage limit or an error (see its alert)");
  else if (sum(extract, "failed"))
    flag(extraction, "note", `${count(sum(extract, "failed"), "call")} failed`);
  if (extract.length) extraction.facts.push(`${n(sum(extract, "postings"))} postings read`);
  extraction.facts.push(open.unread ? `${n(open.unread)} waiting for the next night` : "Nothing waiting");

  const registers = section("Registers");
  const loaded = runs.filter((r) => r.kind === "registers" && r.finished_at).at(-1);
  if (!loaded) flag(registers, "problem", "Not loaded in the last 24 hours");
  else
    registers.facts.push(
      `IND ${n(loaded.stats?.nl_ind ?? 0)} · UK ${n(loaded.stats?.uk_worker ?? 0)} sponsors`,
    );

  const server = section("Server");
  const backup = host.backup && now - host.backup.at * 1000 < 25 * 3600_000 ? host.backup : null;
  if (!backup) flag(server, "problem", "No backup in the last 25 hours");
  if (host.disk != null && host.disk >= 85) flag(server, "problem", `Disk ${String(host.disk)}% full`);
  else if (host.disk != null && host.disk >= 70) flag(server, "note", `Disk ${String(host.disk)}% full`);
  server.facts.push(
    [
      backup ? `Backup ${String(Math.round(backup.bytes / 1e6))} MB, ${time(backup.at * 1000)}` : "",
      host.disk != null ? `disk ${String(host.disk)}% used` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  );

  const alerts = section("Alerts");
  for (const f of host.failing)
    flag(alerts, "problem", `Still failing: ${unitName(f.unit)}, since ${time(f.since * 1000)}`);
  if (host.failedRuns && !host.failing.length)
    flag(alerts, "note", `${count(host.failedRuns, "failed run")} in 24 hours, each alerted; all work again`);
  else if (host.failedRuns)
    alerts.facts.push(`${count(host.failedRuns, "failed run")} in 24 hours, each alerted`);
  else alerts.facts.push("None in 24 hours");

  // Problems first, then notes; otherwise the same order every day.
  return [boards, roles, extraction, registers, server, alerts].sort(
    (a, b) => RANK[b.signal] - RANK[a.signal],
  );
}

export function render(sections: Section[], now = Date.now()): string {
  const issues = sections.flatMap((s) => s.issues);
  const problems = issues.filter((i) => i.signal === "problem").length;
  const notes = issues.filter((i) => i.signal === "note").length;
  const header = problems
    ? `⚠️ <b>Visaproof · ${count(problems, "problem")}</b>`
    : "✅ <b>Visaproof · all good</b>";
  const subtitle = `<i>${day.format(now)} · last 24 hours${notes ? ` · ${count(notes, "note")}` : ""}</i>`;
  const body = sections.map((s) =>
    [
      `${DOT[s.signal]} <b>${esc(s.title)}</b>`,
      ...s.issues.map((i) => `→ ${esc(i.text)}`),
      ...s.facts.filter(Boolean).map(esc),
    ].join("\n"),
  );
  return [`${header}\n${subtitle}`, ...body].join("\n\n");
}

export async function digest(hostJson = "{}") {
  const host: Host = { failedRuns: 0, failing: [], ...(JSON.parse(hostJson) as Partial<Host>) };
  const runs = await sql<Run[]>`
    select kind, started_at, finished_at, stats from run where started_at > now() - interval '24 hours' order by id`;
  // "Waiting" counts what the nightly extraction (Opus) will read: open postings that mention visas or relocation
  // and have no extraction for their current text.
  const [open] = await sql<Open[]>`
    select count(*)::int as roles, count(distinct company_id)::int as companies,
      (count(*) filter (where p.description ~* ${MENTIONS_RE.source} and not exists (
        select 1 from extraction e where e.posting_id = p.id and e.content_hash = p.content_hash
          and e.prompt_version = ${PROMPT_VERSION} and e.requested = 'opus')))::int as unread
    from posting p where closed_at is null`;
  console.log(render(summarise(runs, open ?? { roles: 0, companies: 0, unread: 0 }, host)));
}
