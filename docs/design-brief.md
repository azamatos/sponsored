# Design brief: Visaproof

Design a responsive web app: **Visaproof**, a free job finder at `visaproof.azamatos.com` for software developers
who need a visa to work in Europe. Phone first (360 px), then desktop. The site will be built in Nuxt (Vue 3)
with Tailwind CSS and its own small set of components on Reka UI (headless, accessible primitives, like shadcn's),
so design a compact component set that maps onto those.

Everything below comes from real data: 15,342 open roles read from companies' own job boards on 2026-10-23, and
what a language model found in them, checked against 200 hand-labelled postings.

## Who it's for

A developer outside the EU, usually mid-level or senior, often on a phone, often reading English as a second
language. Today they open fifty postings and search each one for "visa". They want a short list they can trust and
a fast way to the original posting to apply. No account, no CV upload.

The questions they ask first, in this order:

1. Will this employer sponsor my visa?
2. Will they help me move?
3. Do I need the local language?
4. Is it still open, and what does it pay?

What earns trust is **evidence**. Every answer shows where it comes from: the exact sentence from the posting, in
quotes, or the official register entry, and when it was checked. "We don't know" is a normal answer and must look
calm, not broken.

## The visa answer: five states (the core of the design)

Only 2.6% of roles explicitly say they sponsor visas, about 350 at any time. Most say nothing at all (78%), and 8%
refuse. So the answer can't be yes or no. It has levels, from strongest to weakest:

| State             | When                                                                                                                                                                                                                    | Evidence shown                                                                                              | Roles now                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Sponsors**      | The posting says it sponsors visas for this role                                                                                                                                                                        | The sentence, e.g. "We sponsor your work visa"                                                              | ~350                                    |
| **May sponsor**   | The posting hedges: "for certain roles", "case by case"                                                                                                                                                                 | The sentence                                                                                                | ~50                                     |
| **Can sponsor**   | The posting doesn't refuse, and the law lets this employer hire on a visa: an official sponsor in the UK or the Netherlands, or, in Germany, a posted salary above the Blue Card threshold (any employer can hire then) | The register entry ("UK licensed sponsor: Example Ltd") or the salary and the threshold                     | up to ~3,000 as registers are confirmed |
| **Unknown**       | The posting says nothing, and no register or salary check applies                                                                                                                                                       | A short country note ("In Germany, any employer can hire on a Blue Card if the salary is at least €45,934") | most roles                              |
| **Won't sponsor** | The posting refuses: "visa sponsorship is not available", "must have the right to work in the UK"                                                                                                                       | The sentence                                                                                                | ~1,200                                  |

- The default search view **hides "Won't sponsor"** and sorts the strongest states first. A visa filter lets people
  narrow down: Sponsors only / Sponsors or may / Sponsors, may or can / Everything except won't (default) / All.
- The states need to be told apart at a glance in a list, and never by colour alone: each one needs a word and an
  icon. Screen readers read them as "Visa: sponsors".
- "Can sponsor" is a legal fact about the employer, not a promise from the posting. The design should make that
  difference visible (for example, a different shape or icon from "Sponsors").

## The other facts on each role

| Fact       | States                                                                   | Evidence                        |
| ---------- | ------------------------------------------------------------------------ | ------------------------------- |
| Relocation | **Helps you move** · **May help** · **No relocation** · **Says nothing** | The sentence                    |
| Languages  | **English only** · **German required** (or another language)             | The sentence, when there is one |
| Salary     | The range as posted, with currency and period · **not posted**           | —                               |
| Freshness  | First seen, last checked, closed                                         | —                               |

Plus title, company, city and country, on-site / hybrid / remote (and where remote is allowed), seniority.

Relocation is a separate answer on purpose: many postings pay for the move and say nothing about permits, and the
other way round.

## Numbers that shape the screens

- 15,342 open roles at 2,553 companies in 31 countries; about 250 new a day. Most roles: UK (4,101), Germany
  (2,700), then Poland, France, Spain, Portugal, the Netherlands.
- **Salary is posted for only 12% of roles.** A "salary posted" filter shrinks the list a lot, so show the count
  before it's applied. Some ranges are for another country's office (a US range on a London role): show the
  currency as posted.
- **Languages:** a local language is required in 11% of German roles (and 22% are written in German), 25% of
  Belgian, 16% of Austrian, under 10% elsewhere. "No local language needed" is one of the most useful filters.
- **Germany:** 180 of the 183 German roles that post a yearly salary clear the 2026 Blue Card threshold (median
  lower bound €80,000). Most German roles post no salary, so they show "Unknown" with the country note.
- Filters with few results are normal here. Empty states must suggest the next step ("Show roles that may
  sponsor too").

## Screens

Each screen needs its loading, empty and error states.

1. **Search (home).** Free-text search (title, company, stack). Filters: country, visa (the five levels above),
   relocation offered, no local language, role family (backend, frontend, full-stack, mobile, DevOps, data, ML,
   security, QA, embedded, management), seniority, work mode, salary posted, posted within. Counts on every filter
   option, the state kept in the URL, one tap to clear. Results as job cards: title, company, place, work mode, the
   visa and relocation answers as compact chips, required language, salary when posted, age. Sort: strongest visa
   answer first (default), newest.
2. **Job page.** The facts on top, then the **evidence panel**: visa, relocation, register or Blue Card check,
   languages, each with its quote or entry and "checked <date>". Salary. A big **Apply on the company's site**
   button. "Report a wrong answer". Other open roles at the company. No full posting text: it isn't ours to
   republish.
3. **Company page.** Its open roles, its register status, how many of its roles say they sponsor, a link to its
   job board.
4. **Country page.** Roles there, and a short, dated, sourced note on how developers get a work permit there
   (register or salary rules), with links to the official sources.
5. **Method** (`/method`). How it works in plain words, the measured accuracy as a small table (on 200
   hand-labelled postings, "Sponsors" is 100% precise; the keyword rules it replaced were 33%), what it can't do,
   and "not legal advice".
6. **Status** (`/status`). Is the data fresh: when the job boards were last read, how many failed, when the
   registers and the extraction last ran. Simple and honest.

## Brand

- Part of the azamatos.com family. The wordmark is a shell prompt in Space Mono: `➜ ~ visaproof.azamatos▊`. The
  cursor blinks four times, then stays solid, and doesn't blink at all with reduced motion.
- Family tokens, dark: background `#010101`, text `#fff`, secondary `#a6a6a6`, muted `rgba(255,255,255,.5)`, border
  `rgba(255,255,255,.18)` (hover `.35`), surface `rgba(255,255,255,.02)` (hover `.06`). Type: Geist 400 and 500,
  Space Mono 400 for the wordmark and small data.
- Each site in the family has its own accent: the portfolio uses mint `#68edc0`, pass uses coral. **Propose two or
  three accents for Visaproof** that work for the five visa states too. The favicon keeps the prompt arrow and adds
  its own detail.
- The family is dark only. People read this site for a while: propose whether it also gets a light theme.
- Voice: plain and concrete, numbers instead of adjectives, short sentences, no hype. Never "guaranteed".

## Accessibility and quality

WCAG 2.2 AA: contrast on every state, visible focus, filters usable by keyboard and screen reader, no meaning in
colour alone, reduced motion respected, 44 px touch targets. Lighthouse 95 or more on a phone.

## What to hand back

The six screens (phone and desktop) with their states; the components (job card, the visa chip in all five states,
the relocation chip, filter controls, the evidence panel, empty states); and the tokens (accent, any light theme,
spacing, radii, type scale).

## Real roles to design with

Found on 2026-10-23. Quotes are exact sentences from the postings. None of these employers' register entries is
confirmed yet, so roles without a sentence show "Unknown" for now.

| Company    | Role                             | Place                   | Visa                                                                                   | Relocation                                           | Salary                       |
| ---------- | -------------------------------- | ----------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| Dust       | Software Engineer                | Paris, on-site          | Sponsors: "supporting you with all residence and work permit-related procedures"       | Helps: "We offer substantial support for relocation" | €40,000–150,000 a year       |
| Affirm     | Staff Software Engineer, Backend | Remote in Spain, Poland | Sponsors: "We are able to offer visa sponsorship for this role"                        | Says nothing                                         | €103,000–139,000 a year      |
| Tracebit   | Founding Engineer                | London, on-site         | Sponsors: "We can support various types of working visas in the UK"                    | Says nothing                                         | £100,000–130,000 a year      |
| Photoroom  | Product ML Engineer              | Paris, hybrid           | Sponsors: "Visa sponsorship and relocation support up to €10,000"                      | Helps: "relocation support up to €10,000"            | not posted                   |
| GreenFlux  | Engineering Manager              | Amsterdam, hybrid       | Sponsors: "we also offer Visa sponsorship"                                             | Helps: "relocation compensation to expats"           | not posted                   |
| Revel      | IT Infrastructure Engineer       | Prague, on-site         | Sponsors: "We sponsor your work visa"                                                  | Helps: "cover relocation"                            | not posted                   |
| Codeway    | Senior Backend Developer         | Barcelona, hybrid       | Sponsors: "Full visa & relocation support if you’re moving to Barcelona"               | Helps (same sentence)                                | not posted; Turkish required |
| Neo4j      | Research Engineer                | London, on-site         | Sponsors: "Neo4j can provide visa support for exceptional international applications." | Says nothing                                         | not posted                   |
| Opencast   | DevOps Consultant                | UK cities, hybrid       | Won't sponsor: "applicants must have UK citizenship"                                   | Says nothing                                         | £50,000–60,000 a year        |
| Polarsteps | iOS Engineer                     | Amsterdam, hybrid       | Unknown (would be "Can sponsor" once its IND entry is confirmed)                       | Says nothing                                         | €69,000–82,000 a year        |
| Zeit AI    | Staff Backend Engineer, Platform | Munich or London        | Can sponsor (Munich: the posted salary clears the Blue Card threshold)                 | Helps: "We support relocation within Europe"         | €95,000–270,000 a year       |
