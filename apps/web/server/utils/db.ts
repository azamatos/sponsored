import postgres from "postgres";

// One pool per server process. The site only reads; the pipeline writes.
let pool: postgres.Sql | undefined;

export function db() {
  pool ??= postgres(useRuntimeConfig().databaseUrl, { max: 10, idle_timeout: 30, onnotice: () => {} });
  return pool;
}
