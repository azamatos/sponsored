# Memory bank

Everything a person or an agent needs to continue the work without the chat history. Read `activeContext.md`
first, then whatever the task touches.

| File                                   | What it holds                                                                             | Changes                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------- |
| [projectbrief.md](projectbrief.md)     | what this is, who it's for, why it exists, competitors, what success looks like           | rarely                          |
| [productContext.md](productContext.md) | features, MVP scope, visa rules with sources, data and content rules                      | when product rules change       |
| [techContext.md](techContext.md)       | architecture, packages, extraction and evaluation, data model, ops, sources and registers | when the technical plan changes |
| [activeContext.md](activeContext.md)   | current state, decisions waiting for the owner, next step, open questions                 | every work session              |
| [progress.md](progress.md)             | milestones with done-criteria and target dates, done log                                  | when a milestone moves          |

## Rules

- Update `activeContext.md` and `progress.md` at the end of every work session.
- Write facts, not plans dressed as facts: mark anything not built yet as _planned_.
- Absolute dates (`2026-10-17`), never "yesterday".
- This folder is public with the repo: no secrets, nothing private about the owner.
