# Roadmap

**Updated 2026-10-23.** Target: **MVP live by 2026-12-20**, with 2027-01-04 as the latest date; public launch in
early January. Agents do the building; the owner decides, designs the screens (Claude Design) and reviews. Every
milestone is shippable on its own.

## Status

| Milestone                                      | Target    | Status                                                             |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------ |
| Idea and plan                                  | —         | done 2026-10-17                                                    |
| M0 Setup and real data                         | Oct 25    | almost done: findings written; alerts wait for the owner           |
| M1 Evidence: extraction, evaluation, registers | Nov 15    | not started; the labelled set can start, the model waits for owner |
| M2 Design (owner, Claude Design)               | Nov 22    | not started; brief comes from `docs/findings.md`                   |
| M3 Site                                        | Dec 20    | not started                                                        |
| M4 Launch                                      | early Jan | not started                                                        |
| M5 After launch                                | —         | later                                                              |

## M0: setup and real data (target Oct 25)

- [x] Repo `azamatos/sponsored`, pnpm workspace, TypeScript strict, ESLint (`strictTypeChecked`), Prettier,
      Vitest, CI with a Docker image build (2026-10-23)
- [x] Pipeline: adapters for Ashby, Greenhouse, Lever, SmartRecruiters, Personio, Recruitee, Workable, Workday;
      location and role rules; regex signals; Postgres schema; ingest with closing and an empty-board guard
      (2026-10-22)
- [x] On the server: Docker Compose, systemd timers (ingest every 6 h, registers daily, discovery weekly) (2026-10-22)
- [x] Registers loaded: IND 13,024 sponsors, UK 122,353 Skilled Worker sponsors (2026-10-22)
- [x] Discovery from Common Crawl's columnar index (DuckDB); the CDX query server times out on big hosts (2026-10-23)
- [x] First full sweep of every discovered board; `docs/findings.md` with the numbers (2026-10-23)
- [x] Each adapter tested against a saved real response (2026-10-23)
- [x] Nightly `pg_dump`, kept 7 days (2026-10-23)
- [x] Fixes from the sweep: one row per board, a request queue per site, US state codes (2026-10-23)
- [ ] Alerts when a run fails or a board type fails as a group (channel: owner's decision)

Done when the timers have run unattended for 3 days without a failure and the findings are written.

## M1: evidence (target Nov 15)

- [ ] Labelled set: 200 postings sampled across countries, boards and rule outcomes, including postings with no
      visa words (to check the keyword pre-filter); labelled by an agent, every "offers" and "refuses" label
      reviewed by the owner (about an hour)
- [ ] Scorer, with the regex baseline's numbers first
- [ ] Extractor: sentence pre-filter, paragraph cache for boilerplate, structured output, quote verification,
      Batch API; model and prompt version stored per extraction. Visa and relocation verdicts only for the ~21%
      of postings that mention them (`docs/findings.md`)
- [ ] Prompt iterations until precision ≥ 95% for `visa = offers` and `relocation = offers`
- [ ] Backfill every open role, then only new or changed ones
- [ ] Register review: a table of reviewed entities for the 100 companies with the most NL and UK roles (most of
      the roles there); an agent proposes, the owner spot-checks. Name-in-posting matching covers only ~3%
- [ ] Verify the Blue Card and IND amounts at their sources; decide whether the UK salary check is in the MVP

Done when every open role has visa and relocation facts with verified quotes, the scorer passes the bar, and the
register status is confirmed for the top companies.

## M2: design (owner, target Nov 22, alongside M1)

- [ ] Design brief (agent): who, the questions per role, the screens, the real numbers that shape them (how often
      salary is posted, how many roles say anything about visas), and a sample of real extracted data to design with
- [ ] Screens in Claude Design (owner): search with filters, job page with the evidence, company, country, method,
      status; phone first; dark mode
- [ ] Design synced into code: tokens and components

Done when the owner signs off the screens.

## M3: site (target Dec 20)

- [ ] `apps/web`: Next.js (App Router), Tailwind CSS + shadcn/ui from the design
- [ ] Search with filters (country, role, seniority, visa, relocation, language not required, work mode, salary
      posted, posted within), state in the URL; job, company and country pages; `/method`; `/status`
- [ ] Hosting and domain per the owner's decision; DNS by the owner
- [ ] Playwright + axe, Lighthouse ≥ 95 in CI

Done when a visitor can find visa-friendly roles, see why each answer was given, and click through to apply.

## M4: launch (early January)

- [ ] README: screenshot, architecture, method, evaluation numbers, how to run
- [ ] `/method` with the measured accuracy and known limits
- [ ] Competitors re-checked (`projectbrief.md`)
- [ ] Shared where relocating developers are: subreddits and Telegram channels that allow it, LinkedIn (owner)

## M5: after launch (only with real users)

- Alerts for saved searches (email or Telegram)
- "Suggest a company" form
- Sponsorship history per company ("posted 12 visa-friendly roles this year")
- Denmark (SIRI) and Ireland (DETE) registers; country guides, sourced and dated
- Lever boards beyond the seed list (Common Crawl doesn't crawl Lever's main host); more Workday employers
- Salary insights from posted ranges

## Done log

- 2026-10-17: idea agreed with the owner; README, AGENTS.md and memory bank written.
- 2026-10-22: pipeline built and running on the server; first run from the server read all 174 seed boards in
  2 minutes (1,803 engineering roles in Europe); registers loaded.
- 2026-10-23: repo on GitHub with CI; discovery moved to Common Crawl's columnar index; first full sweep of
  16,353 boards; adapter fixtures; nightly backups; duplicate boards merged, per-site rate limits, US state codes
  fixed; `docs/findings.md` written.
