# Register reviews

`registers.jsonl`: whether each of the biggest employers is on a sponsor register, decided by review, one line per
company and register. Load it with `node src/cli.ts reviews reviews/registers.jsonl`; every "listed" must name an
entry on the register at that moment, or nothing loads.

- `register`: `nl_ind` (IND recognised sponsors) or `uk_worker` (Home Office licensed sponsors, Skilled Worker).
- `verdict`: `listed` (with `entry_name`, the register's name for it, character for character), `not_listed`, or
  `unsure` (the employer couldn't be established, or the board posts for several companies or for clients).
- `evidence`: how the legal entity was found (its site, its postings, a company registry number matching the
  register's) and checked.
- `reviewed_by`: `agent` or `owner`. The owner spot-checks agent reviews; a correction changes the line and sets
  `owner`.

The first round (2026-10-24): the 100 companies with the most roles in the Netherlands and the 100 with the most in
the UK, by agents with web research: 142 listed, 40 not listed, 18 unsure.
