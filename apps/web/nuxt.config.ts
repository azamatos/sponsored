import tailwindcss from "@tailwindcss/vite";

// Visaproof's site: server-rendered pages that read the pipeline's Postgres (NUXT_DATABASE_URL).
export default defineNuxtConfig({
  compatibilityDate: "2026-10-24",
  devtools: { enabled: false },
  modules: ["@nuxt/fonts"],
  css: ["~/assets/css/main.css"],
  vite: { plugins: [tailwindcss()] },
  // Self-hosted at build time: no request to Google from a visitor's browser.
  fonts: {
    families: [
      { name: "Geist", provider: "google", weights: [400, 500] },
      { name: "Space Mono", provider: "google", weights: [400] },
    ],
  },
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "color-scheme", content: "dark light" },
      ],
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    },
  },
  runtimeConfig: { databaseUrl: "postgres://sponsored@localhost:5433/sponsored" },
  typescript: { strict: true },
});
