<script setup lang="ts">
import { CloudOff, RotateCw } from 'lucide-vue-next'
import BaseButton from './BaseButton.vue'

withDefaults(defineProps<{ title?: string; message?: string; loading?: boolean }>(), {
  title: 'Gagal memuat data',
})
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="card flex flex-col items-center px-6 py-10 text-center" role="alert">
    <span class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
      <CloudOff :size="22" aria-hidden="true" />
    </span>
    <h3 class="text-base font-semibold text-fg">{{ title }}</h3>
    <p v-if="message" class="mt-1 max-w-xs text-sm text-fg-muted">{{ message }}</p>
    <BaseButton class="mt-5" variant="secondary" :icon="RotateCw" :loading="loading" @click="$emit('retry')">
      Coba lagi
    </BaseButton>
  </div>
</template>
