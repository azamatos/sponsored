import { fetchJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter, RawPosting } from "./types.ts";

type SmartRecruitersList = {
  totalFound?: number;
  content?: {
    id: string;
    name?: string;
    company?: { name?: string };
    location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean };
    releasedDate?: string;
  }[];
};
type Section = { text?: string };
type SmartRecruitersPosting = {
  jobAd?: {
    sections?: {
      companyDescription?: Section;
      jobDescription?: Section;
      qualifications?: Section;
      additionalInformation?: Section;
    };
  };
};

// https://developers.smartrecruiters.com/docs/posting-api: the list has no texts, so detail() fetches one job.
export const smartrecruiters: Adapter = async (b) => {
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b.slug)}/postings`;
  const postings: RawPosting[] = [];
  let name: string | null = null;
  for (let offset = 0; offset < 5000; offset += 100) {
    const j = await fetchJson<SmartRecruitersList>(`${base}?limit=100&offset=${offset}`);
    for (const x of j.content ?? []) {
      name ??= x.company?.name ?? null;
      postings.push({
        externalId: x.id,
        title: x.name ?? "",
        url: `https://jobs.smartrecruiters.com/${b.slug}/${x.id}`,
        location: [x.location?.city, x.location?.region, x.location?.country].filter(Boolean).join(", "),
        codes: [x.location?.country],
        remote: x.location?.remote === true,
        hybrid: x.location?.hybrid === true,
        postedAt: iso(x.releasedDate),
        description: null,
        detail: async () => {
          const d = await fetchJson<SmartRecruitersPosting>(`${base}/${x.id}`);
          const s = d.jobAd?.sections ?? {};
          return {
            description: plain(
              [
                s.companyDescription?.text,
                s.jobDescription?.text,
                s.qualifications?.text,
                s.additionalInformation?.text,
              ].join("\n"),
            ),
          };
        },
      });
    }
    if (offset + 100 >= (j.totalFound ?? 0)) break;
  }
  return { name, postings };
};
