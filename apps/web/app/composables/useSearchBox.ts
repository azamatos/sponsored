// The search box searches as you type, as developers expect from their tools: 0.4 s after the last key, from two
// letters ("Go", "Vue"); Enter searches at once, one letter too ("C", "R"); an emptied box shows every role again
// straight away. Typing never adds history entries.
const WAIT = 400;

export function useSearchBox() {
  const { param, set } = useSearch();
  const text = ref(param("q"));
  // What the URL was last told. The box follows the URL only when the URL changes from outside (a link to a
  // search, "Clear the search"), so a reply arriving mid-word never overwrites what was typed since.
  let sent = text.value;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const search = (q: string) => {
    clearTimeout(timer);
    if (q === sent) return;
    sent = q;
    set({ q: q || undefined });
  };
  watch(
    () => param("q"),
    (q) => {
      if (q === sent) return;
      sent = q;
      text.value = q;
    },
  );
  watch(text, (value) => {
    const q = value.trim();
    clearTimeout(timer);
    if (q === sent) return;
    if (!q) search("");
    else if (q.length >= 2)
      timer = setTimeout(() => {
        search(q);
      }, WAIT);
  });
  onBeforeUnmount(() => {
    clearTimeout(timer);
  });

  return {
    text,
    submit: () => {
      search(text.value.trim());
    },
    clear: () => {
      text.value = "";
    },
  };
}
