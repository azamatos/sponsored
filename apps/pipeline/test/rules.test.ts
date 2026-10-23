import { describe, expect, it } from "vitest";
import { inScope, where } from "../src/location.ts";
import { familyOf, seniorityOf } from "../src/roles.ts";
import { canonical, surtRange } from "../src/discover.ts";
import { siteOf } from "../src/http.ts";
import { failingGroups, mergeById } from "../src/ingest.ts";
import { measure } from "../src/evaluation.ts";
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
