<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CalendarHeart, MessagesSquare } from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import CounselingRequestForm from '@/components/counseling/CounselingRequestForm.vue'
import CounselingSessionCard from '@/components/counseling/CounselingSessionCard.vue'
import CounselingSessionSheet from '@/components/counseling/CounselingSessionSheet.vue'
import CounselingEventCard from '@/components/counseling/CounselingEventCard.vue'
import { useCounselingStore } from '@/stores/counseling'
import { useStudentStore } from '@/stores/student'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { haptic } from '@/composables/useHaptic'
import { getApiError, getApiErrorCode } from '@/utils/api'
import { formatTime, nowInTimeZone, timeZoneLabel } from '@/utils/format'
import { isEventAttended, isSessionOpen } from '@/utils/counseling'
import type { CounselingEvent, CounselingSession } from '@/types/counseling'

type Tab = 'ajukan' | 'sesi' | 'kegiatan'
const TABS: { key: Tab; label: string }[] = [
  { key: 'ajukan', label: 'Ajukan' },
  { key: 'sesi', label: 'Sesi Saya' },
  { key: 'kegiatan', label: 'Kegiatan' },
]

const route = useRoute()
const router = useRouter()
const counseling = useCounselingStore()
const student = useStudentStore()

const tab = computed<Tab>({
  get: () => {
    const q = route.query.tab
    return q === 'sesi' || q === 'kegiatan' ? q : 'ajukan'
  },
  set: (v) => {
    haptic(6)
    void router.replace({ query: { ...route.query, tab: v === 'ajukan' ? undefined : v } })
  },
})

const loading = ref({ counselors: false, sessions: false, events: false })
const errors = ref({ counselors: '', sessions: '', events: '' })
const refreshing = computed(() => Object.values(loading.value).some(Boolean))

const tz = computed(() => student.school?.timezone)
const tzLabel = computed(() => timeZoneLabel(tz.value))
const now = ref(nowInTimeZone(tz.value))
const today = computed(() => now.value.date)
// Perbarui jam sekolah tiap menit agar tombol presensi acara terbuka/tertutup tepat waktu.
let clock: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  clock = setInterval(() => (now.value = nowInTimeZone(tz.value)), 30_000)
})
onBeforeUnmount(() => clearInterval(clock))

/** NOT_ENROLLED → muat ulang status; EnrollmentGate menampilkan ajakan gabung. */
async function guarded<T>(key: keyof typeof errors.value, fallback: string, fn: () => Promise<T>) {
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

const loadCounselors = (force = false) =>
  guarded('counselors', 'Gagal memuat daftar guru BK.', () => counseling.fetchCounselors(force))
const loadSessions = () => guarded('sessions', 'Tidak dapat memuat sesi konseling.', () => counseling.fetchSessions())
const loadEvents = () => guarded('events', 'Tidak dapat memuat kegiatan BK.', () => counseling.fetchEvents())

async function loadAll(force = false) {
  if (!student.isActive) return
  now.value = nowInTimeZone(tz.value)
  await Promise.all([loadCounselors(force), loadSessions(), loadEvents()])
}

onMounted(async () => {
  await student.fetchMe().catch(() => undefined)
  void loadAll()
})
watch(
  () => student.isActive,
  (a) => a && loadAll(),
)

/* ---------------- Sesi ---------------- */
const openSessions = computed(() =>
  counseling.sessions
    .filter(isSessionOpen)
    .sort((a, b) => `${a.requested_date} ${a.start_time}`.localeCompare(`${b.requested_date} ${b.start_time}`)),
)
const pastSessions = computed(() =>
  counseling.sessions
    .filter((s) => !isSessionOpen(s))
    .sort((a, b) => `${b.requested_date} ${b.start_time}`.localeCompare(`${a.requested_date} ${a.start_time}`)),
)

const sheetOpen = ref(false)
const sheetSession = ref<CounselingSession | null>(null)
function openSession(s: CounselingSession) {
  haptic(8)
  sheetSession.value = s
  sheetOpen.value = true
}

function onSubmitted() {
  tab.value = 'sesi'
}

/* ---------------- Kegiatan ---------------- */
const upcomingEvents = computed(() =>
  counseling.events
    .filter((e) => e.event_date >= today.value)
    .sort((a, b) => `${a.event_date} ${a.start_time}`.localeCompare(`${b.event_date} ${b.start_time}`)),
)
const pastEvents = computed(() =>
  counseling.events
    .filter((e) => e.event_date < today.value)
    .sort((a, b) => `${b.event_date} ${b.start_time}`.localeCompare(`${a.event_date} ${a.start_time}`))
    .slice(0, 10),
)
const attended = (e: CounselingEvent) => isEventAttended(e, student.student?.id, counseling.attendedIds)

const attendingId = ref<string | null>(null)
async function attend(e: CounselingEvent) {
  const ok = await confirm({
    title: 'Tandai hadir?',
    message: `Kehadiranmu di "${e.title}" akan dicatat dan dilihat guru BK. Lakukan hanya bila kamu sedang mengikuti kegiatan ini.`,
    confirmText: 'Ya, saya hadir',
  })
  if (!ok) return
  attendingId.value = e.id
  try {
    const res = await counseling.attendEvent(e.id)
    haptic(15)
    toast.success('Kehadiran tercatat', res?.check_in_time ? `Pukul ${formatTime(res.check_in_time)}` : e.title)
  } catch (err) {
    const code = getApiErrorCode(err)
    if (code === 'NOT_ENROLLED') await student.fetchMe(true).catch(() => undefined)
    else {
      toast.error('Gagal mencatat kehadiran', getApiError(err))
      // Jadwal/status acara mungkin berubah (EVENT_NOT_OPEN, EVENT_NOT_TODAY, NOT_EVENT_AUDIENCE).
      if (code) void loadEvents()
    }
  } finally {
    attendingId.value = null
  }
}
</script>

<template>
  <div class="space-y-4">
    <Teleport defer to="#header-actions">
      <RefreshButton v-if="student.isActive" :loading="refreshing" label="Muat ulang konseling" @click="loadAll(true)" />
    </Teleport>

    <EnrollmentGate join-message="Layanan Bimbingan Konseling tersedia setelah kamu tergabung dengan sekolah.">
      <div class="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1" role="tablist" aria-label="Menu konseling">
        <button
          v-for="t in TABS"
          :id="`tab-${t.key}`"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="tab === t.key"
          :aria-controls="`panel-${t.key}`"
          class="pressable relative h-10 rounded-xl text-sm font-semibold"
          :class="tab === t.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
          @click="tab = t.key"
        >
          {{ t.label }}
          <span
            v-if="t.key === 'sesi' && openSessions.length"
            class="ml-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold leading-[18px] text-white"
            >{{ openSessions.length }}<span class="sr-only"> sesi aktif</span></span
          >
        </button>
      </div>

      <!-- Ajukan -->
      <div v-if="tab === 'ajukan'" id="panel-ajukan" class="mt-4" role="tabpanel" aria-labelledby="tab-ajukan">
        <CounselingRequestForm
          :counselors-loading="loading.counselors"
          :counselors-error="errors.counselors"
          @retry-counselors="loadCounselors(true)"
          @submitted="onSubmitted"
        />
      </div>

      <!-- Sesi Saya -->
      <div v-else-if="tab === 'sesi'" id="panel-sesi" class="mt-4" role="tabpanel" aria-labelledby="tab-sesi">
        <ErrorState v-if="errors.sessions && !counseling.sessionsLoaded" :message="errors.sessions" :loading="loading.sessions" @retry="loadSessions" />
        <div v-else-if="!counseling.sessionsLoaded" class="space-y-2" aria-busy="true" aria-label="Memuat sesi">
          <div v-for="i in 3" :key="i" class="skeleton h-28 w-full rounded-2xl" />
        </div>
        <div v-else-if="!counseling.sessions.length" class="card">
          <EmptyState :icon="MessagesSquare" title="Belum ada sesi" description="Ajukan sesi bila kamu ingin bercerita atau berkonsultasi dengan guru BK.">
            <BaseButton @click="tab = 'ajukan'">Ajukan sesi</BaseButton>
          </EmptyState>
        </div>
        <div v-else class="space-y-5">
          <section v-if="openSessions.length" aria-labelledby="open-title">
            <h2 id="open-title" class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Sedang berjalan</h2>
            <ul class="space-y-2">
              <li v-for="s in openSessions" :key="s.id"><CounselingSessionCard :session="s" @open="openSession(s)" /></li>
            </ul>
          </section>
          <section v-if="pastSessions.length" aria-labelledby="past-title">
            <h2 id="past-title" class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Riwayat</h2>
            <ul class="space-y-2">
              <li v-for="s in pastSessions" :key="s.id"><CounselingSessionCard :session="s" @open="openSession(s)" /></li>
            </ul>
          </section>
        </div>
      </div>

      <!-- Kegiatan -->
      <div v-else id="panel-kegiatan" class="mt-4" role="tabpanel" aria-labelledby="tab-kegiatan">
        <ErrorState v-if="errors.events && !counseling.eventsLoaded" :message="errors.events" :loading="loading.events" @retry="loadEvents" />
        <div v-else-if="!counseling.eventsLoaded" class="space-y-2" aria-busy="true" aria-label="Memuat kegiatan">
          <div v-for="i in 3" :key="i" class="skeleton h-40 w-full rounded-2xl" />
        </div>
        <div v-else-if="!counseling.events.length" class="card">
          <EmptyState :icon="CalendarHeart" title="Belum ada kegiatan" description="Bimbingan kelompok dan klasikal dari guru BK akan muncul di sini." />
        </div>
        <div v-else class="space-y-5">
          <section v-if="upcomingEvents.length" aria-labelledby="ev-up-title">
            <h2 id="ev-up-title" class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Akan datang</h2>
            <ul class="space-y-2">
              <li v-for="e in upcomingEvents" :key="e.id">
                <CounselingEventCard :event="e" :attended="attended(e)" :now="now" :tz-label="tzLabel" :attending="attendingId === e.id" @attend="attend(e)" />
              </li>
            </ul>
          </section>
          <p v-else class="card p-4 text-center text-sm text-fg-muted">Belum ada kegiatan yang akan datang.</p>
          <section v-if="pastEvents.length" aria-labelledby="ev-past-title">
            <h2 id="ev-past-title" class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">Sudah lewat</h2>
            <ul class="space-y-2">
              <li v-for="e in pastEvents" :key="e.id">
                <CounselingEventCard :event="e" :attended="attended(e)" :now="now" :tz-label="tzLabel" />
              </li>
            </ul>
          </section>
        </div>
      </div>
    </EnrollmentGate>

    <CounselingSessionSheet v-model:open="sheetOpen" :session="sheetSession" />
  </div>
</template>
