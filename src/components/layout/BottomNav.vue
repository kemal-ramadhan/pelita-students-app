<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Bell, CalendarCheck2, House, ScanLine, UserRound } from 'lucide-vue-next'
import { useNotificationStore } from '@/stores/notifications'
import { haptic } from '@/composables/useHaptic'

const route = useRoute()
const notif = useNotificationStore()

const left = [
  { to: '/', label: 'Beranda', icon: House, match: (p: string) => p === '/' || p === '/gabung-sekolah' },
  { to: '/activity', label: 'Aktivitas', icon: CalendarCheck2, match: (p: string) => p.startsWith('/activity') },
]
const right = [
  { to: '/notifikasi', label: 'Notifikasi', icon: Bell, match: (p: string) => p.startsWith('/notifikasi') },
  { to: '/profil', label: 'Profil', icon: UserRound, match: (p: string) => p.startsWith('/profil') },
]

const presensiActive = computed(() => route.path.startsWith('/presensi'))
const badge = computed(() => (notif.unread > 99 ? '99+' : String(notif.unread)))
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] border-t border-line bg-surface/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    aria-label="Navigasi utama"
  >
    <ul class="relative grid h-16 grid-cols-5 items-stretch">
      <li v-for="item in left" :key="item.to">
        <RouterLink
          :to="item.to"
          class="pressable flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
          :class="item.match(route.path) ? 'text-accent' : 'text-fg-subtle hover:text-fg'"
          :aria-current="item.match(route.path) ? 'page' : undefined"
          @click="haptic(8)"
        >
          <component :is="item.icon" :size="22" :stroke-width="item.match(route.path) ? 2.4 : 2" aria-hidden="true" />
          {{ item.label }}
        </RouterLink>
      </li>

      <!-- Presensi: tombol tengah menonjol -->
      <li class="relative flex justify-center">
        <RouterLink
          to="/presensi"
          class="pressable absolute -top-6 flex flex-col items-center gap-1 text-[11px] font-semibold"
          :class="presensiActive ? 'text-accent' : 'text-fg-muted'"
          :aria-current="presensiActive ? 'page' : undefined"
          @click="haptic(12)"
        >
          <span
            class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-600/40 ring-4 ring-surface"
            :class="presensiActive ? 'scale-105' : ''"
          >
            <ScanLine :size="28" aria-hidden="true" />
          </span>
          Presensi
        </RouterLink>
      </li>

      <li v-for="item in right" :key="item.to">
        <RouterLink
          :to="item.to"
          class="pressable flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
          :class="item.match(route.path) ? 'text-accent' : 'text-fg-subtle hover:text-fg'"
          :aria-current="item.match(route.path) ? 'page' : undefined"
          :aria-label="item.to === '/notifikasi' && notif.unread > 0 ? `${item.label}, ${notif.unread} belum dibaca` : undefined"
          @click="haptic(8)"
        >
          <span class="relative">
            <component :is="item.icon" :size="22" :stroke-width="item.match(route.path) ? 2.4 : 2" aria-hidden="true" />
            <span
              v-if="item.to === '/notifikasi' && notif.unread > 0"
              class="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white ring-2 ring-surface"
              aria-hidden="true"
              >{{ badge }}</span
            >
          </span>
          {{ item.label }}
        </RouterLink>
      </li>
    </ul>
  </nav>
</template>
