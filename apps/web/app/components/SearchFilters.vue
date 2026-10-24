<script setup lang="ts">
import {
  CheckboxIndicator,
  CheckboxRoot,
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
  RadioGroupIndicator,
  RadioGroupItem,
  RadioGroupRoot,
  SwitchRoot,
  SwitchThumb,
  ToggleGroupItem,
  ToggleGroupRoot,
} from "reka-ui";
import { FAMILIES, MODES, SENIORITY, VISA_LEVELS, type VisaLevel, WITHIN } from "#shared/answers";
import { countryName } from "#shared/countries";

// Every filter with its count: what choosing it would leave. The same panel is the sidebar on a desktop and the
// sheet on a phone.
type Counts = {
  levels: Record<VisaLevel, number>;
  countries: { code: string; n: number }[];
  relocation: number;
  noLanguage: number;
  salary: number;
  families: Record<string, number>;
  seniority: Record<string, number>;
  modes: Record<string, number>;
  within: Record<string, number>;
};
const { counts = null, total = 0 } = defineProps<{ counts?: Counts | null; total?: number }>();
const { param, on, set, listOf, toggle } = useSearch();

const n = (x: number | undefined) => (x ?? 0).toLocaleString("en-US");
const allCountries = ref(false);
const countries = computed(() => (counts?.countries ?? []).slice(0, allCountries.value ? undefined : 6));
const pressed = (k: string) => listOf(k);
const pick = (k: string, next: unknown) =>
  set({ [k]: Array.isArray(next) && next.length ? next.join(",") : undefined });
</script>

<template>
  <div class="flex flex-col">
    <CollapsibleRoot default-open class="border-t border-line">
      <h3>
        <CollapsibleTrigger
          class="flex h-12 w-full cursor-pointer items-center justify-between text-[15px] font-medium"
        >
          Visa
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
        <RadioGroupRoot
          :model-value="param('visa') || 'open'"
          aria-label="Visa"
          class="flex flex-col pb-3"
          @update:model-value="(v) => set({ visa: v === 'open' ? undefined : String(v) })"
        >
          <label
            v-for="l in VISA_LEVELS"
            :key="l.key"
            class="flex min-h-11 cursor-pointer items-center gap-3"
          >
            <RadioGroupItem
              :value="l.key"
              class="grid size-5 flex-none cursor-pointer place-items-center rounded-full border-[1.5px] border-line-strong data-[state=checked]:border-accent"
            >
              <RadioGroupIndicator class="size-[9px] rounded-full bg-accent" />
            </RadioGroupItem>
            <span class="flex-1 text-sm">{{ l.label }}</span>
            <span class="font-mono text-mono text-muted">{{ n(counts?.levels[l.key]) }}</span>
          </label>
        </RadioGroupRoot>
      </CollapsibleContent>
    </CollapsibleRoot>

    <CollapsibleRoot default-open class="border-t border-line">
      <h3>
        <CollapsibleTrigger
          class="flex h-12 w-full cursor-pointer items-center justify-between text-[15px] font-medium"
        >
          Moving and language
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent class="flex flex-col pb-3">
        <label
          v-for="s in [
            { k: 'relocation', label: 'Helps you move', count: counts?.relocation },
            { k: 'nolang', label: 'No local language needed', count: counts?.noLanguage },
          ]"
          :key="s.k"
          class="flex min-h-12 cursor-pointer items-center gap-3"
        >
          <span class="flex-1 text-sm">{{ s.label }}</span>
          <span class="font-mono text-mono text-muted">{{ n(s.count) }}</span>
          <SwitchRoot
            :model-value="on(s.k)"
            class="flex h-6 w-10 flex-none cursor-pointer items-center rounded-full bg-line-strong p-[3px] data-[state=checked]:bg-accent"
            @update:model-value="(v) => set({ [s.k]: v ? '1' : undefined })"
          >
            <SwitchThumb
              class="size-[18px] rounded-full bg-white transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-ink"
            />
          </SwitchRoot>
        </label>
      </CollapsibleContent>
    </CollapsibleRoot>

    <CollapsibleRoot default-open class="border-t border-line">
      <h3>
        <CollapsibleTrigger
          class="flex h-12 w-full cursor-pointer items-center justify-between text-[15px] font-medium"
        >
          Country
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m4 6 4 4 4-4" />
          </svg>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent class="flex flex-col pb-2">
        <label v-for="c in countries" :key="c.code" class="flex min-h-11 cursor-pointer items-center gap-3">
          <CheckboxRoot
            :model-value="listOf('country').includes(c.code)"
            class="grid size-5 flex-none cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-line-strong text-accent-ink data-[state=checked]:border-accent data-[state=checked]:bg-accent"
            @update:model-value="(v) => toggle('country', c.code, v === true)"
          >
            <CheckboxIndicator>
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
            </CheckboxIndicator>
          </CheckboxRoot>
          <span class="flex-1 text-sm">{{ countryName(c.code) }}</span>
          <span class="font-mono text-mono text-muted">{{ n(c.n) }}</span>
        </label>
        <button
          v-if="(counts?.countries.length ?? 0) > 6"
          type="button"
          class="h-11 cursor-pointer self-start text-sm text-accent underline underline-offset-[3px]"
          @click="allCountries = !allCountries"
        >
          {{ allCountries ? "Fewer countries" : `All ${counts?.countries.length} countries` }}
        </button>
      </CollapsibleContent>
    </CollapsibleRoot>

    <label class="flex min-h-14 cursor-pointer items-center gap-3 border-t border-line py-3">
      <span class="flex flex-1 flex-col gap-0.5 text-[15px] leading-5 font-medium">
        Salary posted
        <span class="text-xs font-normal text-fg-2">Leaves {{ n(counts?.salary) }} of {{ n(total) }}</span>
      </span>
      <SwitchRoot
        :model-value="on('salary')"
        class="flex h-6 w-10 flex-none cursor-pointer items-center rounded-full bg-line-strong p-[3px] data-[state=checked]:bg-accent"
        @update:model-value="(v) => set({ salary: v ? '1' : undefined })"
      >
        <SwitchThumb
          class="size-[18px] rounded-full bg-white transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-accent-ink"
        />
      </SwitchRoot>
    </label>

    <CollapsibleRoot
      v-for="g in [
        { k: 'family', title: 'Role', items: FAMILIES, counts: counts?.families },
        { k: 'seniority', title: 'Seniority', items: SENIORITY, counts: counts?.seniority },
        { k: 'mode', title: 'Work mode', items: MODES, counts: counts?.modes },
      ]"
      :key="g.k"
      :default-open="pressed(g.k).length > 0"
      class="border-t border-line"
    >
      <h3>
        <CollapsibleTrigger
          class="flex h-12 w-full cursor-pointer items-center justify-between text-[15px] font-medium"
        >
          {{ g.title }}
          <span class="inline-flex items-center gap-2 text-xs font-normal text-fg-2">
            {{ pressed(g.k).length ? `${pressed(g.k).length} chosen` : "Any" }}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent class="pb-3">
        <ToggleGroupRoot
          type="multiple"
          :model-value="pressed(g.k)"
          :aria-label="g.title"
          class="flex flex-wrap gap-2"
          @update:model-value="(v) => pick(g.k, v)"
        >
          <ToggleGroupItem
            v-for="item in g.items"
            :key="item.key"
            :value="item.key"
            class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-line px-3 text-sm data-[state=on]:border-accent data-[state=on]:bg-accent-tint"
          >
            {{ item.label }}
            <span class="font-mono text-mono text-muted">{{ n(g.counts?.[item.key]) }}</span>
          </ToggleGroupItem>
        </ToggleGroupRoot>
        <p v-if="g.k === 'seniority'" class="pt-2 text-xs text-fg-2">
          Almost half of titles don't say. Those roles stay in unless you pick a level.
        </p>
      </CollapsibleContent>
    </CollapsibleRoot>

    <CollapsibleRoot :default-open="!!param('within')" class="border-t border-line">
      <h3>
        <CollapsibleTrigger
          class="flex h-12 w-full cursor-pointer items-center justify-between text-[15px] font-medium"
        >
          Posted within
          <span class="inline-flex items-center gap-2 text-xs font-normal text-fg-2">
            {{ WITHIN.find((w) => w.key === param("within"))?.label ?? "Any time" }}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m4 6 4 4 4-4" />
            </svg>
          </span>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
        <RadioGroupRoot
          :model-value="param('within')"
          aria-label="Posted within"
          class="flex flex-col pb-3"
          @update:model-value="(v) => set({ within: String(v) || undefined })"
        >
          <label v-for="w in WITHIN" :key="w.key" class="flex min-h-11 cursor-pointer items-center gap-3">
            <RadioGroupItem
              :value="w.key"
              class="grid size-5 flex-none cursor-pointer place-items-center rounded-full border-[1.5px] border-line-strong data-[state=checked]:border-accent"
            >
              <RadioGroupIndicator class="size-[9px] rounded-full bg-accent" />
            </RadioGroupItem>
            <span class="flex-1 text-sm">{{ w.label }}</span>
            <span class="font-mono text-mono text-muted">{{ n(counts?.within[w.days]) }}</span>
          </label>
        </RadioGroupRoot>
      </CollapsibleContent>
    </CollapsibleRoot>
  </div>
</template>
