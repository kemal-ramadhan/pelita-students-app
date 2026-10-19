<script setup lang="ts">
import { ArrowRight, School } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'

withDefaults(defineProps<{ message?: string }>(), {
  message: 'Masukkan kode sekolah dari guru atau operator sekolahmu. Setelah disetujui, kamu bisa melakukan presensi.',
})
</script>

<template>
  <section
    class="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 p-5 text-white shadow-card"
    aria-labelledby="join-title"
  >
    <div class="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
    <span class="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
      <School :size="22" aria-hidden="true" />
    </span>
    <h2 id="join-title" class="relative mt-3 text-lg font-semibold">Gabung Sekolah</h2>
    <p class="relative mt-1 text-sm text-blue-100">{{ message }}</p>
    <BaseButton
      to="/gabung-sekolah"
      size="lg"
      block
      variant="secondary"
      :icon-right="ArrowRight"
      class="relative mt-4 !border-transparent !bg-white !text-primary-700"
    >
      Masukkan kode sekolah
    </BaseButton>
  </section>
</template>
