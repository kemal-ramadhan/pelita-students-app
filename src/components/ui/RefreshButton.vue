<script setup lang="ts">
import { RotateCw } from 'lucide-vue-next'

withDefaults(defineProps<{ loading?: boolean; label?: string }>(), { label: 'Muat ulang' })
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    class="pressable inline-flex h-10 w-10 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted hover:text-fg disabled:opacity-60"
    :aria-label="label"
    :aria-busy="loading || undefined"
    :disabled="loading"
    @click="$emit('click')"
  >
    <RotateCw :size="18" :class="loading ? 'animate-spin' : ''" aria-hidden="true" />
  </button>
</template>
