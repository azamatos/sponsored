import { fetchJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter } from "./types.ts";

type WorkableAccount = {
  name?: string;
  jobs?: {
    shortcode: string;
    title?: string;
    url?: string;
    shortlink?: string;
    application_url?: string;
    city?: string;
    state?: string;
    country?: string;
    locations?: { city?: string; country?: string; countryCode?: string }[];
    telecommuting?: boolean;
    published_on?: string;
    created_at?: string;
    description?: string;
    requirements?: string;
    benefits?: string;
  }[];
};
type WorkableJob = { description?: string; requirements?: string; benefits?: string };

// Workable's widget feed (undocumented, may change). details=true adds the texts to the list.
export const workable: Adapter = async (b) => {
  const slug = encodeURIComponent(b.slug);
  const j = await fetchJson<WorkableAccount>(
    `https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`,
  );
  return {
    name: j.name ?? null,
    postings: (j.jobs ?? []).map((x) => ({
      externalId: x.shortcode,
      title: x.title ?? "",
      url: x.url || x.shortlink || x.application_url || "",
      location: [
        [x.city, x.state, x.country].filter(Boolean).join(", "),
        ...(x.locations ?? []).map((l) => [l.city, l.country].filter(Boolean).join(", ")),
      ]
        .filter(Boolean)
        .join("; "),
      codes: (x.locations ?? []).map((l) => l.countryCode),
      remote: x.telecommuting === true,
      postedAt: iso(x.published_on ?? x.created_at),
      description: x.description ? plain([x.description, x.requirements, x.benefits].join("\n")) : null,
      detail: async () => {
        const d = await fetchJson<WorkableJob>(
          `https://apply.workable.com/api/v2/accounts/${slug}/jobs/${x.shortcode}`,
        );
        return { description: plain([d.description, d.requirements, d.benefits].join("\n")) };
      },
    })),
  };
};
