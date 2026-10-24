import { describe, expect, it } from "vitest";
import { inScope, where } from "../src/location.ts";
import { familyOf, seniorityOf } from "../src/roles.ts";
import { canonical, surtRange } from "../src/discover.ts";
import { siteOf } from "../src/http.ts";
import { failingGroups, mergeById, workdayMaintenance } from "../src/ingest.ts";
import { measure } from "../src/evaluation.ts";
import { render, summarise } from "../src/digest.ts";
import { excerpt, locate } from "../src/extract.ts";
import { languageExcerpt, needsReading, verify } from "../src/languages.ts";
import { parseCsv, core } from "../src/registers.ts";
import { MENTIONS_RE, payOf, signals } from "../src/signals.ts";
import { clip, plain } from "../src/text.ts";

describe("where", () => {
  it("finds offices in Europe", () => {
    expect(where("Berlin, Germany")).toMatchObject({ keep: true, mode: "onsite", countries: ["DE"] });
    expect(where("Amsterdam; London")).toMatchObject({ keep: true, countries: ["GB", "NL"] });
    expect(where("Hybrid - Munich")).toMatchObject({ keep: true, mode: "hybrid", countries: ["DE"] });
  });
  it("drops offices elsewhere and remote without a region", () => {
    expect(where("San Francisco, CA").keep).toBe(false);
    expect(where("Remote").keep).toBe(false);
    expect(where("Remote - US").keep).toBe(false);
  });
  it("reads DE and MT after a comma as US states unless the city is European", () => {
    expect(where("Wilmington, DE").keep).toBe(false);
    expect(where("Dover, DE, United States").keep).toBe(false);
    expect(where("Helena, MT").keep).toBe(false);
    expect(where("Berlin, DE")).toMatchObject({ keep: true, countries: ["DE"] });
    expect(where("Valletta, MT")).toMatchObject({ keep: true, countries: ["MT"] });
    expect(where("Remote - DE")).toMatchObject({ keep: true, countries: ["DE"] });
  });
  it("doesn't read places outside Europe as European ones (from the labelled set)", () => {
    expect(inScope(where("Saskatoon, SK", { codes: ["ca"] }))).toBe(false);
    expect(inScope(where("Sydney, New South Wales, Australia; Singapore"))).toBe(false);
    expect(inScope(where("New York, NY (Hybrid); CZ Biohub NY, LLC"))).toBe(false);
    expect(inScope(where("Bristol, Rhode Island; Bristol Rhode Island"))).toBe(false);
    expect(where("Bristol, UK")).toMatchObject({ keep: true, countries: ["GB"] });
    expect(where("Cardiff, Wales")).toMatchObject({ keep: true, countries: ["GB"] });
    expect(where("United Kingdom Remote; UK Remote")).toMatchObject({ keep: true, countries: ["GB"] });
  });
  it("keeps remote open to Europe", () => {
    expect(where("Remote, Europe")).toMatchObject({ keep: true, mode: "remote", scope: "europe" });
    expect(where("Remote (Germany)")).toMatchObject({ keep: true, scope: "country", countries: ["DE"] });
  });
  it("reads country codes the board sends", () => {
    expect(where("Somewhere", { codes: ["NLD"] })).toMatchObject({ keep: true, countries: ["NL"] });
  });
  it("marks countries outside the launch scope", () => {
    expect(inScope(where("Istanbul, Turkey"))).toBe(false);
    expect(inScope(where("Zurich, Switzerland"))).toBe(true);
  });
});

describe("familyOf", () => {
  it.each([
    ["Senior Frontend Engineer", "frontend"],
    ["Full Stack Developer (m/f/d)", "fullstack"],
    ["Backend Engineer, Payments", "backend"],
    ["Senior Software Engineer - Java", "backend"],
    ["iOS Engineer", "mobile"],
    ["Site Reliability Engineer", "devops"],
    ["Machine Learning Engineer", "ml"],
    ["Data Engineer", "data"],
    ["Engineering Manager, Platform", "management"],
    ["Software Engineer", "software"],
    ["Senior C++ Developer", "backend"],
  ])("%s → %s", (title, family) => {
    expect(familyOf(title)).toBe(family);
  });
  it.each([
    "Sales Engineer",
    "Solutions Engineer",
    "Mechanical Engineer",
    "Account Executive",
    "Product Designer",
    "Customer Support Engineer",
  ])("%s isn't software", (title) => {
    expect(familyOf(title)).toBeNull();
  });
});

describe("seniorityOf", () => {
  it("reads the level from the title", () => {
    expect(seniorityOf("Senior Frontend Engineer")).toBe("senior");
    expect(seniorityOf("Staff Engineer")).toBe("staff");
    expect(seniorityOf("Junior Developer")).toBe("junior");
    expect(seniorityOf("Werkstudent Softwareentwicklung")).toBe("intern");
    expect(seniorityOf("Software Engineer")).toBe("unspecified");
  });
});

describe("signals", () => {
  it("finds a visa offer with its context", () => {
    const s = signals("We offer visa sponsorship and a relocation package to Berlin.");
    expect(s.visa).toBe("offers");
    expect(s.visaQuotes[0]).toContain("visa sponsorship");
  });
  it("lets a refusal win over a mention", () => {
    expect(signals("Unfortunately we cannot offer visa sponsorship for this role.").visa).toBe("refuses");
    expect(signals("You must have the right to work in the UK.").visa).toBe("refuses");
  });
  it("is silent when nothing is said", () => {
    expect(signals("Build great things with React.").visa).toBe("silent");
  });
  it("finds a required local language", () => {
    expect(signals("Fluent German (C1) is required.").languages).toEqual(["german"]);
    expect(signals("English is our working language.").languages).toEqual([]);
  });
});

describe("payOf", () => {
  it("reads ranges with currencies and periods", () => {
    expect(payOf("€70,000 - €90,000 per year")).toEqual({
      min: 70000,
      max: 90000,
      currency: "EUR",
      period: "year",
    });
    expect(payOf("65k-80k EUR")).toEqual({ min: 65000, max: 80000, currency: "EUR", period: "year" });
    expect(payOf("£500 - £600 per day")).toMatchObject({ currency: "GBP", period: "day" });
  });
  it("ignores years of experience", () => {
    expect(payOf("3-5 years of experience")).toBeNull();
  });
});

describe("registers", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
  it("drops legal suffixes for matching", () => {
    expect(core("Adyen N.V.")).toBe("adyen");
    expect(core("Mollie B.V.")).toBe("mollie");
    expect(core("Booking.com B.V.")).toBe("booking com");
  });
});

describe("surtRange", () => {
  it("covers one host, or every subdomain of a wildcard", () => {
    expect(surtRange("jobs.ashbyhq.com")).toEqual(["com,ashbyhq,jobs)/", "com,ashbyhq,jobs)0"]);
    expect(surtRange("job-boards.eu.greenhouse.io")).toEqual([
      "io,greenhouse,eu,job-boards)/",
      "io,greenhouse,eu,job-boards)0",
    ]);
    expect(surtRange("*.recruitee.com")).toEqual(["com,recruitee,", "com,recruitee-"]);
  });
});

describe("canonical", () => {
  it("gives each board one row", () => {
    expect(canonical({ ats: "smartrecruiters", slug: "Devoteam" })).toEqual({
      ats: "smartrecruiters",
      slug: "devoteam",
      eu: false,
    });
    expect(canonical({ ats: "greenhouse", slug: "acme", eu: true }).eu).toBe(false);
    expect(canonical({ ats: "personio", slug: "acme", eu: true }).eu).toBe(false);
    expect(canonical({ ats: "lever", slug: "acme", eu: true }).eu).toBe(true);
  });
});

describe("siteOf", () => {
  it("puts every company's subdomain on one board type in the same queue", () => {
    expect(siteOf("acme.recruitee.com")).toBe("recruitee.com");
    expect(siteOf("acme.jobs.personio.de")).toBe("personio.de");
    expect(siteOf("apply.workable.com")).toBe("workable.com");
  });
});

describe("text for Postgres", () => {
  it("drops NUL characters and half emojis", () => {
    expect(clip("ok 🚀 go", 4)).not.toMatch(/[\uD800-\uDFFF]/);
    expect(clip("🚀".slice(0, 1) + " visa", 50)).toBe(" visa");
    expect(plain("a&#0;b")).toBe("ab");
  });
});

describe("failingGroups", () => {
  it("names a board type when half of 10 or more boards failed", () => {
    const run = (ats: string, ok: number, failed: number) => [
      ...Array.from({ length: ok }, () => ({ ats, failed: false })),
      ...Array.from({ length: failed }, () => ({ ats, failed: true })),
    ];
    expect(failingGroups([...run("workable", 4, 6), ...run("ashby", 90, 10), ...run("lever", 0, 3)])).toEqual(
      ["workable 6/10"],
    );
  });
  it("with again, counts only boards whose previous read failed too", () => {
    const results = [
      ...Array.from({ length: 2 }, () => ({ ats: "workday", failed: false, again: false })),
      ...Array.from({ length: 13 }, (_, i) => ({ ats: "workday", failed: true, again: i < 3 })),
    ];
    expect(failingGroups(results)).toEqual(["workday 13/15"]);
    expect(failingGroups(results, true)).toEqual([]);
    expect(
      failingGroups(
        results.map((r) => ({ ...r, again: r.failed })),
        true,
      ),
    ).toEqual(["workday 13/15"]);
  });
});

describe("workdayMaintenance", () => {
  it("covers Friday 23:00 to Saturday 11:00 in US Pacific time, summer and winter", () => {
    expect(workdayMaintenance(new Date("2026-10-24T06:20:00Z"))).toBe(true); // Fri 23:20 PDT, the failed run
    expect(workdayMaintenance(new Date("2026-10-24T12:20:00Z"))).toBe(true); // Sat 05:20 PDT
    expect(workdayMaintenance(new Date("2026-10-24T18:20:00Z"))).toBe(false); // Sat 11:20 PDT
    expect(workdayMaintenance(new Date("2026-10-24T00:20:00Z"))).toBe(false); // Fri 17:20 PDT
    expect(workdayMaintenance(new Date("2026-11-07T06:20:00Z"))).toBe(false); // Fri 22:20 PST
    expect(workdayMaintenance(new Date("2026-11-07T18:20:00Z"))).toBe(true); // Sat 10:20 PST
  });
});

describe("measure", () => {
  it("weights each stratum by its share of all postings", () => {
    const items = [
      { label: "offers", predicted: "offers", weight: 1 },
      { label: "refuses", predicted: "offers", weight: 1 },
      { label: "offers", predicted: "silent", weight: 10 },
    ] as const;
    const m = measure([...items], "offers");
    expect(m).toMatchObject({ predicted: 2, labelled: 2, precision: 0.5 });
    expect(m.recall).toBeCloseTo(1 / 11);
  });
});

describe("mergeById", () => {
  it("makes one posting per id, with every location in a stable order", () => {
    const job = (location: string, code: string) => ({
      externalId: "A1",
      title: "Backend Engineer",
      url: "u",
      location,
      codes: [code],
      description: "text",
    });
    const one = mergeById([job("Lisbon, Portugal", "PT"), job("Berlin, Germany", "DE")]);
    const other = mergeById([job("Berlin, Germany", "DE"), job("Lisbon, Portugal", "PT")]);
    expect(one).toHaveLength(1);
    expect(one[0]?.location).toBe("Berlin, Germany; Lisbon, Portugal");
    expect(one[0]?.location).toBe(other[0]?.location);
    expect(one[0]?.codes).toEqual(["PT", "DE"]);
  });
});

describe("MENTIONS_RE", () => {
  it("finds work-permit words beyond English and German", () => {
    expect(MENTIONS_RE.test("sinulla on työskentelylupa Suomessa")).toBe(true);
    expect(MENTIONS_RE.test("een geldige werkvergunning is vereist")).toBe(true);
    expect(MENTIONS_RE.test("You must be eligible to work in Spain")).toBe(true);
    expect(MENTIONS_RE.test("We build payment APIs in Go")).toBe(false);
  });
});

describe("digest", () => {
  const now = Date.parse("2026-10-24T06:00:00Z");
  const s = now / 1000;
  const run = (kind: string, hoursAgo: number, finished: boolean, stats: Record<string, number> = {}) => ({
    kind,
    started_at: new Date(now - hoursAgo * 3600_000),
    finished_at: finished ? new Date(now - hoursAgo * 3600_000 + 1200_000) : null,
    stats,
  });
  const open = { roles: 15210, companies: 2540, unread: 1628 };
  const host = {
    backup: { bytes: 29_979_017, at: s - 3 * 3600 - 600 },
    disk: 12,
    failedRuns: 0,
    failing: [],
  };
  const day = (first: Record<string, number> = {}) => [
    ...[0, 6, 12, 18].map((h) =>
      run("ingest", h, true, {
        boards: 2557,
        failed: 6,
        new: 40,
        closed: 9,
        changed: 12,
        ...(h === 0 ? first : {}),
      }),
    ),
    run("extract", 5, true, { postings: 1500, failed: 0 }),
    run("languages", 4.5, true, { postings: 3000, read: 1800 }),
    run("registers", 2, true, { nl_ind: 13024, uk_worker: 122368 }),
  ];
  it("renders a normal day", () => {
    expect(render(summarise(day(), open, host, now), now)).toBe(
      [
        "✅ <b>Visaproof · all good</b>\n<i>Sat 24 Oct · last 24 hours</i>",
        "🟢 <b>Job boards</b>\n4 runs · 10,228 reads · 24 failed",
        "🟢 <b>Roles</b>\n15,210 open at 2,540 companies\n+160 new · 36 closed · 48 changed",
        "🟢 <b>Extraction</b>\n1,500 postings read\n1,628 waiting for the next night\n3,000 checked for languages",
        "🟢 <b>Registers</b>\nIND 13,024 · UK 122,368 sponsors",
        "🟢 <b>Server</b>\nBackup 30 MB, Sat 24 Oct, 02:50 UTC · disk 12% used",
        "🟢 <b>Alerts</b>\nNone in 24 hours",
      ].join("\n\n"),
    );
  });
  it("puts notes first and keeps the all-good header", () => {
    const text = render(
      summarise(day({ skipped: 15, groups: 1 }), open, { ...host, failedRuns: 1 }, now),
      now,
    );
    expect(text.split("\n\n").slice(0, 3)).toEqual([
      "✅ <b>Visaproof · all good</b>\n<i>Sat 24 Oct · last 24 hours · 2 notes</i>",
      "🟡 <b>Job boards</b>\n→ A whole board type was down in 1 run; it alerts if that repeats\n" +
        "4 runs · 10,228 reads · 24 failed\n15 Workday reads skipped: Workday's weekly maintenance",
      "🟡 <b>Alerts</b>\n→ 1 failed run in 24 hours, each alerted; all work again",
    ]);
  });
  it("counts the problems in the header and lists their sections first", () => {
    const sections = summarise(
      [run("ingest", 6, true, { boards: 100, failed: 40 }), run("ingest", 5, false)],
      { ...open, unread: 0 },
      { failedRuns: 2, failing: [{ unit: "sponsored-extract.service", since: s - 5 * 3600 }], disk: 90 },
      now,
    );
    expect(
      sections.filter((x) => x.signal === "problem").map((x) => [x.title, x.issues.map((i) => i.text)]),
    ).toEqual([
      ["Job boards", ["1 run never finished", "Only 1 of 4 runs finished", "40 of 100 reads failed"]],
      ["Extraction", ["Didn't run in the last 24 hours"]],
      ["Registers", ["Not loaded in the last 24 hours"]],
      ["Server", ["No backup in the last 25 hours", "Disk 90% full"]],
      ["Alerts", ["Still failing: extract, since Sat 24 Oct, 01:00 UTC"]],
    ]);
    expect(render(sections, now).split("\n")[0]).toBe("⚠️ <b>Visaproof · 8 problems</b>");
  });
});

describe("excerpt", () => {
  it("keeps the visa lines with their neighbours, and language lines, verbatim", () => {
    const text = [
      "About us",
      "We build maps.",
      "VISAS & RELOCATION",
      "Not offered for this role.",
      "Perks",
      "Fluent German required.",
      "Gym",
    ].join("\n");
    expect(excerpt(text)).toBe(
      "We build maps.\nVISAS & RELOCATION\nNot offered for this role.\n…\nFluent German required.",
    );
  });
});

describe("locate", () => {
  const text = "Benefits:\n- We offer  visa sponsorship\nand a relocation package. It’s great.";
  it("finds exact quotes and quotes with different whitespace or quote marks", () => {
    expect(locate("relocation package", text)).toBe("relocation package");
    expect(locate("We offer visa sponsorship and a relocation package", text)).toBe(
      "We offer  visa sponsorship\nand a relocation package",
    );
    expect(locate("It's great", text)).toBe("It’s great");
  });
  it("refuses quotes that aren't in the text", () => {
    expect(locate("We sponsor visas", text)).toBeNull();
    expect(locate(null, text)).toBeNull();
  });
});

describe("language check", () => {
  const english =
    "You will build our platform with the team and the product owners. We are looking for engineers who care about quality.";
  it("reads postings with a line about languages or written in another language, and skips the rest", () => {
    expect(needsReading(english)).toBe(false);
    expect(needsReading(`${english} Fluent Dutch is required.`)).toBe(true);
    expect(
      needsReading(
        "Wir suchen eine Softwareentwicklerin für unser Team in Berlin. Du arbeitest an unserer Plattform.",
      ),
    ).toBe(true);
  });
  it("keeps a language only with a sentence found in the text, or the posting's own language", () => {
    const text = `${english}\nYou speak fluent German and English.`;
    expect(
      verify({ id: "1", languages: ["German", "english"], quote: "fluent German", writtenIn: null }, text),
    ).toEqual({ languages: ["german"], quote: "fluent German", writtenIn: null, dropped: null });
    expect(verify({ id: "1", languages: ["french"], quote: "fluent French", writtenIn: null }, text)).toEqual(
      {
        languages: [],
        quote: null,
        writtenIn: null,
        dropped: { languages: ["french"], quote: "fluent French" },
      },
    );
    expect(
      verify({ id: "1", languages: ["german"], quote: null, writtenIn: "German" }, "Wir suchen…"),
    ).toEqual({
      languages: ["german"],
      quote: null,
      writtenIn: "german",
      dropped: null,
    });
  });
  it("sends the opening and each line about languages with the line before it and its heading", () => {
    const opening = ["Senior Engineer", "A".repeat(320)];
    const text = [...opening, "Our stack is Go.", "Dutch is a plus.", "We offer lunch."].join("\n");
    expect(languageExcerpt(text)).toBe([...opening, "Our stack is Go.", "Dutch is a plus."].join("\n"));
    const listed = [
      ...opening,
      "Nice to have:",
      "Experience with Angular",
      "Kubernetes",
      "German language skills",
    ];
    expect(languageExcerpt([...listed, "We offer:"].join("\n"))).toBe(
      [...opening, "Nice to have:", "…", "Kubernetes", "German language skills"].join("\n"),
    );
  });
});
