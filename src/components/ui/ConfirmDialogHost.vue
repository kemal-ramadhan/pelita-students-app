<script setup lang="ts">
import { computed } from 'vue'
import { TriangleAlert, CircleHelp } from 'lucide-vue-next'
import BottomSheet from './BottomSheet.vue'
import BaseButton from './BaseButton.vue'
import { acceptConfirm, confirmState, settleConfirm } from '@/composables/useConfirm'

const open = computed({
  get: () => confirmState.open,
  set: (v: boolean) => {
    if (!v) settleConfirm(false)
  },
})
const danger = computed(() => confirmState.options.tone === 'danger')
const warning = computed(() => confirmState.options.tone === 'warning')
</script>

<template>
  <BottomSheet
    v-model:open="open"
    hide-header
    :persistent="confirmState.loading"
    :aria-label="confirmState.options.title"
    initial-focus="[data-confirm-cancel]"
  >
    <div class="flex flex-col items-center pt-2 text-center">
      <div
        class="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
        :class="
          danger
            ? 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400'
            : warning
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300'
              : 'bg-accent-soft text-accent'
        "
      >
        <TriangleAlert v-if="danger || warning" :size="22" aria-hidden="true" />
        <CircleHelp v-else :size="22" aria-hidden="true" />
      </div>
      <h2 class="text-lg font-semibold text-fg">{{ confirmState.options.title }}</h2>
      <p v-if="confirmState.options.message" class="mt-1.5 text-sm text-fg-muted">
        {{ confirmState.options.message }}
      </p>
    </div>
    <div class="mt-6 flex flex-col gap-2">
      <BaseButton
        size="lg"
        block
        :variant="danger ? 'danger' : 'primary'"
        :loading="confirmState.loading"
        @click="acceptConfirm"
      >
        {{ confirmState.options.confirmText ?? 'Ya, lanjutkan' }}
      </BaseButton>
      <BaseButton
        size="lg"
        block
        variant="ghost"
        data-confirm-cancel
        :disabled="confirmState.loading"
        @click="settleConfirm(false)"
      >
        {{ confirmState.options.cancelText ?? 'Batal' }}
      </BaseButton>
    </div>
  </BottomSheet>
</template>
