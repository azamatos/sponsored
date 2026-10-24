# Active context

**Updated 2026-10-24.** Read this first.

## Where things stand

- The pipeline runs on the server (`deploy/README.md`): every 6 hours it reads the job boards that are due, keeps
  software engineering roles in the EU, EEA, UK and Switzerland, and marks closed ones. The IND and UK registers
  reload daily; Common Crawl discovery runs weekly.
- The first full sweep (every board Common Crawl knows on the supported hosts) ran on 2026-10-22. Its numbers and
  what they change: `docs/findings.md`. In short: plenty of roles; few postings say anything about visas; the
  regexes are wrong too often to show; for the Netherlands and the UK the register is the main answer.
- Extraction runs nightly at 01:00 UTC (Claude Code, Opus 5.5, on the owner's subscription); the first night read
  1,500 postings, about 1,670 are left. Telegram gets 🚨 alerts, ✅ "works again" and a daily summary at 06:00
  (`deploy/README.md` → Alerts).
- The design is done (the owner's Claude Design canvas, 27 boards). The site (`apps/web`, Nuxt) has its search page
  so far; a preview is live at visaproof.azamatos.com, not indexed (`X-Robots-Tag: noindex`) until the launch.
- The repo `azamatos/visaproof` (renamed from `azamatos/sponsored` on 2026-10-24) is public, with CI (types,
  lint, format, tests, image build).

## Decisions taken (engineering, reversible)

Recorded with reasons in `techContext.md` → "Decisions taken": pipeline and Postgres on the owner's server;
discovery from Common Crawl's columnar index; one request per board where the API allows; visa and relocation as
separate facts; automatic register matches are candidates only; regex hits never shown.

## Decided by the owner (2026-10-23)

1. **Language model:** no paid API usage (owner); extraction runs Claude Code in print mode on the owner's
   subscription (`CLAUDE_CODE_OAUTH_TOKEN` in the server's `.env`). Measured on the labelled set, all three models
   clear the bar; **Opus 5.5** is used, the only one with 100% recall on "offers" (`docs/findings.md`). Nightly at
   01:00 UTC, up to 1,500 postings a run.
2. **Site hosting:** on the server, in Docker behind its existing front door (one file,
   `/srv/edge/sites/sponsored.caddy`), with Cloudflare proxying the domain; it reads the local Postgres.
3. **Alerts:** Telegram (`deploy/README.md` → Alerts), live since 2026-10-23 through the owner's bot.
4. **Name:** Visaproof, at `visaproof.azamatos.com` (a subdomain: no domain is bought). The repo, the folder and
   the server paths keep the working name `sponsored`.
5. **Pace:** MVP live on 2026-10-30, a one-week plan (`progress.md`).
6. **Site stack:** Nuxt (Vue 3), Tailwind CSS, own components on Reka UI (`techContext.md`).

## Decided by the owner (2026-10-24, "go with recommended")

1. **Accent:** "Visa blue" `#76beff` (light theme `#0863a9`), with orange `#f99f5d` (light `#a14808`) for
   refusals: told apart by colour-blind readers, unlike red and green.
2. **Light theme:** yes, following the device, with a System / Dark / Light switch in the footer.
3. **Corrections address:** `visaproof@azamatos.com`, forwarded by Cloudflare Email Routing; the site promises
   to act within a week. Setting it up adds MX records to azamatos.com: ask before.

## Waiting for the owner

- Mon Oct 26: spot-check about 20 proposed register entries.
- Thu Oct 29: review the preview. Fri Oct 30: the DNS record, and approve the email forwarding.
- Any time: delete the old Anthropic Console API key (unused: extraction runs on the subscription).

Settled earlier: the eval bar is precision ≥ 95% for "offers"; countries at launch are the EU, EEA, UK and
Switzerland, with Germany done best; the repo is public from day one (the owner made it public).

## Next steps

1. Register review for the 100 biggest NL and UK employers (an agent proposes with evidence; the owner
   spot-checks).
2. IND and Blue Card amounts checked at their official sources.
3. Language pass for the postings that don't mention visas, measured on the labelled set first.
4. The five visa states per role in SQL; then `apps/web` to the design from Monday.

## Open questions

- Lever: Common Crawl has no URLs for `jobs.lever.co` (its crawler is probably not allowed there), so only the
  seed list and the EU host cover Lever. Find another public way to list Lever boards.
- Workday: only the seed tenants are read. Discovering more is possible (`myworkdayjobs.com` in Common Crawl) but
  each tenant costs dozens of requests; decide after the extraction is running.
- Germany's Blue Card amounts and the IND amounts came from secondary sources; verify them at the source before
  the site shows them (`productContext.md`). UK going rates per occupation code aren't researched.
- Register matching: names in postings rarely equal the register entity (~3% of candidate companies), so the
  plan is a reviewed table for the biggest employers. Common-word names (Wise, Alan, Linear) need it most.
- Staffing agencies and aggregators post other companies' roles: flag them so the agency isn't read as the
  sponsor.
