<script setup lang="ts">
// The family's wordmark, a shell prompt in Space Mono. The cursor blinks four times, then stays; never with reduced
// motion (the global rule turns animations off).
</script>

<template>
  <span class="inline-flex items-center gap-[0.55em] font-mono leading-none whitespace-nowrap">
    <span aria-hidden="true" class="text-accent">➜</span>
    <span aria-hidden="true" class="text-fg-2">~</span>
    <span aria-hidden="true" class="inline-flex items-center gap-[3px] text-fg">
      visaproof.azamatos<span class="cursor inline-block h-[1.1em] w-[0.58em] bg-accent" />
    </span>
  </span>
</template>

<style scoped>
.cursor {
  animation: blink 1s steps(1, end) 4;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
