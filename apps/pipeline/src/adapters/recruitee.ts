import { fetchJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter } from "./types.ts";

type RecruiteeOffers = {
  offers?: {
    id: number;
    title?: string;
    careers_url: string;
    company_name?: string;
    location?: string;
    city?: string;
    country?: string;
    country_code?: string;
    remote?: boolean;
    hybrid?: boolean;
    published_at?: string;
    description?: string;
    requirements?: string;
    salary?: {
      min?: string | number | null;
      max?: string | number | null;
      currency?: string;
      period?: string;
    } | null;
  }[];
};

// https://docs.recruitee.com/reference/offers
export const recruitee: Adapter = async (b) => {
  const j = await fetchJson<RecruiteeOffers>(`https://${b.slug}.recruitee.com/api/offers/`);
  return {
    name: j.offers?.[0]?.company_name ?? null,
    postings: (j.offers ?? []).map((x) => ({
      externalId: String(x.id),
      title: x.title ?? "",
      url: x.careers_url,
      location: [x.location, x.city, x.country].filter(Boolean).join(", "),
      codes: [x.country_code],
      remote: x.remote === true,
      hybrid: x.hybrid === true,
      postedAt: iso(x.published_at),
      description: plain(`${x.description ?? ""}\n${x.requirements ?? ""}`),
      salary: x.salary?.min
        ? `${x.salary.min}–${x.salary.max ?? ""} ${x.salary.currency ?? ""} ${x.salary.period ?? ""}`.trim()
        : null,
    })),
  };
};
