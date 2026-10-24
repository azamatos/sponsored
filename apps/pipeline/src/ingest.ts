import { ADAPTERS, type Board, type RawPosting } from "./adapters/index.ts";
import { finishRun, sql, startRun } from "./db.ts";
import { HttpError, pool } from "./http.ts";
import { inScope, where } from "./location.ts";
import { familyOf, seniorityOf } from "./roles.ts";
import { payOf, signals } from "./signals.ts";
import { hash } from "./text.ts";

type Company = Board & {
  id: number;
  name: string | null;
  total_jobs: number | null;
  origin: string;
  errors_in_row: number;
};

// Which boards a run reads: active ones every time. Quiet ones (no roles in scope) once a week and gone ones once a
// month, each in its own slot of the 6-hour runs, so their re-reads are spread over the week instead of falling on
// one run together. A board whose slot was missed (the server was down) is read two days later.
function due(now: number) {
  const slot = Math.floor(now / 21_600_000);
  return sql`
    status = 'active'
    or status = 'new'
    or (status = 'idle' and (checked_at is null or checked_at < now() - interval '9 days'
      or (id % 28 = ${slot % 28} and checked_at < now() - interval '1 day')))
    or (status = 'gone' and (checked_at is null or checked_at < now() - interval '32 days'
      or (id % 120 = ${slot % 120} and checked_at < now() - interval '1 day')))`;
}

// Workday's published maintenance starts on Friday at 23:00 US Pacific time and lasts up to 4 hours a week, 8 once a
// month and 12 once a quarter. Its boards answer with a web page meanwhile, so runs in that span skip them; their
// roles stay open.
export function workdayMaintenance(at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(at);
  const day = parts.find((p) => p.type === "weekday")?.value;
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return (day === "Fri" && hour >= 23) || (day === "Sat" && hour < 11);
}

export async function ingest({ all = false, only = [] as string[], concurrency = 32 } = {}) {
  const listed = await sql<Company[]>`
    select id, ats, slug, eu, name, total_jobs, origin, errors_in_row from company
    where ${only.length ? sql`(ats || ':' || slug) in ${sql(only)}` : all ? sql`true` : due(Date.now())}
    order by id`;
  const skip = workdayMaintenance(new Date());
  const companies = skip ? listed.filter((c) => c.ats !== "workday") : listed;
  // Runs of a few named boards (by hand) don't count as the scheduled ones in the morning summary.
  const runId = await startRun(only.length ? "ingest-boards" : "ingest");
  const stats = {
    boards: companies.length,
    ok: 0,
    failed: 0,
    gone: 0,
    kept: 0,
    new: 0,
    changed: 0,
    closed: 0,
    details: 0,
    skipped: listed.length - companies.length,
    groups: 0,
  };
  console.log(
    `run ${runId}: reading ${companies.length} boards${stats.skipped ? ` (${stats.skipped} Workday boards skipped: maintenance)` : ""}`,
  );
  let done = 0;
  const results: { ats: string; failed: boolean; again: boolean }[] = [];
  await pool(companies, concurrency, async (c) => {
    const t0 = Date.now();
    try {
      const r = await readBoard(c);
      Object.entries(r.counts).forEach(([k, v]) => (stats[k as keyof typeof stats] += v));
      stats.ok++;
      results.push({ ats: c.ats, failed: false, again: false });
      await sql`insert into source_result ${sql({ run_id: runId, company_id: c.id, ok: true, ms: Date.now() - t0, total: r.total, kept: r.kept, error: r.warning })}`;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const gone = e instanceof HttpError && (e.status === 404 || e.status === 410);
      if (gone) stats.gone++;
      else stats.failed++;
      results.push({ ats: c.ats, failed: !gone, again: !gone && c.errors_in_row > 0 });
      await sql`
        update company set checked_at = now(), error = ${err}, errors_in_row = errors_in_row + 1,
          status = ${gone ? "gone" : sql`status`}
        where id = ${c.id}`;
      await sql`insert into source_result ${sql({ run_id: runId, company_id: c.id, ok: false, ms: Date.now() - t0, error: err })}`;
    }
    if (++done % 250 === 0) console.log(`  ${done}/${companies.length} boards, ${stats.kept} roles kept`);
  });
  // A whole board type failing means its API changed or blocks us, or it's down for a while. Failed boards keep
  // their roles, so one run is no harm: the run fails (and the timer's alert fires) only when the same boards failed
  // in their previous read too.
  const failing = failingGroups(results);
  const repeated = failingGroups(results, true);
  stats.groups = failing.length;
  await finishRun(runId, stats);
  console.log(`run ${runId} done: ${JSON.stringify(stats)}`);
  if (repeated.length)
    throw new Error(`board types failing as a group two reads in a row: ${repeated.join(", ")}`);
  if (failing.length)
    console.log(`board types failing as a group: ${failing.join(", ")}; alert if the next run fails too`);
  return stats;
}

// Board types where at least half of 10 or more boards failed (404s count as answers, not failures). With again,
// only boards whose previous read failed too count.
export function failingGroups(results: { ats: string; failed: boolean; again?: boolean }[], again = false) {
  const by = new Map<string, { tried: number; failed: number }>();
  for (const r of results) {
    const g = by.get(r.ats) ?? { tried: 0, failed: 0 };
    g.tried++;
    if (r.failed && (!again || r.again)) g.failed++;
    by.set(r.ats, g);
  }
  return [...by]
    .filter(([, g]) => g.tried >= 10 && g.failed / g.tried >= 0.5)
    .map(([ats, g]) => `${ats} ${g.failed}/${g.tried}`);
}

// Some boards (Workable) list a job once per location under one id. Read separately, the entries overwrote each
// other's content hash, so the same roles came out "changed" on every run. One posting per id, all its locations,
// sorted so the hash doesn't depend on the list's order.
export function mergeById(postings: RawPosting[]): RawPosting[] {
  const by = new Map<string, RawPosting[]>();
  for (const p of postings) by.set(p.externalId, [...(by.get(p.externalId) ?? []), p]);
  return [...by.values()].map(([first, ...rest]) => {
    if (!first || !rest.length) return first as RawPosting;
    const all = [first, ...rest];
    return {
      ...first,
      location: [...new Set(all.flatMap((p) => p.location.split("; ")).filter(Boolean))].sort().join("; "),
      codes: all.flatMap((p) => p.codes ?? []),
      remote: all.some((p) => p.remote),
      hybrid: all.some((p) => p.hybrid),
    };
  });
}

async function readBoard(c: Company) {
  const runStart = new Date();
  const board = await ADAPTERS[c.ats](c);
  const name = board.name;
  const postings = mergeById(board.postings);
  const counts = { kept: 0, new: 0, changed: 0, closed: 0, details: 0 };
  const total = postings.length;

  // A board that suddenly lists nothing is more likely broken than empty: keep its roles open and say so.
  if (total === 0 && (c.total_jobs ?? 0) >= 5) {
    await sql`update company set checked_at = now(), error = ${`empty board (had ${c.total_jobs})`} where id = ${c.id}`;
    return { total, kept: 0, counts, warning: `empty board (had ${c.total_jobs})` };
  }

  const existing = new Map(
    (
      await sql<{ external_id: string; content_hash: string; has_text: boolean }[]>`
        select external_id, content_hash, description is not null as has_text from posting where company_id = ${c.id}`
    ).map((r) => [r.external_id, r]),
  );

  for (const p of postings) {
    const family = familyOf(p.title);
    if (!family) continue;
    let place = where(p.location, { remote: p.remote, hybrid: p.hybrid, codes: p.codes });
    if (!inScope(place)) continue;
    const old = existing.get(p.externalId);
    // Boards without texts in the list: fetch a job's text only when it's new or still missing.
    if (p.description == null && p.detail && (!old || !old.has_text)) {
      try {
        const d = await p.detail();
        counts.details++;
        p.description = d.description;
        if (d.location) {
          const refined = where(`${p.location}; ${d.location}`, {
            remote: p.remote || d.remote,
            hybrid: p.hybrid,
            codes: p.codes,
          });
          if (refined.keep) place = refined;
        }
      } catch {
        // keep the posting without its text; the next run tries again
      }
    }
    if (!place.keep) continue;
    counts.kept++;
    await upsert(c.id, p, family, place, old, counts);
  }

  const closed = await sql`
    update posting set closed_at = now()
    where company_id = ${c.id} and closed_at is null and last_seen_at < ${runStart}`;
  counts.closed = closed.count;

  await sql`
    update company set
      name = coalesce(name, ${name}), checked_at = now(), ok_at = now(), error = null, errors_in_row = 0,
      total_jobs = ${total}, kept_jobs = ${counts.kept}, status = ${counts.kept ? "active" : "idle"}
    where id = ${c.id}`;
  return { total, kept: counts.kept, counts, warning: null };
}

async function upsert(
  companyId: number,
  p: RawPosting,
  family: string,
  place: Extract<ReturnType<typeof where>, { keep: true }>,
  old: { content_hash: string; has_text: boolean } | undefined,
  counts: { new: number; changed: number },
) {
  const contentHash = hash(p.title, p.location, p.description, p.salary);
  const base = {
    url: p.url,
    title: p.title,
    family,
    seniority: seniorityOf(p.title),
    location_raw: p.location,
    countries: place.countries,
    work_mode: place.mode,
    remote_scope: place.scope,
    posted_at: p.postedAt ?? null,
  };
  if (!old) {
    counts.new++;
    await sql`insert into posting ${sql({ ...base, ...facts(p), company_id: companyId, external_id: p.externalId, content_hash: contentHash })}
      on conflict (company_id, external_id) do nothing`;
    return;
  }
  // Boards without texts in the list have no description here: keep the stored one and its facts.
  const changed = old.content_hash !== contentHash && p.description != null;
  if (changed) counts.changed++;
  await sql`
    update posting set ${sql(changed ? { ...base, ...facts(p), content_hash: contentHash } : base)},
      last_seen_at = now(), closed_at = null ${changed ? sql`, changed_at = now()` : sql``}
    where company_id = ${companyId} and external_id = ${p.externalId}`;
}

function facts(p: RawPosting) {
  const text = p.description ?? "";
  const pay = payOf(p.salary) ?? payOf(text);
  return {
    description: p.description,
    salary_raw: p.salary ?? null,
    pay: pay ? sql.json(pay) : null,
    signals: p.description ? sql.json(signals(text)) : null,
  };
}
