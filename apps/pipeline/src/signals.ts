import { clip } from "./text.ts";

// Rule-based facts from a posting's text: the free baseline the language model has to beat later. A hit is only a
// hint: "visa sponsorship is not available" matches both lists, so the refusal wins.

const VISA_RE =
  /visa sponsorship|sponsor (?:your |a |the )?visa|visa support|work permit|blue card|relocation (?:support|package|assistance|bonus|budget|allowance|help)|help (?:you )?relocate|relocat(?:e|ing) to|we (?:can |will |do )?sponsor|sponsorship|highly skilled migrant|kennismigrant|global mobility|immigration (?:support|assistance)|relocation paid/g;
const NO_VISA_RE =
  /(?:not|unable to|cannot|can't|can not|don't|do not|won't|will not)(?: be able to)?(?: currently)? (?:offer|provide|support|sponsor)[^.]{0,30}(?:visa|sponsorship|relocation)|no (?:visa )?sponsorship|without (?:the need for )?(?:visa )?sponsorship|must (?:already )?(?:have|hold|possess)[^.]{0,40}(?:right|authori[sz]ation|permit) to work|(?:valid|existing) (?:eu )?work (?:permit|authori[sz]ation)|eu citizen|eu passport|(?:right|authori[sz]ed) to work in (?:the )?(?:us|usa|united states|uk|eu|germany|netherlands)/g;
// Any mention of visas, relocation, permits or the right to work, in English and the main languages in scope (the
// labelled set's one miss was a Finnish "työskentelylupa"). A posting without one can only be silent on visas and
// relocation, so it skips that part of extraction.
export const MENTIONS_RE =
  /(visa|sponsor|relocat|permit|blue card|right to work|eligible to work|authori[sz]ed to work|work authori[sz]ation|immigra|citizen|global mobility|kennismigrant|residence|aufenthalt|arbeitserlaubnis|umzug|werkvergunning|verblijfsvergunning|verhuiz|permis de travail|titre de s[ée]jour|d[ée]m[ée]nagement|permiso de trabajo|reubicaci|permesso di|pozwoleni[ea] na prac|relokacj|autoriza[çc][ãa]o de|työlupa|työskentelylupa|oleskelulupa|arbetstillst[åa]nd|uppehållstillst[åa]nd|arbejdstilladelse|opholdstilladelse)/i;
const LANG_RE =
  /(?:fluent|fluency|business[- ]level|native|proficient|excellent|very good|strong|professional)[^.\n]{0,25}(?:german|dutch|french|spanish|italian|polish|swedish|danish|norwegian|finnish|czech|portuguese|greek|hungarian|romanian)|(?:german|dutch|french|spanish|italian|polish|swedish|danish|norwegian|finnish|portuguese)[^.\n]{0,25}(?:c1|c2|b2|fluent|native|required|mandatory|is a must|essential)|deutschkenntnisse|fließend\w* deutsch|verhandlungssicher/g;
const GERMAN_WORDS =
  /(?<![a-zäöüß])(und|wir|sie|für|mit|bei|unser|deine|ihre|erfahrung|kenntnisse|aufgaben)(?![a-zäöüß])/g;
const LANGUAGES = [
  "german",
  "dutch",
  "french",
  "spanish",
  "italian",
  "polish",
  "swedish",
  "danish",
  "norwegian",
  "finnish",
  "czech",
  "portuguese",
  "greek",
  "hungarian",
  "romanian",
];

export type Visa = "offers" | "refuses" | "silent";
export type Signals = {
  visa: Visa;
  visaQuotes: string[];
  noVisaQuotes: string[];
  languages: string[];
  languageQuotes: string[];
  germanText: boolean;
};

function grab(text: string, re: RegExp) {
  const out = new Set<string>();
  for (const m of text.matchAll(re)) {
    out.add(
      clip(
        text
          .slice(Math.max(0, m.index - 80), m.index + m[0].length + 80)
          .replace(/\s+/g, " ")
          .trim(),
        220,
      ),
    );
    if (out.size >= 3) break;
  }
  return [...out];
}

export function signals(description: string): Signals {
  const d = description.toLowerCase();
  const visaQuotes = grab(d, VISA_RE);
  const noVisaQuotes = grab(d, NO_VISA_RE);
  const languageQuotes = grab(d, LANG_RE);
  return {
    visa: noVisaQuotes.length ? "refuses" : visaQuotes.length ? "offers" : "silent",
    visaQuotes,
    noVisaQuotes,
    languages: LANGUAGES.filter((l) => languageQuotes.some((q) => q.includes(l))),
    languageQuotes,
    germanText: (d.match(GERMAN_WORDS) ?? []).length > 20,
  };
}

// ---------- salary ----------

const CUR: Record<string, string> = { "€": "EUR", "£": "GBP", $: "USD" };
const AMOUNT = String.raw`(\d{1,3}(?:[.,'’\u202f\u00a0 ]\d{3})+|\d{1,6}(?:[.,]\d{1,2})?)\s?([kK])?`;
const MONEY = String.raw`(€|£|\$|EUR|GBP|USD|CHF|SEK|DKK|NOK|PLN|CZK|RON|HUF)`;
const PAY_RE = new RegExp(
  String.raw`(?:${MONEY}\s?)?${AMOUNT}(?:\s?${MONEY})?\s?(?:-|–|—|to|bis|and)\s?(?:${MONEY}\s?)?${AMOUNT}(?:\s?${MONEY})?`,
  "g",
);
const amount = (n: string, k?: string) => {
  const v = /[.,'’\s\u202f\u00a0]\d{3}(?!\d)/.test(n)
    ? +n.replace(/[.,'’\s\u202f\u00a0]/g, "")
    : +n.replace(",", ".");
  return k ? v * 1000 : v;
};

export type Pay = { min: number; max: number; currency: string; period: "year" | "month" | "day" | "hour" };

// The first salary range in a text, or null.
export function payOf(text: string | null | undefined): Pay | null {
  const s = text ?? "";
  for (const m of s.matchAll(PAY_RE)) {
    const c = m[1] ?? m[4] ?? m[5] ?? m[8];
    const [low, high] = [m[2], m[6]];
    if (!c || !low || !high) continue;
    const min = amount(low, m[3] || m[7]);
    const max = amount(high, m[7] || m[3]);
    if (!(min > 0 && max >= min)) continue;
    const tail = s.slice(m.index + m[0].length, m.index + m[0].length + 30).toLowerCase();
    const period = /hour|hourly|\/h\b|stunde/.test(tail)
      ? "hour"
      : /month|monthly|\bmo\b|monat|p\.m\./.test(tail)
        ? "month"
        : /\bday\b|daily|day rate/.test(tail)
          ? "day"
          : "year";
    if (period === "year" && max < 1000) continue; // "3-5 years", "$10-20M": not pay
    return { min, max, currency: CUR[c] ?? c.toUpperCase(), period };
  }
  return null;
}
