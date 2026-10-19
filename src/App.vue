<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastHost from '@/components/ui/ToastHost.vue'
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost.vue'
import { useTheme } from '@/composables/useTheme'

useTheme().initTheme()
</script>

<template>
  <RouterView />
  <ToastHost />
  <ConfirmDialogHost />
</template>
