// The theme: "system" follows the device; "dark" or "light" is the visitor's choice, kept in a cookie so the server
// renders the right colours on the first paint (no flash).
export type Theme = "system" | "dark" | "light";

export function useTheme() {
  const theme = useCookie<Theme>("theme", {
    default: () => "system",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  useHead({ htmlAttrs: { "data-theme": () => (theme.value === "system" ? undefined : theme.value) } });
  return theme;
}
