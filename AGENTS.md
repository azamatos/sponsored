# Sponsored: instructions for coding agents

A public job finder for developers who need a visa to work in Europe: open roles read from companies' own job
boards, with an evidence-backed answer to "will they sponsor a visa, and will they help me relocate?" for each.
Owner: Azamat Jorayev (azamatos). Applies to every agent tool; Claude Code also reads `CLAUDE.md`.

**Status (2026-10-23):** the data pipeline runs on a server every 6 hours; there's no website yet. Current state
and the next step: `docs/memory-bank/activeContext.md`.

## Read first

1. `docs/memory-bank/activeContext.md`: where things stand, decisions waiting for the owner, the next step.
2. `docs/findings.md`: what the real data looks like (sizes, coverage, what the rules get wrong). It decides scope.
3. As the task needs: `projectbrief.md` (what and why), `productContext.md` (features, verdicts, visa rules, data
   rules), `techContext.md` (architecture, data model, sources, ops), `progress.md` (milestones).
4. On the owner's machine, `CLAUDE.local.md` (git-ignored) has private notes: read it if it exists, and never copy
   anything from it into the repo.

## Repo layout

| Path                       | What                                                                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/pipeline`            | Node 22 + TypeScript, run directly (type stripping, no build). Job-board adapters, location and role rules, visa signals, sponsor registers, Common Crawl discovery, Postgres. CLI: `node src/cli.ts`. |
| `apps/pipeline/migrations` | Plain SQL, applied in name order by `cli.ts migrate`.                                                                                                                                                  |
| `deploy/`                  | Docker Compose, systemd timers and the deploy script for the server (`deploy/README.md`).                                                                                                              |
| `docs/`                    | Findings and the memory bank.                                                                                                                                                                          |

## Commands

```sh
pnpm install
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test   # what CI runs
pnpm --filter @sponsored/pipeline cli <command>                  # against DATABASE_URL (default: local Postgres)
```

## Rules

1. **The repo is public.** No secrets, no server addresses, nothing private about the owner. Private context lives
   only in `CLAUDE.local.md` on the owner's machine.
2. **Only official public feeds.** Companies' job-board APIs, Common Crawl's index and government registers. Never
   scrape LinkedIn, Indeed or a site whose terms forbid it. Send the honest User-Agent in `src/http.ts`, keep the
   per-host limits (2 at a time, 300 ms apart), and read each board at most once per run.
3. **Don't republish postings.** Show the title, company, location, extracted facts and short quotes; link to the
   original for the full text and for applying. The full text is stored for extraction and evaluation only.
   Honour removal requests.
4. **Every verdict carries its evidence:** a quote that is an exact substring of the posting, or a register entry.
   "Unknown" is a valid answer. Never infer sponsorship from company size, reputation or another posting.
5. **Rule-based signals are never shown as verdicts.** They are a pre-filter and the baseline the extractor has to
   beat (`docs/findings.md` shows why).
6. **Legal facts are dated and sourced.** Thresholds and register rules live in `productContext.md` with a source
   URL and a "checked" date.
7. **Open decisions stay open until the owner decides** (list in `activeContext.md`). Propose with a
   recommendation; don't pick silently. Reversible engineering choices are recorded there with the reason.
8. **Default stack and quality bar** come from the owner's defaults: TypeScript strict, pnpm, ESLint
   (`strictTypeChecked`) + Prettier, Vitest, Playwright + axe for the site, GitHub Actions, Lighthouse ≥ 95.
9. **Tests come with the change:** an adapter gets a test against a saved real response
   (`apps/pipeline/test/fixtures`); the extractor gets scored against the labelled set before a prompt or model
   change is merged.
10. **Memory bank:** update `activeContext.md` and `progress.md` at the end of every work session. Absolute dates.
    Mark what isn't built yet as _planned_.

## Working with the owner

- The owner writes in English. Commit with Conventional Commits.
- Ask first before: DNS changes, anything on the server outside `/srv/sponsored` and its `sponsored-*` systemd
  units, paid services (LLM API keys, databases), deleting anything in the owner's accounts.
- Never ask for tokens in chat; the owner stores secrets (`gh secret set`, the server's `.env`).
- Dev port for the site: **4003**.
