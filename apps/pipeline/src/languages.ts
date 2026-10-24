import path from "node:path";
import { finishRun, sql, startRun } from "./db.ts";
import { assemble, LANGUAGE_RE, labelledKeys, locate, loggedCall, units } from "./extract.ts";
import { pool } from "./http.ts";

// Which languages other than English each open role requires, with the sentence as evidence. A language model reads
// only the postings with something to read: a line about languages, or a text mostly in another language. The rest
// ask for no other language and are stored without a call.

export const LANGUAGE_PROMPT_VERSION = "languages-v2";
const PROMPT = path.join(import.meta.dirname, "..", "prompts", `${LANGUAGE_PROMPT_VERSION}.md`);
const BATCH = 25;

const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          languages: { type: "array", items: { type: "string" } },
          quote: { type: ["string", "null"] },
          writtenIn: { type: ["string", "null"] },
        },
        required: ["id", "languages", "quote", "writtenIn"],
      },
    },
  },
  required: ["results"],
};

type Answer = { id: string; languages: string[]; quote: string | null; writtenIn: string | null };
type Posting = {
  id: number;
  content_hash: string;
  title: string;
  location_raw: string | null;
  description: string;
};

// The share of a text made of common English words; under 4%, it is written in another language.
export const englishShare = (t: string) =>
  (t.match(/\b(the|and|you|with|our|for|will|are)\b/gi) ?? []).join("").length / Math.max(1, t.length);
export const needsReading = (t: string) => LANGUAGE_RE.test(t) || englishShare(t) < 0.04;

// A short line that opens a section ("Nice to have:", "Requirements", "**What you bring**").
const HEADING =
  /^(#+\s|\*\*)|:\s*$|^(nice|bonus|plus|preferred|desirable|optional|requirements|required|must|qualifications|what you|what we|you have|you bring|you will|skills|about you|who you are|ideal|your profile|profile)/i;

// The opening (to see which language the posting is in) and the lines about languages, verbatim, each with the line
// before it and the heading it sits under, so the model can tell a must from a plus.
export function languageExcerpt(text: string, max = 2000): string {
  const all = units(text);
  const keep = new Set<number>();
  let opening = 0;
  all.forEach((u, i) => {
    if (opening < 300) {
      keep.add(i);
      opening += u.length;
    } else if (LANGUAGE_RE.test(u)) {
      keep.add(i - 1).add(i);
      for (let j = i - 1; j >= Math.max(0, i - 12); j--) {
        const h = all[j] ?? "";
        if (h.length <= 80 && HEADING.test(h)) {
          keep.add(j);
          break;
        }
      }
    }
  });
  return assemble(all, keep, max);
}

const clean = (ls: (string | null)[]) => [
  ...new Set(ls.map((l) => (l ?? "").toLowerCase().trim()).filter((l) => l && l !== "english")),
];

// A required language counts with a sentence found in the text, or when the posting is written in it.
export function verify(a: Answer, text: string) {
  const writtenIn = clean([a.writtenIn])[0] ?? null;
  const quote = locate(a.quote, text);
  const said = clean(a.languages);
  const languages = quote ? clean([...said, writtenIn]) : clean([writtenIn]);
  const dropped = said.some((l) => !languages.includes(l))
    ? { languages: a.languages, quote: a.quote }
    : null;
  return { languages, quote: languages.length ? quote : null, writtenIn, dropped };
}

export async function checkLanguages({
  model = "sonnet",
  limit = 3000,
  labelled = false,
  concurrency = 2,
} = {}) {
  const postings = labelled
    ? await sql<Posting[]>`
        select p.id, p.content_hash, p.title, p.location_raw, p.description
        from posting p join company c on c.id = p.company_id
        where c.ats || ':' || c.slug || ':' || p.external_id in ${sql(labelledKeys())} and p.description is not null
        order by p.id`
    : await sql<Posting[]>`
        select p.id, p.content_hash, p.title, p.location_raw, p.description
        from posting p
        where p.closed_at is null and p.description is not null
          and not exists (select 1 from language_check l where l.posting_id = p.id and l.content_hash = p.content_hash
            and l.prompt_version = ${LANGUAGE_PROMPT_VERSION} and l.requested = ${model})
        order by p.first_seen_at desc
        limit ${limit}`;
  const toRead = postings.filter((p) => needsReading(p.description));
  const plain = postings.filter((p) => !needsReading(p.description));
  console.log(`languages: ${String(postings.length)} postings, ${String(toRead.length)} to read`);
  const runId = await startRun(labelled ? "languages-labelled" : "languages");
  const stats = { postings: 0, read: 0, calls: 0, failed: 0, dropped: 0, costUsd: 0 };
  const store = async (p: Posting, answered: string, r: ReturnType<typeof verify> | null) => {
    const row = {
      posting_id: p.id,
      content_hash: p.content_hash,
      prompt_version: LANGUAGE_PROMPT_VERSION,
      requested: model,
      model: answered,
      languages: r?.languages ?? [],
      quote: r?.quote ?? null,
      written_in: r?.writtenIn ?? null,
      dropped: r?.dropped ? sql.json(r.dropped) : null,
    };
    await sql`
      insert into language_check ${sql(row)}
      on conflict (posting_id, content_hash, prompt_version, requested) do update set
        model = excluded.model, languages = excluded.languages, quote = excluded.quote,
        written_in = excluded.written_in, dropped = excluded.dropped, created_at = now()`;
    stats.postings++;
  };
  let stop = "";
  try {
    for (const p of plain) await store(p, "none", null);
    const texts = new Map(toRead.map((p) => [String(p.id), p]));
    const batches: Posting[][] = [];
    for (let i = 0; i < toRead.length; i += BATCH) batches.push(toRead.slice(i, i + BATCH));
    await pool(batches, concurrency, async (batch) => {
      if (stop) return;
      const input = batch
        .map(
          (p) =>
            `<posting id="${String(p.id)}">\ntitle: ${p.title}\nlocation: ${p.location_raw ?? ""}\n${languageExcerpt(p.description)}\n</posting>`,
        )
        .join("\n\n");
      const r = await loggedCall(model, input, {
        prompt: PROMPT,
        schema: SCHEMA,
        version: LANGUAGE_PROMPT_VERSION,
        postings: batch.length,
      });
      if ("error" in r) {
        stats.failed++;
        if (r.limited) stop = r.error;
        return;
      }
      stats.calls++;
      stats.costUsd += r.costUsd;
      for (const a of r.results as Answer[]) {
        const p = texts.get(a.id);
        if (!p) continue;
        const v = verify(a, p.description);
        if (v.dropped) stats.dropped++;
        stats.read++;
        await store(p, r.answered, v);
      }
    });
  } catch (e) {
    await finishRun(runId, { ...stats, queued: postings.length, error: 1 });
    throw e;
  }
  console.log(
    `languages (${model}, ${LANGUAGE_PROMPT_VERSION}): ${JSON.stringify(stats)}${stop ? `; stopped: ${stop}` : ""}`,
  );
  await finishRun(runId, { ...stats, queued: postings.length, ...(stop ? { error: 1 } : {}) });
  if (stop) throw new Error(`language check stopped: ${stop}`);
  return stats;
}
