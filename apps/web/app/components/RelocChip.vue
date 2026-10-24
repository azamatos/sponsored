<script setup lang="ts">
// The relocation answer: a separate promise from the visa one (many postings pay for the move and say nothing about
// permits, and the other way round). Screen readers hear "Relocation: helps you move".
import type { RelocationState } from "#shared/answers";

const { state, size = "sm" } = defineProps<{ state: RelocationState; size?: "sm" | "md" }>();

const LOOK = {
  helps: { label: "Helps you move", class: "bg-fill text-fg border-line-strong" },
  may: { label: "May help you move", class: "text-fg border-line" },
  no: { label: "No relocation", class: "bg-refuse-tint text-refuse border-refuse-line" },
  silent: { label: "Says nothing", class: "text-fg-2 border-unknown-line border-dashed" },
} as const;

const look = computed(() => LOOK[state]);
const icon = computed(() => (size === "md" ? 16 : 14));
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border font-medium leading-none whitespace-nowrap"
    :class="[look.class, size === 'md' ? 'h-8 px-3 text-sm' : 'h-7 px-2.5 text-xs']"
  >
    <span class="sr-only">Relocation: {{ look.label.toLowerCase() }}</span>
    <svg
      aria-hidden="true"
      :width="icon"
      :height="icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      :stroke-dasharray="state === 'silent' ? '2 1.6' : undefined"
      :class="state === 'may' || state === 'silent' ? 'text-fg-2' : ''"
    >
      <path
        d="M3.5 5h9A1.5 1.5 0 0 1 14 6.5V12a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V6.5A1.5 1.5 0 0 1 3.5 5z"
      />
      <path v-if="state !== 'silent'" d="M5.75 5V3.5a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1V5" />
      <path v-if="state === 'no'" d="M1.5 2l13 13" />
    </svg>
    <span aria-hidden="true">{{ look.label }}</span>
  </span>
</template>
