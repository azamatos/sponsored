// For Docker's health check: the server answers, and so does the database.
export default defineEventHandler(async () => {
  await db()`select 1`;
  return "ok";
});
