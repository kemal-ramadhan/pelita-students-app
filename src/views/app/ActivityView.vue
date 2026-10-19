<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { BookOpen, CalendarX2, ChevronLeft, ChevronRight, LogIn, LogOut } from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useStudentStore } from '@/stores/student'
import { useAttendanceStore } from '@/stores/attendance'
import { getApiError, getApiErrorCode } from '@/utils/api'
import { formatDayShort, formatMonth, formatTime, shiftMonth, toMonthKey } from '@/utils/format'
import { TONE_CLASSES, type Tone } from '@/utils/attendance'
import type { AttendanceHistory, HistorySession } from '@/types/api'

const student = useStudentStore()
const attendance = useAttendanceStore()

const currentMonth = toMonthKey()
const month = ref(currentMonth)
const view = ref<'daily' | 'sessions'>('daily')
const data = ref<AttendanceHistory | null>(null)
const loading = ref(false)
const error = ref('')

const chips = computed<{ key: keyof AttendanceHistory['summary']; label: string; tone: Tone }[]>(() => [
  { key: 'present', label: 'Hadir', tone: 'success' },
  { key: 'late', label: 'Terlambat', tone: 'warning' },
  { key: 'sick', label: 'Sakit', tone: 'info' },
  { key: 'permission', label: 'Izin', tone: 'violet' },
  { key: 'absent', label: 'Alpa', tone: 'danger' },
])

const daily = computed(() => [...(data.value?.daily ?? [])].sort((a, b) => b.date.localeCompare(a.date)))

const sessionGroups = computed(() => {
  const groups = new Map<string, HistorySession[]>()
  for (const s of data.value?.sessions ?? []) {
    const list = groups.get(s.date) ?? []
    list.push(s)
    groups.set(s.date, list)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, items]) => ({ date, items: items.sort((a, b) => a.start_time.localeCompare(b.start_time)) }))
})

async function load(force = false) {
  if (!student.isActive) return
  loading.value = true
  error.value = ''
  try {
    data.value = await attendance.fetchHistory(month.value, force)
  } catch (err) {
    if (getApiErrorCode(err) === 'NOT_ENROLLED') await student.fetchMe(true).catch(() => undefined)
    else error.value = getApiError(err, 'Tidak dapat memuat riwayat presensi.')
  } finally {
    loading.value = false
  }
}

function go(delta: number) {
  const next = shiftMonth(month.value, delta)
  if (next > currentMonth) return
  month.value = next
}

watch(month, () => {
  data.value = null
  void load()
})
onMounted(async () => {
  await student.fetchMe().catch(() => undefined)
  void load()
})
watch(
  () => student.isActive,
  (a) => a && load(),
)

const methodLabel = (m?: string | null) =>
  m === 'qr' || m === 'token' || m === 'code' ? 'Kode/QR' : m === 'manual' ? 'Dicatat guru' : m ? m.toUpperCase() : ''
</script>

<template>
  <div class="space-y-4">
    <Teleport defer to="#header-actions">
      <RefreshButton v-if="student.isActive" :loading="loading" label="Muat ulang riwayat" @click="load(true)" />
    </Teleport>

    <EnrollmentGate join-message="Riwayat presensi tersedia setelah kamu tergabung dengan sekolah.">
      <!-- Pemilih bulan -->
      <div class="card flex items-center justify-between p-1.5">
        <button type="button" class="pressable flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-muted" aria-label="Bulan sebelumnya" @click="go(-1)">
          <ChevronLeft :size="20" aria-hidden="true" />
        </button>
        <label class="relative flex items-center">
          <span class="sr-only">Pilih bulan</span>
          <span class="pointer-events-none text-[15px] font-semibold capitalize text-fg" aria-hidden="true">{{ formatMonth(month) }}</span>
          <input
            v-model="month"
            type="month"
            :max="currentMonth"
            class="absolute inset-0 cursor-pointer opacity-0"
            @change="month > currentMonth && (month = currentMonth)"
          />
        </label>
        <button
          type="button"
          class="pressable flex h-10 w-10 items-center justify-center rounded-xl text-fg-muted hover:bg-surface-muted disabled:opacity-30"
          aria-label="Bulan berikutnya"
          :disabled="month >= currentMonth"
          @click="go(1)"
        >
          <ChevronRight :size="20" aria-hidden="true" />
        </button>
      </div>

      <!-- Ringkasan -->
      <div class="mt-4 grid grid-cols-5 gap-2" aria-label="Ringkasan presensi">
        <div v-for="c in chips" :key="c.key" class="flex flex-col items-center rounded-2xl px-1 py-2.5 ring-1 ring-inset" :class="TONE_CLASSES[c.tone]">
          <span v-if="loading && !data" class="skeleton h-6 w-6" aria-hidden="true" />
          <span v-else class="text-xl font-bold tabular-nums">{{ data?.summary[c.key] ?? 0 }}</span>
          <span class="text-[10px] font-medium">{{ c.label }}</span>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1" role="tablist" aria-label="Jenis riwayat">
        <button
          type="button"
          role="tab"
          :aria-selected="view === 'daily'"
          class="pressable h-10 rounded-xl text-sm font-semibold"
          :class="view === 'daily' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
          @click="view = 'daily'"
        >
          Harian
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="view === 'sessions'"
          class="pressable h-10 rounded-xl text-sm font-semibold"
          :class="view === 'sessions' ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
          @click="view = 'sessions'"
        >
          Per pelajaran
        </button>
      </div>

      <div class="mt-4" role="tabpanel">
        <ErrorState v-if="error" :message="error" :loading="loading" @retry="load(true)" />
        <div v-else-if="loading && !data" class="space-y-2" aria-busy="true" aria-label="Memuat riwayat">
          <div v-for="i in 5" :key="i" class="skeleton h-16 w-full rounded-2xl" />
        </div>

        <!-- Harian -->
        <template v-else-if="view === 'daily'">
          <div v-if="!daily.length" class="card">
            <EmptyState compact :icon="CalendarX2" title="Belum ada presensi" :description="`Tidak ada catatan presensi pada ${formatMonth(month)}.`" />
          </div>
          <ul v-else class="space-y-2">
            <li v-for="d in daily" :key="d.id || d.date" class="card flex items-center gap-3 p-3">
              <div class="w-16 shrink-0">
                <p class="text-sm font-semibold capitalize text-fg">{{ formatDayShort(d.date) }}</p>
              </div>
              <div class="flex min-w-0 flex-1 items-center gap-3 text-xs text-fg-muted">
                <span class="inline-flex items-center gap-1 tabular-nums"><LogIn :size="13" aria-label="Masuk" /> {{ formatTime(d.check_in_time) }}</span>
                <span class="inline-flex items-center gap-1 tabular-nums"><LogOut :size="13" aria-label="Pulang" /> {{ formatTime(d.check_out_time) }}</span>
              </div>
              <StatusPill :status="d.status" />
            </li>
          </ul>
        </template>

        <!-- Per pelajaran -->
        <template v-else>
          <div v-if="!sessionGroups.length" class="card">
            <EmptyState compact :icon="BookOpen" title="Belum ada presensi kelas" :description="`Tidak ada catatan presensi pelajaran pada ${formatMonth(month)}.`" />
          </div>
          <ol v-else class="space-y-5">
            <li v-for="g in sessionGroups" :key="g.date">
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">{{ formatDayShort(g.date) }}</h3>
              <ol class="relative ml-2 space-y-2 border-l-2 border-line pl-4">
                <li v-for="(s, i) in g.items" :key="`${g.date}-${i}`" class="relative">
                  <span class="absolute -left-[23px] top-4 h-3 w-3 rounded-full bg-primary-500 ring-4 ring-app" aria-hidden="true" />
                  <div class="card flex items-center gap-3 p-3">
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold text-fg">{{ s.subject_name }}</p>
                      <p class="truncate text-xs text-fg-muted">
                        {{ formatTime(s.start_time) }}<template v-if="s.teacher_name"> · {{ s.teacher_name }}</template>
                        <template v-if="methodLabel(s.check_in_method)"> · {{ methodLabel(s.check_in_method) }}</template>
                      </p>
                    </div>
                    <StatusPill :status="s.status" />
                  </div>
                </li>
              </ol>
            </li>
          </ol>
        </template>
      </div>
    </EnrollmentGate>
  </div>
</template>
