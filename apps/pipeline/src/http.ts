// One way out to the internet for every source: an honest User-Agent, a queue per site so no site gets more than
// a few requests at a time, retries on 429 and 5xx (honouring Retry-After), and a timeout per request.

export const USER_AGENT = "jobs-azamatos-bot/0.1 (+https://azamatos.com)";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
};

type Host = { active: number; last: number; waiting: (() => void)[] };
const hosts = new Map<string, Host>();
const LIMITS = { perHost: 2, gapMs: 300 };
// Sites that answered the first full sweep with 429s at the default pace (2026-10-22).
const SITE_LIMITS = new Map([["workable.com", { perHost: 1, gapMs: 1000 }]]);

// For tests: one pace for every site.
export function setHostLimits(perHost: number, gapMs: number) {
  LIMITS.perHost = perHost;
  LIMITS.gapMs = gapMs;
  SITE_LIMITS.clear();
}

// The queue a host shares: its last two labels, so every company's subdomain on one board type (acme.recruitee.com,
// acme.jobs.personio.de) counts against the same site.
export const siteOf = (host: string) => host.split(".").slice(-2).join(".");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquire(site: string) {
  const limits = SITE_LIMITS.get(site) ?? LIMITS;
  let h = hosts.get(site);
  if (!h) hosts.set(site, (h = { active: 0, last: 0, waiting: [] }));
  while (h.active >= limits.perHost) await new Promise<void>((r) => h.waiting.push(r));
  h.active++;
  const wait = h.last + limits.gapMs - Date.now();
  h.last = Math.max(Date.now(), h.last + limits.gapMs);
  if (wait > 0) await sleep(wait);
  return () => {
    h.active--;
    h.waiting.shift()?.();
  };
}

export async function fetchText(url: string, opts: Options = {}): Promise<string> {
  const { method = "GET", body, headers = {}, timeout = 30_000, retries = 2 } = opts;
  const site = siteOf(new URL(url).hostname);
  let last: Error = new Error("no attempt");
  for (let attempt = 0; attempt <= retries; attempt++) {
    const release = await acquire(site);
    let wait: number;
    try {
      const res = await fetch(url, {
        method,
        body,
        headers: { "User-Agent": USER_AGENT, "Accept-Language": "en", ...headers },
        signal: AbortSignal.timeout(timeout),
        redirect: "follow",
      });
      const text = await res.text();
      if (res.ok) return text;
      last = new HttpError(res.status, `HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) throw last;
      const retryAfter = Number(res.headers.get("retry-after"));
      wait = retryAfter > 0 ? Math.min(retryAfter * 1000, 60_000) : 3000 * (attempt + 1) ** 2;
    } catch (e) {
      if (e instanceof HttpError && e.status !== 429 && e.status < 500) throw e;
      last = e instanceof Error ? e : new Error(String(e));
      wait = 3000 * (attempt + 1) ** 2;
    } finally {
      release();
    }
    if (attempt < retries) await sleep(wait);
  }
  throw last;
}

// The caller names the shape it expects; nothing checks it, so read optional fields defensively.
export async function fetchJson<T>(url: string, opts: Options = {}): Promise<T> {
  const text = await fetchText(url, { ...opts, headers: { Accept: "application/json", ...opts.headers } });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`not JSON: ${text.slice(0, 60).replace(/\s+/g, " ")}`);
  }
}

export const postJson = <T>(url: string, data: unknown, opts: Options = {}) =>
  fetchJson<T>(url, {
    ...opts,
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json", ...opts.headers },
  });

// Runs fn over items with at most `size` running at once. The workers share one iterator, so each item runs once.
export async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const next = items.values();
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (const item of next) await fn(item);
    }),
  );
}
