<script setup lang="ts">
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { Bell, HeartHandshake, History, MapPin, QrCode, School, UserRound, BrainCircuit } from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import TodayAttendanceCard from '@/components/presensi/TodayAttendanceCard.vue'
import LessonList from '@/components/presensi/LessonList.vue'
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import { useStudentStore } from '@/stores/student'
import { useNotificationStore } from '@/stores/notifications'
import { useTodayAttendance } from '@/composables/useTodayAttendance'
import { assetUrl, formatLongDate } from '@/utils/format'
import { haptic } from '@/composables/useHaptic'

const student = useStudentStore()
const notif = useNotificationStore()
const { today, loading, error, load } = useTodayAttendance()
const refreshing = ref(false)

const todayLabel = computed(() => formatLongDate(new Date()))

interface MenuItem {
  to: string
  label: string
  icon: Component
  color: string
  badge?: number
}

/** Hanya fitur yang sudah berjalan (punya endpoint). */
const menu = computed<MenuItem[]>(() => {
  const common: MenuItem[] = [
    { to: '/notifikasi', label: 'Notifikasi', icon: Bell, color: 'from-rose-500 to-pink-600', badge: notif.unread },
    { to: '/profil', label: 'Profil', icon: UserRound, color: 'from-slate-500 to-slate-700' },
  ]
  if (student.isActive) {
    return [
      { to: '/asesmen', label: 'Asesmen Minat', icon: BrainCircuit, color: 'from-fuchsia-500 to-purple-600' },
      { to: '/presensi/sekolah', label: 'Presensi Sekolah', icon: MapPin, color: 'from-primary-500 to-primary-700' },
      { to: '/presensi/kelas', label: 'Presensi Kelas', icon: QrCode, color: 'from-violet-500 to-indigo-600' },
      { to: '/activity', label: 'Riwayat', icon: History, color: 'from-emerald-500 to-teal-600' },
      { to: '/konseling', label: 'Konseling BK', icon: HeartHandshake, color: 'from-amber-500 to-orange-600' },
      ...common,
    ]
  }
  return [{ to: '/gabung-sekolah', label: 'Gabung Sekolah', icon: School, color: 'from-primary-500 to-primary-700' }, ...common]
})

async function refresh() {
  refreshing.value = true
  haptic(8)
  try {
    await Promise.all([student.fetchMe(true).catch(() => undefined), notif.fetchUnreadCount().catch(() => undefined)])
    if (student.isActive) await load()
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  if (student.isActive) void load()
})
watch(
  () => student.isActive,
  (active) => {
    if (active && !today.value) void load()
  },
)
</script>

<template>
  <div class="space-y-5">
    <Teleport defer to="#header-actions">
      <RefreshButton :loading="refreshing" label="Muat ulang beranda" @click="refresh" />
    </Teleport>

    <p class="text-sm text-fg-muted">{{ todayLabel }}</p>

    <EnrollmentGate>
      <!-- Kartu sekolah -->
      <section
        v-if="student.school"
        class="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-900 p-4 text-white shadow-card"
        aria-label="Sekolah"
      >
        <div class="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div class="relative flex items-center gap-3">
          <BaseAvatar
            :src="assetUrl(student.school.logo)"
            :name="student.school.name"
            :size="52"
            shape="rounded"
            fit="contain"
            :alt="`Logo ${student.school.name}`"
          />
          <div class="min-w-0">
            <p class="truncate text-base font-semibold">{{ student.school.name }}</p>
            <p class="truncate text-sm text-blue-100">
              {{ student.className ? `Kelas ${student.className}` : 'Belum ditempatkan di kelas' }}
            </p>
            <p v-if="student.student?.nisn" class="text-xs text-blue-200/90">NISN {{ student.student.nisn }}</p>
          </div>
        </div>
      </section>

      <AlertBanner v-if="error" tone="danger" class="mt-4">{{ error }}</AlertBanner>

      <TodayAttendanceCard class="mt-4" :today="today" :loading="loading" show-actions />

      <section class="mt-5" aria-labelledby="lessons-title">
        <div class="mb-2 flex items-center justify-between">
          <h2 id="lessons-title" class="text-[15px] font-semibold text-fg">Pelajaran hari ini</h2>
          <span v-if="today?.sessions.length" class="text-xs text-fg-subtle">{{ today.sessions.length }} sesi</span>
        </div>
        <LessonList :sessions="today?.sessions ?? []" :loading="loading" />
      </section>
    </EnrollmentGate>

    <!-- Menu aplikasi -->
    <section aria-labelledby="menu-title">
      <h2 id="menu-title" class="mb-3 text-[15px] font-semibold text-fg">Menu</h2>
      <ul class="grid grid-cols-4 gap-x-2 gap-y-4">
        <li v-for="m in menu" :key="m.to">
          <RouterLink :to="m.to" class="pressable flex flex-col items-center gap-1.5 rounded-xl p-1 text-center" @click="haptic(8)">
            <span class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md" :class="m.color">
              <component :is="m.icon" :size="24" aria-hidden="true" />
              <span
                v-if="m.badge"
                class="absolute -right-1 -top-1 min-w-[20px] rounded-full bg-red-500 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-app"
                >{{ m.badge > 99 ? '99+' : m.badge }}<span class="sr-only"> belum dibaca</span></span
              >
            </span>
            <span class="text-[11px] font-medium leading-tight text-fg">{{ m.label }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
