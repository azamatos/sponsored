// Recorded HTTP responses for the adapter tests: "METHOD url body" → response text.
export type Fixture = {
  board: { ats: string; slug: string; eu: boolean };
  responses: Record<string, string>;
};

export function requestKey(input: string | URL | Request, init?: RequestInit) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const body = typeof init?.body === "string" ? ` ${init.body}` : "";
  return `${init?.method ?? "GET"} ${url}${body}`;
}
