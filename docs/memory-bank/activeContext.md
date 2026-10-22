# Active context

**Updated 2026-10-23.** Read this first.

## Where things stand

- The pipeline runs on the server (`deploy/README.md`): every 6 hours it reads the job boards that are due, keeps
  software engineering roles in the EU, EEA, UK and Switzerland, and marks closed ones. The IND and UK registers
  reload daily; Common Crawl discovery runs weekly.
- The first full sweep (every board Common Crawl knows on the supported hosts) ran on 2026-10-22. Its numbers and
  what they change: `docs/findings.md`. In short: plenty of roles; few postings say anything about visas; the
  regexes are wrong too often to show; for the Netherlands and the UK the register is the main answer.
- Nothing user-facing exists yet. No language model is wired in.
- The repo `azamatos/sponsored` is public, with CI (types, lint, format, tests, image build).

## Decisions taken (engineering, reversible)

Recorded with reasons in `techContext.md` → "Decisions taken": pipeline and Postgres on the owner's server;
discovery from Common Crawl's columnar index; one request per board where the API allows; visa and relocation as
separate facts; automatic register matches are candidates only; regex hits never shown.

## Decisions the owner needs to make

| #   | Decision                                                                                                                                                                                                                   | Recommendation                                                                                                       | Blocks |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | **Language model and monthly cap** for extraction (estimate in `docs/findings.md`)                                                                                                                                         | Measure all three on the labelled set, use the cheapest that clears the bar; about $30–55 once, then $15–35 a month  | M1     |
| 2   | **Where the site runs**                                                                                                                                                                                                    | On the same server, behind its existing front door, with Cloudflare proxying the domain; it reads the local Postgres | M3     |
| 3   | **Where failure alerts go**                                                                                                                                                                                                | A Telegram bot message to the owner; needs a bot token stored on the server                                          | M0     |
| 4   | **Name and domain.** The repo is `sponsored`. Checked 2026-10-17: "Sponsored" is also the usual label for paid ads, so some people may read it as "promoted listings"; alternatives were Visaproof, Sponsorproof, Visaline | Decide before the design starts (M2), since the design carries the name                                              | M2     |

Settled earlier: the eval bar is precision ≥ 95% for "offers"; countries at launch are the EU, EEA, UK and
Switzerland, with Germany done best; the repo is public from day one (the owner made it public).

## Next steps

1. Labelled set of 200 postings and the scorer, with the regex baseline numbers (doesn't need a decision).
2. Alerts, after decision 3.
3. The extractor, once the model is chosen (decision 1).
4. Register review table for the top 100 NL and UK companies.
5. Design brief for the owner (M2), built from the findings and a sample of extracted data.

## Open questions

- Lever: Common Crawl has no URLs for `jobs.lever.co` (its crawler is probably not allowed there), so only the
  seed list and the EU host cover Lever. Find another public way to list Lever boards.
- Workday: only the seed tenants are read. Discovering more is possible (`myworkdayjobs.com` in Common Crawl) but
  each tenant costs dozens of requests; decide after the extraction is running.
- Germany's Blue Card amounts came from secondary sources; verify against the Bundesanzeiger notice before the
  site shows them (`productContext.md`). UK going rates per occupation code aren't researched.
- Register matching: names in postings rarely equal the register entity (~3% of candidate companies), so the
  plan is a reviewed table for the biggest employers. Common-word names (Wise, Alan, Linear) need it most.
- Staffing agencies and aggregators post other companies' roles: flag them so the agency isn't read as the
  sponsor.
