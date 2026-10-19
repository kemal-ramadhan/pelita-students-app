<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock,
  FileText,
  Hourglass,
  ListChecks,
} from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useStudentAssessmentStore } from '@/stores/assessmentStudent'
import { useStudentStore } from '@/stores/student'
import { haptic } from '@/composables/useHaptic'
import { getApiError, getApiErrorCode } from '@/utils/api'
import { formatDate, formatTime } from '@/utils/format'
import {
  INSTRUMENT_LABELS,
  INSTRUMENT_STATUS,
  instrumentAction,
  instrumentName,
} from '@/utils/assessment'
import type { SessionInstrument, SessionState, StudentSession } from '@/types/assessment'

type Tab = 'sesi' | 'riwayat'
const TABS: { key: Tab; label: string }[] = [
  { key: 'sesi', label: 'Sesi Asesmen' },
  { key: 'riwayat', label: 'Riwayat Hasil' },
]

const route = useRoute()
const router = useRouter()
const store = useStudentAssessmentStore()
const student = useStudentStore()

const tab = computed<Tab>({
  get: () => (route.query.tab === 'riwayat' ? 'riwayat' : 'sesi'),
  set: (v) => {
    haptic(6)
    void router.replace({ query: { ...route.query, tab: v === 'sesi' ? undefined : v } })
  },
})

const loading = ref({ sessions: false, results: false })
const errors = ref({ sessions: '', results: '' })
const refreshing = computed(() => loading.value.sessions || loading.value.results)

async function guarded(key: 'sessions' | 'results', fallback: string, fn: () => Promise<unknown>) {
  loading.value[key] = true
  errors.value[key] = ''
  try {
    await fn()
  } catch (err) {
    if (getApiErrorCode(err) === 'NOT_ENROLLED') await student.fetchMe(true).catch(() => undefined)
    else errors.value[key] = getApiError(err, fallback)
  } finally {
    loading.value[key] = false
  }
}

const loadSessions = () =>
  guarded('sessions', 'Tidak dapat memuat sesi asesmen.', () => store.fetchSessions())
const loadResults = () =>
  guarded('results', 'Tidak dapat memuat riwayat hasil.', () => store.fetchResults())

async function loadAll() {
  if (!student.isActive) return
  await Promise.all([loadSessions(), loadResults()])
}

onMounted(async () => {
  await student.fetchMe().catch(() => undefined)
  void loadAll()
})
watch(
  () => student.isActive,
  (a) => a && loadAll(),
)

const GROUPS: { state: SessionState; title: string }[] = [
  { state: 'open', title: 'Sedang dibuka' },
  { state: 'upcoming', title: 'Akan datang' },
  { state: 'closed', title: 'Sudah ditutup' },
]
const grouped = computed(() =>
  GROUPS.map((g) => ({
    ...g,
    sessions: store.sessions
      .filter((s) => s.state === g.state)
      .sort((a, b) =>
        g.state === 'closed'
          ? b.closes_at.localeCompare(a.closes_at)
          : a.opens_at.localeCompare(b.opens_at),
      ),
  })).filter((g) => g.sessions.length),
)

const sortedResults = computed(() =>
  [...store.results].sort((a, b) => b.created_at.localeCompare(a.created_at)),
)

function when(s: StudentSession) {
  const fmt = (v: string) => `${formatDate(v)} ${formatTime(v)}`
  if (s.state === 'upcoming') return `Dibuka ${fmt(s.opens_at)}`
  if (s.state === 'open') return `Ditutup ${fmt(s.closes_at)}`
  return `Ditutup ${formatDate(s.closes_at)}`
}

function act(s: StudentSession, ins: SessionInstrument) {
  const a = instrumentAction(s.state, ins)
  haptic(10)
  if (a.kind === 'start')
    void router.push({ name: 'assessment-take', params: { sessionId: s.id, instrument: ins.code } })
  else if (a.kind === 'resume')
    void router.push({
      name: 'assessment-take',
      params: { sessionId: s.id, instrument: ins.code },
      query: { attempt: a.attemptId },
    })
  else if (a.kind === 'processing')
    void router.push({ name: 'assessment-submitting', params: { attemptId: a.attemptId } })
  else if (a.kind === 'result')
    void router.push({ name: 'assessment-result', params: { attemptId: a.attemptId } })
}

const progressText = (s: StudentSession) => {
  const done = s.instruments.filter((i) => i.status === 'completed').length
  return `${done}/${s.instruments.length} tes selesai`
}

function resultKey(r: {
  holland_code?: string | null
  vark_category?: string | null
  recommended_track?: string | null
}) {
  return r.holland_code || r.recommended_track || r.vark_category || ''
}
</script>

<template>
  <div class="space-y-4">
    <Teleport defer to="#header-actions">
      <RefreshButton
        v-if="student.isActive"
        :loading="refreshing"
        label="Muat ulang asesmen"
        @click="loadAll"
      />
    </Teleport>

    <EnrollmentGate
      join-message="Asesmen minat dan karier tersedia setelah kamu tergabung dengan sekolah."
    >
      <section class="card flex items-start gap-3 p-4" aria-label="Tentang asesmen">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"
        >
          <BrainCircuit :size="22" aria-hidden="true" />
        </span>
        <p class="text-sm text-fg-muted">
          Asesmen membantumu mengenali minat, gaya belajar, dan arah karier. Ini
          <strong class="text-fg">bukan ujian</strong> — hasilnya adalah gambaran untuk didiskusikan
          bersama Guru BK dan orang tua.
        </p>
      </section>

      <div
        class="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1"
        role="tablist"
        aria-label="Menu asesmen"
      >
        <button
          v-for="t in TABS"
          :id="`tab-${t.key}`"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="tab === t.key"
          :aria-controls="`panel-${t.key}`"
          class="pressable h-10 rounded-xl text-sm font-semibold"
          :class="tab === t.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
          @click="tab = t.key"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Sesi -->
      <div
        v-if="tab === 'sesi'"
        id="panel-sesi"
        class="mt-4"
        role="tabpanel"
        aria-labelledby="tab-sesi"
      >
        <ErrorState
          v-if="errors.sessions && !store.sessionsLoaded"
          :message="errors.sessions"
          :loading="loading.sessions"
          @retry="loadSessions"
        />
        <div
          v-else-if="!store.sessionsLoaded"
          class="space-y-2"
          aria-busy="true"
          aria-label="Memuat sesi asesmen"
        >
          <div v-for="i in 2" :key="i" class="skeleton h-44 w-full rounded-2xl" />
        </div>
        <div v-else-if="!store.sessions.length" class="card">
          <EmptyState
            :icon="ListChecks"
            title="Belum ada asesmen"
            description="Sesi asesmen yang ditugaskan sekolah akan muncul di sini."
          />
        </div>
        <div v-else class="space-y-5">
          <section v-for="g in grouped" :key="g.state" :aria-labelledby="`grp-${g.state}`">
            <h2
              :id="`grp-${g.state}`"
              class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle"
            >
              {{ g.title }}
            </h2>
            <ul class="space-y-3">
              <li v-for="s in g.sessions" :key="s.id" class="card p-4">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h3 class="text-[15px] font-semibold text-fg">{{ s.title }}</h3>
                    <p v-if="s.description" class="mt-0.5 line-clamp-2 text-[13px] text-fg-muted">
                      {{ s.description }}
                    </p>
                  </div>
                  <span class="shrink-0 text-xs tabular-nums text-fg-subtle">{{
                    progressText(s)
                  }}</span>
                </div>
                <p class="mt-2 inline-flex items-center gap-1.5 text-[13px] text-fg-muted">
                  <CalendarDays :size="14" class="shrink-0 text-fg-subtle" aria-hidden="true" />
                  <span class="tabular-nums">{{ when(s) }}</span>
                </p>

                <ul class="mt-3 divide-y divide-line border-t border-line">
                  <li
                    v-for="ins in s.instruments"
                    :key="ins.code"
                    class="flex items-center gap-3 py-3 last:pb-0"
                  >
                    <span
                      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white"
                      :class="INSTRUMENT_LABELS[ins.code]?.color ?? 'from-slate-500 to-slate-700'"
                      aria-hidden="true"
                      >{{ ins.code }}</span
                    >
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-medium text-fg">{{
                        instrumentName(ins.code, ins.name)
                      }}</span>
                      <span
                        class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle"
                      >
                        <span class="inline-flex items-center gap-1"
                          ><Clock :size="12" aria-hidden="true" />±{{
                            ins.estimated_minutes
                          }}
                          mnt</span
                        >
                        <span>{{ ins.total_questions }} butir</span>
                        <StatusPill
                          :label="INSTRUMENT_STATUS[ins.status]?.label ?? ins.status"
                          :tone="INSTRUMENT_STATUS[ins.status]?.tone ?? 'neutral'"
                        />
                      </span>
                    </span>
                    <template v-for="a in [instrumentAction(s.state, ins)]" :key="a.kind">
                      <BaseButton
                        v-if="a.kind === 'start'"
                        size="sm"
                        :icon-right="ArrowRight"
                        @click="act(s, ins)"
                        >Mulai</BaseButton
                      >
                      <BaseButton
                        v-else-if="a.kind === 'resume'"
                        size="sm"
                        :icon-right="ArrowRight"
                        @click="act(s, ins)"
                        >Lanjutkan</BaseButton
                      >
                      <BaseButton
                        v-else-if="a.kind === 'processing'"
                        size="sm"
                        variant="secondary"
                        :icon="Hourglass"
                        @click="act(s, ins)"
                      >
                        {{ ins.status === 'failed' ? 'Cek status' : 'Diproses' }}
                      </BaseButton>
                      <BaseButton
                        v-else-if="a.kind === 'result'"
                        size="sm"
                        variant="soft"
                        :icon="CircleCheck"
                        @click="act(s, ins)"
                        >Lihat hasil</BaseButton
                      >
                      <span
                        v-else-if="a.reason"
                        class="shrink-0 text-xs font-medium text-fg-subtle"
                        >{{ a.reason }}</span
                      >
                    </template>
                  </li>
                </ul>
              </li>
            </ul>
          </section>
        </div>
      </div>

      <!-- Riwayat -->
      <div v-else id="panel-riwayat" class="mt-4" role="tabpanel" aria-labelledby="tab-riwayat">
        <ErrorState
          v-if="errors.results && !store.resultsLoaded"
          :message="errors.results"
          :loading="loading.results"
          @retry="loadResults"
        />
        <div
          v-else-if="!store.resultsLoaded"
          class="space-y-2"
          aria-busy="true"
          aria-label="Memuat riwayat"
        >
          <div v-for="i in 3" :key="i" class="skeleton h-20 w-full rounded-2xl" />
        </div>
        <div v-else-if="!sortedResults.length" class="card">
          <EmptyState
            :icon="FileText"
            title="Belum ada hasil"
            description="Hasil asesmen yang sudah selesai diproses akan tersimpan di sini."
          />
        </div>
        <ul v-else class="space-y-2">
          <li v-for="r in sortedResults" :key="r.id">
            <RouterLink
              :to="{ name: 'assessment-result', params: { attemptId: r.attempt_id } }"
              class="pressable card flex items-center gap-3 p-4"
              @click="haptic(8)"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-bold text-white"
                :class="
                  INSTRUMENT_LABELS[r.instrument_code]?.color ?? 'from-slate-500 to-slate-700'
                "
                aria-hidden="true"
                >{{ r.instrument_code }}</span
              >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold text-fg">{{
                  instrumentName(r.instrument_code)
                }}</span>
                <span class="block truncate text-xs text-fg-subtle">
                  {{ formatDate(r.created_at)
                  }}<template v-if="r.session_title"> · {{ r.session_title }}</template>
                </span>
              </span>
              <span
                v-if="resultKey(r)"
                class="shrink-0 rounded-lg bg-accent-soft px-2 py-1 text-xs font-semibold text-accent"
                >{{ resultKey(r) }}</span
              >
              <ChevronRight :size="18" class="shrink-0 text-fg-subtle" aria-hidden="true" />
            </RouterLink>
          </li>
        </ul>
      </div>
    </EnrollmentGate>
  </div>
</template>
