# Technical plan

**Updated 2026-10-23.** Built: the pipeline (ingest, registers, discovery) on the server. Planned: extraction,
evaluation, the website. Items marked **open** wait for the owner (`activeContext.md`).

## Shape

```
company job boards ──┐            Common Crawl index ──┐ weekly
                     ▼                                 ▼
   pipeline (apps/pipeline), Docker on the server, systemd timers
     ingest every 6 h: read due boards → engineering roles in Europe → new / changed / closed → rule signals
     registers daily:  IND + UK registers → match companies
     discover weekly:  Common Crawl → new boards (read once, kept if they have roles for us)
     extract (planned): new or changed postings → language model → facts with verified quotes
                     ▼
              Postgres 18 (same server, no public port)
                     ▼
   website (planned, apps/web): search, filters, job / company / country pages, method, status
```

The pipeline and the site share only the database, so either can be rebuilt without touching the other.

## Decisions taken (reversible, with the reason)

| Decision                                                                                           | Why                                                                                                      | Instead of                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Pipeline and Postgres on the owner's server (Docker, systemd timers, `Persistent=true`)            | No time limits, no laptop sleep, no cold database; runs every 6 h for free. A missed run starts at boot. | GitHub Actions cron + Neon (scheduled runs get delayed and switch off after 60 days without commits) |
| Node runs the TypeScript directly (type stripping)                                                 | No build step for a CLI; `tsc` only type-checks                                                          | A bundler                                                                                            |
| Plain SQL migrations + the `postgres` client                                                       | Bulk upserts and a small schema; nothing an ORM adds yet                                                 | Drizzle (still fine for the site later)                                                              |
| Read each board in one request where possible (Greenhouse `content=true`, Workable `details=true`) | ~10× fewer requests than one per job                                                                     | Per-job detail calls                                                                                 |
| Common Crawl for discovery                                                                         | Finds the boards nobody listed by hand, using public data, one request per board to check                | A hand-kept company list only                                                                        |
| Keep only engineering roles in scope countries; keep their full text privately                     | Small database, and the text is needed for extraction and evaluation                                     | Storing every posting                                                                                |
| Visa sponsorship and relocation support are two separate facts                                     | Most "relocation package" postings say nothing about visas (`docs/findings.md`)                          | One "visa" verdict                                                                                   |
| Auto register matches are candidates, not answers                                                  | Name matching links "Wise" to "Wise K9 Ltd" (`docs/findings.md`)                                         | Showing name matches                                                                                 |

## Packages

| Path                          | Job                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/pipeline/src/adapters/` | One file per board type, all returning `RawPosting`. Boards without texts in the list (SmartRecruiters, Workday) fetch a job's text only when it's new. |
| `src/location.ts`             | Free-text location → countries, on-site / hybrid / remote and remote scope. Remote with no region is dropped (on a US board it means the US).           |
| `src/roles.ts`                | Title → role family (frontend … management) or not software; seniority.                                                                                 |
| `src/signals.ts`              | Regex visa / no-visa / language hits with context, salary ranges. Baseline and pre-filter only.                                                         |
| `src/ingest.ts`               | Which boards are due, upsert, close what disappeared. A board that suddenly lists nothing keeps its roles open and records a warning.                   |
| `src/registers.ts`            | IND HTML table and UK CSV → `register_entry`; automatic matching.                                                                                       |
| `src/discover.ts`             | Seed lists and Common Crawl → `company` rows with status `new`.                                                                                         |
| `src/report.ts`               | The numbers in `docs/findings.md`.                                                                                                                      |
| `apps/web`                    | _Planned._ The site.                                                                                                                                    |
| `eval/`                       | _Planned._ Labelled postings and the scorer.                                                                                                            |

Board status: `new` → read once → `active` (has roles for us; read every run), `idle` (works, nothing for us;
re-read weekly), `gone` (404; re-read monthly).

## Data model (as built, `migrations/001_init.sql`)

```
company          id, ats, slug, eu, name, origin (seed | commoncrawl), status, checked_at, ok_at, error,
                 errors_in_row, total_jobs, kept_jobs                         unique (ats, slug, eu)
posting          id, company_id, external_id, url, title, family, seniority, location_raw, countries[],
                 work_mode, remote_scope, posted_at, first_seen_at, last_seen_at, changed_at, closed_at,
                 content_hash, description (private), salary_raw, pay, signals      unique (company_id, external_id)
register_entry   register (nl_ind | uk_worker), name, core (name without legal suffixes), extra (KvK; town, rating)
company_register company_id, register, entry_name, method (auto | override)
run              id, kind, started_at, finished_at, stats
source_result    run_id, company_id, ok, ms, total, kept, error
```

Planned: `extraction` (posting_id, prompt_version, model, data jsonb, created_at) and `paragraph` (hash → extracted
facts, so company-wide boilerplate is read once), `label` for the evaluation set.

## Sources (checked 2026-10-17, confirmed working from the server 2026-10-22)

| Board           | Endpoint (GET unless noted)                                                                                                         | Text in the list                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Ashby           | `api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`                                                             | yes, plus structured salary                                                             |
| Greenhouse      | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` (EU: `boards-api.eu.greenhouse.io`)                                   | yes                                                                                     |
| Lever           | `api.lever.co/v0/postings/{slug}?mode=json` (EU: `api.eu.lever.co`)                                                                 | yes                                                                                     |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings`, then `/postings/{id}`                                                       | no: one request per new role                                                            |
| Personio        | `{slug}.jobs.personio.de/xml?language=en`                                                                                           | yes (XML)                                                                               |
| Recruitee       | `{slug}.recruitee.com/api/offers/`                                                                                                  | yes                                                                                     |
| Workable        | `apply.workable.com/api/v1/widget/accounts/{slug}?details=true` (undocumented)                                                      | yes                                                                                     |
| Workday         | POST `{host}/wday/cxs/{tenant}/{site}/jobs` searching "software", "developer", "engineer", then one GET per new role (undocumented) | no                                                                                      |
| Common Crawl    | `index.commoncrawl.org/{crawl}-index?url={host}/*&output=json&fl=url`                                                               | — slow (seconds per call) and sometimes 502/504: retried, and the weekly run repeats it |

Not used: LinkedIn, Indeed, Glassdoor (terms), big-tech career sites and aggregators (their listings, their terms;
check before adding).

| Register                                                                                        | Where                                                                                                                  | Format                                        | Updated           |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------- |
| NL: IND public register "Work" (13,024 on 2026-10-22)                                           | `ind.nl/en/public-register-recognised-sponsors/public-register-work`                                                   | One HTML table: organisation, KvK number      | Monthly           |
| UK: Worker and Temporary Worker licensed sponsors, Skilled Worker route (122,353 on 2026-10-22) | CSV linked from `gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers` (file name changes) | CSV: name, town, county, type & rating, route | Most working days |
| DK: SIRI fast-track certified companies (~990)                                                  | `nyidanmark.dk/en-GB/Words-and-concepts/SIRI/Certified-companies`                                                      | HTML table: name, CVR                         | Later             |
| IE: DETE employment permits by company                                                          | `enterprise.gov.ie/en/publications/employment-permit-statistics-2026.html`                                             | XLSX per year                                 | Later             |

A register load that shrinks by more than 20% is rejected and the old copy kept.

## Register matching (the hard part, planned v2)

Automatic name matching is only a candidate list. A match becomes an answer when one of these holds:

1. **The posting names the entity.** Many postings end with the legal employer ("Adyen N.V.", "Wise Payments
   Limited"); search the stored texts for the register names of the candidates.
2. **KvK / company number** found on the company's site or posting (NL).
3. **Manual override**, reviewed in a small table, for the companies with the most NL and UK roles first.

Until then the site says "register: not checked yet" rather than guessing.

## Extraction (planned)

1. **Pre-filter:** keep the title, location and only the sentences that mention visas, relocation, permits,
   languages, salary, remote or seniority, plus the first lines. Most postings shrink to a few hundred tokens.
2. **Boilerplate once:** hash each paragraph; a paragraph seen at the same company before reuses its facts. Most
   visa and relocation sentences are company-wide boilerplate (`docs/findings.md`).
3. **Language model** with structured output, validated by zod:
   - `visa`: `offers | refuses | silent` + 0–3 verbatim quotes
   - `relocation`: `offers | refuses | silent` + quotes
   - `languages[]`: `{ language, level?, required }`; `seniority`; `family`; `stack[]`
   - `workMode`, `remoteRegion`; `salary`: `{ min, max, currency, period } | null`
4. **Quotes are verified:** a quote that isn't an exact substring of the posting is dropped.
5. **Batch API** (half price, results within hours: fine for a 6-hourly pipeline), cache by content hash + prompt
   version, model and prompt version stored with each extraction.
6. **Model: open** (cost estimate in `activeContext.md`). One `extract()` function, so it can change.

## Evaluation (planned)

- `eval/postings/`: 200 postings sampled across countries, boards and rule outcomes (yes, no, silent, the known
  false positives), labelled field by field. The owner reviews every "offers" and "refuses" label.
- `eval/score.ts`: per-field accuracy; precision and recall for `visa = offers` and `relocation = offers` (a false
  "yes" sends someone to apply where they can't get a permit, so precision matters most); rules vs. model side by
  side.
- Bar: precision ≥ 95% for `visa = offers` before the site shows verdicts.
- Runs before any prompt or model change; numbers go in the README and on `/method`.

## Website (planned)

- **Framework:** Next.js (App Router), the framework most European frontend postings ask for. Server-rendered
  pages for search engines, filter state in the URL.
- **Hosting: open.** Recommended: on the same server in Docker behind its existing Caddy front door, with
  Cloudflare proxying the domain (cache, TLS, DDoS); it reads the local Postgres directly. Alternative: Cloudflare
  Workers + a hosted Postgres (the original plan), which needs the data copied out of the server.
- Search: Postgres full-text search over title, company and stack, `pg_trgm` for company names, facet counts in SQL.
- UI: Tailwind CSS + shadcn/ui, from the owner's design (Claude Design). Dark mode, keyboard and screen-reader
  friendly filters. Cloudflare Web Analytics (no cookies).

## Ops

- Deploy: `deploy/deploy.sh` (`deploy/README.md`). CI: types, lint, format, tests, Docker image build.
- Every run writes `run` and `source_result`; `report` shows failures by board type.
- **Alerts: open.** A failed timer run or a board type failing as a group should reach the owner (Telegram bot or
  email). Until then: `systemctl list-timers` and `report`.
- Backups (planned): nightly `pg_dump` to a file kept for 7 days; the database can also be rebuilt from the boards
  in an hour, except history (first seen, closed).

## Tests

- Vitest: rules (`test/rules.test.ts`); each adapter against a saved real response (planned, `test/fixtures`);
  register parsing and matching; the quote verifier.
- Site (planned): Playwright + axe on search, filter, job page, apply link; keyboard only. Lighthouse CI ≥ 95.
