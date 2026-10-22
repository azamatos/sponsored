import { fetchJson, postJson } from "../http.ts";
import { iso, plain } from "../text.ts";
import type { Adapter, RawPosting } from "./types.ts";

type WorkdayList = {
  total?: number;
  jobPostings?: { externalPath?: string; title?: string; locationsText?: string; bulletFields?: string[] }[];
};
type WorkdayJob = {
  jobPostingInfo?: {
    jobDescription?: string;
    location?: string;
    additionalLocations?: string[];
    country?: { descriptor?: string };
    remoteType?: string;
    startDate?: string;
  };
};

// A Workday tenant's career site (undocumented "cxs" API). The list has titles and a short location; detail()
// fetches the text. Big tenants have thousands of jobs, so search for engineering words instead of listing all.
const SEARCH = ["software", "developer", "engineer"];
const MAX_PAGES = 25;

export const workday: Adapter = async (b) => {
  const [host, tenant, site] = b.slug.split("/");
  if (!host || !tenant || !site) throw new Error(`workday slug must be host/tenant/site: ${b.slug}`);
  const base = `https://${host}/wday/cxs/${tenant}/${site}`;
  const found = new Map<string, NonNullable<WorkdayList["jobPostings"]>[number] & { externalPath: string }>();
  for (const searchText of SEARCH)
    for (let page = 0; page < MAX_PAGES; page++) {
      const j = await postJson<WorkdayList>(`${base}/jobs`, {
        appliedFacets: {},
        limit: 20,
        offset: page * 20,
        searchText,
      });
      // A few entries come without a path (and so without a page): skip them.
      for (const x of j.jobPostings ?? [])
        if (x.externalPath) found.set(x.externalPath, { ...x, externalPath: x.externalPath });
      if ((page + 1) * 20 >= (j.total ?? 0)) break;
    }
  const postings: RawPosting[] = [...found.values()].map((x) => {
    const pathPlace = decodeURIComponent(x.externalPath.split("/")[2] ?? "").replace(/-/g, " ");
    const several = /\d+\s+Locations?/i.test(x.locationsText ?? "");
    return {
      externalId: x.bulletFields?.[0] ?? x.externalPath,
      title: x.title ?? "",
      url: `https://${host}/${site}${x.externalPath}`,
      location: several ? pathPlace : `${x.locationsText ?? ""}; ${pathPlace}`,
      postedAt: null,
      description: null,
      detail: async () => {
        const d = (await fetchJson<WorkdayJob>(`${base}${x.externalPath}`)).jobPostingInfo ?? {};
        return {
          description: plain(d.jobDescription),
          location: [d.location, ...(d.additionalLocations ?? []), d.country?.descriptor]
            .filter(Boolean)
            .join("; "),
          remote: /remote/i.test(d.remoteType ?? ""),
          postedAt: iso(d.startDate),
        };
      },
    };
  });
  return { name: tenant, postings };
};
