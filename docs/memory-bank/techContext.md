# Technical plan

**Updated 2026-10-23.** Built: the pipeline (ingest, registers, discovery, alerts) on the server. Planned:
extraction, evaluation, the website.

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

| Board           | Endpoint (GET unless noted)                                                                                                         | Text in the list                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Ashby           | `api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true`                                                             | yes, plus structured salary                                    |
| Greenhouse      | `boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true` (also serves boards hosted on `job-boards.eu.greenhouse.io`)          | yes                                                            |
| Lever           | `api.lever.co/v0/postings/{slug}?mode=json` (EU: `api.eu.lever.co`)                                                                 | yes                                                            |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings`, then `/postings/{id}`                                                       | no: one request per new role                                   |
| Personio        | `{slug}.jobs.personio.de/xml?language=en` (every board is also on `.com`)                                                           | yes (XML)                                                      |
| Recruitee       | `{slug}.recruitee.com/api/offers/`                                                                                                  | yes                                                            |
| Workable        | `apply.workable.com/api/v1/widget/accounts/{slug}?details=true` (undocumented)                                                      | yes                                                            |
| Workday         | POST `{host}/wday/cxs/{tenant}/{site}/jobs` searching "software", "developer", "engineer", then one GET per new role (undocumented) | no                                                             |
| Common Crawl    | Columnar index (Parquet on `data.commoncrawl.org`), read with DuckDB by SURT key range per host                                     | — the CDN answers 403 when busy: retried 2 and 4 minutes later |

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
   Postings with no visa, relocation, permit or right-to-work words at all (~79%) skip the visa and relocation
   verdict: it's "silent" without a model call.
2. **Boilerplate once** (_planned_, if usage grows): hash each paragraph; a paragraph seen at the same company
   before reuses its facts. Most visa and relocation sentences are company-wide boilerplate (`docs/findings.md`).
3. **Language model** with structured output (a JSON schema):
   - `visa`: `offers | maybe | refuses | silent` + one verbatim quote
   - `relocation`: `offers | maybe | refuses | silent` + quote
   - `languages[]`: required languages other than English
   - _Planned_: `seniority`, `stack[]`, `workMode`, `remoteRegion`, `salary`, and languages for postings without
     visa words (a second, lighter pass)
4. **Quotes are verified:** a quote that isn't in the posting (allowing for whitespace and quote marks) is
   dropped with its fact, which is then stored as silent.
5. **Built (2026-10-23):** `src/extract.ts`, prompt `prompts/extract-v1.md`; tables `extraction` (one row per
   posting text, prompt version and model) and `extraction_call` (tokens, time, API-equivalent cost per call).
   20 postings per call, 2 calls at a time, nightly; it stops at the first usage-limit error.
6. **Model:** Opus 5.5 through Claude Code in print mode on the owner's subscription (no API billing), chosen on
   the labelled set (`docs/findings.md`). One `extract()` function, so the model or the way it's called can
   change.

## Evaluation (planned)

- `eval/postings/`: 200 postings sampled across countries, boards and rule outcomes (yes, no, silent, the known
  false positives), labelled field by field. The owner reviews every "offers" and "refuses" label.
- `eval/score.ts`: per-field accuracy; precision and recall for `visa = offers` and `relocation = offers` (a false
  "yes" sends someone to apply where they can't get a permit, so precision matters most); rules vs. model side by
  side.
- Bar: precision ≥ 95% for `visa = offers` before the site shows verdicts.
- Runs before any prompt or model change; numbers go in the README and on `/method`.

## Website (planned)

- **Framework:** Nuxt (Vue 3), chosen by the owner on 2026-10-23 as a new skill with demand: Vue is asked for in
  18% of frontend and 14% of full-stack roles in our own postings (React 72%, Angular 29%, Next.js 17%, Astro 1%),
  and the owner already ships React and Next.js. Pages render on the server; Nuxt's server routes (Nitro) query
  the local Postgres directly; the filters are a plain GET form, so their state lives in the URL and works
  without JavaScript. Earlier picks, Next.js and then Astro, were dropped: Next.js is heavier than six page types
  need and already on the owner's resume; Astro is the owner's, but teaches nothing new.
- **Components:** the site's own small design system: Tailwind tokens from the owner's design, hand-written
  components, and Reka UI (headless, accessible) for the hard widgets (the phone filter drawer, the country
  combobox, checkboxes), borrowing shadcn-vue's code where useful. No component library as a dependency: in our
  postings no UI library is a hiring signal (shadcn 1.6%, Material UI 1.8%, Vue libraries ~0%), while "design
  system" is (9.8%). Storybook after launch, optional.
  - The reusable pieces live in `apps/web/app/components/ui/` (used as `<UiSelect>`, `<UiExternalLink>`): no native
    `<select>` (`UiSelect`, on Reka's Select, renders its choice on the server too); every link to another site is a
    `UiExternalLink`, which opens a new tab and says so (an arrow, and "(opens in a new tab)" for screen readers);
    links within the site are `NuxtLink` and stay in the tab (owner, 2026-10-24).
- **Learning notes:** `docs/learning/`, one short note per concept the first time it appears in the code (the
  owner learns Nuxt and Vue from this codebase).
- **Hosting:** on the same server in Docker behind its existing Caddy front door, with Cloudflare proxying the
  domain (cache, TLS, DDoS); it reads the local Postgres directly (decided 2026-10-23).
- Search: Postgres full-text search over title, company and stack, `pg_trgm` for company names, facet counts in SQL.
- UI: from the owner's design (Claude Design). Keyboard and screen-reader friendly filters, WCAG 2.2 AA, axe in
  CI. Cloudflare Web Analytics (no cookies).

## Ops

- Deploy: `deploy/deploy.sh` (`deploy/README.md`). CI: types, lint, format, tests, Docker image build.
- Every run writes `run` and `source_result`; `report` shows failures by board type.
- **Alerts:** a failed unit, or an ingest where a board type fails as a group, sends its last log lines to the
  owner on Telegram (`deploy/alert.sh`, `deploy/README.md` → Alerts).
- Backups: nightly `pg_dump` to `/srv/sponsored/backups`, kept 7 days (`deploy/backup.sh`); the database can also
  be rebuilt from the boards in about two hours, except history (first seen, closed).
- Requests are queued per site (`acme.recruitee.com` and `beta.recruitee.com` share one queue): 2 at a time,
  300 ms apart; Workable 1 a second, because it answered the first sweep with 429s.

## Tests

- Vitest: rules (`test/rules.test.ts`); each adapter against a saved real response (`test/fixtures`, recorded
  with `scripts/record-fixture.ts` from discovered boards); planned: register matching and the quote verifier.
- Site (planned): Playwright + axe on search, filter, job page, apply link; keyboard only. Lighthouse CI ≥ 95.
