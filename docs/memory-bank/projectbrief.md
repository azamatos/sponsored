# Project brief

## What it is

A free, public job finder for software developers who need a visa to work in Europe. Every day it reads the open
roles of a curated list of European tech companies straight from their own job boards, checks each employer
against the official sponsor registers, and uses a language model to pull the facts that matter out of each
posting: the visa or relocation statement (as an exact quote), seniority, stack, work mode, language requirements
and salary. The site makes all of it searchable and sends you to the company's own page to apply.

## The problem

For a developer outside the EU, most "visa sponsorship" job lists are either stale, tagged by hand at company level
("this company sponsors"), or just a keyword search. So each posting still means: open it, search for "visa",
look up the employer in the register, check whether German is required, check the salary against the permit
threshold. Most of that can be done once, by a machine, with evidence.

## Why it exists

- It grew out of a private script that read a few company job boards and flagged visa sentences. This is that
  idea made public and done properly, for everyone who needs it.
- It's a portfolio project that shows the full stack in the open: a data pipeline, a database, an AI extraction
  step with measured accuracy, and a fast React interface, used by real people.

## Who it's for

- Developers relocating to Europe: the main audience.
- Recruiters and companies that sponsor: a fair, evidence-based listing is free exposure. They can ask for
  corrections or removal.

## What makes it different

1. **Evidence instead of tags.** Every verdict shows the sentence it came from or the register entry, with dates.
2. **Official registers.** Dutch IND recognised sponsors and the UK register of licensed sponsors are checked
   automatically, so "they sponsor" means something.
3. **The language filter.** "No German required" is one click.
4. **Fresh.** Read daily from the company's own board; closed roles are marked.
5. **Measured.** The extractor's accuracy on a labelled set is published, and so are its known limits.
6. **Free and private.** No accounts, no CV uploads, no tracking cookies.

## Competitors

Checked 2026-10-17. Re-check before M3.

| Site                                                                                      | What it does                                                                                                                                                                            | Registers        | Quotes evidence | Money                                       |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | --------------- | ------------------------------------------- |
| [JobThing.nl](https://jobthing.nl/about)                                                  | **Closest.** Netherlands only; lists only employers on the IND register, quotes the relocation sentence, drops "can't sponsor" posts. ~5,000 English jobs, ~1,150 in software and data. | IND              | yes             | not disclosed                               |
| [Hunt UK Visa Sponsors](https://huntukvisasponsors.com/how-does-it-work)                  | UK only; "sponsorship likelihood" from the employer's register entry, occupation code and salary rules.                                                                                 | UK, synced daily | no              | free feed ~3 days late; paid for fresh jobs |
| [SponsorScope](https://chromewebstore.google.com/detail/fajgghoolleplneoancngfgdflonlapi) | Chrome extension that marks UK sponsors on LinkedIn, Indeed and others.                                                                                                                 | UK               | no              | —                                           |
| [indsponsors.nl](https://indsponsors.nl/jobs)                                             | Directory of IND sponsors plus a few dozen jobs.                                                                                                                                        | IND              | no              | free                                        |
| [relocate.me](https://relocate.me/)                                                       | Curated relocation tech jobs and country guides.                                                                                                                                        | —                | no              | employers pay                               |
| [Arbeitnow](https://www.arbeitnow.com/visa-sponsorship-jobs)                              | German board with a "visa sponsorship" filter; method not disclosed.                                                                                                                    | —                | no              | free                                        |
| [visasponsor.jobs](https://visasponsor.jobs/)                                             | 10 countries, "verified" listings, method not stated.                                                                                                                                   | —                | —               | free                                        |
| [Next Level Jobs](https://nextleveljobs.eu/)                                              | Scrapes ~150 EU tech companies' career pages hourly; no per-job visa tag.                                                                                                               | —                | no              | candidates pay (€39 / €109)                 |
| [JobGlance](https://jobglance.app/jobs/visa-sponsorship/europe/)                          | Automated scan of descriptions for sponsorship language; ~8,700 European roles.                                                                                                         | —                | unclear         | free                                        |
| [Landing.Jobs](https://landing.jobs/jobs)                                                 | "Offers visa support / relocation" filters set by employers.                                                                                                                            | —                | no              | employers pay                               |

LinkedIn and Wellfound have visa filters too, set by the employers themselves.

**The gap:** nobody combines (1) registers from several countries, (2) the quoted sentence per posting with
"no sponsorship" posts flagged, (3) a salary check against the permit thresholds, and (4) fresh tech roles straight
from company job boards. JobThing does 1–2 for the Netherlands only; Hunt UK does 1 and a salary check for the UK
only. **Germany has no register at all**, so the quote plus a Blue Card salary check is the only signal there, and
that's where the gap is widest. Germany is also the biggest market for relocating developers.

## What success looks like

- **MVP (Jan 4, 2027):** ~170 companies, daily ingestion with no manual steps, every role with a verdict, search
  and filters, job and company pages, published eval numbers, Lighthouse ≥ 95.
- **Launch (mid-January):** public repo with a strong README, shared where relocating developers gather.
- **After launch:** real usage (weekly visitors, searches, clicks to apply), published with the other numbers; companies
  added on request.

## Not in scope

- Applying through the site, CV parsing, recruiter tools, paid listings.
- Countries outside Europe at launch.
- Legal advice of any kind.
