<script setup lang="ts">
import { computed } from 'vue'
import { passwordStrength } from '@/utils/validators'

const props = defineProps<{ password: string }>()
const result = computed(() => passwordStrength(props.password))
const colors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']
const textColors = [
  'text-red-600 dark:text-red-400',
  'text-red-600 dark:text-red-400',
  'text-amber-700 dark:text-amber-400',
  'text-emerald-700 dark:text-emerald-400',
  'text-emerald-700 dark:text-emerald-400',
]
</script>

<template>
  <div v-if="password" class="space-y-1.5" aria-live="polite">
    <div class="flex gap-1" aria-hidden="true">
      <span
        v-for="i in 4"
        :key="i"
        class="h-1 flex-1 rounded-full transition-colors duration-200"
        :class="i <= Math.max(1, result.score) ? colors[result.score] : 'bg-surface-muted'"
      />
    </div>
    <p class="text-xs">
      <span class="font-medium" :class="textColors[result.score]">Kekuatan: {{ result.label }}</span>
      <span v-if="result.hints.length" class="text-fg-subtle"> · {{ result.hints.slice(0, 2).join(', ') }}</span>
    </p>
  </div>
</template>
