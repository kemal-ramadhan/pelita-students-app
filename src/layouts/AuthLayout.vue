<script setup lang="ts">
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme'

defineProps<{ title: string; subtitle?: string }>()
const { isDark, toggleDarkMode } = useTheme()
</script>

<template>
  <div class="min-h-dvh bg-app">
    <div class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-surface sm:border-x sm:border-line">
      <!-- Header brand -->
      <header
        class="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 px-5 pb-14 text-white pt-[max(1rem,env(safe-area-inset-top))]"
      >
        <div class="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.08]"
          style="background-image: radial-gradient(circle at 1px 1px, white 1px, transparent 0); background-size: 20px 20px"
          aria-hidden="true"
        />
        <div class="relative flex items-center justify-between">
          <RouterLink to="/login" class="flex items-center gap-2.5 rounded-lg" aria-label="EduPilot Siswa">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
              <img src="/logo-ep.png" alt="" class="h-6 w-6 object-contain" />
            </span>
            <span class="leading-tight">
              <span class="block text-base font-bold tracking-tight">EduPilot</span>
              <span class="block text-[11px] font-medium text-blue-100">Aplikasi Siswa</span>
            </span>
          </RouterLink>
          <button
            type="button"
            class="pressable rounded-full p-2 text-white/90 hover:bg-white/10"
            :aria-label="isDark ? 'Gunakan tema terang' : 'Gunakan tema gelap'"
            @click="toggleDarkMode"
          >
            <Sun v-if="isDark" :size="19" aria-hidden="true" />
            <Moon v-else :size="19" aria-hidden="true" />
          </button>
        </div>
        <div class="relative mt-7">
          <h1 class="text-2xl font-semibold leading-tight tracking-tight">{{ title }}</h1>
          <p v-if="subtitle || $slots.subtitle" class="mt-1.5 text-sm text-blue-100">
            <slot name="subtitle">{{ subtitle }}</slot>
          </p>
        </div>
      </header>

      <main class="relative -mt-8 flex-1 rounded-t-3xl bg-surface px-5 pt-7 pb-8 animate-slide-up">
        <slot />
      </main>

      <footer class="px-5 pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-fg-subtle">
        &copy; {{ new Date().getFullYear() }} EduPilot
      </footer>
    </div>
  </div>
</template>
