<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-vue-next'

const props = withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'danger'; title?: string }>(), {
  tone: 'info',
})

const styles = {
  info: 'border-primary-200 bg-primary-50 text-primary-900 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-100',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  danger: 'border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100',
}
const iconColor = {
  info: 'text-primary-600 dark:text-primary-300',
  success: 'text-emerald-600 dark:text-emerald-300',
  warning: 'text-amber-600 dark:text-amber-300',
  danger: 'text-red-600 dark:text-red-300',
}
const icon = computed(
  () => ({ info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert })[props.tone],
)
</script>

<template>
  <div
    class="flex gap-3 rounded-xl border px-4 py-3 text-sm animate-fade-in"
    :class="styles[tone]"
    :role="tone === 'danger' || tone === 'warning' ? 'alert' : 'status'"
  >
    <component :is="icon" :size="18" class="mt-px shrink-0" :class="iconColor[tone]" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <p v-if="title" class="font-semibold">{{ title }}</p>
      <div :class="title ? 'mt-0.5 opacity-90' : ''"><slot /></div>
    </div>
    <div v-if="$slots.action" class="shrink-0 self-center"><slot name="action" /></div>
  </div>
</template>
