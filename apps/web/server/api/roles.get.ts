import type { PendingQuery, Row } from "postgres";
import {
  FAMILIES,
  MODES,
  type RelocationState,
  SENIORITY,
  type RoleCard,
  VISA_LEVELS,
  VISA_STATES,
  type VisaLevel,
  type VisaState,
} from "#shared/answers";
import { COUNTRIES } from "#shared/countries";
import { age, companyName, place, salary, WORK_MODE } from "#shared/format";

// Search: open roles with their answers, filtered and sorted, 20 a page, with a count on every filter option. An
// option's count applies every other filter, so it says what choosing it would leave.

const PAGE = 20;
const keys = (xs: readonly { key: string }[]) => xs.map((x) => x.key);

type Filters = {
  q: string;
  visa: (typeof VISA_LEVELS)[number];
  countries: string[];
  relocation: boolean;
  noLanguage: boolean;
  salary: boolean;
  families: string[];
  seniority: string[];
  modes: string[];
  within: number;
};
type Facet =
  | "visa"
  | "countries"
  | "relocation"
  | "noLanguage"
  | "salary"
  | "families"
  | "seniority"
  | "modes"
  | "within";

// Query values arrive as strings, arrays (a repeated key) or nothing; only a single string counts.
const str = (v: unknown) => (typeof v === "string" ? v : "");
const list = (v: unknown, allowed: string[]) =>
  str(v)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => allowed.includes(s));

function parse(query: Record<string, unknown>): Filters {
  const level = VISA_LEVELS.find((l) => l.key === query.visa) ?? VISA_LEVELS[3];
  return {
    q: str(query.q).trim().slice(0, 80),
    visa: level,
    countries: list(str(query.country).toUpperCase(), Object.keys(COUNTRIES)),
    relocation: query.relocation === "1",
    noLanguage: query.nolang === "1",
    salary: query.salary === "1",
    families: list(query.family, keys(FAMILIES)),
    seniority: list(query.seniority, keys(SENIORITY)),
    modes: list(query.mode, keys(MODES)),
    within: [1, 7, 30].includes(Number(query.within)) ? Number(query.within) : 0,
  };
}

export default defineEventHandler(async (event) => {
  const f = parse(getQuery(event));
  const page = Math.max(1, Math.min(50, Number(getQuery(event).page) || 1));
  const sort = getQuery(event).sort === "newest" ? "newest" : "strongest";
  const sql = db();

  // Every filter as a condition; a facet's own condition is left out when counting its options.
  const where = (skip?: Facet) => {
    const c: PendingQuery<Row[]>[] = [sql`p.closed_at is null`];
    if (f.q) {
      const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      const word = `\\m${f.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\M`;
      c.push(sql`(p.title ilike ${like} or c.name ilike ${like} or p.description ~* ${word})`);
    }
    if (skip !== "visa") c.push(sql`a.visa in ${sql(f.visa.states)}`);
    if (skip !== "countries" && f.countries.length) c.push(sql`p.countries && ${f.countries}::text[]`);
    if (skip !== "relocation" && f.relocation) c.push(sql`a.relocation = 'helps'`);
    if (skip !== "noLanguage" && f.noLanguage) c.push(sql`a.languages = '{}'`);
    if (skip !== "salary" && f.salary) c.push(sql`p.pay is not null`);
    if (skip !== "families" && f.families.length) c.push(sql`p.family in ${sql(f.families)}`);
    if (skip !== "seniority" && f.seniority.length) c.push(sql`p.seniority in ${sql(f.seniority)}`);
    if (skip !== "modes" && f.modes.length) c.push(sql`p.work_mode in ${sql(f.modes)}`);
    if (skip !== "within" && f.within)
      c.push(sql`p.first_seen_at > now() - make_interval(days => ${f.within})`);
    return c.reduce((all, one) => sql`${all} and ${one}`);
  };
  const from = sql`posting p join company c on c.id = p.company_id join role_answer a on a.posting_id = p.id`;
  const order =
    sort === "newest"
      ? sql`p.first_seen_at desc, p.id desc`
      : sql`a.visa_rank, p.first_seen_at desc, p.id desc`;

  const group = (column: PendingQuery<Row[]>, skip: Facet) =>
    sql<{ key: string; n: number }[]>`
      select ${column} as key, count(*)::int as n from ${from} where ${where(skip)} group by 1`;
  const [rows, [total], visa, countries, [switches], families, seniority, modes, [within]] =
    await Promise.all([
      sql<
        {
          id: number;
          title: string;
          name: string | null;
          slug: string;
          location_raw: string;
          countries: string[];
          work_mode: string;
          remote_scope: string;
          visa: VisaState;
          relocation: RelocationState;
          languages: string[] | null;
          pay: { min: number; max: number; currency: string; period: string } | null;
          first_seen_at: Date;
        }[]
      >`
      select p.id::int as id, p.title, c.name, c.slug, p.location_raw, p.countries, p.work_mode, p.remote_scope,
        a.visa, a.relocation, a.languages, p.pay, p.first_seen_at
      from ${from} where ${where()} order by ${order} limit ${PAGE} offset ${(page - 1) * PAGE}`,
      sql<{ n: number }[]>`select count(*)::int as n from ${from} where ${where()}`,
      sql<{ visa: VisaState; n: number }[]>`
      select a.visa, count(*)::int as n from ${from} where ${where("visa")} group by 1`,
      sql<{ code: string; n: number }[]>`
      select x.code, count(*)::int as n from ${from}, unnest(p.countries) as x(code)
      where ${where("countries")} and x.code in ${sql(Object.keys(COUNTRIES))} group by 1 order by 2 desc`,
      sql<{ relocation: number; no_language: number; salary: number }[]>`
      select
        (select count(*)::int from ${from} where ${where("relocation")} and a.relocation = 'helps') as relocation,
        (select count(*)::int from ${from} where ${where("noLanguage")} and a.languages = '{}') as no_language,
        (select count(*)::int from ${from} where ${where("salary")} and p.pay is not null) as salary`,
      group(sql`p.family`, "families"),
      group(sql`p.seniority`, "seniority"),
      group(sql`p.work_mode`, "modes"),
      sql<{ d1: number; d7: number; d30: number; any: number }[]>`
      select count(*) filter (where p.first_seen_at > now() - interval '1 day')::int as d1,
        count(*) filter (where p.first_seen_at > now() - interval '7 days')::int as d7,
        count(*) filter (where p.first_seen_at > now() - interval '30 days')::int as d30, count(*)::int as any
      from ${from} where ${where("within")}`,
    ]);
  const keyed = (xs: { key: string; n: number }[]) =>
    Object.fromEntries(xs.map((x) => [x.key, x.n])) as Record<string, number>;

  const byState = Object.fromEntries(
    VISA_STATES.map((s) => [s, visa.find((v) => v.visa === s)?.n ?? 0]),
  ) as Record<VisaState, number>;
  const roles: RoleCard[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    company: companyName(r.name, r.slug),
    companySlug: r.slug,
    place: place(r.location_raw, r.countries, r.work_mode, r.remote_scope),
    workMode: WORK_MODE[r.work_mode] ?? "",
    visa: r.visa,
    relocation: r.relocation,
    languages: r.languages,
    salary: salary(r.pay),
    firstSeen: age(r.first_seen_at),
  }));
  return {
    total: total?.n ?? 0,
    page,
    pages: Math.ceil((total?.n ?? 0) / PAGE),
    roles,
    counts: {
      visa: byState,
      levels: Object.fromEntries(
        VISA_LEVELS.map((l) => [
          l.key,
          (l.states as readonly VisaState[]).reduce((s, st) => s + byState[st], 0),
        ]),
      ) as Record<VisaLevel, number>,
      countries,
      relocation: switches?.relocation ?? 0,
      noLanguage: switches?.no_language ?? 0,
      salary: switches?.salary ?? 0,
      families: keyed(families),
      seniority: keyed(seniority),
      modes: keyed(modes),
      within: { 0: within?.any ?? 0, 1: within?.d1 ?? 0, 7: within?.d7 ?? 0, 30: within?.d30 ?? 0 },
    },
  };
});
