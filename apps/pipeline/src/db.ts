import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

export const sql = postgres(process.env.DATABASE_URL ?? "postgres://jobs:jobs@localhost:5432/jobs", {
  max: 8,
  onnotice: () => {},
});

const MIGRATIONS = path.join(import.meta.dirname, "..", "migrations");

// Plain SQL files, applied once each, in name order.
export async function migrate() {
  await sql`create table if not exists _migration (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql<{ name: string }[]>`select name from _migration`).map((r) => r.name));
  for (const file of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(path.join(MIGRATIONS, file), "utf8"));
      await tx`insert into _migration (name) values (${file})`;
    });
    console.log(`migrated ${file}`);
  }
}

export async function startRun(kind: string) {
  const [r] = await sql<{ id: number }[]>`insert into run (kind) values (${kind}) returning id`;
  if (!r) throw new Error("starting a run returned no row");
  return r.id;
}

export async function finishRun(id: number, stats: object) {
  await sql`update run set finished_at = now(), stats = ${sql.json(stats as never)} where id = ${id}`;
}
