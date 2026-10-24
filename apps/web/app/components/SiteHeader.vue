<script setup lang="ts">
const route = useRoute();
const NAV = [
  { to: "/", label: "Search", phone: false },
  { to: "/method", label: "Method", phone: true },
  { to: "/status", label: "Status", phone: false },
];
const current = (to: string) => (to === "/" ? route.path === "/" : route.path.startsWith(to));
</script>

<template>
  <header class="border-b border-line bg-bg">
    <div class="mx-auto flex h-14 max-w-[1264px] items-center justify-between gap-3 px-4 md:h-16 md:px-8">
      <NuxtLink
        to="/"
        aria-label="Visaproof, search"
        class="inline-flex min-h-11 items-center text-[13px] no-underline md:text-[15px]"
      >
        <Wordmark />
      </NuxtLink>
      <nav aria-label="Site">
        <ul class="flex items-center gap-1">
          <li v-for="n in NAV" :key="n.to" :class="n.phone ? '' : 'hidden md:block'">
            <NuxtLink
              :to="n.to"
              :aria-current="current(n.to) ? 'page' : undefined"
              class="inline-flex min-h-11 items-center px-2 text-sm underline-offset-[6px] md:px-3"
              :class="
                current(n.to) ? 'text-fg underline decoration-1' : 'text-fg-2 no-underline hover:text-fg'
              "
            >
              {{ n.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
</template>
