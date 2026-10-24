<script setup lang="ts">
// The visa answer for a role, in one of five states. Told apart by word, icon and shape, never by colour alone:
// round chips quote the posting, the square one ("Can sponsor") comes from the law or a register, dashed means
// nobody says yet. Screen readers hear "Visa: sponsors".
import type { VisaState } from "#shared/answers";

const { state, size = "sm" } = defineProps<{ state: VisaState; size?: "sm" | "md" }>();

const LOOK = {
  sponsors: {
    label: "Sponsors visa",
    spoken: "sponsors",
    class: "bg-accent text-accent-ink border-accent rounded-full",
  },
  may: {
    label: "May sponsor",
    spoken: "may sponsor",
    class: "bg-accent-tint text-accent border-accent-line rounded-full",
  },
  can: {
    label: "Can sponsor",
    spoken: "can sponsor, by law or register",
    class: "text-fg border-accent-line rounded-can",
  },
  unknown: {
    label: "Visa unknown",
    spoken: "unknown",
    class: "text-fg-2 border-unknown-line border-dashed rounded-full",
  },
  wont: {
    label: "Won't sponsor",
    spoken: "won't sponsor",
    class: "bg-refuse-tint text-refuse border-refuse-line rounded-full",
  },
} as const;

const look = computed(() => LOOK[state]);
const icon = computed(() => (size === "md" ? 16 : 14));
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 border font-medium leading-none whitespace-nowrap"
    :class="[look.class, size === 'md' ? 'h-8 px-3 text-sm' : 'h-7 px-2.5 text-xs']"
  >
    <span class="sr-only">Visa: {{ look.spoken }}</span>
    <svg
      aria-hidden="true"
      :width="icon"
      :height="icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      :class="state === 'can' || state === 'may' ? 'text-accent' : ''"
    >
      <template v-if="state === 'sponsors'">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M5.2 8.2l1.9 1.9 3.7-4" />
      </template>
      <template v-else-if="state === 'may'">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" stroke="none" />
      </template>
      <template v-else-if="state === 'can'">
        <path d="M2 6.2 8 2.5l6 3.7" />
        <path d="M2.5 13.5h11" />
        <path d="M4 7.5v4.5M6.67 7.5v4.5M9.33 7.5v4.5M12 7.5v4.5" />
      </template>
      <template v-else-if="state === 'wont'">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M3.6 3.6l8.8 8.8" />
      </template>
      <circle v-else cx="8" cy="8" r="6.25" stroke-dasharray="2.2 2.2" />
    </svg>
    <span aria-hidden="true">{{ look.label }}</span>
  </span>
</template>
