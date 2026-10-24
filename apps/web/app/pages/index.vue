<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from "reka-ui";
import { VISA_LEVELS } from "#shared/answers";

const route = useRoute();
const { param, on, set, filtered, clear } = useSearch();
const { text: searchText, submit: searchNow, clear: clearSearch } = useSearchBox();
const { data, status, error, refresh } = await useFetch("/api/roles", { query: computed(() => route.query) });

const n = (x: number | undefined) => (x ?? 0).toLocaleString("en-US");
const visaLevel = computed(() => param("visa") || "open");
const visaLabel = computed(() =>
  visaLevel.value === "open"
    ? "all but won't"
    : (VISA_LEVELS.find((l) => l.key === visaLevel.value)?.label ?? "").toLowerCase(),
);
const sheet = ref(false);
const SORTS = [
  { value: "strongest", label: "Strongest first" },
  { value: "newest", label: "Newest first" },
] as const;
const sort = computed({
  get: () => (param("sort") === "newest" ? "newest" : "strongest"),
  set: (v: (typeof SORTS)[number]["value"]) => set({ sort: v === "newest" ? "newest" : undefined }),
});

useSeoMeta({
  description:
    "Software developer jobs in Europe with the visa answer first: whether the employer sponsors, quoted from the posting or the official register.",
});
</script>

<template>
  <main
    id="main"
    class="mx-auto flex w-full max-w-[1264px] flex-col gap-5 px-4 pt-6 pb-10 md:gap-10 md:px-8 md:pt-10 md:pb-16"
  >
    <div class="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
      <div class="flex max-w-[640px] min-w-0 flex-[1_1_420px] flex-col gap-2">
        <h1 class="text-2xl font-medium tracking-[-0.01em] text-balance md:text-3xl">
          Developer jobs in Europe, visa answer first
        </h1>
        <p class="text-[15px] leading-[22px] text-fg-2 text-pretty md:text-base">
          <template v-if="data"
            >{{ n(data.counts.levels.all) }} open roles, read from companies' own job boards.
          </template>
          Each answer quotes the posting or the register.
        </p>
      </div>
      <form
        role="search"
        class="flex max-w-[560px] min-w-0 flex-[1_1_420px] gap-2"
        @submit.prevent="searchNow()"
      >
        <label for="q" class="sr-only">Search roles</label>
        <div
          class="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-control border border-line-strong bg-surface px-3.5 text-fg-2 md:h-[52px] md:px-4"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <circle cx="7" cy="7" r="4.75" />
            <path d="m10.5 10.5 3.25 3.25" />
          </svg>
          <input
            id="q"
            v-model="searchText"
            name="q"
            type="search"
            enterkeyhint="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Title, company or stack"
            class="h-11 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-2"
          />
        </div>
        <button
          type="submit"
          class="hidden h-[52px] cursor-pointer rounded-control border border-line-strong bg-surface-hover px-5 text-[15px] md:block"
        >
          Search
        </button>
      </form>
    </div>

    <!-- Phone: a row of quick filters; everything else in the sheet. -->
    <DialogRoot v-model:open="sheet">
      <div class="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
        <DialogTrigger
          class="inline-flex h-11 flex-none cursor-pointer items-center gap-2 rounded-control border border-line-strong bg-surface-hover px-3.5 text-sm"
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" />
            <circle cx="10.5" cy="4.5" r="1.5" />
            <circle cx="5.5" cy="11.5" r="1.5" />
          </svg>
          Filters
        </DialogTrigger>
        <DialogTrigger
          class="inline-flex h-11 flex-none cursor-pointer items-center gap-1.5 rounded-control border border-line px-3 text-sm whitespace-nowrap"
        >
          Visa: {{ visaLabel }}
        </DialogTrigger>
        <button
          type="button"
          :aria-pressed="on('nolang')"
          class="inline-flex h-11 flex-none cursor-pointer items-center rounded-control border px-3 text-sm whitespace-nowrap"
          :class="on('nolang') ? 'border-accent bg-accent-tint' : 'border-line'"
          @click="set({ nolang: on('nolang') ? undefined : '1' })"
        >
          No local language
        </button>
        <button
          type="button"
          :aria-pressed="on('relocation')"
          class="inline-flex h-11 flex-none cursor-pointer items-center rounded-control border px-3 text-sm whitespace-nowrap"
          :class="on('relocation') ? 'border-accent bg-accent-tint' : 'border-line'"
          @click="set({ relocation: on('relocation') ? undefined : '1' })"
        >
          Helps you move
        </button>
      </div>
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-40 bg-black/60" />
        <DialogContent class="fixed inset-0 z-50 flex flex-col bg-bg text-fg">
          <div class="flex h-14 flex-none items-center justify-between border-b border-line px-4">
            <DialogTitle class="text-lg font-medium">Filters</DialogTitle>
            <div class="flex items-center gap-2">
              <button
                v-if="filtered"
                type="button"
                class="h-11 cursor-pointer px-2 text-sm text-accent underline"
                @click="clear()"
              >
                Clear all
              </button>
              <DialogClose aria-label="Close filters" class="grid size-11 cursor-pointer place-items-center">
                <svg
                  aria-hidden="true"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                >
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </DialogClose>
            </div>
          </div>
          <DialogDescription class="sr-only">Each option shows how many roles it leaves.</DialogDescription>
          <div class="flex-1 overflow-y-auto px-4 pb-4">
            <SearchFilters :counts="data?.counts" :total="data?.total" />
          </div>
          <div class="flex-none border-t border-line p-4">
            <DialogClose
              class="h-[52px] w-full cursor-pointer rounded-control bg-accent text-[15px] font-medium text-accent-ink"
              aria-live="polite"
            >
              Show {{ n(data?.total) }} roles
            </DialogClose>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <div class="flex flex-wrap items-start gap-x-12 gap-y-10">
      <aside aria-label="Filters" class="hidden flex-col gap-2 md:flex md:max-w-[300px] md:flex-[1_1_260px]">
        <div class="flex h-11 items-center justify-between">
          <h2 class="text-lg font-medium">Filters</h2>
          <button
            v-if="filtered"
            type="button"
            class="h-11 cursor-pointer text-sm text-accent underline underline-offset-[3px]"
            @click="clear()"
          >
            Clear all
          </button>
        </div>
        <SearchFilters :counts="data?.counts" :total="data?.total" />
      </aside>

      <section aria-labelledby="results-title" class="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <p class="sr-only" aria-live="polite">{{ data ? `${n(data.total)} roles` : "" }}</p>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 id="results-title" class="text-lg font-medium md:text-xl">
            {{ data ? `${n(data.total)} roles` : "Roles" }}
          </h2>
          <div class="flex items-center gap-2.5 text-sm text-fg-2">
            <span class="hidden sm:inline">Sort</span>
            <UiSelect v-model="sort" label="Sort" :options="SORTS" />
          </div>
        </div>
        <p
          v-if="data && visaLevel === 'open' && data.counts.visa.wont"
          class="-mt-2 flex flex-wrap items-center gap-x-2 text-xs text-fg-2"
        >
          <span>Won't sponsor is hidden: {{ n(data.counts.visa.wont) }} roles.</span>
          <button
            type="button"
            class="min-h-8 cursor-pointer text-accent underline"
            @click="set({ visa: 'all' })"
          >
            Show them
          </button>
        </p>

        <div
          v-if="error"
          role="alert"
          class="flex flex-col items-start gap-3 rounded-card border border-line p-6"
        >
          <p class="text-base">
            The roles didn't load. The job boards are fine; this page couldn't reach them.
          </p>
          <button
            type="button"
            class="h-11 cursor-pointer rounded-control border border-line-strong px-4"
            @click="refresh()"
          >
            Try again
          </button>
        </div>
        <div
          v-else-if="data && !data.total"
          class="flex flex-col items-start gap-3 rounded-card border border-dashed border-unknown-line p-6"
        >
          <p class="text-base">
            No roles match<template v-if="param('q')"> “{{ param("q") }}”</template
            ><template v-if="filtered"> with these filters</template>.
          </p>
          <div class="flex flex-wrap gap-x-6">
            <button
              v-if="param('q')"
              type="button"
              class="h-11 cursor-pointer text-accent underline"
              @click="clearSearch()"
            >
              Clear the search
            </button>
            <button
              v-if="visaLevel !== 'open' && visaLevel !== 'all'"
              type="button"
              class="h-11 cursor-pointer text-accent underline"
              @click="set({ visa: undefined })"
            >
              Show roles whose employer may sponsor too
            </button>
            <button
              v-else-if="filtered"
              type="button"
              class="h-11 cursor-pointer text-accent underline"
              @click="clear()"
            >
              Clear the filters
            </button>
          </div>
        </div>
        <!-- While new results load, the old ones stay, dimmed: the list never flashes empty. -->
        <ol
          v-else
          class="flex flex-col gap-3 transition-opacity duration-150"
          :class="status === 'pending' ? 'opacity-60' : ''"
          :aria-busy="status === 'pending'"
        >
          <li v-for="job in data?.roles" :key="job.id"><JobCard :job="job" /></li>
        </ol>

        <nav
          v-if="data && data.pages > 1"
          aria-label="Pages"
          class="flex items-center justify-between gap-3 pt-2"
        >
          <button
            type="button"
            :disabled="data.page <= 1"
            class="h-11 cursor-pointer rounded-control border border-line-strong px-4 disabled:cursor-default disabled:opacity-40"
            @click="set({ page: data.page > 2 ? String(data.page - 1) : undefined })"
          >
            Previous
          </button>
          <span class="font-mono text-mono text-muted">Page {{ data.page }} of {{ n(data.pages) }}</span>
          <button
            type="button"
            :disabled="data.page >= data.pages"
            class="h-11 cursor-pointer rounded-control border border-line-strong px-4 disabled:cursor-default disabled:opacity-40"
            @click="set({ page: String(data.page + 1) })"
          >
            Next
          </button>
        </nav>
      </section>
    </div>
  </main>
</template>
