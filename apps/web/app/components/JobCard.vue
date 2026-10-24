<script setup lang="ts">
import type { RoleCard } from "#shared/answers";

const { job } = defineProps<{ job: RoleCard }>();
const LANGUAGE = (l: string) => l.charAt(0).toUpperCase() + l.slice(1);
const language = computed(() =>
  job.languages === null
    ? null
    : job.languages.length
      ? `${job.languages.map(LANGUAGE).join(", ")} required`
      : "English only",
);
</script>

<template>
  <article class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
    <div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div class="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
        <h3 class="text-lg font-medium text-pretty">
          <NuxtLink :to="`/jobs/${job.id}`" class="text-fg no-underline hover:underline">{{
            job.title
          }}</NuxtLink>
        </h3>
        <p class="text-sm text-fg-2 text-pretty">
          {{ job.company }} · {{ job.place }}<template v-if="job.workMode"> · {{ job.workMode }}</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <VisaChip :state="job.visa" />
        <RelocChip v-if="job.relocation !== 'silent'" :state="job.relocation" />
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-2">
      <span
        v-if="language"
        class="inline-flex items-center gap-1.5"
        :class="job.languages?.length ? 'font-medium text-fg' : ''"
      >
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="8" cy="8" r="6.25" />
          <path
            d="M1.75 8h12.5M8 1.75c1.8 1.9 2.6 3.9 2.6 6.25S9.8 12.35 8 14.25C6.2 12.35 5.4 10.35 5.4 8S6.2 3.65 8 1.75z"
          />
        </svg>
        {{ language }}
      </span>
      <span v-if="job.salary" class="inline-flex items-center gap-1.5 text-fg">
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="1.75" y="4" width="12.5" height="8" rx="1.25" />
          <circle cx="8" cy="8" r="1.75" />
        </svg>
        {{ job.salary }}
      </span>
      <span class="font-mono text-mono text-muted"
        ><span class="sr-only">First seen </span>{{ job.firstSeen }}</span
      >
    </div>
  </article>
</template>
