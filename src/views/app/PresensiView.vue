<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { ChevronRight, MapPin, QrCode } from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useStudentStore } from '@/stores/student'
import { useTodayAttendance } from '@/composables/useTodayAttendance'
import { formatTime } from '@/utils/format'
import { isSessionLive } from '@/utils/attendance'
import { haptic } from '@/composables/useHaptic'

const student = useStudentStore()
const { today, load } = useTodayAttendance()

onMounted(async () => {
  await student.fetchMe().catch(() => undefined)
  if (student.isActive) void load()
})

const schoolHint = computed(() => {
  const t = today.value
  if (!t) return 'Presensi masuk & pulang dengan GPS'
  if (t.is_checked_out) return `Lengkap · masuk ${formatTime(t.daily_attendance?.check_in_time)}, pulang ${formatTime(t.daily_attendance?.check_out_time)}`
  if (t.is_checked_in) return `Masuk ${formatTime(t.daily_attendance?.check_in_time)} · belum presensi pulang`
  return 'Belum presensi masuk hari ini'
})
const liveCount = computed(() => today.value?.sessions.filter((s) => isSessionLive(s.session_status)).length ?? 0)
</script>

<template>
  <div class="space-y-4">
    <EnrollmentGate join-message="Presensi tersedia setelah kamu tergabung dan disetujui oleh sekolah.">
      <p class="text-sm text-fg-muted">Pilih jenis presensi.</p>
      <div class="mt-3 space-y-3">
        <RouterLink
          to="/presensi/sekolah"
          class="pressable card flex items-center gap-4 p-5 hover:border-primary-300"
          @click="haptic(10)"
        >
          <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md shadow-primary-600/30">
            <MapPin :size="30" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg font-semibold text-fg">Presensi Sekolah</span>
            <span class="mt-0.5 block text-sm text-fg-muted">{{ schoolHint }}</span>
            <StatusPill v-if="today?.daily_attendance" class="mt-2" :status="today.daily_attendance.status" />
          </span>
          <ChevronRight :size="20" class="shrink-0 text-fg-subtle" aria-hidden="true" />
        </RouterLink>

        <RouterLink
          to="/presensi/kelas"
          class="pressable card flex items-center gap-4 p-5 hover:border-primary-300"
          @click="haptic(10)"
        >
          <span class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <QrCode :size="30" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-lg font-semibold text-fg">Presensi Kelas</span>
            <span class="mt-0.5 block text-sm text-fg-muted">Pindai QR atau masukkan kode dari guru per mata pelajaran</span>
            <span v-if="liveCount" class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
              {{ liveCount }} pelajaran sedang berlangsung
            </span>
          </span>
          <ChevronRight :size="20" class="shrink-0 text-fg-subtle" aria-hidden="true" />
        </RouterLink>
      </div>
    </EnrollmentGate>
  </div>
</template>
