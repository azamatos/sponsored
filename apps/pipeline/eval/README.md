# Labelled set

200 open postings from discovered boards, labelled by hand, to measure the rules and the language model. Drawn
2026-10-23 with `node src/cli.ts eval-sample`, in four strata (`strata.json`): what the rules say (offers, refuses),
and, where they say nothing, whether the text mentions visas or relocation at all. One posting per company per
stratum.

- `labels.jsonl`: one line per posting: its key (`ats:slug:externalId`), the content hash it was labelled at, the
  stratum and the labels. Postings aren't republished: the texts stay in the database, and only short quotes are
  kept here.
- `strata.json`: how many open postings each stratum held, so the scores can be weighted to all postings.
- Score: `node src/cli.ts eval-score` (against the database that holds the texts).

## How to label

Read the whole posting. Label what it says about **this role**, in its European location. A statement about
another country ("full US visa support for our San Francisco office") doesn't count.

### `visa`: will the employer sponsor a work visa or permit?

| Value     | When                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `offers`  | It says it sponsors or supports visas or work permits for this role: "visa sponsorship available", "we sponsor visas", "we help with visas and permits", "Blue Card support". "For the right candidate" still counts.                        |
| `maybe`   | Hedged or not for this role: "visa sponsorship may be available for select positions", "case by case", "depending on the role".                                                                                                              |
| `refuses` | It won't sponsor, or requires what a visa applicant doesn't have: "unable to sponsor", "must have the right to work in the UK", "valid EU work permit required", "EU citizenship required". "…or eligible for sponsorship" is not a refusal. |
| `silent`  | Nothing about visas, permits or the right to work.                                                                                                                                                                                           |

### `relocation`: will the employer help the person move?

| Value     | When                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| `offers`  | Relocation package, support, assistance, allowance, bonus or help moving, for this role.                             |
| `maybe`   | Hedged: "relocation support where applicable", "may include relocation", a benefits list that varies by country.     |
| `refuses` | "No relocation", "relocation not offered", "only candidates already based in <country>".                             |
| `silent`  | Nothing about relocation. Being asked to be "based in" or "commutable to" a city, alone, is `silent`, not `refuses`. |

### Quotes

`visaQuote` and `relocationQuote`: for every value except `silent`, the shortest passage that carries the fact,
**copied exactly** from the text (same case, same punctuation; it must be a substring of the text). `null` when
`silent`.

### `languages`

Languages other than English the role **requires** (lower case, English names: `german`, `dutch`, `french`…).
"Nice to have" or "a plus" doesn't count. A posting written entirely in another language counts as requiring it.

### `note`

Optional, short: why a hard case got its label.
