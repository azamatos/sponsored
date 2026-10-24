import { COUNTRIES, countryName } from "./countries";

const or = (xs: string[]) =>
  xs.length <= 2 ? xs.join(" or ") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1) ?? ""}`;
const NOT_A_CITY = new Set(
  [
    ...Object.keys(COUNTRIES),
    ...Object.values(COUNTRIES),
    "Europe",
    "EMEA",
    "EU",
    "Remote",
    "Hybrid",
    "UK",
  ].map((s) => s.toLowerCase()),
);

// "Dublin; Dublin, Dublin, Ireland" → "Dublin, Ireland"; remote roles say where remote is allowed.
export function place(raw: string, countries: string[], mode: string, scope: string): string {
  const names = countries.map(countryName);
  if (mode === "remote") {
    if (scope === "worldwide") return "Remote, anywhere";
    if (scope === "europe" || !names.length) return "Remote in Europe";
    return `Remote in ${or(names)}`;
  }
  // The city of the first listed place in one of the role's countries: "Sunnyvale, CA; London, UK" → London.
  const segments = raw.split(";").map((x) => x.trim());
  const inScope = (x: string) =>
    countries.some((c) =>
      new RegExp(`\\b(${c}|${countryName(c)}${c === "GB" ? "|UK|England|Scotland|Wales" : ""})\\b`, "i").test(
        x,
      ),
    );
  const first = segments.length === 1 ? segments[0] : segments.find(inScope);
  const city = (first ?? "")
    .split(",")[0]
    ?.replace(/\b(office|remote|hybrid|on-?site)\b/gi, "")
    .replace(/[-–(]\s*$/, "")
    .trim();
  const where = names.length > 2 ? `${String(names.length)} countries` : names.join(" or ");
  if (!city || NOT_A_CITY.has(city.toLowerCase())) return where || raw;
  return where ? `${city}, ${where}` : city;
}

export const WORK_MODE: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "" };

const SYMBOL: Record<string, string> = { EUR: "€", GBP: "£", USD: "$", CHF: "CHF " };
const PER: Record<string, string> = { year: "a year", month: "a month", day: "a day", hour: "an hour" };

// The range as posted, in its own currency: "€40,000–150,000 a year".
export function salary(
  pay: { min: number; max: number; currency: string; period: string } | null,
): string | null {
  if (!pay) return null;
  const n = (x: number) => x.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const sym = SYMBOL[pay.currency] ?? `${pay.currency} `;
  const range = pay.min === pay.max ? n(pay.min) : `${n(pay.min)}–${n(pay.max)}`;
  return `${sym}${range} ${PER[pay.period] ?? ""}`.trim();
}

// How long ago a role was first seen, in words: "Today", "Yesterday", "3 days ago", "2 weeks ago".
export function age(date: Date | string, now = Date.now()): string {
  const days = Math.floor((now - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  if (days < 14) return `${String(days)} days ago`;
  if (days < 60) return `${String(Math.floor(days / 7))} weeks ago`;
  return `${String(Math.floor(days / 30))} months ago`;
}

// Boards that don't send their company's name have only a slug: "the-exploration-company" → "The Exploration
// Company". Good enough until the name is read from the board.
export const companyName = (name: string | null, slug: string) =>
  name ??
  slug
    .replace(/[-_]+/g, " ")
    .replace(/\d+$/, "")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
