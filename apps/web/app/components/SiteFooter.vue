<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from "reka-ui";
import type { Theme } from "~/composables/useTheme";

const { roles = null, readAt = null } = defineProps<{ roles?: number | null; readAt?: string | null }>();
const theme = useTheme();
const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];
// A toggle group can be emptied by clicking the pressed item; the theme can't.
const choose = (v: unknown) => {
  if (v === "system" || v === "dark" || v === "light") theme.value = v;
};
</script>

<template>
  <footer class="border-t border-line bg-bg text-fg-2">
    <div
      class="mx-auto flex max-w-[1264px] flex-wrap justify-between gap-x-12 gap-y-6 px-4 pt-8 pb-10 md:px-8 md:pt-10 md:pb-12"
    >
      <div class="flex max-w-[560px] flex-[1_1_320px] flex-col gap-3">
        <p class="text-sm text-pretty">
          Answers come from the posting's own words and public registers. Not legal advice: confirm with the
          employer.
        </p>
        <p v-if="roles !== null" class="font-mono text-mono text-muted">
          {{ roles.toLocaleString("en-US") }} open roles<template v-if="readAt">
            · job boards read {{ readAt }}</template
          >
        </p>
      </div>
      <div class="flex flex-col gap-4">
        <nav aria-label="Footer">
          <ul class="-mx-2 flex flex-wrap gap-x-1 text-sm">
            <li>
              <NuxtLink to="/method" class="inline-flex min-h-11 items-center px-2 text-fg no-underline"
                >Method</NuxtLink
              >
            </li>
            <li>
              <NuxtLink to="/status" class="inline-flex min-h-11 items-center px-2 text-fg no-underline"
                >Status</NuxtLink
              >
            </li>
            <li>
              <UiExternalLink
                href="https://github.com/azamatos/visaproof"
                class="min-h-11 px-2 text-fg no-underline"
              >
                Code
              </UiExternalLink>
            </li>
            <li>
              <UiExternalLink href="https://azamatos.com" class="min-h-11 px-2 text-fg no-underline">
                azamatos.com
              </UiExternalLink>
            </li>
          </ul>
        </nav>
        <div class="inline-flex items-center gap-3">
          <span id="theme-label" class="text-sm">Theme</span>
          <ToggleGroupRoot
            :model-value="theme"
            type="single"
            aria-labelledby="theme-label"
            class="inline-flex gap-0.5 rounded-control border border-line p-[3px]"
            @update:model-value="choose"
          >
            <ToggleGroupItem
              v-for="t in THEMES"
              :key="t.value"
              :value="t.value"
              class="h-[38px] min-w-16 cursor-pointer rounded-[7px] px-3 text-sm text-fg-2 data-[state=on]:bg-fill data-[state=on]:text-fg"
            >
              {{ t.label }}
            </ToggleGroupItem>
          </ToggleGroupRoot>
        </div>
      </div>
    </div>
  </footer>
</template>
