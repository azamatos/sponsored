import { createHash } from "node:crypto";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e.startsWith("#")
      ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : +e.slice(1))
      : (ENTITIES[e.toLowerCase()] ?? m),
  );

// HTML (sometimes escaped twice, as Greenhouse sends it) to plain text with line breaks kept.
export function plain(html: string | null | undefined): string {
  let s = html ?? "";
  if (/&lt;\/?[a-z]/i.test(s)) s = decode(s);
  s = s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/?(br|p|li|ul|ol|h\d|div|tr|section)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return wellFormed(decode(s))
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ *\n[ \n]*/g, "\n")
    .trim();
}

// Lower case, accents and punctuation gone: for matching words, not for showing.
export const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Postgres refuses NUL characters and half an emoji (a lone surrogate, left by slicing a string mid-pair).
export const wellFormed = (s: string) =>
  s
    .replaceAll("\0", "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");

export const clip = (s: string, n: number) =>
  wellFormed(s.length > n ? s.slice(0, n).replace(/\s+\S*$/, "") + " …" : s);

export const hash = (...parts: (string | number | null | undefined)[]) =>
  createHash("sha1")
    .update(parts.map((p) => String(p ?? "")).join("\u0000"))
    .digest("hex");

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const iso = (v: string | number | null | undefined): string | null => {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
