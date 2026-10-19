<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { CalendarClock, Check, CircleX, MessageSquareHeart, Send } from 'lucide-vue-next'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useCounselingStore } from '@/stores/counseling'
import { useStudentStore } from '@/stores/student'
import { getApiError, getApiErrorCode } from '@/utils/api'
import { formatDate, formatLongDate, formatTime, timeZoneLabel } from '@/utils/format'
import { isSessionScheduled, otherParticipantNames, outcomeLabel, sessionStatus, sessionTypeLabel } from '@/utils/counseling'
import type { CounselingSession } from '@/types/counseling'

const props = defineProps<{ session: CounselingSession | null }>()
const open = defineModel<boolean>('open', { default: false })

const counseling = useCounselingStore()
const student = useStudentStore()
const detail = ref<CounselingSession | null>(null)
const loading = ref(false)
const error = ref('')

const s = computed(() => detail.value ?? props.session)
const st = computed(() => sessionStatus(s.value?.status))
const tz = computed(() => timeZoneLabel(student.school?.timezone))
const scheduled = computed(() => (s.value ? isSessionScheduled(s.value) : false))
const friends = computed(() =>
  s.value ? otherParticipantNames(s.value, { id: student.student?.id, name: student.student?.full_name }) : [],
)
const feedback = computed(() => {
  const o = s.value?.outcome
  if (!o || s.value?.status !== 'completed') return null
  const text = (o.student_feedback ?? '').trim()
  const plan = (o.follow_up_plan ?? '').trim()
  if (!text && !plan) return null
  return { text, plan, date: o.follow_up_date, status: outcomeLabel(o.outcome_status) }
})

interface Step {
  label: string
  hint?: string
  state: 'done' | 'current' | 'todo' | 'failed'
  icon: Component
}
const steps = computed<Step[]>(() => {
  const v = s.value
  if (!v) return []
  const sent: Step = { label: 'Diajukan', hint: formatDate(v.created_at), state: 'done', icon: Send }
  if (v.status === 'cancelled') return [sent, { label: 'Dibatalkan', state: 'failed', icon: CircleX }]
  const sch: Step = {
    label: v.status === 'rescheduled' ? 'Dijadwalkan ulang' : 'Dijadwalkan',
    hint: scheduled.value ? undefined : 'Menunggu guru BK',
    state: scheduled.value ? 'done' : 'current',
    icon: CalendarClock,
  }
  const done: Step = {
    label: 'Selesai',
    state: v.status === 'completed' ? 'done' : scheduled.value ? 'current' : 'todo',
    icon: Check,
  }
  return [sent, sch, done]
})

const STEP_CLS: Record<Step['state'], string> = {
  done: 'bg-emerald-500 text-white',
  current: 'bg-accent-soft text-accent ring-2 ring-primary-500',
  todo: 'bg-surface-muted text-fg-subtle',
  failed: 'bg-red-500 text-white',
}

watch(
  () => [open.value, props.session?.id] as const,
  async ([isOpen, id]) => {
    if (!isOpen || !id) return
    detail.value = null
    error.value = ''
    loading.value = true
    try {
      const fresh = await counseling.getSession(id)
      if (props.session?.id === id) detail.value = fresh
    } catch (err) {
      if (getApiErrorCode(err) === 'NOT_ENROLLED') {
        open.value = false
        void student.fetchMe(true).catch(() => undefined)
        return
      }
      error.value = getApiError(err, 'Tidak dapat memuat pembaruan terbaru.')
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <BottomSheet v-model:open="open" :title="s?.topic ?? 'Detail sesi'" :description="s ? sessionTypeLabel(s.counseling_type) : undefined">
    <div v-if="s" class="space-y-4 pb-2" :aria-busy="loading || undefined">
      <AlertBanner v-if="error" tone="warning">{{ error }}</AlertBanner>

      <!-- Linimasa status -->
      <ol class="flex items-start" aria-label="Status pengajuan">
        <li
          v-for="(step, i) in steps"
          :key="step.label"
          class="relative flex flex-1 flex-col items-center text-center"
          :aria-current="step.state === 'current' ? 'step' : undefined"
        >
          <span
            v-if="i > 0"
            class="absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2"
            :class="step.state === 'todo' ? 'bg-line' : step.state === 'failed' ? 'bg-red-300 dark:bg-red-500/40' : 'bg-emerald-400'"
            aria-hidden="true"
          />
          <span class="relative z-10 flex h-8 w-8 items-center justify-center rounded-full" :class="STEP_CLS[step.state]">
            <component :is="step.icon" :size="15" aria-hidden="true" />
          </span>
          <span class="mt-1.5 text-xs font-semibold" :class="step.state === 'todo' ? 'text-fg-subtle' : 'text-fg'">{{ step.label }}</span>
          <span v-if="step.hint" class="text-[11px] text-fg-subtle">{{ step.hint }}</span>
        </li>
      </ol>

      <!-- Jadwal -->
      <section class="rounded-2xl bg-surface-muted p-3.5" aria-labelledby="sched-title">
        <div class="flex items-center justify-between gap-2">
          <h3 id="sched-title" class="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {{ scheduled ? 'Jadwal sesi' : s.status === 'cancelled' ? 'Waktu yang diajukan' : 'Waktu yang kamu minta' }}
          </h3>
          <StatusPill :label="st.label" :tone="st.tone" />
        </div>
        <p class="mt-2 text-[15px] font-semibold capitalize text-fg">{{ formatLongDate(s.requested_date) }}</p>
        <p class="text-sm tabular-nums text-fg-muted">{{ formatTime(s.start_time) }}–{{ formatTime(s.end_time) }} {{ tz }}</p>
        <p v-if="scheduled && s.place" class="mt-1 text-sm text-fg-muted">Tempat: <span class="font-medium text-fg">{{ s.place }}</span></p>
        <p v-if="s.status === 'pending'" class="mt-2 text-xs text-fg-subtle">Guru BK akan mengonfirmasi atau menyesuaikan jadwal ini.</p>
        <p v-if="s.counselor?.full_name" class="mt-2 text-sm text-fg-muted">
          Guru BK: <span class="font-medium text-fg">{{ s.counselor.full_name }}</span>
        </p>
      </section>

      <AlertBanner v-if="s.reschedule_reason && (s.status === 'rescheduled' || s.status === 'cancelled')" :tone="s.status === 'cancelled' ? 'danger' : 'info'" :title="s.status === 'cancelled' ? 'Keterangan pembatalan' : 'Alasan perubahan jadwal'">
        {{ s.reschedule_reason }}
      </AlertBanner>

      <section v-if="friends.length" aria-labelledby="friends-title">
        <h3 id="friends-title" class="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Teman yang ikut</h3>
        <p class="mt-1 text-sm text-fg">{{ friends.join(', ') }}</p>
      </section>

      <section v-if="s.description" aria-labelledby="story-title">
        <h3 id="story-title" class="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Cerita singkat</h3>
        <p class="mt-1 whitespace-pre-line break-words text-sm text-fg">{{ s.description }}</p>
      </section>

      <!-- Umpan balik untuk siswa (catatan rahasia guru BK tidak pernah ditampilkan) -->
      <section
        v-if="feedback"
        class="rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:ring-emerald-400/20"
        aria-labelledby="fb-title"
      >
        <h3 id="fb-title" class="flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-100">
          <MessageSquareHeart :size="17" class="text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
          Pesan dari guru BK
        </h3>
        <p v-if="feedback.status" class="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{{ feedback.status }}</p>
        <p v-if="feedback.text" class="mt-2 whitespace-pre-line break-words text-sm text-fg">{{ feedback.text }}</p>
        <div v-if="feedback.plan" class="mt-3 border-t border-emerald-600/15 pt-2 text-sm dark:border-emerald-400/20">
          <p class="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
            Rencana tindak lanjut<template v-if="feedback.date"> · {{ formatDate(feedback.date) }}</template>
          </p>
          <p class="mt-0.5 whitespace-pre-line break-words text-fg">{{ feedback.plan }}</p>
        </div>
      </section>
    </div>
  </BottomSheet>
</template>
