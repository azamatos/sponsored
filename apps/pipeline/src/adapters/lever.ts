import { fetchJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter } from "./types.ts";

type LeverPosting = {
  id: string;
  text?: string;
  hostedUrl: string;
  categories?: { location?: string; allLocations?: string[] };
  country?: string | null;
  workplaceType?: string;
  createdAt?: number;
  descriptionPlain?: string;
  lists?: { text?: string; content?: string }[];
  additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string } | null;
};

// https://github.com/lever/postings-api
export const lever: Adapter = async (b) => {
  const host = b.eu ? "api.eu.lever.co" : "api.lever.co";
  const j = await fetchJson<LeverPosting[]>(
    `https://${host}/v0/postings/${encodeURIComponent(b.slug)}?mode=json`,
  );
  return {
    name: null,
    postings: j.map((x) => ({
      externalId: x.id,
      title: x.text ?? "",
      url: x.hostedUrl,
      location: [x.categories?.location, ...(x.categories?.allLocations ?? [])].filter(Boolean).join("; "),
      codes: [x.country],
      remote: x.workplaceType === "remote",
      hybrid: x.workplaceType === "hybrid",
      postedAt: iso(x.createdAt),
      description: [
        x.descriptionPlain,
        ...(x.lists ?? []).map((l) => `${l.text ?? ""}\n${plain(l.content)}`),
        x.additionalPlain,
      ]
        .filter(Boolean)
        .join("\n"),
      salary: x.salaryRange
        ? `${x.salaryRange.min ?? ""}–${x.salaryRange.max ?? ""} ${x.salaryRange.currency ?? ""} ${x.salaryRange.interval ?? ""}`.trim()
        : null,
    })),
  };
};
