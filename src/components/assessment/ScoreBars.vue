<script setup lang="ts">
import type { BarDatum } from '@/utils/assessment'

/** Batang horizontal satu warna (magnitudo) — label & nilai selalu tertulis, tidak bergantung warna. */
defineProps<{ title: string; caption?: string; data: BarDatum[]; highlight?: string[] }>()
</script>

<template>
  <figure class="card p-4">
    <figcaption>
      <p class="text-[15px] font-semibold text-fg">{{ title }}</p>
      <p v-if="caption" class="text-xs text-fg-subtle">{{ caption }}</p>
    </figcaption>
    <ul class="mt-3 space-y-3">
      <li
        v-for="d in data"
        :key="d.key"
        :aria-label="`${d.label}: ${d.display}${d.note ? `, ${d.note}` : ''}`"
      >
        <div class="flex items-baseline justify-between gap-2 text-[13px]" aria-hidden="true">
          <span
            class="min-w-0 truncate"
            :class="highlight?.includes(d.key) ? 'font-semibold text-fg' : 'text-fg-muted'"
            >{{ d.label }}</span
          >
          <span class="shrink-0 tabular-nums text-fg">
            <span v-if="d.note" class="mr-1.5 text-xs text-fg-subtle">{{ d.note }}</span
            >{{ d.display }}
          </span>
        </div>
        <div class="mt-1 h-2 w-full rounded-full bg-surface-muted" aria-hidden="true">
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :class="
              highlight?.includes(d.key)
                ? 'bg-primary-600 dark:bg-primary-400'
                : 'bg-primary-400 dark:bg-primary-600'
            "
            :style="{ width: `${Math.max(2, Math.min(100, (d.value / (d.max || 1)) * 100))}%` }"
          />
        </div>
      </li>
    </ul>
  </figure>
</template>
