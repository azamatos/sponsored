<script setup lang="ts" generic="T extends string">
// A dropdown in the design's style, on Reka UI's Select: the listbox semantics, arrow keys and type-ahead, Escape,
// and focus back on the button come from Reka; the look comes from the tokens (a border and the surface tint, no
// shadow). Opens under the button, aligned to its end, never covering it.
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";

const { options, label } = defineProps<{ options: readonly { value: T; label: string }[]; label: string }>();
const model = defineModel<T>({ required: true });
const choose = (v: unknown) => {
  const hit = options.find((o) => o.value === v);
  if (hit) model.value = hit.value;
};
</script>

<template>
  <SelectRoot :model-value="model" @update:model-value="choose">
    <SelectTrigger
      :aria-label="label"
      class="group inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border border-line bg-bg pr-3 pl-3.5 text-sm text-fg hover:border-line-strong data-[state=open]:border-line-strong"
    >
      <!-- our own text, so the server renders the choice too (Reka fills SelectValue in only in the browser) -->
      <SelectValue>{{ options.find((o) => o.value === model)?.label }}</SelectValue>
      <SelectIcon as-child>
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
          class="text-fg-2 transition-transform duration-150 group-data-[state=open]:rotate-180"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        side="bottom"
        align="end"
        :side-offset="6"
        class="z-50 min-w-(--reka-select-trigger-width) overflow-hidden rounded-control border border-line-strong bg-bg text-fg data-[state=open]:animate-[select-in_120ms_ease-out]"
      >
        <SelectViewport class="flex flex-col gap-0.5 p-1">
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            class="flex h-11 cursor-pointer items-center justify-between gap-6 rounded-[7px] pr-2.5 pl-3 text-sm outline-none select-none data-highlighted:bg-surface-hover data-[state=checked]:font-medium"
          >
            <SelectItemText>{{ o.label }}</SelectItemText>
            <SelectItemIndicator class="text-accent">
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3.5 8.5l3 3 6-6.5" />
              </svg>
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<style>
@keyframes select-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
</style>
