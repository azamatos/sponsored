import { sql } from "./db.ts";

// What the data looks like: the numbers that decide scope and design. Prints Markdown tables.

// Objects (a run's stats) as JSON, so they don't print as "[object Object]".
const cell = (v: unknown) =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "bigint"
    ? String(v)
    : v == null
      ? ""
      : JSON.stringify(v);

const table = (title: string, rows: Record<string, unknown>[]) => {
  const [first] = rows;
  if (!first) return `### ${title}\n\n(none)\n`;
  const cols = Object.keys(first);
  return [
    `### ${title}`,
    "",
    `| ${cols.join(" | ")} |`,
    `| ${cols.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${cols.map((c) => cell(r[c])).join(" | ")} |`),
    "",
  ].join("\n");
};

export async function report() {
  const out: string[] = [];
  const add = async (title: string, q: Promise<Record<string, unknown>[]>) => out.push(table(title, await q));

  await add(
    "Boards by job board and status",
    sql`select ats, count(*) filter (where status = 'active') as active, count(*) filter (where status = 'idle') as idle,
          count(*) filter (where status = 'gone') as gone, count(*) filter (where status = 'new') as unread,
          count(*) filter (where errors_in_row > 0 and status <> 'gone') as failing, count(*) as total
        from company group by ats order by active desc`,
  );
  await add(
    "Last ingest runs",
    sql`select id, to_char(started_at, 'YYYY-MM-DD HH24:MI') as started,
          round(extract(epoch from finished_at - started_at) / 60) as minutes, stats from run
        where kind = 'ingest' order by id desc limit 5`,
  );
  await add(
    "Open roles by country (in scope)",
    sql`with p as (select unnest(case when cardinality(countries) = 0 then array[remote_scope] else countries end) as c, *
                   from posting where closed_at is null)
        select c as country, count(*) as roles, count(distinct company_id) as companies,
          round(100.0 * count(*) filter (where signals->>'visa' = 'offers') / count(*)) as "visa offered %",
          round(100.0 * count(*) filter (where signals->>'visa' = 'refuses') / count(*)) as "refuses %",
          round(100.0 * count(*) filter (where signals is not null and jsonb_array_length(signals->'languages') > 0 or (signals->>'germanText')::boolean) / count(*)) as "local language %",
          round(100.0 * count(*) filter (where pay is not null) / count(*)) as "salary posted %",
          round(100.0 * count(*) filter (where work_mode = 'remote') / count(*)) as "remote %"
        from p group by c order by roles desc limit 30`,
  );
  await add(
    "Open roles by family",
    sql`select family, count(*) as roles,
          round(100.0 * count(*) filter (where signals->>'visa' = 'offers') / count(*)) as "visa offered %"
        from posting where closed_at is null group by family order by roles desc`,
  );
  await add(
    "Open roles by seniority",
    sql`select seniority, count(*) as roles from posting where closed_at is null group by seniority order by roles desc`,
  );
  await add(
    "Texts and salaries by job board",
    sql`select c.ats, count(*) as roles, round(100.0 * count(*) filter (where p.description is not null) / count(*)) as "text %",
          round(100.0 * count(*) filter (where p.pay is not null) / count(*)) as "salary %",
          round(100.0 * count(*) filter (where p.salary_raw is not null) / count(*)) as "structured salary %"
        from posting p join company c on c.id = p.company_id where p.closed_at is null group by c.ats order by roles desc`,
  );
  await add(
    "Register coverage (roles at a company found in the country's register)",
    sql`select country, register, count(*) as roles,
          count(*) filter (where exists (select 1 from company_register r where r.company_id = p.company_id and r.register = x.register)) as "at a listed company",
          count(distinct p.company_id) as companies,
          count(distinct p.company_id) filter (where exists (select 1 from company_register r where r.company_id = p.company_id and r.register = x.register)) as "listed companies"
        from posting p
        join (values ('NL', 'nl_ind'), ('GB', 'uk_worker')) as x(country, register) on x.country = any(p.countries)
        where p.closed_at is null group by country, register`,
  );
  await add(
    "Germany: posted salaries against the Blue Card threshold (yearly EUR, IT-specialist rate 45,934.20, to verify)",
    sql`select count(*) as "DE roles with a yearly EUR salary",
          count(*) filter (where (pay->>'max')::numeric >= 45934.2) as "max clears it",
          count(*) filter (where (pay->>'min')::numeric >= 45934.2) as "min clears it",
          round(percentile_cont(0.5) within group (order by (pay->>'min')::numeric)) as "median min",
          round(percentile_cont(0.5) within group (order by (pay->>'max')::numeric)) as "median max"
        from posting where closed_at is null and 'DE' = any(countries) and pay->>'currency' = 'EUR' and pay->>'period' = 'year'`,
  );
  await add(
    "Companies with the most open roles",
    sql`select coalesce(c.name, c.slug) as company, c.ats, count(*) as roles,
          count(*) filter (where p.signals->>'visa' = 'offers') as "visa offered"
        from posting p join company c on c.id = p.company_id where p.closed_at is null
        group by c.id order by roles desc limit 25`,
  );
  await add(
    "Failures in the last ingest run",
    sql`select c.ats, s.error, count(*) as boards from source_result s join company c on c.id = s.company_id
        where s.run_id = (select max(id) from run where kind = 'ingest') and not s.ok
        group by c.ats, s.error order by boards desc limit 20`,
  );
  console.log(out.join("\n"));
}
