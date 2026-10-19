<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { initials } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    src?: string | null
    name?: string | null
    size?: number
    shape?: 'circle' | 'rounded'
    /** `contain` untuk logo agar tidak terpotong. */
    fit?: 'cover' | 'contain'
    /** Teks alt khusus (default: "Foto {name}"). */
    alt?: string
  }>(),
  { size: 40, shape: 'circle', fit: 'cover' },
)

const failed = ref(false)
watch(
  () => props.src,
  () => (failed.value = false),
)

const palette = [
  'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300',
]

const color = computed(() => {
  const s = props.name ?? ''
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
})

const text = computed(() => initials(props.name))
const showImg = computed(() => !!props.src && !failed.value)
</script>

<template>
  <span
    class="relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold"
    :class="[shape === 'circle' ? 'rounded-full' : 'rounded-xl', showImg ? 'bg-surface-muted' : color]"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(10, Math.round(size * 0.38))}px` }"
  >
    <img
      v-if="showImg"
      :src="src!"
      :alt="alt ?? (name ? `Foto ${name}` : '')"
      class="h-full w-full"
      :class="fit === 'contain' ? 'bg-white object-contain p-[8%]' : 'object-cover'"
      loading="lazy"
      @error="failed = true"
    />
    <span v-else aria-hidden="true">{{ text }}</span>
    <span v-if="!showImg && name" class="sr-only">{{ name }}</span>
  </span>
</template>
