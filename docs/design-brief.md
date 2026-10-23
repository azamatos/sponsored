# Design brief: Visaproof

**Written 2026-10-23** for the design in Claude Design (M2). Numbers come from `docs/findings.md`; the examples at
the end are real postings with what the extractor found in them.

## What it is, and for whom

Visaproof is a free job finder at `visaproof.azamatos.com` for software developers who need a visa to work in
Europe. It reads open roles from companies' own job boards and answers, with proof, the questions a relocating
developer asks first:

1. Will they sponsor my visa?
2. Will they help me move?
3. Can I actually get the permit (the employer is on the official sponsor register; the salary clears Germany's
   Blue Card threshold)?
4. Do I need the local language?
5. Is it still open, and what does it pay?

The visitor is a developer outside the EU, usually mid-level or senior, often on a phone, often searching in
English as a second language, and tired of opening fifty postings to search each for "visa". They want a short,
trustworthy list and a fast way to the original posting to apply. They don't want an account.

What earns trust here is **evidence**: every answer shows the sentence it came from, or the register entry, and
when it was checked. "We don't know" is a valid answer and has to look calm, not broken.

## Brand

- Part of the azamatos.com family. The wordmark is a shell prompt in Space Mono: `➜ ~ visaproof.azamatos▊`. The
  cursor blinks four times, then stays solid, and doesn't blink at all with reduced motion.
- Family tokens (dark): background `#010101`, text `#fff`, secondary `#a6a6a6`, muted `rgba(255,255,255,.5)`,
  border `rgba(255,255,255,.18)` (hover `.35`), surface `rgba(255,255,255,.02)` (hover `.06`). Type: Geist 400/500,
  Space Mono 400 for the wordmark and small data.
- Each site in the family has its own accent: the portfolio and Rebuffer use mint `#68edc0`, pass uses coral.
  **Visaproof needs its own accent**, and the favicon keeps the prompt arrow and adds its own detail. The family is
  dark only; decide whether this site, which people read for a while, also gets a light theme.
- Voice: plain and concrete, numbers instead of adjectives, short sentences, no hype. Never "guaranteed".

## The answer for each role (the core of the design)

Every role carries up to five facts. Each must be readable at a glance in a list, and checkable in detail on the
job page. Don't rely on colour alone: each state needs an icon or a word as well.

| Fact       | States                                                                              | Evidence shown                                                 |
| ---------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Visa       | **offers** · **maybe** (depends on the role) · **refuses** · **says nothing**       | The exact sentence, in quotes, with a link to the posting      |
| Relocation | **offers** · **maybe** · **refuses** · **says nothing**                             | The exact sentence                                             |
| Register   | NL and UK only: **listed** (confirmed entity) · **not checked yet**                 | The register's entry name and the date the register was loaded |
| Blue Card  | Germany only: **salary clears the threshold** · **below it** · **no salary posted** | The threshold, its source and date; the posted range           |
| Languages  | **English only** · **German required** (or another language)                        | The sentence, when there is one                                |

Plus the plain facts: title, company, city and country, on-site / hybrid / remote (and where remote is allowed),
seniority, salary when posted (as posted: currency and period), first seen, last checked, closed.

Visa and relocation are separate on purpose: many postings offer to pay for the move and say nothing about
permits, and the other way round.

## Numbers that shape the screens

- **15,342 open roles at 2,553 companies** in 31 countries; about **250 new a day**. The UK (4,101) and Germany
  (2,700) are the biggest, then Poland, France, Spain, Portugal and the Netherlands.
- **Most postings say nothing about visas.** Only 22% mention visas, relocation, permits or the right to work.
  About **2.6% explicitly offer visa sponsorship** (~350 roles), 8% refuse it, 5% offer relocation help.
  - So "offers sponsorship only" is a narrow filter (a few hundred roles): it must exist, but the default view
    can't be just that. Recommended default: hide roles that **refuse**, and sort the ones that **offer** first.
  - "Says nothing" is the most common state by far. On the job page it leads to what _can_ be said: the register
    (NL, UK) or the Blue Card salary check (Germany).
- **Salary is posted for 12% of roles** (Recruitee 36%, Ashby 23%, SmartRecruiters 4%). A salary filter will shrink
  the list a lot: show the count before applying it. Some ranges are for another country's office (a US range on
  a London role); show the currency as posted.
- **Languages:** a local language is required in 11% of German roles (and 22% are written in German), 25% of
  Belgian, 16% of Austrian; under 10% elsewhere. "No local language needed" is a key filter.
- **Registers:** the Dutch IND list has 13,016 recognised sponsors, the UK list 122,353 licensed sponsors. Matching
  a brand to its legal entity needs review, so many companies will show "register: not checked yet" at launch.
- **Germany's Blue Card:** almost every German role that posts a salary clears the 2026 threshold (180 of 183;
  median lower bound €80,000). Most German roles post no salary.

## Screens

Phone first (360 px), then desktop. Each screen needs its loading, empty and error states.

1. **Search (home).** Free-text search (title, company, stack); filters: country, role family (backend, frontend,
   full-stack, mobile, DevOps, data, ML, security, QA, embedded, management), seniority, visa (offers / offers or
   maybe / doesn't refuse), relocation offered, no local language, work mode, salary posted, posted within. Show
   counts on the filters, keep the state in the URL, and one tap to clear. Results as a list of job cards, each
   showing title, company, place, work mode, the visa and relocation answers as compact chips, salary when posted,
   and age. Sort: sponsorship first (default), newest.
2. **Job page.** The facts on top; the **evidence panel** (visa, relocation, register, Blue Card, languages: each
   with its quote or entry, and "checked <date>"); salary; a big **Apply on the company's site** button; "Report a
   wrong answer"; other open roles at the company. No full posting text: it's not ours to republish.
3. **Company page.** Open roles; register status; how many of its roles offer sponsorship; link to its job board.
4. **Country page.** Roles there; a short, dated, sourced summary of how work permits work for developers
   (register or salary rules); links to the official sources.
5. **Method** (`/method`). How it works in plain words, the measured accuracy (a small table), what it can't do,
   and "not legal advice".
6. **Status** (`/status`). Is the data fresh: when boards were last read, how many failed, when the registers and
   the extraction last ran. Simple and honest; it's also a portfolio piece.

## Accessibility and quality

WCAG 2.2 AA: contrast on every chip state, focus visible, filters usable by keyboard and screen reader (chips
read as "Visa: offers sponsorship"), no colour-only meaning, reduced motion respected. Touch targets 44 px.
Lighthouse ≥ 95 on phone.

## What to hand back

The screens above (phone and desktop), the components (job card, answer chip in every state, filter controls,
evidence panel, empty states), and the tokens (the accent, any light theme, spacing, radii). When it's done, share
the Claude Design link: it gets synced into the site's code (Next.js, Tailwind CSS, shadcn/ui).

## Real examples to design with

Extracted on 2026-10-23 by the extractor (Opus 5.5). Quotes are exact sentences from the postings. "Register" is
an automatic candidate, not yet confirmed, so these would show "not checked yet".

| Company    | Role                             | Place                   | Visa                                                                                 | Relocation                                            | Salary                                        |
| ---------- | -------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- | --------------------------------------------- |
| Dust       | Software Engineer                | Paris, on-site          | offers: "supporting you with all residence and work permit-related procedures"       | offers: "We offer substantial support for relocation" | €40,000–150,000 a year                        |
| Affirm     | Staff Software Engineer, Backend | Remote in Spain, Poland | offers: "We are able to offer visa sponsorship for this role"                        | says nothing                                          | €103,000–139,000 a year                       |
| Tracebit   | Founding Engineer                | London, on-site         | offers: "We can support various types of working visas in the UK"                    | says nothing                                          | £100,000–130,000 a year                       |
| Photoroom  | Product ML Engineer              | Paris, hybrid           | offers: "Visa sponsorship and relocation support up to €10,000"                      | offers: "relocation support up to €10,000"            | not posted                                    |
| GreenFlux  | Engineering Manager              | Amsterdam, hybrid       | offers: "we also offer Visa sponsorship"                                             | offers: "relocation compensation to expats"           | not posted                                    |
| Revel      | IT Infrastructure Engineer       | Prague, on-site         | offers: "We sponsor your work visa"                                                  | offers: "cover relocation"                            | not posted                                    |
| Codeway    | Senior Backend Developer         | Barcelona, hybrid       | offers: "Full visa & relocation support if you’re moving to Barcelona"               | offers (same sentence)                                | not posted; Turkish required                  |
| Neo4j      | Research Engineer                | London, on-site         | offers: "Neo4j can provide visa support for exceptional international applications." | says nothing                                          | not posted                                    |
| Opencast   | DevOps Consultant                | UK cities, hybrid       | refuses: "applicants must have UK citizenship"                                       | says nothing                                          | £50,000–60,000 a year                         |
| Polarsteps | iOS Engineer                     | Amsterdam, hybrid       | says nothing                                                                         | says nothing                                          | €69,000–82,000 a year                         |
| Zeit AI    | Staff Backend Engineer, Platform | Munich or London        | says nothing                                                                         | offers: "We support relocation within Europe"         | €95,000–270,000 a year (clears the Blue Card) |
