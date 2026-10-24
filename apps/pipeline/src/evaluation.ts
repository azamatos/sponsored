import { readFileSync } from "node:fs";
import { sql } from "./db.ts";
import { PROMPT_VERSION } from "./extract.ts";
import { LANGUAGE_PROMPT_VERSION } from "./languages.ts";
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
export function measure<T extends string>(
  items: { label: T; predicted: T; weight: number }[],
  value: T,
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
// The rules (and, with a model alias, that model's extractions for the current prompt) against the labels.
export async function score(model = "", labelsFile = "eval/labels.jsonl", strataFile = "eval/strata.json") {
  const labels = readLabels(labelsFile);
  const strata = JSON.parse(readFileSync(strataFile, "utf8")) as Record<Stratum, { population: number }>;
  const weight = weights(labels, strata);

  type Row = {
    key: string;
    description: string;
    visa: Fact | null;
    visa_quote: string | null;
    relocation: Fact | null;
    relocation_quote: string | null;
    languages: string[] | null;
  };
  const rows = await sql<Row[]>`
    select c.ats || ':' || c.slug || ':' || p.external_id as key, p.description,
      e.visa, e.visa_quote, e.relocation, e.relocation_quote, e.languages
    from posting p join company c on c.id = p.company_id
    left join lateral (
      select * from extraction e where e.posting_id = p.id and e.requested = ${model}
        and e.prompt_version = ${PROMPT_VERSION} order by e.created_at desc limit 1) e on true
    where c.ats || ':' || c.slug || ':' || p.external_id in ${sql(labels.map((l) => l.key))}`;
  const texts = new Map(rows.map((r) => [r.key, r.description]));
  const extracted = new Map(rows.map((r) => [r.key, r]));
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
  if (model) scoreModel(model, items, extracted);
  const none = items.filter((i) => i.l.stratum === "silent-none");
  const missed = none.filter((i) => i.l.visa !== "silent" || i.l.relocation !== "silent");
  console.log(
    `\nPre-filter: ${missed.length} of ${none.length} postings without the keywords say something about visas or relocation` +
      (missed.length
        ? ` (~${Math.round((missed.length / none.length) * strata["silent-none"].population)} open roles)`
        : ""),
  );
}

// Each labelled posting stands for its stratum's share of all open postings.
function weights(labels: Label[], strata: Record<Stratum, { population: number }>) {
  const sampled = new Map<string, number>();
  for (const l of labels) sampled.set(l.stratum, (sampled.get(l.stratum) ?? 0) + 1);
  return (s: Stratum) => strata[s].population / (sampled.get(s) ?? 1);
}

// The language check against the labels: exact matches, and precision and recall on "requires a language other
// than English", weighted like the visa scores.
export async function scoreLanguages(
  model = "sonnet",
  labelsFile = "eval/labels.jsonl",
  strataFile = "eval/strata.json",
) {
  const labels = readLabels(labelsFile);
  const weight = weights(
    labels,
    JSON.parse(readFileSync(strataFile, "utf8")) as Record<Stratum, { population: number }>,
  );
  const rows = await sql<
    { key: string; languages: string[] | null; quote: string | null; written_in: string | null }[]
  >`
    select c.ats || ':' || c.slug || ':' || p.external_id as key, l.languages, l.quote, l.written_in
    from posting p join company c on c.id = p.company_id
    left join lateral (
      select * from language_check l where l.posting_id = p.id and l.requested = ${model}
        and l.prompt_version = ${LANGUAGE_PROMPT_VERSION} order by l.created_at desc limit 1) l on true
    where c.ats || ':' || c.slug || ':' || p.external_id in ${sql(labels.map((l) => l.key))}`;
  const checked = new Map(rows.filter((r) => r.languages).map((r) => [r.key, r]));
  const sorted = (ls: string[]) => [...ls].sort().join(",");
  const items = labels.flatMap((l) => {
    const r = checked.get(l.key);
    return r
      ? [{ l, r, got: sorted(r.languages ?? []), want: sorted(l.languages), weight: weight(l.stratum) }]
      : [];
  });
  const any = (s: string) => (s ? "requires" : "none");
  const m = measure(
    items.map((i) => ({ label: any(i.want), predicted: any(i.got), weight: i.weight })),
    "requires",
  );
  const pct = (x: number | null) => (x === null ? "–" : `${String(Math.round(x * 100))}%`);
  console.log(
    `Languages, "${model}", prompt ${LANGUAGE_PROMPT_VERSION}: ${String(items.length)} of ${String(labels.length)} checked`,
  );
  console.log(`Exact: ${String(items.filter((i) => i.got === i.want).length)} of ${String(items.length)}`);
  console.log(
    `Requires a language: ${String(m.predicted)} predicted, ${String(m.labelled)} labelled, precision ${pct(m.precision)}, recall ${pct(m.recall)} (weighted)`,
  );
  console.log("\nDisagreements (label → check):");
  for (const i of items.filter((x) => x.got !== x.want))
    console.log(
      `- ${i.l.key}: [${i.want}] → [${i.got}] | quote: ${JSON.stringify(i.r.quote)} | written in: ${String(i.r.written_in)}`,
    );
}

// A posting without the keywords isn't sent to the model, so it counts as silent; one with the keywords but no
// extraction yet is reported, not guessed.
function scoreModel(
  model: string,
  items: { l: Label; weight: number }[],
  extracted: Map<
    string,
    {
      description: string;
      visa: Fact | null;
      visa_quote: string | null;
      relocation: Fact | null;
      relocation_quote: string | null;
      languages: string[] | null;
    }
  >,
) {
  const pct = (x: number | null) => (x === null ? "–" : `${String(Math.round(x * 100))}%`);
  const rows = items.map((i) => {
    const e = extracted.get(i.l.key);
    const sent = MENTIONS_RE.test(e?.description ?? "");
    return { ...i, e, sent, done: !sent || e?.visa != null };
  });
  const missing = rows.filter((r) => !r.done);
  const scored = rows.filter((r) => r.done);
  const pred = (r: (typeof rows)[number], f: "visa" | "relocation"): Fact =>
    r.sent ? (r.e?.[f] ?? "silent") : "silent";
  console.log(
    `\nModel "${model}", prompt ${PROMPT_VERSION}: ${String(scored.length)} scored, ${String(missing.length)} not extracted yet\n`,
  );
  console.log("| Model | Predicted | Labelled | Precision | Recall (weighted) |");
  console.log("| --- | ---: | ---: | ---: | ---: |");
  for (const [f, v] of [
    ["visa", "offers"],
    ["visa", "refuses"],
    ["relocation", "offers"],
  ] as const) {
    const m = measure(
      scored.map((r) => ({ label: r.l[f], predicted: pred(r, f), weight: r.weight })),
      v,
    );
    console.log(
      `| ${f} ${v} | ${String(m.predicted)} | ${String(m.labelled)} | ${pct(m.precision)} | ${pct(m.recall)} |`,
    );
  }
  const sentRows = scored.filter((r) => r.sent);
  const sameLanguages = sentRows.filter(
    (r) => [...(r.e?.languages ?? [])].sort().join(",") === [...r.l.languages].sort().join(","),
  ).length;
  console.log(
    `\nLanguages: ${String(sameLanguages)} of ${String(sentRows.length)} postings read by the model match exactly`,
  );
  console.log("\nDisagreements (label → model):");
  for (const r of scored)
    for (const f of ["visa", "relocation"] as const)
      if (r.l[f] !== pred(r, f))
        console.log(
          `- ${r.l.key} ${f}: ${r.l[f]} → ${pred(r, f)} | label: ${JSON.stringify(r.l[`${f}Quote`])} | model: ${JSON.stringify(r.e?.[`${f}_quote`] ?? null)}`,
        );
}
