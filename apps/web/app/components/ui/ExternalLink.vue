<script setup lang="ts">
// A link to another site. It opens in a new tab, so a search here isn't lost, and it says so: the design's "external"
// arrow for the eye, and words for a screen reader. Links within Visaproof use NuxtLink and stay in the tab.
const { href, icon = true } = defineProps<{ href: string; icon?: boolean }>();
</script>

<template>
  <a :href="href" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5">
    <slot />
    <svg
      v-if="icon"
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="flex-none opacity-70"
    >
      <path d="M9.5 2.5h4v4M13.5 2.5l-6 6M11.5 9.5v3a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3" />
    </svg>
    <span class="sr-only">(opens in a new tab)</span>
  </a>
</template>
