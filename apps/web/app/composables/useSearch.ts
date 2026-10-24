// The search's state lives in the URL, so a search can be shared and the back button works. Every change starts again
// at page 1; "clear" keeps the search text and drops the filters.
export function useSearch() {
  const route = useRoute();
  const router = useRouter();
  const param = (k: string) => {
    const v = route.query[k];
    return typeof v === "string" ? v : "";
  };
  const set = (changes: Record<string, string | undefined>) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...route.query, ...changes, page: changes.page }))
      if (typeof v === "string" && v) next[k] = v;
    void router.replace({ query: next });
  };
  const listOf = (k: string) => param(k).split(",").filter(Boolean);
  const toggle = (k: string, value: string, on: boolean) => {
    const now = new Set(listOf(k));
    if (on) now.add(value);
    else now.delete(value);
    set({ [k]: [...now].join(",") || undefined });
  };
  const filtered = computed(() => Object.keys(route.query).some((k) => !["q", "sort", "page"].includes(k)));
  const clear = () => void router.replace({ query: param("q") ? { q: param("q") } : {} });
  return { param, on: (k: string) => param(k) === "1", set, listOf, toggle, filtered, clear };
}
