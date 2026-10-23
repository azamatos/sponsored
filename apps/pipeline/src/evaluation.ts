import { readFileSync } from "node:fs";
import { sql } from "./db.ts";
import { MENTIONS_RE, signals } from "./signals.ts";

// The labelled set: postings drawn from discovered boards in four strata, labelled by hand, and the scorer that
// measures the rules (and later the language model) against them. Only labels and short quotes live in the repo
// (eval/labels.jsonl); the texts stay in the database, because the postings aren't ours to republish.

export const STRATA = {
  "rule-offers": 60, // the rules say it offers sponsorship
  "rule-refuses": 40, // the rules say it refuses
  "silent-keywords": 60, // the rules say nothing, but the text mentions visas, relocation, permits…
  "silent-none": 40, // no such words at all: checks that the pre-filter misses nothing
} as const;
type Stratum = keyof typeof STRATA;

export type Fact = "offers" | "maybe" | "refuses" | "silent";
export type Label = {
  key: string; // ats:slug:externalId
  hash: string; // content hash of the posting when it was labelled
  stratum: Stratum;
  visa: Fact;
  visaQuote: string | null;
  relocation: Fact;
  relocationQuote: string | null;
  languages: string[]; // languages other than English the role requires
  note?: string;
};

type Row = {
  ats: string;
  slug: string;
  external_id: string;
  content_hash: string;
  title: string;
  location_raw: string | null;
  url: string;
  description: string;
  stratum: Stratum;
  population: number;
};

// One posting per company per stratum, ordered by a hash of the id, so the same data gives the same sample.
export async function sample(seed = "2026-10-23") {
  const mentions = MENTIONS_RE.source;
  const rows = await sql<Row[]>`
    with p as (
      select p.id, c.ats, c.slug, p.external_id, p.content_hash, p.title, p.location_raw, p.url, p.description,
        case when p.signals->>'visa' = 'offers' then 'rule-offers'
             when p.signals->>'visa' = 'refuses' then 'rule-refuses'
             when p.description ~* ${mentions} then 'silent-keywords'
             else 'silent-none' end as stratum
      from posting p join company c on c.id = p.company_id
      where p.closed_at is null and c.origin = 'commoncrawl' and length(p.description) >= 200),
    q as (
      select *, count(*) over (partition by stratum) as population,
        row_number() over (partition by stratum, ats, slug order by md5(id::text || ${seed})) as per_company
      from p),
    s as (
      select *, row_number() over (partition by stratum order by md5(id::text || ${seed})) as n
      from q where per_company = 1)
    select ats, slug, external_id, content_hash, title, location_raw, url, description, stratum, population::int
    from s where n <= case stratum ${sql.unsafe(
      Object.entries(STRATA)
        .map(([k, v]) => `when '${k}' then ${String(v)}`)
        .join(" "),
    )} end
    order by stratum, n`;
  for (const r of rows)
    console.log(
      JSON.stringify({
        key: `${r.ats}:${r.slug}:${r.external_id}`,
        hash: r.content_hash,
        stratum: r.stratum,
        population: r.population,
        title: r.title,
        location: r.location_raw,
        url: r.url,
        text: r.description,
      }),
    );
}

export const readLabels = (file: string) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Label);

// Precision and recall for one predicted value, weighted by each stratum's share of all open postings.
export function measure(
  items: { label: Fact; predicted: Fact; weight: number }[],
  value: Fact,
): { predicted: number; labelled: number; precision: number | null; recall: number | null } {
  let tp = 0;
  let pred = 0;
  let lab = 0;
  for (const i of items) {
    if (i.predicted === value) pred += i.weight;
    if (i.label === value) lab += i.weight;
    if (i.predicted === value && i.label === value) tp += i.weight;
  }
  return {
    predicted: items.filter((i) => i.predicted === value).length,
    labelled: items.filter((i) => i.label === value).length,
    precision: pred ? tp / pred : null,
    recall: lab ? tp / lab : null,
  };
}

// The rules against the labels. Populations come from strata.json, written when the sample was drawn.
export async function score(labelsFile = "eval/labels.jsonl", strataFile = "eval/strata.json") {
  const labels = readLabels(labelsFile);
  const strata = JSON.parse(readFileSync(strataFile, "utf8")) as Record<Stratum, { population: number }>;
  const sampled = new Map<string, number>();
  for (const l of labels) sampled.set(l.stratum, (sampled.get(l.stratum) ?? 0) + 1);
  const weight = (s: Stratum) => strata[s].population / (sampled.get(s) ?? 1);

  const texts = new Map(
    (
      await sql<{ key: string; description: string }[]>`
        select c.ats || ':' || c.slug || ':' || p.external_id as key, p.description
        from posting p join company c on c.id = p.company_id
        where c.ats || ':' || c.slug || ':' || p.external_id in ${sql(labels.map((l) => l.key))}`
    ).map((r) => [r.key, r.description]),
  );
  const missing = labels.filter((l) => !texts.has(l.key));
  const items = labels
    .filter((l) => texts.has(l.key))
    .map((l) => ({ l, rule: signals(texts.get(l.key) ?? "").visa, weight: weight(l.stratum) }));

  const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
  console.log(`labelled: ${labels.length}, texts found: ${items.length}, missing: ${missing.length}\n`);
  console.log(
    "| Stratum | Labelled | Visa: offers / maybe / refuses / silent | Relocation: offers / maybe / refuses / silent |",
  );
  console.log("| --- | ---: | --- | --- |");
  for (const s of Object.keys(STRATA) as Stratum[]) {
    const in_ = items.filter((i) => i.l.stratum === s);
    const count = (f: "visa" | "relocation") =>
      (["offers", "maybe", "refuses", "silent"] as Fact[])
        .map((v) => in_.filter((i) => i.l[f] === v).length)
        .join(" / ");
    console.log(`| ${s} | ${in_.length} | ${count("visa")} | ${count("relocation")} |`);
  }
  console.log("\n| Rules on visas | Predicted | Labelled | Precision | Recall (weighted) |");
  console.log("| --- | ---: | ---: | ---: | ---: |");
  for (const v of ["offers", "refuses"] as Fact[]) {
    const m = measure(
      items.map((i) => ({ label: i.l.visa, predicted: i.rule, weight: i.weight })),
      v,
    );
    console.log(`| ${v} | ${m.predicted} | ${m.labelled} | ${pct(m.precision)} | ${pct(m.recall)} |`);
  }
  const none = items.filter((i) => i.l.stratum === "silent-none");
  const missed = none.filter((i) => i.l.visa !== "silent" || i.l.relocation !== "silent");
  console.log(
    `\nPre-filter: ${missed.length} of ${none.length} postings without the keywords say something about visas or relocation` +
      (missed.length
        ? ` (~${Math.round((missed.length / none.length) * strata["silent-none"].population)} open roles)`
        : ""),
  );
}
