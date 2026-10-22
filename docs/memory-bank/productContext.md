# Product spec

Updated 2026-10-23. The agreed behaviour for the MVP; "later" items are in `progress.md`. The pipeline is built,
the site isn't.

## Who uses it

Software developers outside the EU who want a job in Europe and need the employer to sponsor a work permit:
frontend, backend, full-stack, mobile, data and DevOps engineers, mostly mid-level to senior. They are good at
their jobs and bad at guessing which postings are realistic for them. Today they open every posting, search it
for "visa", look up the employer in a register, and still don't know.

## The questions it answers, per role

1. **Visa:** does the posting offer sponsorship or relocation, refuse it, or say nothing? With the quote.
2. **Permit route:** for the role's country, can this employer actually sponsor? (Register check where one exists.)
3. **Language:** is German, Dutch, French or another local language required, or only nice to have?
4. **Fit:** role type, seniority, stack, work mode (on-site, hybrid, remote and from where).
5. **Money:** the salary range when the posting gives one, and for Germany whether it clears the Blue Card threshold.
6. **Freshness:** when it was first seen, last checked, and whether it's closed.

## Verdicts

Two separate facts per role, because they're different promises (most "relocation package" postings say nothing
about visas, `docs/findings.md`):

| Fact                   | Values                    | Shown as                                                                      |
| ---------------------- | ------------------------- | ----------------------------------------------------------------------------- |
| **Visa sponsorship**   | offers / refuses / silent | ✓ "Sponsors visas", ✗ "No sponsorship", or "Doesn't say", each with the quote |
| **Relocation support** | offers / refuses / silent | ✓ "Helps you relocate", ✗, or nothing, with the quote                         |

Then the employer check for the role's country:

| Register status     | When                                                                                               | Shown as                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Listed**          | The employer's entity is confirmed on the country's register (`techContext.md`, register matching) | "IND recognised sponsor" / "UK licensed sponsor", with the entry name     |
| **Not listed**      | Confirmed absent                                                                                   | NL: red warning, the Highly Skilled Migrant route is closed. UK: warning. |
| **Not checked yet** | No confirmed match either way                                                                      | "Register not checked yet"                                                |
| —                   | Countries without a register (Germany and most others)                                             | The country note instead (Blue Card salary check for Germany)             |

The headline badge combines them: "Sponsors visas" only when the posting says so; "Licensed sponsor, posting
doesn't say" when only the register speaks; "Doesn't say: ask the recruiter" otherwise. A refusal always wins.

A quote must be an exact substring of the posting text. If the extractor's quote isn't found, it's dropped.
Rule-based regex hits are never shown: they're wrong too often (`docs/findings.md`).

## Screens (MVP)

### Search (`/`)

- A search box (title, company, stack) and filters: country and city, role type, seniority, stack, verdict,
  "no local language required", salary posted, work mode, posted within.
- Each result: title, company, city and work mode, verdict badge, language badge, salary if posted, stack tags,
  posted date.
- Filter state lives in the URL, so a search can be shared or bookmarked.
- Sorted by newest first by default; "visa offered first" as an option.
- Fast on a phone: server-rendered first page, small JavaScript, no layout shift.

### Job (`/jobs/:id`)

- The facts above, the **evidence block** (quotes and register entry, each with its source and date), and a big
  "Apply on the company's site" link.
- "Last checked" time; a closed banner when the role is gone from the company's board.
- A "Report a wrong verdict" link (mailto or a simple form) to collect labelled mistakes.

### Company (`/companies/:slug`)

- Open roles, register status per country (entity name as registered), link to the careers page.

### Country (`/countries/:code`)

- Open roles there, plus a short, sourced explainer of the work-permit route for developers, with the date checked.

### Method (`/method`)

- Where the data comes from, how verdicts are made, the extractor's measured accuracy, known limits, the
  not-legal-advice note, and how a company can ask to be removed or corrected.

### Status (`/status`)

- Last ingest run, number of open roles, sources that failed.

## Visa rules by country

Each rule needs a source URL and a checked date before the site shows it. Re-check every January (thresholds
change yearly). Researched 2026-10-17; "verify" marks a figure taken from a secondary source.

| Country            | Route for developers                        | Employer check                                                                                            | 2026 salary threshold (gross)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Source                                                                                                                                                 |
| ------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Germany**        | EU Blue Card                                | None: there's no sponsor register and any employer can hire on a Blue Card                                | €50,700/year general; **€45,934.20/year** for shortage occupations (including IT specialists) and graduates of the last 3 years. Consistent across [CMS law firm](https://cms.law/en/deu/legal-updates/gefragt-wie-nie-die-blaue-karte-eu-als-schluessel-im-recruiting-internationaler-fachkraefte), [rt partner](https://www.rtpartner.de/immigration/blaue-karte-eu-mindestgehalt-2026/) and others (checked 2026-10-23); confirm on make-it-in-germany.com (blocks automated reads) before showing. | [BAnz AT 18.12.2025 B3](https://www.bundesanzeiger.de/pub/publication/REViP4bN6jVdpGxPaiQ/content/REViP4bN6jVdpGxPaiQ/BAnz%20AT%2018.12.2025%20B3.pdf) |
| **Netherlands**    | Highly Skilled Migrant (or EU Blue Card)    | Employer **must** be an IND recognised sponsor                                                            | HSM: €5,942/month at 30+, €4,357 under 30, €3,122 reduced criterion; Blue Card €5,942 (reduced €4,754). Excluding the 8% holiday allowance (**verify**).                                                                                                                                                                                                                                                                                                                                               | [IND required amounts](https://ind.nl/en/required-amounts-income-requirements)                                                                         |
| **United Kingdom** | Skilled Worker                              | Employer must hold a sponsor licence (Home Office register)                                               | Not researched yet: going rate per occupation code; research before UK verdicts show salary checks                                                                                                                                                                                                                                                                                                                                                                                                     | [Register](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)                                                           |
| **Denmark**        | Fast-track scheme (and others)              | SIRI list of fast-track certified companies (~990)                                                        | Not researched yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [SIRI certified companies](https://www.nyidanmark.dk/en-GB/Words-and-concepts/SIRI/Certified-companies)                                                |
| **Ireland**        | Critical Skills / General Employment Permit | No licence system; DETE publishes permits issued per company (evidence of past sponsoring, not a licence) | Not researched yet                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | [DETE statistics 2026](https://enterprise.gov.ie/en/publications/employment-permit-statistics-2026.html)                                               |
| Other EU           | National skilled-worker permits             | No register checked                                                                                       | —                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | —                                                                                                                                                      |

What the site says per country:

- **Germany:** "No sponsor licence needed for the Blue Card." Salary posted → above or below the threshold;
  not posted → "salary not posted: the Blue Card needs at least €X".
- **Netherlands:** an employer that isn't on the IND register gets a red warning, whatever the posting says.
- **UK:** not on the register → warning; on it → "Licensed sponsor", plus the posting's own statement.
- **Ireland:** "Has sponsored N permits this year" when DETE's data matches (later, not MVP).

## Data and content rules

- **Sources:** only companies' public job-board feeds and the governments' published registers. Never LinkedIn,
  never a site whose terms forbid automated access.
- **What we store and show:** title, company, location, dates, the extracted facts, quotes of at most a few
  sentences, and the link. The full posting text is stored privately for extraction and evaluation, never shown.
- **Attribution:** every job page links to the original posting, and the company's name is never altered.
- **Removal:** a company can ask to be removed or corrected; honour it within a week.
- **Personal data:** none in the MVP (no accounts). Alerts later will need email addresses, a privacy policy and
  deletion on request.
- **No ranking for money:** no paid placement or sponsored listings, which would undermine the verdicts.
- **Disclaimer on every verdict:** "Based on the posting text and public registers. Not legal advice; confirm
  with the employer."
