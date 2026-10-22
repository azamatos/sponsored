import { fetchJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter } from "./types.ts";

type GreenhouseBoard = {
  jobs?: {
    id: number;
    title?: string;
    absolute_url: string;
    company_name?: string;
    location?: { name?: string };
    offices?: { name?: string; location?: string | null }[];
    first_published?: string;
    updated_at?: string;
    content?: string;
  }[];
};

// https://developers.greenhouse.io/job-board.html: content=true sends every job's text in one response.
export const greenhouse: Adapter = async (b) => {
  const host = b.eu ? "boards-api.eu.greenhouse.io" : "boards-api.greenhouse.io";
  const j = await fetchJson<GreenhouseBoard>(
    `https://${host}/v1/boards/${encodeURIComponent(b.slug)}/jobs?content=true`,
    { timeout: 60_000 },
  );
  return {
    name: j.jobs?.[0]?.company_name ?? null,
    postings: (j.jobs ?? []).map((x) => ({
      externalId: String(x.id),
      title: x.title ?? "",
      url: x.absolute_url,
      location: [x.location?.name, ...(x.offices ?? []).map((o) => o.location || o.name)]
        .filter(Boolean)
        .join("; "),
      postedAt: iso(x.first_published ?? x.updated_at),
      description: plain(x.content),
    })),
  };
};
