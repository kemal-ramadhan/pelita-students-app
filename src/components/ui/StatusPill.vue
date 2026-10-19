<script setup lang="ts">
import { computed } from 'vue'
import { TONE_CLASSES, statusLabel, statusTone, type Tone } from '@/utils/attendance'

const props = defineProps<{
  /** Status presensi (present/late/...) — label & warna otomatis. */
  status?: string | null
  /** Atau label + tone manual. */
  label?: string
  tone?: Tone
  size?: 'sm' | 'md'
}>()

const tone = computed(() => props.tone ?? statusTone(props.status))
const text = computed(() => props.label ?? statusLabel(props.status))
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center gap-1 rounded-full font-medium ring-1 ring-inset"
    :class="[TONE_CLASSES[tone], size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]']"
  >
    <slot />{{ text }}
  </span>
</template>
