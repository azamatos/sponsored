# Visaproof

Visa-friendly developer jobs in Europe, with the evidence for every answer. Coming to
[visaproof.azamatos.com](https://visaproof.azamatos.com).

> **Status: in development.** The data pipeline runs every 6 hours; the website isn't built yet. The repo keeps
> its working name, `sponsored`.

A free job finder for software developers who need a visa to work in Europe. It reads open roles straight from
companies' own job boards and answers the questions a relocating developer asks first, with proof:

- **Will they sponsor a visa? Will they help me relocate?** Two separate answers, each with the exact sentence
  from the posting ("we sponsor visas for the right candidate") and the employer's entry in an official sponsor
  register where one exists.
- **Can I actually get the permit?** In the Netherlands only an IND recognised sponsor can hire a Highly Skilled
  Migrant. In the UK the employer needs a sponsor licence. In Germany any employer can hire on an EU Blue Card if
  the salary clears the threshold. The site checks what it can and says what it can't.
- **Do I need the local language?** "German required" is pulled out of the posting, so you can filter it away.
- **Is it still open?** Every role is re-checked against the company's board several times a day.

## How it works

```
company job boards (Ashby, Greenhouse, Lever, SmartRecruiters,     Common Crawl index
Personio, Recruitee, Workable, Workday)                            (finds new boards weekly)
                │                                                         │
                ▼                                                         ▼
     pipeline, every 6 hours (Node + TypeScript, Docker, systemd timers on a small server)
     read board → engineering roles in Europe → new / changed / closed → facts from the text
                │                         ▲
                ▼                         │ daily
            Postgres  ◀───────────  sponsor registers (Dutch IND, UK Home Office)
                │
                ▼
     website (planned): search, filters, job pages with the evidence, method and accuracy
```

1. A board is read in one request where its API allows it; a few boards need one more request per new role.
2. Only software engineering roles in the EU, EEA, UK and Switzerland are kept.
3. Employers are matched against the official registers.
4. A language model reads each new or changed posting and returns structured facts with verified quotes
   (planned). A hand-labelled test set measures how often it's right, and the numbers are published.

What the first runs found is in [docs/findings.md](docs/findings.md).

## What it isn't

- Not legal advice. Visa rules change; the site links to official sources and shows when it last checked.
- Not a copy of the postings. It shows extracted facts and short quotes, then sends you to the original.
- Not a recruiter. No accounts, no CV uploads, no tracking beyond privacy-friendly page counts.

## Run it

Needs Node 22.18+, pnpm 10 and a Postgres database.

```sh
pnpm install
export DATABASE_URL=postgres://user:pass@localhost:5432/sponsored
cd apps/pipeline
node src/cli.ts migrate
node src/cli.ts seed boards.json          # [{ "ats": "greenhouse", "slug": "example" }, …]
node src/cli.ts ingest                    # read the boards
node src/cli.ts registers                 # load the IND and UK registers, match companies
node src/cli.ts report                    # the numbers, as Markdown
```

The server setup (Docker Compose, timers, deploy) is in [deploy/README.md](deploy/README.md).

## Docs

- `AGENTS.md`: instructions for coding agents.
- `docs/memory-bank/`: the brief, product spec, technical plan, roadmap and current state.

## License

MIT. Built by [Azamat Jorayev](https://azamatos.com).
