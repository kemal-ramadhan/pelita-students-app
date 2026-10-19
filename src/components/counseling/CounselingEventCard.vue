<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, CircleCheckBig, Clock, MapPin, UserRound } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { addMinutes, formatLongDate, formatTime } from '@/utils/format'
import { EVENT_ATTEND_LEAD_MINUTES, eventPhase } from '@/utils/counseling'
import type { CounselingEvent } from '@/types/counseling'

const props = defineProps<{
  event: CounselingEvent
  attended: boolean
  /** Waktu sekolah saat ini. */
  now: { date: string; time: string }
  tzLabel: string
  attending?: boolean
}>()
defineEmits<{ attend: [] }>()

const phase = computed(() => eventPhase(props.event, props.now))
const isToday = computed(() => props.event.event_date === props.now.date)
const opensAt = computed(() => {
  const m = /^(\d{2}):(\d{2})/.exec(props.event.start_time)
  if (!m) return ''
  const total = Number(m[1]) * 60 + Number(m[2]) - EVENT_ATTEND_LEAD_MINUTES
  return total <= 0 ? '00:00' : (addMinutes('00:00', total) ?? '')
})
</script>

<template>
  <article class="card p-4" :aria-labelledby="`ev-${event.id}`">
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p v-if="event.category" class="text-xs font-semibold text-accent">{{ event.category }}</p>
        <h3 :id="`ev-${event.id}`" class="text-[15px] font-semibold text-fg">{{ event.title }}</h3>
      </div>
      <StatusPill v-if="phase === 'open'" label="Berlangsung" tone="success" />
      <StatusPill v-else-if="isToday && phase !== 'ended'" label="Hari ini" tone="info" />
    </div>

    <p v-if="event.description" class="mt-1.5 line-clamp-3 whitespace-pre-line break-words text-sm text-fg-muted">{{ event.description }}</p>

    <div class="mt-3 flex flex-col gap-1 text-[13px] text-fg-muted">
      <span class="inline-flex items-center gap-1.5">
        <CalendarDays :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
        <span class="capitalize">{{ formatLongDate(event.event_date) }}</span>
      </span>
      <span class="inline-flex items-center gap-1.5 tabular-nums">
        <Clock :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
        {{ formatTime(event.start_time) }}–{{ formatTime(event.end_time) }} {{ tzLabel }}
      </span>
      <span v-if="event.location" class="inline-flex items-center gap-1.5">
        <MapPin :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
        <span class="truncate">{{ event.location }}</span>
      </span>
      <span v-if="event.counselor?.full_name" class="inline-flex items-center gap-1.5">
        <UserRound :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
        <span class="truncate">{{ event.counselor.full_name }}</span>
      </span>
    </div>

    <div class="mt-3 flex min-h-10 items-center justify-between gap-3 border-t border-line pt-3">
      <template v-if="attended">
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400" role="status">
          <CircleCheckBig :size="17" aria-hidden="true" /> Kamu tercatat hadir
        </span>
      </template>
      <template v-else-if="phase === 'open'">
        <span class="text-xs text-fg-subtle">Tandai hadir saat kamu sudah mengikuti kegiatan.</span>
        <BaseButton size="sm" :loading="attending" @click="$emit('attend')">Saya hadir</BaseButton>
      </template>
      <span v-else-if="phase === 'soon'" class="text-xs text-fg-subtle">Presensi dibuka pukul {{ formatTime(opensAt) }} {{ tzLabel }}.</span>
      <span v-else-if="phase === 'upcoming'" class="text-xs text-fg-subtle">Presensi dibuka pada hari acara, 30 menit sebelum mulai.</span>
      <span v-else class="text-xs text-fg-subtle">Kegiatan sudah selesai.</span>
    </div>
  </article>
</template>
