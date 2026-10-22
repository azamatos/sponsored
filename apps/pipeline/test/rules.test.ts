import { describe, expect, it } from "vitest";
import { inScope, where } from "../src/location.ts";
import { familyOf, seniorityOf } from "../src/roles.ts";
import { surtRange } from "../src/discover.ts";
import { parseCsv, core } from "../src/registers.ts";
import { payOf, signals } from "../src/signals.ts";

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
