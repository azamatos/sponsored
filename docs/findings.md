# Findings from the first full sweep

**Checked 2026-10-23.** What the real data looks like, and what that changes in the plan. The numbers come from
the first sweep on 2026-10-22, which read every board Common Crawl knew, and a second run on 2026-10-23 after
duplicate boards were merged. The queries are in `apps/pipeline/scripts/findings.sql`.

## In short

1. **The sources hold enough.** 16,098 company job boards found automatically, 15,342 open software engineering
   roles in Europe at 2,553 companies, and about 250 new ones a day.
2. **Few postings say anything about visas.** Only 22% mention visas, relocation, permits or the right to work at
   all. A role that clearly offers visa sponsorship is rare, about 2.6 in 100.
3. **The regex baseline can't be shown.** On 200 hand-labelled postings, only a third of its "offers sponsorship"
   hits really offer it, and a fifth are refusals it misread.
4. **For most roles the answer has to come from the law and the registers, not the posting.** That means the
   Dutch and UK sponsor registers, and the Blue Card salary rule in Germany. Register matching becomes core work,
   and automatic name matching is not enough.
5. **A language model clears the bar, on the owner's subscription.** Only the 22% of postings that mention visas
   or relocation are read. Opus 5.5 is 100% precise and 100% complete on "offers visa sponsorship" in the
   labelled set, against 33% precision for the rules.

## Boards

| Board type      | Boards found |    Active |       Idle | Gone (404) | Open roles kept |
| --------------- | -----------: | --------: | ---------: | ---------: | --------------: |
| Greenhouse      |        4,209 |       608 |      3,513 |         88 |           4,051 |
| Ashby           |        3,063 |       676 |      2,076 |        310 |           3,929 |
| SmartRecruiters |          713 |       210 |        502 |          0 |           3,836 |
| Workable        |        4,716 |       476 |      4,230 |         10 |           1,744 |
| Personio        |        2,503 |       334 |      1,488 |        681 |             816 |
| Recruitee       |          808 |       194 |        605 |          4 |             606 |
| Lever           |           69 |        39 |         30 |          0 |             250 |
| Workday         |           17 |        16 |          1 |          0 |             110 |
| **Total**       |   **16,098** | **2,553** | **12,445** |  **1,093** |      **15,342** |

174 of the boards come from a hand-made seed list; the rest from Common Crawl's two latest crawls (September and
October 2026).

- **Active:** has engineering roles in Europe, read every 6 hours. **Idle:** works, but nothing for us; re-read
  weekly. **Gone:** 404; re-read monthly.
- Most boards are idle: Common Crawl finds every company on a board type, and most of them hire in the US or
  outside engineering. The sweep reads them anyway, because a company can start hiring in Europe later.
- Bugs the sweep found and the fixes, deployed 2026-10-23:
  - 255 boards were counted twice, holding 1,050 duplicate roles. SmartRecruiters slugs are case-insensitive,
    Personio serves every board on both `.de` and `.com`, and Greenhouse's EU-hosted boards come from the main API.
    Migration `002_one_row_per_board.sql` merged them.
  - All 403 boards on Greenhouse's EU host failed: its API host doesn't exist, and the main API serves them.
  - Workable (150 boards) and Recruitee (53) answered with 429s. Requests are now queued per site, not per host,
    because every Recruitee company has its own subdomain. Workable is read one request a second.
  - Workable lists a job once per location under one id; the entries overwrote each other's content hash, so
    about 850 roles came out "changed" on every run. Now one posting per id with all its locations (2026-10-23).
  - Two smaller bugs failed one board each: a quote cut in the middle of an emoji, which Postgres refuses, and
    Workday entries without a page. After the fixes, 8 of 2,915 boards failed in the next run, all on the
    boards' side (404, 403, one board that isn't a job board).

## Roles

Roles that list several countries count once in each.

| Country             | Roles | Companies | Salary posted | Local language required (rules) | Refuses visas (rules) |
| ------------------- | ----: | --------: | ------------: | ------------------------------: | --------------------: |
| United Kingdom      | 4,101 |       923 |           14% |                              0% |                    8% |
| Germany             | 2,700 |       696 |            9% |      11%, and 22% are in German |                    2% |
| Poland              | 1,417 |       285 |           16% |                              4% |                    2% |
| France              | 1,183 |       224 |           12% |                              7% |                    0% |
| Spain               | 1,109 |       293 |           17% |                              6% |                    1% |
| Portugal            |   950 |       171 |           13% |                              7% |                    4% |
| Netherlands         |   889 |       290 |           24% |                              6% |                    2% |
| Ireland             |   566 |       153 |           17% |                              0% |                    4% |
| Romania             |   468 |       126 |            4% |                              2% |                    0% |
| Sweden              |   445 |       102 |            9% |                              3% |                    2% |
| Belgium             |   427 |       113 |            3% |                             25% |                    4% |
| Switzerland         |   391 |       122 |            7% |                              7% |                    1% |
| Remote, Europe-wide |   230 |        70 |           18% |                              2% |                    1% |
| Remote, worldwide   |   234 |        61 |           13% |                              0% |                    3% |

The full list is in the script's output. The rules' "refuses" is right 90% of the time in a sample (below); their
"offers" is left out because it's wrong most of the time.

- **Role families:** software 5,894, DevOps 1,927, backend 1,727, ML 1,218, data 967, full-stack 842,
  management 614, security 602, mobile 557, frontend 454, QA 403, embedded 137. "Software" is the catch-all for
  titles like "Software Engineer" with no stack.
- **Seniority:** not stated 7,255, senior 4,625, staff 1,212, manager 739, lead 707, junior 392, intern 217,
  mid 195. Almost half the titles don't say; the model will read it from the text.
- **Work mode:** on-site 7,566 (49%), hybrid 4,158 (27%), remote 3,618 (24%), of which 2,909 are limited to one
  country, 401 are open to Europe and 308 are open worldwide.
- **Freshness:** 250 roles a day were posted in the last 7 days, on the boards that send a date (all but 110
  roles).
- **Concentration:** the 100 companies with the most roles hold 72% of the Dutch roles, 52% of the UK ones and 55%
  of the German ones.

## What postings say about visas

Rule-based signals (`src/signals.ts`) mark a role "offers" when the text has words like "visa sponsorship" or
"relocation package", and "refuses" when it has a refusal like "unable to sponsor". The labelled set
(`apps/pipeline/eval/`) measures them: 200 postings from discovered boards in four strata, read in full and
labelled for visa and relocation separately, with the exact sentence as evidence. Scores are weighted by each
stratum's share of all open postings (`node src/cli.ts eval-score`).

| Stratum (open postings)            | Labelled | Visa: offers / maybe / refuses / silent | Relocation: offers / maybe / refuses / silent |
| ---------------------------------- | -------: | --------------------------------------- | --------------------------------------------- |
| Rules say "offers" (930)           |       60 | 20 / 1 / 13 / 26                        | 32 / 3 / 2 / 23                               |
| Rules say "refuses" (443)          |       40 | 1 / 3 / 36 / 0                          | 4 / 0 / 6 / 30                                |
| Rules silent, keywords (1,437)     |       60 | 1 / 0 / 9 / 50                          | 5 / 1 / 5 / 49                                |
| Rules silent, no keywords (10,653) |       40 | 0 / 0 / 1 / 39                          | 0 / 0 / 0 / 40                                |

| Rules on visas | Precision | Recall |
| -------------- | --------: | -----: |
| offers         |       33% |    90% |
| refuses        |       90% |    37% |

- **"Offers" is right a third of the time.** 22% of its hits are refusals ("visa sponsorship is not available",
  "a work permit is required" slip past the refusal patterns), and 43% say nothing about visas, mostly because
  they only offer relocation.
- **Relocation and visa are different promises.** Of the roles the rules mark "offers", about half offer
  relocation help, and only a third visa sponsorship. The site keeps them as two facts.
- **Refusals are precise but mostly missed.** 90% of "refuses" hits are real, but the rules find only 37% of all
  refusals.
- **Weighted to all open postings on discovered boards:** about 2.6% offer visa sponsorship (~350 roles), 8%
  refuse it, and 5% offer relocation help.
- **22% of open roles mention visas, relocation, permits, citizenship or the right to work at all** (a keyword
  list in English and the main languages in scope). The other 78% can only be "silent" on visas, because every
  verdict needs a quote. In the labelled set, 1 of 40 postings without the keywords said something: a Finnish
  "työskentelylupa" (work permit), now in the list.
- **The sentences repeat.** Half of the "offers" hits share their sentence with at least two other roles at the
  same company. It's company boilerplate, so a paragraph cache saves model calls.
- **About 2.5% of kept roles weren’t in Europe** (5 of 200): "Saskatoon, SK" read as Slovakia, "New South Wales"
  as Wales, "CZ Biohub" as Czechia, "Bristol, Rhode Island" as Bristol. Fixed 2026-10-23; the fix drops 127 open
  roles, all outside Europe.

## Languages

The rules find a required local language in 11% of German roles, 25% of Belgian, 16% of Austrian, 12% of Italian
and under 10% everywhere else. Most required: German, French, Dutch. A further 22% of German roles are written in
German, which says the same thing. The rules' precision here isn't measured yet; the labelled set covers it.

## Salary

- Posted in 12% of roles overall. By board: Recruitee 36%, Lever 30%, Ashby 23% (it has a salary field),
  Greenhouse 9%, Workable 7%, Personio 6%, SmartRecruiters 4%. By country: Lithuania 41%, Italy 35%, the
  Netherlands 24%, Spain and Ireland 17%, the UK 14%, Germany 9%, Belgium 3%.
- **Germany's Blue Card:** 183 German roles post a yearly euro range. 180 of them start at or above the 2026
  threshold for IT and other shortage jobs (€45,934.20), and 171 at or above the general one (€50,700). The median
  lower bound is €80,000. For software roles that post pay, the threshold is almost never the obstacle; the open
  question is the 91% of German roles that post none.

## Registers

- IND public register (Netherlands): 13,016 recognised sponsors. UK register of licensed sponsors, Skilled Worker
  route: 122,353. Both reload daily.
- Automatic name matching gives a candidate for 140 of 290 companies with Dutch roles and 501 of 923 with UK
  roles. Candidates aren't answers: "Wise" alone matches 20 UK entries.
- **Matching v2 by the posting naming the entity doesn't carry far.** Only 9 of 299 Dutch and 29 of 832 UK
  candidate companies have a posting that contains a candidate's exact register name.
- **What will work: a reviewed table for the biggest employers.** The 100 companies with the most roles hold 72%
  of Dutch and 52% of UK roles. An agent proposes the entity for each (register name, town, company number where
  the posting gives one), and the owner spot-checks. Everything else shows "register: not checked yet".

## Known gaps

- **Lever:** Common Crawl has no URLs on `jobs.lever.co` (its EU host gave 58), so Lever is under-covered.
  Lever's own sitemap or search engines' indexes are the next places to look.
- **Workday:** only the tenants on the seed list are read. Each tenant needs several requests per run; add more
  after the extractor runs.
- **Locations:** two-letter US state codes were read as countries ("Helena, MT" as Malta, "Dover, DE" as
  Germany). Fixed 2026-10-23. Postings listing dozens of countries ("Remote – Lithuania; Remote – Canada; …") are
  kept for every European one; the model should confirm the region.
- **Staffing agencies and job aggregators** have boards too; some post other companies' roles. They need a flag so
  their roles don't count as the agency sponsoring.

## Language model results

The extractor (`src/extract.ts`, prompt `prompts/extract-v1.md`) runs Claude Code in print mode on the owner's
Claude subscription: no API billing. It reads only the postings that mention visas, permits or relocation, sends
excerpts (the matching lines with their neighbours) 20 postings per call, answers in a JSON schema, and drops any
fact whose quote isn't in the posting. Scored on the labelled set, 2026-10-23, first prompt version:

| Model      | Visa offers: precision / recall | Visa refuses | Relocation offers | Languages exact | 161 postings, API-equivalent |
| ---------- | ------------------------------- | ------------ | ----------------- | --------------- | ---------------------------- |
| Rules      | 33% / 90%                       | 90% / 37%    | —                 | —               | —                            |
| Haiku 5.5  | 100% / 91%                      | 95% / 93%    | 95% / 98%         | 158 of 160      | $0.03                        |
| Sonnet 5.5 | 100% / 91%                      | 100% / 95%   | 98% / 92%         | 159 of 161      | $0.29                        |
| Opus 5.5   | **100% / 100%**                 | 98% / 96%    | 95% / 98%         | 159 of 161      | $0.70                        |

- All three clear the bar (precision ≥ 95% for "offers"). The sample is small: 22 postings offer visas, so a
  perfect score still means a 95% interval down to about 85%. The set grows as the owner reviews and as new
  postings are labelled.
- **Opus 5.5 is the model in use:** the only one that found every sponsorship statement, and on a flat-rate
  subscription the difference in use is small. The backfill of every open posting that mentions visas (~3,300) is
  about $15 API-equivalent, spread over a few nights; the daily new ones about $0.35.
- No quote had to be dropped: every quote the models gave is in its posting.
- Most remaining disagreements are hard cases: "must already live in X" (relocation refuses, or silent?),
  security clearance that a foreigner could obtain, and roles that turned out not to be in Europe.
- API-equivalent is what the same calls would cost on the API (`extraction_call.cost_usd`): it measures how much
  of the subscription's limits extraction uses. The earlier estimate for the API is in git history.

## What changes in the plan

- **M1 started with the labelled set**, before any extractor code; the regex numbers above are its baseline.
- **Visa and relocation verdicts only for the postings that mention them.** The others are "silent" without a
  model call, and a sample of them goes into the labelled set to check that the keyword list misses nothing.
- **Register review moves up.** For the Netherlands and the UK the register is the main answer. The reviewed
  table for the top 100 companies per country is M1 work, not later.
- **The design has to make "silent" useful.** Most roles say nothing; the job page leads with what the law and the
  registers say and treats the posting's own words as extra evidence.
