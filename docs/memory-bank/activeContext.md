# Active context

**Updated 2026-10-24, late evening.** Read this first. The next session starts with "Next steps" below.

## Where things stand

- **Pipeline** (on the server, `deploy/README.md`): every 6 hours it reads the job boards that are due (quiet
  boards in weekly slots, Workday skipped in its maintenance window), keeps software roles in the EU, EEA, UK and
  Switzerland, and closes the ones that disappear. Registers reload daily, discovery weekly. Nightly at 01:00 UTC
  on the owner's Claude subscription: the visa extraction (Opus 5.5, ~1,670 postings left after the first night),
  then the language check (Sonnet, about 3,000 postings a night until all are read).
- **Answers:** the `role_answer` view (migration 006) gives each role one of the five visa states, relocation and
  languages, each with its evidence. "Can sponsor" comes from `register_review` (the 200 biggest NL and UK
  employers, reviewed by agents with evidence: `apps/pipeline/reviews/registers.jsonl`) and the German Blue Card
  minimum (`visa_rule`, checked at the source on 2026-10-24). About 2,130 roles are "Can sponsor".
- **Site** (`apps/web`, Nuxt 4 + Tailwind 4 + Reka UI, matching the owner's design): the search page only. Live
  search, every filter with counts (sidebar on a desktop, sheet on a phone), dark and light themes, our own
  `UiSelect`, `UiExternalLink` (new tab). **Live as a preview at visaproof.azamatos.com**, not indexed
  (`X-Robots-Tag: noindex` in `deploy/caddy/sponsored.caddy`) until the public launch. Job cards link to
  `/jobs/:id`, and the header to `/method` and `/status`: those pages don't exist yet (404).
- **Ops:** Telegram gets 🚨 alerts with what they mean, ✅ "works again", and a daily summary at 06:00 UTC with
  🟢 🟡 🔴 per part. CI: types, lint, format, unit tests, both Docker images.
- The repo is `azamatos/visaproof` (renamed from `azamatos/sponsored` on 2026-10-24), public. The folder and the
  server paths keep the working name `sponsored`.

## Decided by the owner

2026-10-23:

1. **Language model:** no paid API; Claude Code in print mode on the owner's subscription
   (`CLAUDE_CODE_OAUTH_TOKEN` in the server's `.env`, never `ANTHROPIC_API_KEY`). Opus 5.5 for visas.
2. **Hosting:** the server, in Docker behind the shared Caddy (`/srv/edge/sites/sponsored.caddy`), Cloudflare
   proxying. Not Cloudflare Pages: the site reads the server's Postgres (asked again on 2026-10-24, confirmed).
3. **Alerts:** Telegram. **Name:** Visaproof at `visaproof.azamatos.com`. **Pace:** MVP on 2026-10-30.
4. **Site stack:** Nuxt (Vue 3), Tailwind CSS, own components on Reka UI.

2026-10-24:

1. **Design:** the owner's Claude Design canvas (27 boards; link in `CLAUDE.local.md`, private). Accent "Visa
   blue" `#76beff` (light `#0863a9`), orange `#f99f5d` (light `#a14808`) for refusals; a light theme with a
   System / Dark / Light switch.
2. **Corrections address:** `visaproof@azamatos.com` was chosen. Since 2026-10-24 azamatos.com already has
   Cloudflare Email Routing (for `hi@azamatos.com`), so it's one more routing rule, no new DNS records; or the site
   uses `hi@azamatos.com`. Confirm with the owner before Friday.
3. **Search:** searches as you type (0.4 s, from two letters; Enter at once; an emptied box resets). "Clear all"
   clears the filters, not the search text.
4. **Links:** every link to another site opens in a new tab and says so (`UiExternalLink`); no native `<select>`
   (`UiSelect`). Rules in `techContext.md` → Components.
5. **Preview:** published now, with `noindex` until the public launch.

## Waiting for the owner

- **What search matches** (proposed 2026-10-24, not decided): today it's the title, the company and any word in
  the posting's text, which is slow (~1 s) and imprecise ("C" matches 11,080 of 14,765 roles, "go" matches
  "go-to-market"). Proposal: title, company and a list of technologies recognised in each posting (a dictionary
  with aliases: Go/Golang, k8s/Kubernetes, C++, .NET, Java ≠ JavaScript), stored per posting with a GIN index.
  Fast, precise, and the same list can show the stack on cards and become a filter. Ask before building.
- **Method and Status** (explained 2026-10-24; the owner asked what they're for, no reply yet on extras): Method is
  why the answers can be trusted (static text, a dated accuracy table, live counts from `/api/stats`); Status is
  whether they're fresh (`/api/status`: last run of each job, failures by board type, extraction backlog,
  registers; fresh < 7 h, late 7–13 h, stale > 13 h, with a notice on every page when stale). Public-safe facts
  only. Optional: discovery records its runs (one line), a few days of history.
- **Spot-check** about 20 register reviews (planned for Mon Oct 26): prepare a short page with the 21
  medium-confidence "listed" first, then a few "not listed".
- Thu Oct 29: review the preview. Fri Oct 30: the corrections address.

## Next steps (in order)

1. Ask the owner about search matching; build the technologies list if yes.
2. The job page (`/jobs/:id`): the facts on top, the evidence panel (visa, relocation, register or Blue Card
   check, languages, each with its quote or entry and "checked" date), salary, "Apply on the company's site"
   (`UiExternalLink`), "Report a wrong answer", other roles at the company; loading, closed and not-found states.
   Design boards: Job-phone, Job-desktop, Job-answers, Job-states. Endpoint `/api/jobs/[id]`.
3. `/api/stats` (footer, home, Method) and `/api/status` (Status, the stale-data notice).
4. Company and country pages (`/companies/...`, `/countries/[code]`): register status, the country's route with
   `visa_rule` amounts and sources. Mind boards that post for others ("Referral Board" is Elastic's referral
   board; staffing agencies), and companies without a name yet (slug title-cased for now).
5. Method and Status pages.
6. Playwright + axe tests in CI (needs a small test database), Lighthouse ≥ 95 on a phone; `docs/learning/` notes.
7. Update this file and `progress.md`; deploy (`DEPLOY_HOST=<alias> deploy/deploy.sh`).

## Open questions

- Lever: Common Crawl has no URLs for `jobs.lever.co`, so only the seed list and the EU host cover Lever.
- Workday: only the seed tenants are read; discovering more costs dozens of requests per tenant.
- Register reviews cover the 200 biggest employers; the rest stay "Unknown" unless the posting says something.
  Groups with several entities (some listed, some not) are marked unsure.
- Staffing agencies and aggregators post other companies' roles: flag them so the agency isn't read as the sponsor.
- UK going rates per occupation code aren't researched (the UK salary check waits until after launch).

Settled earlier: the eval bar is precision ≥ 95% for "offers"; countries at launch are the EU, EEA, UK and
Switzerland, with Germany done best; the repo is public from day one.
