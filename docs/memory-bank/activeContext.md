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

## Decided by the owner (2026-10-23)

1. **Language model:** measure Opus 5.5, Sonnet 5.5 and Haiku 4.5 on the labelled set and use the cheapest that
   clears precision ≥ 95% (estimate: $30–55 once, then $15–35 a month; `docs/findings.md`). Cap: $50 a month.
   The owner puts the API key in the server's `.env` and sets the limit in the Anthropic Console.
2. **Site hosting:** on the server, in Docker behind its existing front door (one file,
   `/srv/edge/sites/sponsored.caddy`), with Cloudflare proxying the domain; it reads the local Postgres.
3. **Alerts:** Telegram (`deploy/README.md` → Alerts). Built; the owner adds the bot token and chat id.
4. **Name:** a shortlist for the owner to pick before the design. Until then the working name is Sponsored and
   the address `jobs.azamatos.com`. Checked 2026-10-23 (registry lookups; a web search for products with the same
   name); `.com` is taken for all of them:

   | Name          | Says                                        | Free               | Same-name products found                 |
   | ------------- | ------------------------------------------- | ------------------ | ---------------------------------------- |
   | Visaproof     | visa answers with proof (the evidence)      | `.dev` `.io` `.eu` | none                                     |
   | Visasignal    | what the posting and the register signal    | `.dev` `.io` `.eu` | none                                     |
   | Visaradar     | finds visa-friendly roles                   | `.dev` `.io` `.eu` | none; "Job Radar" is a feature elsewhere |
   | Hired Abroad  | the outcome, in plain words                 | `.dev` `.io` `.eu` | none                                     |
   | Bluecard Jobs | clear for Germany, too narrow for NL and UK | `.dev` `.io` `.eu` | none                                     |

   Ruled out: VisaJobs (a US visa job board exists), Relocatable (too close to relocate.me, a competitor),
   Permitted and Sponsorable (domains taken). Recommendation: Visaproof. A domain is a purchase: owner's call.

5. **Pace:** MVP live on 2026-10-30, a one-week plan (`progress.md`).

## Waiting for the owner

- Telegram bot token and chat id in `/srv/sponsored/.env`.
- Anthropic API key in `/srv/sponsored/.env`, with a $50/month limit.
- The label review, the name, the design, the DNS record.

Settled earlier: the eval bar is precision ≥ 95% for "offers"; countries at launch are the EU, EEA, UK and
Switzerland, with Germany done best; the repo is public from day one (the owner made it public).

## Next steps

1. Owner review of the labels (`apps/pipeline/eval/labels.jsonl`, the non-silent ones).
2. The extractor and the model comparison, once the API key is in.
3. Backfill; register review table for the top 100 NL and UK companies; design brief and name shortlist.
4. `apps/web` skeleton on real data while the owner designs.

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
