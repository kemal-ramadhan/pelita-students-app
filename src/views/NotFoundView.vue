<script setup lang="ts">
import { Compass } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-app px-4">
    <div class="card w-full max-w-[420px]">
      <EmptyState :icon="Compass" title="Halaman tidak ditemukan" description="Tautan yang Anda buka tidak tersedia atau sudah dipindahkan.">
        <BaseButton to="/">Ke beranda</BaseButton>
      </EmptyState>
    </div>
  </div>
</template>
