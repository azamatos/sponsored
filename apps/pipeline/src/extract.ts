import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { finishRun, sql, startRun } from "./db.ts";
import type { Fact } from "./evaluation.ts";
import { pool } from "./http.ts";
import { MENTIONS_RE } from "./signals.ts";
import { errorText } from "./text.ts";

// Visa and relocation facts from a language model, run through Claude Code in print mode on the owner's
// subscription (CLAUDE_CODE_OAUTH_TOKEN). Only postings that mention visas, permits or relocation are read; the
// rest are silent by construction. Each call reads a batch of excerpts and answers in a JSON schema; a quote that
// isn't in the posting's text is dropped with its fact.

export const PROMPT_VERSION = "v1";
const PROMPT = path.join(import.meta.dirname, "..", "prompts", `extract-${PROMPT_VERSION}.md`);
const BATCH = 20;

const LANGUAGE_RE =
  /(german|deutsch|dutch|nederlands|french|fran[çc]ais|spanish|espa[ñn]ol|italian|italiano|polish|polski|swedish|svenska|danish|dansk|norwegian|norsk|finnish|suomi|czech|portuguese|portugu[êe]s|greek|hungarian|romanian|language|fluent|native speaker)/i;

// The lines (or, in long paragraphs, sentences) that mention visas, permits or relocation, with one on each side
// for headings like "VISAS & RELOCATION", plus the lines about languages. Kept verbatim, so quotes stay substrings.
export function excerpt(text: string, max = 3000): string {
  const units = text
    .split("\n")
    .flatMap((l) => (l.length > 400 ? l.split(/(?<=[.!?])\s+/) : [l]))
    .map((u) => u.trim())
    .filter(Boolean);
  const keep = new Set<number>();
  units.forEach((u, i) => {
    if (MENTIONS_RE.test(u)) [i - 1, i, i + 1].forEach((j) => keep.add(j));
    else if (LANGUAGE_RE.test(u)) keep.add(i);
  });
  let out = "";
  let last = -2;
  for (const i of [...keep].filter((j) => j >= 0 && j < units.length).sort((a, b) => a - b)) {
    const piece = (i > last + 1 && out ? "\n…\n" : out ? "\n" : "") + (units[i] ?? "");
    if (out.length + piece.length > max) break;
    out += piece;
    last = i;
  }
  return out;
}

// The quote as it appears in the text, or null. Models sometimes change whitespace or quote marks; the match is
// made on a copy with those evened out, then cut from the original.
export function locate(quote: string | null | undefined, text: string): string | null {
  const q = (quote ?? "").trim();
  if (!q) return null;
  if (text.includes(q)) return q;
  const even = (c: string) => (/\s/.test(c) ? " " : c.replace(/[‘’]/g, "'").replace(/[“”]/g, '"'));
  const flat: string[] = [];
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = even(text[i] ?? "");
    if (c === " " && flat.at(-1) === " ") continue;
    flat.push(c);
    at.push(i);
  }
  const needle = q.replace(/\s+/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  const start = flat.join("").indexOf(needle);
  if (start < 0) return null;
  const from = at[start] ?? 0;
  const to = (at[start + needle.length - 1] ?? from) + 1;
  return text.slice(from, to);
}

const FACT = { type: "string", enum: ["offers", "maybe", "refuses", "silent"] };
const SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          visa: FACT,
          visaQuote: { type: ["string", "null"] },
          relocation: FACT,
          relocationQuote: { type: ["string", "null"] },
          languages: { type: "array", items: { type: "string" } },
        },
        required: ["id", "visa", "visaQuote", "relocation", "relocationQuote", "languages"],
      },
    },
  },
  required: ["results"],
};

type Answer = {
  id: string;
  visa: Fact;
  visaQuote: string | null;
  relocation: Fact;
  relocationQuote: string | null;
  languages: string[];
};
type ClaudeResult = {
  is_error?: boolean;
  result?: string;
  structured_output?: { results?: Answer[] };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
  total_cost_usd?: number;
};

// One print-mode call: no tools, no saved session, our instructions instead of Claude Code's.
function claude(model: string, input: string, effort?: string): Promise<ClaudeResult> {
  const args = ["-p", "--model", model, "--output-format", "json", "--tools", "", "--no-session-persistence"];
  args.push("--system-prompt", readFileSync(PROMPT, "utf8"), "--json-schema", JSON.stringify(SCHEMA));
  if (effort) args.push("--effort", effort);
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"], timeout: 600_000 });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      const start = out.indexOf("{");
      if (start < 0) {
        reject(new Error(`claude exited ${String(code)}: ${(err || out).slice(0, 300)}`));
        return;
      }
      try {
        resolve(JSON.parse(out.slice(start)) as ClaudeResult);
      } catch {
        reject(new Error(`claude sent no JSON: ${out.slice(0, 300)}`));
      }
    });
    child.stdin.end(input);
  });
}

type Posting = {
  id: number;
  content_hash: string;
  title: string;
  location_raw: string | null;
  description: string;
};

// Reads the postings in batches and stores one extraction per posting. Stops at the first error that looks like a
// usage limit, so a busy day on the subscription doesn't turn into a run of failed calls.
export async function extractPostings(
  postings: Posting[],
  { model = "sonnet", effort = "", concurrency = 2 } = {},
) {
  const texts = new Map(postings.map((p) => [String(p.id), p]));
  const batches: Posting[][] = [];
  for (let i = 0; i < postings.length; i += BATCH) batches.push(postings.slice(i, i + BATCH));
  const stats = { postings: 0, calls: 0, failed: 0, dropped: 0, costUsd: 0 };
  let stop = "";
  await pool(batches, concurrency, async (batch) => {
    if (stop) return;
    const input = batch
      .map(
        (p) =>
          `<posting id="${String(p.id)}">\ntitle: ${p.title}\nlocation: ${p.location_raw ?? ""}\n${excerpt(p.description)}\n</posting>`,
      )
      .join("\n\n");
    const t0 = Date.now();
    let r: ClaudeResult;
    try {
      r = await claude(model, input, effort || undefined);
      if (r.is_error || !r.structured_output?.results) throw new Error(r.result ?? "no structured output");
    } catch (e) {
      const error = errorText(e);
      stats.failed++;
      if (/limit|rate|quota|429|overloaded/i.test(error)) stop = error;
      await sql`insert into extraction_call ${sql({ requested: model, prompt_version: PROMPT_VERSION, postings: batch.length, ms: Date.now() - t0, error: error.slice(0, 500) })}`;
      return;
    }
    const answered = Object.keys(r.modelUsage ?? {})[0] ?? model;
    stats.calls++;
    stats.costUsd += r.total_cost_usd ?? 0;
    await sql`insert into extraction_call ${sql({
      requested: model,
      model: answered,
      prompt_version: PROMPT_VERSION,
      postings: batch.length,
      ms: Date.now() - t0,
      input_tokens: r.usage?.input_tokens ?? null,
      output_tokens: r.usage?.output_tokens ?? null,
      cache_read_tokens: r.usage?.cache_read_input_tokens ?? null,
      cache_write_tokens: r.usage?.cache_creation_input_tokens ?? null,
      cost_usd: r.total_cost_usd ?? null,
    })}`;
    for (const a of r.structured_output.results) {
      const p = texts.get(a.id);
      if (!p) continue;
      const visaQuote = a.visa === "silent" ? null : locate(a.visaQuote, p.description);
      const relocationQuote = a.relocation === "silent" ? null : locate(a.relocationQuote, p.description);
      const dropped: Partial<Answer> = {};
      if (a.visa !== "silent" && !visaQuote) Object.assign(dropped, { visa: a.visa, visaQuote: a.visaQuote });
      if (a.relocation !== "silent" && !relocationQuote)
        Object.assign(dropped, { relocation: a.relocation, relocationQuote: a.relocationQuote });
      if (Object.keys(dropped).length) stats.dropped++;
      const row = {
        posting_id: p.id,
        content_hash: p.content_hash,
        prompt_version: PROMPT_VERSION,
        requested: model,
        model: answered,
        visa: visaQuote ? a.visa : "silent",
        visa_quote: visaQuote,
        relocation: relocationQuote ? a.relocation : "silent",
        relocation_quote: relocationQuote,
        languages: [...new Set(a.languages.map((l) => l.toLowerCase().trim()).filter(Boolean))],
        dropped: Object.keys(dropped).length ? sql.json(dropped) : null,
      };
      await sql`
        insert into extraction ${sql(row)}
        on conflict (posting_id, content_hash, prompt_version, requested) do update set
          model = excluded.model, visa = excluded.visa, visa_quote = excluded.visa_quote,
          relocation = excluded.relocation, relocation_quote = excluded.relocation_quote,
          languages = excluded.languages, dropped = excluded.dropped, created_at = now()`;
      stats.postings++;
    }
  });
  console.log(
    `extract (${model}, prompt ${PROMPT_VERSION}): ${JSON.stringify(stats)}${stop ? `; stopped: ${stop}` : ""}`,
  );
  if (stop) throw new Error(`extraction stopped: ${stop}`);
  return stats;
}

// The open postings that mention visas or relocation and have no extraction yet for this text, prompt and model.
// With labelled = true, the labelled set instead (texts from any state, open or closed).
export async function extract({ model = "opus", limit = 500, labelled = false, effort = "" } = {}) {
  const mentions = MENTIONS_RE.source;
  const postings = labelled
    ? await sql<Posting[]>`
        select p.id, p.content_hash, p.title, p.location_raw, p.description
        from posting p join company c on c.id = p.company_id
        where c.ats || ':' || c.slug || ':' || p.external_id in ${sql(labelledKeys())}
          and p.description ~* ${mentions}
        order by p.id`
    : await sql<Posting[]>`
        select p.id, p.content_hash, p.title, p.location_raw, p.description
        from posting p
        where p.closed_at is null and p.description ~* ${mentions}
          and not exists (select 1 from extraction e where e.posting_id = p.id and e.content_hash = p.content_hash
            and e.prompt_version = ${PROMPT_VERSION} and e.requested = ${model})
        order by p.first_seen_at desc
        limit ${limit}`;
  console.log(`extract: ${String(postings.length)} postings to read`);
  const runId = await startRun(labelled ? "extract-labelled" : "extract");
  try {
    const stats = await extractPostings(postings, { model, effort });
    await finishRun(runId, { ...stats, queued: postings.length });
    return stats;
  } catch (e) {
    await finishRun(runId, { queued: postings.length, error: 1 });
    throw e;
  }
}

function labelledKeys() {
  return readFileSync(path.join(import.meta.dirname, "..", "eval", "labels.jsonl"), "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => (JSON.parse(l) as { key: string }).key);
}
