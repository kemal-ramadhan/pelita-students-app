<script setup lang="ts">
import { computed } from 'vue'
import { LogIn, LogOut, MapPin, QrCode } from 'lucide-vue-next'
import StatusPill from '@/components/ui/StatusPill.vue'
import type { AttendanceToday } from '@/types/api'
import { formatTime } from '@/utils/format'

const props = defineProps<{ today: AttendanceToday | null; loading?: boolean; showActions?: boolean }>()

const daily = computed(() => props.today?.daily_attendance ?? null)
const state = computed(() => {
  if (!props.today) return 'unknown'
  if (props.today.is_checked_out) return 'done'
  if (props.today.is_checked_in) return 'in'
  return 'none'
})
const headline = computed(
  () =>
    ({
      none: 'Kamu belum presensi masuk',
      in: 'Sudah masuk, jangan lupa presensi pulang',
      done: 'Presensi hari ini lengkap',
      unknown: 'Presensi hari ini',
    })[state.value],
)
</script>

<template>
  <section class="card p-4" aria-labelledby="today-att-title">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-wide text-fg-subtle">Presensi sekolah</p>
        <h2 id="today-att-title" class="mt-0.5 text-[15px] font-semibold text-fg">{{ headline }}</h2>
      </div>
      <StatusPill v-if="daily" :status="daily.status" size="md" />
    </div>

    <div v-if="loading && !today" class="mt-4 grid grid-cols-2 gap-3" aria-hidden="true">
      <div class="skeleton h-16" />
      <div class="skeleton h-16" />
    </div>
    <div v-else class="mt-4 grid grid-cols-2 gap-3">
      <div class="rounded-xl bg-surface-muted p-3">
        <p class="flex items-center gap-1.5 text-xs text-fg-subtle"><LogIn :size="14" aria-hidden="true" /> Masuk</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-fg">{{ formatTime(daily?.check_in_time) }}</p>
        <p class="text-[11px] text-fg-subtle">
          <template v-if="daily?.late_minutes">Terlambat {{ daily.late_minutes }} menit</template>
          <template v-else-if="today?.target_check_in_time">Batas {{ formatTime(today.target_check_in_time) }}</template>
        </p>
      </div>
      <div class="rounded-xl bg-surface-muted p-3">
        <p class="flex items-center gap-1.5 text-xs text-fg-subtle"><LogOut :size="14" aria-hidden="true" /> Pulang</p>
        <p class="mt-1 text-xl font-semibold tabular-nums text-fg">{{ formatTime(daily?.check_out_time) }}</p>
        <p class="text-[11px] text-fg-subtle">
          <template v-if="daily?.early_minutes">Lebih awal {{ daily.early_minutes }} menit</template>
          <template v-else-if="today?.target_check_out_time">Mulai {{ formatTime(today.target_check_out_time) }}</template>
        </p>
      </div>
    </div>

    <div v-if="showActions" class="mt-4 grid grid-cols-2 gap-2">
      <RouterLink
        to="/presensi/sekolah"
        class="pressable flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-600 text-sm font-semibold text-white shadow-sm shadow-primary-600/30 hover:bg-primary-700 dark:bg-primary-500"
      >
        <MapPin :size="17" aria-hidden="true" />
        {{ state === 'in' ? 'Presensi Pulang' : state === 'done' ? 'Lihat Presensi' : 'Presensi Masuk' }}
      </RouterLink>
      <RouterLink
        to="/presensi/kelas"
        class="pressable flex h-12 items-center justify-center gap-2 rounded-xl bg-accent-soft text-sm font-semibold text-accent hover:bg-primary-100 dark:hover:bg-primary-500/25"
      >
        <QrCode :size="17" aria-hidden="true" /> Presensi Kelas
      </RouterLink>
    </div>
  </section>
</template>
