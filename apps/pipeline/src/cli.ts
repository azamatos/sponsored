import { discoverCommonCrawl, seed } from "./discover.ts";
import { migrate, sql } from "./db.ts";
import { ingest } from "./ingest.ts";
import { loadRegisters, matchCompanies } from "./registers.ts";
import { report } from "./report.ts";
import { sample, score } from "./evaluation.ts";
import { extract } from "./extract.ts";
import { digest } from "./digest.ts";

const HELP = `node src/cli.ts <command>

  migrate                 apply new SQL migrations
  seed <file.json>        add boards from a list of { ats, slug, eu?, company? }
  discover [crawls]       add boards seen by Common Crawl (default: the last 2 crawls)
  ingest [--all] [ats:slug …]
                          read the boards that are due (or all, or only these) into Postgres
  registers               reload the IND and UK sponsor registers, then match companies
  match                   match companies to the registers again
  report                  print the numbers as Markdown
  digest                  print the summary of the last 24 hours (deploy/digest.sh sends it)
  extract [--model m] [--limit n] [--labelled] [--effort e]
                          read the open postings that mention visas with Claude Code (or the labelled set)
  eval-sample             print the postings to label, as JSON lines (texts: keep them out of git)
  eval-score [model]      score the rules (and a model's extractions) against eval/labels.jsonl
  daily                   migrate, registers, ingest, match (what the timer runs)`;

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case "migrate":
      await migrate();
      break;
    case "seed": {
      const file = args[0];
      if (!file) throw new Error("seed needs a file: node src/cli.ts seed <file.json>");
      await seed(file);
      break;
    }
    case "discover":
      await discoverCommonCrawl(Number(args[0] ?? 2));
      break;
    case "ingest":
      await ingest({ all: args.includes("--all"), only: args.filter((a) => a.includes(":")) });
      break;
    case "registers":
      await loadRegisters();
      break;
    case "match":
      await matchCompanies();
      break;
    case "report":
      await report();
      break;
    case "digest":
      await digest();
      break;
    case "eval-sample":
      await sample();
      break;
    case "eval-score":
      await score(args[0] ?? "");
      break;
    case "extract": {
      const opt = (name: string) => {
        const i = args.indexOf(`--${name}`);
        return i >= 0 ? args[i + 1] : undefined;
      };
      await extract({
        model: opt("model") ?? "opus",
        limit: Number(opt("limit") ?? 500),
        labelled: args.includes("--labelled"),
        effort: opt("effort") ?? "",
      });
      break;
    }
    case "daily":
      await migrate();
      await ingest();
      await loadRegisters();
      break;
    default:
      console.log(HELP);
      process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
