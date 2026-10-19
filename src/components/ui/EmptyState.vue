<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon?: Component; title: string; description?: string; compact?: boolean }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center text-center" :class="compact ? 'px-4 py-8' : 'px-6 py-14'">
    <div
      v-if="icon"
      class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent ring-8 ring-accent-soft/40"
    >
      <component :is="icon" :size="22" aria-hidden="true" />
    </div>
    <h3 class="text-base font-semibold text-fg">{{ title }}</h3>
    <p v-if="description" class="mt-1 max-w-sm text-sm text-fg-muted">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5 flex flex-wrap items-center justify-center gap-2"><slot /></div>
  </div>
</template>
