import { fetchJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter } from "./types.ts";

type AshbyBoard = {
  jobs?: {
    id: string;
    title?: string;
    jobUrl: string;
    isListed?: boolean;
    location?: string;
    secondaryLocations?: { location?: string }[];
    address?: { postalAddress?: { addressCountry?: string } };
    isRemote?: boolean;
    workplaceType?: string;
    publishedAt?: string;
    descriptionPlain?: string;
    descriptionHtml?: string;
    compensation?: {
      compensationTierSummary?: string | null;
      scrapeableCompensationSalarySummary?: string | null;
    };
  }[];
};

// https://developers.ashbyhq.com/docs/public-job-posting-api
export const ashby: Adapter = async (b) => {
  const j = await fetchJson<AshbyBoard>(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.slug)}?includeCompensation=true`,
  );
  return {
    name: null,
    postings: (j.jobs ?? [])
      .filter((x) => x.isListed !== false)
      .map((x) => ({
        externalId: x.id,
        title: x.title ?? "",
        url: x.jobUrl,
        location: [
          x.location,
          ...(x.secondaryLocations ?? []).map((l) => l.location),
          x.address?.postalAddress?.addressCountry,
        ]
          .filter(Boolean)
          .join("; "),
        remote: x.isRemote === true || x.workplaceType === "Remote",
        hybrid: x.workplaceType === "Hybrid",
        postedAt: iso(x.publishedAt),
        description: x.descriptionPlain ?? plain(x.descriptionHtml),
        salary:
          x.compensation?.compensationTierSummary ??
          x.compensation?.scrapeableCompensationSalarySummary ??
          null,
      })),
  };
};
