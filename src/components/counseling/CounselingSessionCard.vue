<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, ChevronRight, MapPin, UserRound } from 'lucide-vue-next'
import StatusPill from '@/components/ui/StatusPill.vue'
import { formatDayShort, formatTime } from '@/utils/format'
import { isSessionScheduled, sessionStatus, sessionTypeLabel } from '@/utils/counseling'
import type { CounselingSession } from '@/types/counseling'

const props = defineProps<{ session: CounselingSession }>()
defineEmits<{ open: [] }>()

const st = computed(() => sessionStatus(props.session.status))
const scheduled = computed(() => isSessionScheduled(props.session))
const when = computed(
  () => `${formatDayShort(props.session.requested_date)} · ${formatTime(props.session.start_time)}–${formatTime(props.session.end_time)}`,
)
</script>

<template>
  <button
    type="button"
    class="pressable card flex w-full items-start gap-3 p-4 text-left"
    :aria-label="`${session.topic}, ${st.label}. Lihat detail`"
    @click="$emit('open')"
  >
    <span class="min-w-0 flex-1">
      <span class="flex items-start justify-between gap-2">
        <span class="min-w-0">
          <span class="block truncate text-[15px] font-semibold text-fg">{{ session.topic }}</span>
          <span class="block text-xs text-fg-subtle">{{ sessionTypeLabel(session.counseling_type) }}</span>
        </span>
        <StatusPill :label="st.label" :tone="st.tone" />
      </span>
      <span class="mt-2.5 flex flex-col gap-1 text-[13px] text-fg-muted">
        <span class="inline-flex items-center gap-1.5">
          <CalendarDays :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
          <span class="capitalize tabular-nums">{{ when }}</span>
          <span v-if="!scheduled && session.status !== 'cancelled'" class="text-fg-subtle">(permintaan)</span>
        </span>
        <span v-if="scheduled && session.place" class="inline-flex items-center gap-1.5">
          <MapPin :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
          <span class="truncate">{{ session.place }}</span>
        </span>
        <span v-if="session.counselor?.full_name" class="inline-flex items-center gap-1.5">
          <UserRound :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
          <span class="truncate">{{ session.counselor.full_name }}</span>
        </span>
      </span>
    </span>
    <ChevronRight :size="18" class="mt-1 shrink-0 text-fg-subtle" aria-hidden="true" />
  </button>
</template>
