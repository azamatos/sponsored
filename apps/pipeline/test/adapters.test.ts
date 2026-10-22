import { readdirSync, readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ADAPTERS, type Ats } from "../src/adapters/index.ts";
import { setHostLimits } from "../src/http.ts";
import { requestKey, type Fixture } from "./replay.ts";

// Each adapter against a real board's recorded responses (scripts/record-fixture.ts).
const dir = new URL("./fixtures/", import.meta.url);
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Fixture);

beforeAll(() => {
  setHostLimits(8, 0);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(fixtures.map((f) => [f.board.ats, f] as const))("%s adapter", (_, f) => {
  it("reads the recorded board into postings with plain-text descriptions", async () => {
    vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
      const body = f.responses[requestKey(input, init)];
      return Promise.resolve(new Response(body ?? "", { status: body === undefined ? 404 : 200 }));
    });
    const board = { ...f.board, ats: f.board.ats as Ats };
    const { postings } = await ADAPTERS[board.ats](board);
    expect(postings.length).toBeGreaterThan(0);
    for (const p of postings) {
      expect(p.externalId).not.toBe("");
      expect(p.title).not.toBe("");
      expect(p.url).toMatch(/^https:\/\//);
    }
    const first = postings[0];
    if (!first) throw new Error("no postings");
    const text = first.description ?? (await first.detail?.())?.description ?? "";
    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toMatch(/<\/?(p|div|li|br|ul)\b/i);
    expect(
      postings.map(({ externalId, title, url, location, remote, hybrid, postedAt, salary }) => ({
        externalId,
        title,
        url,
        location,
        remote,
        hybrid,
        postedAt,
        salary,
      })),
    ).toMatchSnapshot();
  });
});
