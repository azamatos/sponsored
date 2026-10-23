# Roadmap

**Updated 2026-10-23.** Target: **MVP live on Friday 2026-10-30**, one week, re-planned at the owner's request:
agents build, so the code is not the bottleneck. What paces it is the owner's design time, the label review
(about an hour), the keys and the DNS record, the prompt iterations to the 95% bar, and Batch API turnaround
(hours). The site skeleton is built on real data while the design is made, then the design is applied. Public
launch (sharing it) follows when the owner is happy with it.

## Week plan

| Day           | Agent                                                                                                                            | Owner                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Fri Oct 23    | Alerts (done). Labelled set of 200 postings, the scorer, the regex baseline numbers                                              | Telegram bot token and chat id; Anthropic API key with a $50/month limit; both in `.env`  |
| Sat Oct 24    | Extractor; all three models on the labelled set (~$30); prompt iterations to the bar; pick the model                             | Review the "offers" and "refuses" labels (about an hour)                                  |
| Sun Oct 25    | Backfill every open role (Batch API); register review table for the top 100 NL and UK companies; design brief and name shortlist | Pick the name; start the design in Claude Design                                          |
| Mon–Tue 26–27 | `apps/web` skeleton on real data: search and filters, job, company and country pages, `/method`, `/status`                       | Design (search, job page, company, country; phone first; dark mode); spot-check registers |
| Wed–Thu 28–29 | Design applied (tokens, components); Playwright + axe; Lighthouse ≥ 95                                                           | Review on a preview                                                                       |
| Fri Oct 30    | Deploy on the server behind the front door, Cloudflare in front                                                                  | DNS record                                                                                |

If the 95% bar needs more prompt rounds, or the design comes later than Oct 27, the site moves by the same days.

## Status

| Milestone                                      | Target   | Status                                 |
| ---------------------------------------------- | -------- | -------------------------------------- |
| Idea and plan                                  | —        | done 2026-10-17                        |
| M0 Setup and real data                         | Oct 23   | done except the Telegram token (owner) |
| M1 Evidence: extraction, evaluation, registers | Oct 25   | starting: the labelled set             |
| M2 Design (owner, Claude Design)               | Oct 27   | brief on Oct 25                        |
| M3 Site                                        | Oct 30   | skeleton from Oct 26                   |
| M4 Launch                                      | November | when the owner is happy with the MVP   |
| M5 After launch                                | —        | later                                  |

## M0: setup and real data (done 2026-10-23)

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
- [x] Alerts when a run fails or a board type fails as a group: Telegram, live once the owner adds the token
      (2026-10-23)

Done when the findings are written (2026-10-23); the timers keep running unattended, with alerts.

## M1: evidence (target Oct 25)

- [ ] Labelled set: 200 postings sampled across countries, boards and rule outcomes, including postings with no
      visa words (to check the keyword pre-filter); labelled by an agent, every "offers" and "refuses" label
      reviewed by the owner (about an hour)
- [ ] Scorer, with the regex baseline's numbers first
- [ ] Extractor: sentence pre-filter, paragraph cache for boilerplate, structured output, quote verification,
      Batch API; model and prompt version stored per extraction. Visa and relocation verdicts only for the ~22%
      of postings that mention them (`docs/findings.md`)
- [ ] Prompt iterations until precision ≥ 95% for `visa = offers` and `relocation = offers`
- [ ] Backfill every open role, then only new or changed ones
- [ ] Register review: a table of reviewed entities for the 100 companies with the most NL and UK roles (most of
      the roles there); an agent proposes, the owner spot-checks. Name-in-posting matching covers only ~3%
- [ ] Verify the Blue Card and IND amounts at their sources; decide whether the UK salary check is in the MVP

Done when every open role has visa and relocation facts with verified quotes, the scorer passes the bar, and the
register status is confirmed for the top companies.

## M2: design (owner, target Oct 27, alongside M1 and the site skeleton)

- [ ] Design brief (agent): who, the questions per role, the screens, the real numbers that shape them (how often
      salary is posted, how many roles say anything about visas), and a sample of real extracted data to design with
- [ ] Screens in Claude Design (owner): search with filters, job page with the evidence, company, country, method,
      status; phone first; dark mode
- [ ] Design synced into code: tokens and components

Done when the owner signs off the screens.

## M3: site (target Oct 30)

- [ ] `apps/web`: Next.js (App Router), Tailwind CSS + shadcn/ui from the design
- [ ] Search with filters (country, role, seniority, visa, relocation, language not required, work mode, salary
      posted, posted within), state in the URL; job, company and country pages; `/method`; `/status`
- [ ] On the server in Docker behind its front door (`/srv/edge/sites/sponsored.caddy`, approved 2026-10-23),
      Cloudflare in front; DNS by the owner
- [ ] Playwright + axe, Lighthouse ≥ 95 in CI

Done when a visitor can find visa-friendly roles, see why each answer was given, and click through to apply.

## M4: launch (November, when the owner is happy)

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
