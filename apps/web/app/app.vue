<script setup lang="ts">
useTheme();
useHead({
  titleTemplate: (title) =>
    title ? `${title} · Visaproof` : "Visaproof: developer jobs in Europe, visa answer first",
});
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:bg-bg focus:p-2"
    >
      Skip to content
    </a>
    <SiteHeader />
    <NuxtPage />
    <SiteFooter />
  </div>
</template>
