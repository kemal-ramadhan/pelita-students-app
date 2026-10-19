<script setup lang="ts">
import { BookOpen, Radio } from 'lucide-vue-next'
import StatusPill from '@/components/ui/StatusPill.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import type { TodaySession } from '@/types/api'
import { formatTime } from '@/utils/format'
import { SESSION_STATUS_LABELS, isSessionLive } from '@/utils/attendance'

defineProps<{ sessions: TodaySession[]; loading?: boolean }>()
</script>

<template>
  <div v-if="loading && !sessions.length" class="space-y-2" aria-hidden="true">
    <div v-for="i in 3" :key="i" class="skeleton h-[72px] w-full rounded-2xl" />
  </div>
  <div v-else-if="!sessions.length" class="card">
    <EmptyState compact :icon="BookOpen" title="Tidak ada pelajaran hari ini" description="Jadwal pelajaranmu hari ini kosong." />
  </div>
  <ol v-else class="space-y-2">
    <li v-for="s in sessions" :key="s.schedule_id" class="card flex items-center gap-3 p-3">
      <div class="w-14 shrink-0 text-center">
        <p class="text-sm font-semibold tabular-nums text-fg">{{ formatTime(s.start_time) }}</p>
        <p class="text-[11px] tabular-nums text-fg-subtle">{{ formatTime(s.end_time) }}</p>
      </div>
      <div class="h-10 w-px shrink-0 bg-line" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-fg">{{ s.subject_name }}</p>
        <p class="truncate text-xs text-fg-muted">
          {{ s.teacher_name || 'Guru belum ditentukan' }}<template v-if="s.room"> · {{ s.room }}</template>
        </p>
        <p v-if="isSessionLive(s.session_status)" class="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <Radio :size="12" aria-hidden="true" class="animate-pulse" /> Sedang berlangsung
        </p>
        <p v-else-if="s.session_status" class="mt-1 text-[11px] text-fg-subtle">
          {{ SESSION_STATUS_LABELS[s.session_status] ?? s.session_status }}
        </p>
      </div>
      <StatusPill v-if="s.my_status" :status="s.my_status" />
      <StatusPill v-else label="Belum" tone="neutral" />
    </li>
  </ol>
</template>
