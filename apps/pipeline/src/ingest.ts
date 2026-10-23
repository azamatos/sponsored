import { ADAPTERS, type Board, type RawPosting } from "./adapters/index.ts";
import { finishRun, sql, startRun } from "./db.ts";
import { HttpError, pool } from "./http.ts";
import { inScope, where } from "./location.ts";
import { familyOf, seniorityOf } from "./roles.ts";
import { payOf, signals } from "./signals.ts";
import { hash } from "./text.ts";

type Company = Board & { id: number; name: string | null; total_jobs: number | null; origin: string };

// Which boards a run reads: active ones every time; the rest less often, since they rarely change.
const DUE = sql`
  status = 'active'
  or status = 'new'
  or (status = 'idle' and (checked_at is null or checked_at < now() - interval '7 days'))
  or (status = 'gone' and (checked_at is null or checked_at < now() - interval '30 days'))`;

export async function ingest({ all = false, only = [] as string[], concurrency = 32 } = {}) {
  const companies = await sql<Company[]>`
    select id, ats, slug, eu, name, total_jobs, origin from company
    where ${only.length ? sql`(ats || ':' || slug) in ${sql(only)}` : all ? sql`true` : DUE}
    order by id`;
  const runId = await startRun("ingest");
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
  };
  console.log(`run ${runId}: reading ${companies.length} boards`);
  let done = 0;
  const results: { ats: string; failed: boolean }[] = [];
  await pool(companies, concurrency, async (c) => {
    const t0 = Date.now();
    try {
      const r = await readBoard(c);
      Object.entries(r.counts).forEach(([k, v]) => (stats[k as keyof typeof stats] += v));
      stats.ok++;
      results.push({ ats: c.ats, failed: false });
      await sql`insert into source_result ${sql({ run_id: runId, company_id: c.id, ok: true, ms: Date.now() - t0, total: r.total, kept: r.kept, error: r.warning })}`;
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const gone = e instanceof HttpError && (e.status === 404 || e.status === 410);
      if (gone) stats.gone++;
      else stats.failed++;
      results.push({ ats: c.ats, failed: !gone });
      await sql`
        update company set checked_at = now(), error = ${err}, errors_in_row = errors_in_row + 1,
          status = ${gone ? "gone" : sql`status`}
        where id = ${c.id}`;
      await sql`insert into source_result ${sql({ run_id: runId, company_id: c.id, ok: false, ms: Date.now() - t0, error: err })}`;
    }
    if (++done % 250 === 0) console.log(`  ${done}/${companies.length} boards, ${stats.kept} roles kept`);
  });
  await finishRun(runId, stats);
  console.log(`run ${runId} done: ${JSON.stringify(stats)}`);
  // A whole board type failing means its API changed or blocks us: fail the run, so the timer's alert fires.
  const failing = failingGroups(results);
  if (failing.length) throw new Error(`board types failing as a group: ${failing.join(", ")}`);
  return stats;
}

// Board types where at least half of 10 or more boards failed (404s count as answers, not failures).
export function failingGroups(results: { ats: string; failed: boolean }[]) {
  const by = new Map<string, { tried: number; failed: number }>();
  for (const r of results) {
    const g = by.get(r.ats) ?? { tried: 0, failed: 0 };
    g.tried++;
    if (r.failed) g.failed++;
    by.set(r.ats, g);
  }
  return [...by]
    .filter(([, g]) => g.tried >= 10 && g.failed / g.tried >= 0.5)
    .map(([ats, g]) => `${ats} ${g.failed}/${g.tried}`);
}

async function readBoard(c: Company) {
  const runStart = new Date();
  const { name, postings } = await ADAPTERS[c.ats](c);
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
