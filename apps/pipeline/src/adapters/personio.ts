import { fetchText } from "../http.ts";
import { decode, iso, plain } from "../text.ts";
import type { Adapter } from "./types.ts";

// Personio's public XML feed. Most boards send the texts only with ?language=en. Boards written in German alone
// send nothing for it, or their positions with empty texts: read the board's own language then.
export const personio: Adapter = async (b) => {
  const domain = b.eu ? "jobs.personio.com" : "jobs.personio.de";
  let xml = await fetchText(`https://${b.slug}.${domain}/xml?language=en`);
  if (!/<jobDescriptions>\s*<jobDescription>/.test(xml))
    xml = await fetchText(`https://${b.slug}.${domain}/xml`);
  const unwrap = (s: string | undefined) => decode((s ?? "").replace(/<!\[CDATA\[|\]\]>/g, "")).trim();
  let name: string | null = null;
  const postings = [...xml.matchAll(/<position>([\s\S]*?)<\/position>/g)].map(([, p = ""]) => {
    const tag = (n: string) => unwrap(p.match(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`))?.[1]);
    name ??= tag("subcompany") || null;
    const id = tag("id");
    return {
      externalId: id,
      title: tag("name"),
      url: `https://${b.slug}.${domain}/job/${id}`,
      location: [...p.matchAll(/<office>([\s\S]*?)<\/office>/g)].map((m) => unwrap(m[1])).join("; "),
      postedAt: iso(tag("createdAt")),
      description: plain(unwrap(p.match(/<jobDescriptions>([\s\S]*?)<\/jobDescriptions>/)?.[1])),
    };
  });
  return { name, postings };
};
