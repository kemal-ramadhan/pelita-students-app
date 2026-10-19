<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Clock,
  CloudCheck,
  CloudOff,
  Grid3x3,
  Info,
  LoaderCircle,
  Lock,
  Send,
  ShieldCheck,
  Timer,
  Type,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import QuestionItem from '@/components/assessment/QuestionItem.vue'
import { useStudentAssessmentStore } from '@/stores/assessmentStudent'
import { useStudentStore } from '@/stores/student'
import { useAnswerAutosave, readPending } from '@/composables/useAnswerAutosave'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { haptic } from '@/composables/useHaptic'
import { getApiStatus } from '@/utils/api'
import {
  assessmentError,
  formatClock,
  instrumentName,
  isNetworkError,
  missingItems,
  normalizeAnswer,
  questionChoices,
  readLocal,
  writeLocal,
  type ChoiceItem,
} from '@/utils/assessment'
import type {
  AnswerMap,
  AnswerValue,
  AssessmentSection,
  AttemptQuestion,
  AttemptState,
  InstrumentCode,
  InteractiveExample,
  OnboardingData,
} from '@/types/assessment'

const CODES: InstrumentCode[] = ['TMB', 'RIA', 'PMK', 'ADN']
const PREFS_KEY = 'edupilot.assessment.prefs'
const sectionStartKey = (attemptId: string) => `edupilot.assessment.section-start.${attemptId}`

const route = useRoute()
const router = useRouter()
const store = useStudentAssessmentStore()
const student = useStudentStore()

const sessionId = computed(() => String(route.params.sessionId ?? ''))
const instrument = computed(
  () => String(route.params.instrument ?? '').toUpperCase() as InstrumentCode,
)

type Phase = 'loading' | 'error' | 'blocked' | 'onboarding' | 'testing'
const phase = ref<Phase>('loading')
const loadError = ref('')
const blocked = ref<{ title: string; message: string; code?: string } | null>(null)

/* ================================================================== */
/* Preferensi tampilan                                                 */
/* ================================================================== */
const prefs = reactive<{ perPage: 1 | 5; fontLevel: number; autoNext: boolean }>({
  perPage: 1,
  fontLevel: 0,
  autoNext: true,
})
const savedPrefs = readLocal<Partial<typeof prefs>>(PREFS_KEY)
if (savedPrefs) {
  if (savedPrefs.perPage === 1 || savedPrefs.perPage === 5) prefs.perPage = savedPrefs.perPage
  if (typeof savedPrefs.fontLevel === 'number')
    prefs.fontLevel = Math.min(2, Math.max(0, savedPrefs.fontLevel))
  if (typeof savedPrefs.autoNext === 'boolean') prefs.autoNext = savedPrefs.autoNext
}
watch(prefs, (p) => writeLocal(PREFS_KEY, { ...p }), { deep: true })
const settingsOpen = ref(false)
const FONT_LABELS = ['Normal', 'Besar', 'Sangat besar']

/* ================================================================== */
/* Onboarding                                                          */
/* ================================================================== */
const onboarding = ref<OnboardingData | null>(null)
const consent = ref(false)
const consentError = ref('')
const starting = ref(false)
const practice = ref<Record<number, string>>({})

function exampleQuestion(ex: InteractiveExample) {
  return ex.sample_question || ex.question || ex.text || ''
}
function exampleOptions(ex: InteractiveExample): { key: string; label: string }[] {
  const raw = ex.options?.length ? ex.options : (ex.scale_labels ?? [])
  return raw.map((o, i) =>
    typeof o === 'string'
      ? { key: String(i), label: o }
      : { key: o.key, label: `${o.key}. ${o.text}` },
  )
}
function selectedOption(ex: InteractiveExample, i: number) {
  return exampleOptions(ex).find((o) => o.key === practice.value[i])
}
/** Kunci jawaban contoh bisa berupa "A" untuk opsi "A. Sekolah". */
function exampleCorrect(ex: InteractiveExample, i: number) {
  const sel = selectedOption(ex, i)
  if (!ex.correct_option || !sel) return null
  const { key, label } = sel
  const c = ex.correct_option.trim().toUpperCase()
  return (
    key.toUpperCase() === c ||
    label.trim().toUpperCase().startsWith(`${c}.`) ||
    label.trim().toUpperCase().startsWith(`${c} `)
  )
}

async function loadOnboarding() {
  phase.value = 'loading'
  try {
    onboarding.value = await store.fetchOnboarding(sessionId.value, instrument.value)
    phase.value = 'onboarding'
  } catch (err) {
    handleBlockingError(err, 'Gagal memuat petunjuk asesmen')
  }
}

async function start() {
  consentError.value = ''
  if (!consent.value) {
    consentError.value = 'Centang persetujuan terlebih dahulu untuk memulai.'
    return
  }
  starting.value = true
  haptic(10)
  try {
    const state = await store.startAttempt(sessionId.value, instrument.value)
    await router.replace({ query: { ...route.query, attempt: state.attempt.id } })
    initAttempt(state)
  } catch (err) {
    const e = assessmentError(err, 'Gagal memulai tes')
    if (e.code === 'CONSENT_REQUIRED') consentError.value = e.message
    else if (
      e.code &&
      [
        'SESSION_NOT_OPEN',
        'MAX_ATTEMPTS',
        'QUOTA_EXHAUSTED',
        'NOT_ENROLLED',
        'STUDENT_ONLY',
        'SCHOOL_INACTIVE',
        'SCHOOL_NOT_SET_UP',
      ].includes(e.code)
    )
      handleBlockingError(err, e.title)
    else toast.error(e.title, e.message)
  } finally {
    starting.value = false
  }
}

function handleBlockingError(err: unknown, fallback: string) {
  const e = assessmentError(err, fallback)
  if (e.code === 'NOT_ENROLLED') void student.fetchMe(true).catch(() => undefined)
  if (e.code === 'ALREADY_SUBMITTED' && attempt.value) return goStatus()
  if (e.code || getApiStatus(err) === 404) {
    blocked.value =
      getApiStatus(err) === 404 && !e.code
        ? { title: 'Asesmen tidak ditemukan', message: 'Sesi atau tes ini tidak tersedia untukmu.' }
        : e
    phase.value = 'blocked'
  } else {
    loadError.value = e.message
    phase.value = 'error'
  }
}

/* ================================================================== */
/* Pengerjaan                                                          */
/* ================================================================== */
const attempt = ref<AttemptState['attempt'] | null>(null)
const sections = ref<AssessmentSection[]>([])
const questions = ref<AttemptQuestion[]>([])
const answers = reactive<AnswerMap>({})
const missing = ref<Set<string>>(new Set())
const pageIndex = ref(0)
const paletteOpen = ref(false)
const submitting = ref(false)

/** Selisih jam server − jam perangkat (ms). */
let clockOffset = 0
const now = ref(Date.now())
const serverNow = () => Date.now() + clockOffset
function syncClock(iso: string) {
  const t = Date.parse(iso)
  if (!Number.isNaN(t)) clockOffset = t - Date.now()
}

const autosave = useAnswerAutosave({
  onAlreadySubmitted: () => goStatus(),
  onServerTime: syncClock,
})

const questionById = computed(() => new Map(questions.value.map((q) => [q.id, q])))
const indexById = computed(() => new Map(questions.value.map((q, i) => [q.id, i])))
const sectionByKey = computed(() => new Map(sections.value.map((s) => [s.key, s])))

interface Page {
  section: AssessmentSection
  items: AttemptQuestion[]
  firstOfSection: boolean
}

/** Halaman tidak melintasi bagian, agar petunjuk & timer per bagian tetap jelas. */
const pages = computed<Page[]>(() => {
  const order: string[] = []
  const bySection = new Map<string, AttemptQuestion[]>()
  for (const q of questions.value) {
    if (!bySection.has(q.section)) {
      bySection.set(q.section, [])
      order.push(q.section)
    }
    bySection.get(q.section)!.push(q)
  }
  const out: Page[] = []
  for (const key of order) {
    const section = sectionByKey.value.get(key) ?? { key, title: key }
    const items = bySection.get(key)!
    for (let i = 0; i < items.length; i += prefs.perPage) {
      out.push({ section, items: items.slice(i, i + prefs.perPage), firstOfSection: i === 0 })
    }
  }
  return out
})
const page = computed(() => pages.value[pageIndex.value])
const isLastPage = computed(() => pageIndex.value >= pages.value.length - 1)

const total = computed(() => questions.value.length)
const answeredCount = computed(
  () => questions.value.filter((q) => answers[q.id] !== undefined).length,
)
const progressPct = computed(() =>
  total.value ? Math.round((answeredCount.value / total.value) * 100) : 0,
)

const sectionChoices = (q: AttemptQuestion): ChoiceItem[] =>
  questionChoices(q, sectionByKey.value.get(q.section)?.scale_labels)

/* ---------------- Timer bagian berwaktu (mis. TMB bakat 20 menit) ---------------- */
const sectionStart = reactive<Record<string, number>>({})
const expiredHandled = new Set<string>()
const timedSections = computed(() => sections.value.filter((s) => (s.time_limit_seconds ?? 0) > 0))

function remainingSec(key: string): number | null {
  const s = sectionByKey.value.get(key)
  const startedAt = sectionStart[key]
  if (!s?.time_limit_seconds || startedAt === undefined) return null
  return Math.max(
    0,
    Math.ceil((startedAt + s.time_limit_seconds * 1000 - (now.value + clockOffset)) / 1000),
  )
}
const isExpired = (key: string) => remainingSec(key) === 0
const needsGate = computed(() => {
  const s = page.value?.section
  return !!s?.time_limit_seconds && sectionStart[s.key] === undefined
})
/** Timer yang ditampilkan: bagian aktif yang berwaktu dan belum habis. */
const activeTimer = computed(() => {
  const cur = page.value?.section
  const candidates = cur?.time_limit_seconds ? [cur, ...timedSections.value] : timedSections.value
  for (const s of candidates) {
    const r = remainingSec(s.key)
    if (r !== null && r > 0) return { section: s, remaining: r }
  }
  return null
})

let tick: ReturnType<typeof setInterval> | undefined
function startTicking() {
  clearInterval(tick)
  if (!timedSections.value.length) return
  tick = setInterval(() => {
    now.value = Date.now()
    for (const s of timedSections.value) {
      const r = remainingSec(s.key)
      if (r === 300 || r === 60) toast.warning(`Sisa waktu ${r / 60} menit`, s.title)
      if (r === 0 && !expiredHandled.has(s.key)) onSectionExpired(s)
    }
  }, 1000)
}

async function startSection(s: AssessmentSection) {
  haptic(12)
  sectionStart[s.key] = serverNow()
  if (attempt.value) writeLocal(sectionStartKey(attempt.value.id), { ...sectionStart })
  now.value = Date.now()
  pageShownAt = Date.now()
  void autosave.markSectionStarted(s.key)
  await focusTop()
}

function onSectionExpired(s: AssessmentSection) {
  expiredHandled.add(s.key)
  haptic([30, 60, 30])
  void autosave.flush()
  const curKey = page.value?.section.key
  const nextIdx = pages.value.findIndex((p, i) => i > pageIndex.value && p.section.key !== s.key)
  if (curKey === s.key) {
    if (nextIdx >= 0) {
      toast.info(
        'Waktu bagian ini habis',
        'Jawabanmu sudah tersimpan. Lanjut ke bagian berikutnya.',
      )
      goTo(nextIdx)
    } else {
      toast.info('Waktu bagian ini habis', 'Jawabanmu sudah tersimpan. Silakan kumpulkan tes.')
      void submit()
    }
  }
}

/* ---------------- Jawaban ---------------- */
let pageShownAt = Date.now()
let lastAnswerAt = 0
let advanceTimer: ReturnType<typeof setTimeout> | undefined

function onAnswer(q: AttemptQuestion, value: AnswerValue, viaPointer: boolean) {
  if (isExpired(q.section) || submitting.value) return
  const firstTime = answers[q.id] === undefined
  const t = Date.now()
  const rt = t - Math.max(pageShownAt, lastAnswerAt)
  lastAnswerAt = t
  answers[q.id] = value
  if (missing.value.has(q.id)) {
    const m = new Set(missing.value)
    m.delete(q.id)
    missing.value = m
  }
  haptic(6)
  autosave.queue(q.id, value, rt)
  if (prefs.perPage === 1 && prefs.autoNext && viaPointer && firstTime && !isLastPage.value) {
    clearTimeout(advanceTimer)
    advanceTimer = setTimeout(() => next(), 280)
  }
}

/* ---------------- Navigasi ---------------- */
async function focusTop() {
  await nextTick()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  document.getElementById('page-heading')?.focus({ preventScroll: true })
}

/** Butir pertama halaman aktif — dipakai untuk mempertahankan posisi saat mode per layar diganti. */
let anchorId: string | undefined

function setPage(i: number) {
  pageIndex.value = Math.max(0, Math.min(i, pages.value.length - 1))
  anchorId = pages.value[pageIndex.value]?.items[0]?.id
  pageShownAt = Date.now()
}

function goTo(i: number, focusItem?: string) {
  clearTimeout(advanceTimer)
  setPage(i)
  if (focusItem) {
    void nextTick(() => {
      const el = document.getElementById(`item-${focusItem}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      el?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
    })
  } else void focusTop()
}
const next = () => (isLastPage.value ? void submit() : goTo(pageIndex.value + 1))
const prev = () => goTo(pageIndex.value - 1)

function pageOfItem(id: string) {
  return pages.value.findIndex((p) => p.items.some((q) => q.id === id))
}
function jumpToItem(id: string) {
  paletteOpen.value = false
  const i = pageOfItem(id)
  if (i >= 0) goTo(i, id)
}

watch(
  () => prefs.perPage,
  () => {
    if (anchorId) pageIndex.value = Math.max(0, pageOfItem(anchorId))
  },
)

/* ---------------- Inisialisasi attempt ---------------- */
function initAttempt(state: AttemptState) {
  if (state.attempt.status !== 'in_progress') {
    attempt.value = state.attempt
    return goStatus()
  }
  syncClock(state.server_time)
  now.value = Date.now()
  attempt.value = state.attempt
  sections.value = state.sections
  questions.value = state.questions

  // Jawaban server + antrean lokal yang belum terkirim (lokal lebih baru).
  const local = readPending(state.attempt.id)
  for (const k of Object.keys(answers)) delete answers[k]
  for (const [id, v] of Object.entries({ ...state.answers, ...local?.answers })) {
    const n = normalizeAnswer(questionById.value.get(id), v)
    if (n !== undefined) answers[id] = n
  }

  const localStarts = readLocal<Record<string, number>>(sectionStartKey(state.attempt.id)) ?? {}
  for (const s of state.sections) {
    const t = s.started_at ? Date.parse(s.started_at) : NaN
    if (!Number.isNaN(t)) sectionStart[s.key] = t
    else if (typeof localStarts[s.key] === 'number') sectionStart[s.key] = localStarts[s.key]!
    if (remainingSec(s.key) === 0) expiredHandled.add(s.key)
  }

  autosave.attach(state.attempt.id)
  phase.value = 'testing'
  startTicking()

  // Lanjutkan dari butir pertama yang belum dijawab (di bagian yang masih terbuka).
  const firstOpen = questions.value.find(
    (q) => answers[q.id] === undefined && !isExpired(q.section),
  )
  setPage(firstOpen ? pageOfItem(firstOpen.id) : pages.value.length - 1)
  if (answeredCount.value > 0)
    toast.info('Melanjutkan tes', `${answeredCount.value} dari ${total.value} jawaban dipulihkan.`)
}

async function loadAttempt(id: string) {
  phase.value = 'loading'
  try {
    initAttempt(await store.fetchAttempt(id))
  } catch (err) {
    // Attempt tak dikenal → mulai dari onboarding (server akan melanjutkan attempt yang ada).
    if (getApiStatus(err) === 404) {
      await router.replace({ query: { ...route.query, attempt: undefined } })
      return loadOnboarding()
    }
    handleBlockingError(err, 'Gagal memuat tes')
  }
}

function goStatus() {
  const id = attempt.value?.id
  autosave.clear()
  if (id) void router.replace({ name: 'assessment-submitting', params: { attemptId: id } })
  else void router.replace({ name: 'assessments' })
}

/* ---------------- Kirim ---------------- */
async function submit() {
  if (!attempt.value || submitting.value) return
  const unanswered = total.value - answeredCount.value
  const ok = await confirm({
    title: 'Kumpulkan jawaban?',
    message: unanswered
      ? `Masih ada ${unanswered} pertanyaan yang belum dijawab. Jawaban yang lengkap membuat hasilmu lebih akurat. Setelah dikumpulkan, jawaban tidak bisa diubah.`
      : 'Semua pertanyaan sudah dijawab. Setelah dikumpulkan, jawaban tidak bisa diubah.',
    confirmText: 'Kumpulkan',
    cancelText: unanswered ? 'Periksa lagi' : 'Batal',
    tone: unanswered ? 'warning' : 'primary',
  })
  if (!ok) return

  submitting.value = true
  haptic(12)
  const id = attempt.value.id
  try {
    await autosave.flush()
    const startedAt = Date.parse(attempt.value.started_at)
    const durationSec = Number.isNaN(startedAt)
      ? 0
      : Math.max(0, Math.round((serverNow() - startedAt) / 1000))
    const all: AnswerMap = {}
    for (const q of questions.value) if (answers[q.id] !== undefined) all[q.id] = answers[q.id]!
    await store.submitAttempt(id, all, durationSec)
    autosave.clear()
    writeLocal(sectionStartKey(id), null)
    toast.success('Jawaban terkirim', 'Hasilmu sedang diproses.')
    void router.replace({ name: 'assessment-submitting', params: { attemptId: id } })
  } catch (err) {
    const e = assessmentError(err, 'Gagal mengumpulkan jawaban')
    if (e.code === 'INCOMPLETE' || getApiStatus(err) === 422) {
      const miss = missingItems(err)
      missing.value = new Set(miss)
      const first = questions.value.find((q) => missing.value.has(q.id))
      toast.warning(
        'Masih ada pertanyaan yang belum dijawab',
        `Lengkapi ${miss.length || 'beberapa'} pertanyaan lalu kumpulkan lagi.`,
      )
      if (first) goTo(pageOfItem(first.id), first.id)
    } else if (e.code === 'ALREADY_SUBMITTED' || getApiStatus(err) === 409) {
      goStatus()
    } else if (isNetworkError(err)) {
      toast.error(
        'Tidak dapat terhubung',
        'Jawabanmu tetap tersimpan di perangkat ini. Coba kumpulkan lagi saat koneksi kembali.',
      )
    } else {
      toast.error(e.title, e.message)
    }
  } finally {
    submitting.value = false
  }
}

/* ---------------- Indikator simpan ---------------- */
const saveInfo = computed(() => {
  switch (autosave.status.value) {
    case 'saving':
      return { icon: LoaderCircle, label: 'Menyimpan…', cls: 'text-fg-muted', spin: true }
    case 'saved':
      return {
        icon: CloudCheck,
        label: 'Tersimpan',
        cls: 'text-emerald-600 dark:text-emerald-400',
        spin: false,
      }
    case 'offline':
      return {
        icon: CloudOff,
        label: 'Offline · disimpan di perangkat',
        cls: 'text-amber-700 dark:text-amber-300',
        spin: false,
      }
    case 'error':
      return {
        icon: CircleAlert,
        label: 'Gagal menyimpan, mencoba lagi',
        cls: 'text-red-600 dark:text-red-400',
        spin: false,
      }
    default:
      return null
  }
})

/* ================================================================== */
onMounted(() => {
  if (!CODES.includes(instrument.value) || !sessionId.value) {
    blocked.value = { title: 'Asesmen tidak ditemukan', message: 'Tautan tes ini tidak valid.' }
    phase.value = 'blocked'
    return
  }
  const attemptId = typeof route.query.attempt === 'string' ? route.query.attempt : ''
  if (attemptId) void loadAttempt(attemptId)
  else void loadOnboarding()
})
onBeforeUnmount(() => {
  clearInterval(tick)
  clearTimeout(advanceTimer)
})

const title = computed(() => instrumentName(instrument.value, onboarding.value?.instrument.name))
</script>

<template>
  <div class="space-y-4">
    <Teleport v-if="phase === 'testing'" defer to="#header-actions">
      <button
        type="button"
        class="pressable inline-flex h-10 w-10 items-center justify-center rounded-full text-fg-muted hover:bg-surface-muted hover:text-fg"
        aria-label="Pengaturan tampilan"
        @click="settingsOpen = true"
      >
        <Type :size="19" aria-hidden="true" />
      </button>
    </Teleport>

    <!-- Memuat -->
    <div v-if="phase === 'loading'" class="space-y-3" aria-busy="true" aria-label="Memuat asesmen">
      <div class="skeleton h-40 w-full rounded-2xl" />
      <div class="skeleton h-56 w-full rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="phase === 'error'"
      :message="loadError"
      @retry="
        typeof route.query.attempt === 'string'
          ? loadAttempt(route.query.attempt)
          : loadOnboarding()
      "
    />

    <!-- Tidak dapat dikerjakan (SESSION_NOT_OPEN, MAX_ATTEMPTS, QUOTA_EXHAUSTED, NOT_ENROLLED, …) -->
    <section
      v-else-if="phase === 'blocked' && blocked"
      class="card flex flex-col items-center px-6 py-10 text-center"
      role="alert"
    >
      <span
        class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
      >
        <Lock :size="22" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">{{ blocked.title }}</h2>
      <p class="mt-1 max-w-xs text-sm text-fg-muted">{{ blocked.message }}</p>
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        <BaseButton variant="secondary" :to="{ name: 'assessments' }">Kembali ke daftar</BaseButton>
        <BaseButton
          v-if="blocked.code === 'QUOTA_EXHAUSTED'"
          variant="soft"
          :to="{ name: 'counseling' }"
          >Hubungi Guru BK</BaseButton
        >
        <BaseButton
          v-if="blocked.code === 'MAX_ATTEMPTS'"
          variant="soft"
          :to="{ name: 'assessments', query: { tab: 'riwayat' } }"
          >Lihat riwayat</BaseButton
        >
      </div>
    </section>

    <!-- ===================== Onboarding ===================== -->
    <template v-else-if="phase === 'onboarding' && onboarding">
      <section class="card p-4" aria-labelledby="ob-title">
        <h2 id="ob-title" class="text-lg font-semibold text-fg">{{ title }}</h2>
        <p v-if="onboarding.session.title" class="text-xs text-fg-subtle">
          {{ onboarding.session.title }}
        </p>
        <p v-if="onboarding.instrument.description" class="mt-2 text-sm text-fg-muted">
          {{ onboarding.instrument.description }}
        </p>
        <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-xl bg-surface-muted px-2 py-2.5">
            <dt class="text-[11px] text-fg-subtle">Perkiraan</dt>
            <dd class="text-sm font-semibold text-fg">
              ±{{ onboarding.instrument.estimated_minutes }} mnt
            </dd>
          </div>
          <div class="rounded-xl bg-surface-muted px-2 py-2.5">
            <dt class="text-[11px] text-fg-subtle">Pertanyaan</dt>
            <dd class="text-sm font-semibold text-fg">
              {{ onboarding.instrument.total_questions }}
            </dd>
          </div>
          <div class="rounded-xl bg-surface-muted px-2 py-2.5">
            <dt class="text-[11px] text-fg-subtle">Bagian</dt>
            <dd class="text-sm font-semibold text-fg">
              {{ onboarding.instrument.sections.length || 1 }}
            </dd>
          </div>
        </dl>

        <ol v-if="onboarding.instrument.sections.length" class="mt-4 space-y-2">
          <li
            v-for="(s, i) in onboarding.instrument.sections"
            :key="s.key"
            class="rounded-xl border border-line p-3"
          >
            <p class="flex items-start justify-between gap-2 text-sm font-semibold text-fg">
              <span>{{ i + 1 }}. {{ s.title }}</span>
              <span
                v-if="s.time_limit_seconds"
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300"
              >
                <Timer :size="12" aria-hidden="true" />{{
                  Math.round(s.time_limit_seconds / 60)
                }}
                menit
              </span>
              <span v-else class="shrink-0 text-[11px] font-medium text-fg-subtle"
                >Tanpa batas waktu</span
              >
            </p>
            <p v-if="s.instruction" class="mt-1 text-[13px] text-fg-muted">{{ s.instruction }}</p>
          </li>
        </ol>
      </section>

      <section class="card p-4" aria-labelledby="terms-title">
        <h2 id="terms-title" class="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <ShieldCheck :size="18" class="text-accent" aria-hidden="true" />{{
            onboarding.terms_and_conditions.title
          }}
        </h2>
        <ul class="mt-3 space-y-2 text-sm text-fg-muted">
          <li v-for="(p, i) in onboarding.terms_and_conditions.points" :key="i" class="flex gap-2">
            <span
              class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
              aria-hidden="true"
            />
            <span>{{ p }}</span>
          </li>
        </ul>
        <AlertBanner
          v-if="onboarding.terms_and_conditions.disclaimer"
          class="mt-4"
          tone="info"
          title="Penting"
        >
          {{ onboarding.terms_and_conditions.disclaimer }}
        </AlertBanner>
      </section>

      <section
        v-if="onboarding.interactive_examples.length"
        class="card p-4"
        aria-labelledby="ex-title"
      >
        <h2 id="ex-title" class="text-[15px] font-semibold text-fg">Coba contoh dulu</h2>
        <p class="text-xs text-fg-subtle">Contoh ini tidak dinilai.</p>
        <div
          v-for="(ex, ei) in onboarding.interactive_examples"
          :key="ei"
          class="mt-4 border-t border-line pt-4 first-of-type:border-0"
        >
          <p v-if="ex.title" class="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {{ ex.title }}
          </p>
          <p v-if="ex.instruction" class="mt-1 text-[13px] text-fg-muted">{{ ex.instruction }}</p>
          <fieldset class="mt-2">
            <legend class="text-[15px] font-medium text-fg">{{ exampleQuestion(ex) }}</legend>
            <div class="mt-2 flex flex-col gap-2">
              <label
                v-for="o in exampleOptions(ex)"
                :key="o.key"
                class="pressable flex min-h-11 cursor-pointer items-center rounded-xl border border-line-strong px-3.5 py-2.5 text-sm text-fg has-[:checked]:border-primary-600 has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]"
              >
                <input
                  v-model="practice[ei]"
                  type="radio"
                  class="sr-only"
                  :name="`ex-${ei}`"
                  :value="o.key"
                />
                {{ o.label }}
              </label>
            </div>
          </fieldset>
          <p
            v-if="selectedOption(ex, ei)"
            class="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-[13px] text-fg-muted"
            role="status"
          >
            <strong
              v-if="exampleCorrect(ex, ei) === true"
              class="text-emerald-700 dark:text-emerald-300"
              >Tepat!
            </strong>
            <strong
              v-else-if="exampleCorrect(ex, ei) === false"
              class="text-amber-700 dark:text-amber-300"
              >Coba perhatikan lagi.
            </strong>
            {{
              ex.hint ||
              ex.explanation ||
              'Bagus! Begitulah cara menjawab. Pilih jawaban yang paling sesuai dengan dirimu.'
            }}
          </p>
        </div>
      </section>

      <section class="card p-4">
        <label class="flex cursor-pointer items-start gap-3 rounded-xl">
          <input
            v-model="consent"
            type="checkbox"
            class="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
            @change="consentError = ''"
          />
          <span class="text-sm text-fg">
            Saya sudah membaca ketentuan di atas, bersedia mengikuti asesmen ini, dan akan menjawab
            dengan jujur sesuai diri saya.
          </span>
        </label>
        <p
          v-if="consentError"
          class="mt-2 text-xs font-medium text-red-600 dark:text-red-400"
          role="alert"
        >
          {{ consentError }}
        </p>
        <BaseButton
          class="mt-4"
          size="lg"
          block
          :loading="starting"
          :disabled="!consent"
          :icon-right="ArrowRight"
          @click="start"
        >
          Mulai tes
        </BaseButton>
      </section>
    </template>

    <!-- ===================== Pengerjaan ===================== -->
    <template v-else-if="phase === 'testing' && page">
      <div
        class="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 -mt-4 border-b border-line/70 bg-app/90 px-4 py-2.5 backdrop-blur-md"
      >
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="pressable inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-muted px-3 text-xs font-semibold text-fg"
            :aria-label="`Daftar pertanyaan, ${answeredCount} dari ${total} terjawab`"
            @click="paletteOpen = true"
          >
            <Grid3x3 :size="14" aria-hidden="true" />
            <span class="tabular-nums">{{ answeredCount }}/{{ total }}</span>
          </button>
          <p
            v-if="saveInfo"
            class="flex min-w-0 items-center gap-1 text-xs font-medium"
            :class="saveInfo.cls"
            role="status"
            aria-live="polite"
          >
            <component
              :is="saveInfo.icon"
              :size="14"
              class="shrink-0"
              :class="saveInfo.spin ? 'animate-spin' : ''"
              aria-hidden="true"
            />
            <span class="truncate">{{ saveInfo.label }}</span>
          </p>
          <span
            v-if="activeTimer"
            class="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset"
            :class="
              activeTimer.remaining <= 60
                ? 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/15 dark:text-red-300'
                : 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300'
            "
            role="timer"
            :aria-label="`Sisa waktu ${activeTimer.section.title}: ${Math.ceil(activeTimer.remaining / 60)} menit`"
          >
            <Clock :size="13" aria-hidden="true" />{{ formatClock(activeTimer.remaining) }}
          </span>
        </div>
        <div
          class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-label="Kemajuan pengerjaan"
          :aria-valuenow="progressPct"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="h-full rounded-full bg-primary-600 transition-[width] duration-300 dark:bg-primary-400"
            :style="{ width: `${progressPct}%` }"
          />
        </div>
      </div>

      <!-- Kepala bagian -->
      <header>
        <h2 id="page-heading" tabindex="-1" class="text-[15px] font-semibold text-fg outline-none">
          {{ page.section.title }}
        </h2>
        <p v-if="page.firstOfSection || needsGate" class="mt-1 text-sm text-fg-muted">
          {{ page.section.instruction }}
        </p>
        <AlertBanner v-if="isExpired(page.section.key)" class="mt-2" tone="warning">
          Waktu bagian ini sudah habis. Jawaban yang tersimpan tetap dihitung.
        </AlertBanner>
      </header>

      <!-- Gerbang bagian berwaktu -->
      <section
        v-if="needsGate"
        class="card flex flex-col items-center px-6 py-8 text-center"
        aria-labelledby="gate-title"
      >
        <span
          class="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
        >
          <Timer :size="22" aria-hidden="true" />
        </span>
        <h3 id="gate-title" class="text-base font-semibold text-fg">Bagian ini dibatasi waktu</h3>
        <p class="mt-1 max-w-xs text-sm text-fg-muted">
          Kamu punya {{ Math.round((page.section.time_limit_seconds ?? 0) / 60) }} menit untuk
          {{
            pages
              .filter((p) => p.section.key === page!.section.key)
              .reduce((n, p) => n + p.items.length, 0)
          }}
          soal. Waktu berjalan sejak kamu menekan tombol di bawah dan tetap berjalan walau aplikasi
          ditutup.
        </p>
        <BaseButton class="mt-5" size="lg" :icon="Timer" @click="startSection(page.section)"
          >Mulai bagian ini</BaseButton
        >
      </section>

      <div v-else class="space-y-3">
        <QuestionItem
          v-for="q in page.items"
          :key="q.id"
          :question="q"
          :number="(indexById.get(q.id) ?? 0) + 1"
          :choices="sectionChoices(q)"
          :model-value="answers[q.id]"
          :disabled="isExpired(q.section) || submitting"
          :missing="missing.has(q.id)"
          :font-level="prefs.fontLevel"
          @answer="(v, p) => onAnswer(q, v, p)"
        />
      </div>

      <p class="text-center text-xs text-fg-subtle">
        Halaman {{ pageIndex + 1 }} dari {{ pages.length }} · jawaban tersimpan otomatis
      </p>

      <!-- Navigasi bawah -->
      <nav
        class="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md"
        aria-label="Navigasi pertanyaan"
      >
        <div class="flex gap-2">
          <BaseButton
            variant="secondary"
            size="lg"
            :icon="ArrowLeft"
            :disabled="pageIndex === 0 || submitting"
            @click="prev"
          >
            <span class="sr-only sm:not-sr-only">Sebelumnya</span>
          </BaseButton>
          <BaseButton
            v-if="!isLastPage"
            class="flex-1"
            size="lg"
            :icon-right="ArrowRight"
            :disabled="needsGate"
            @click="next"
          >
            Berikutnya
          </BaseButton>
          <BaseButton
            v-else
            class="flex-1"
            size="lg"
            :icon-right="Send"
            :loading="submitting"
            @click="submit"
            >Kumpulkan</BaseButton
          >
        </div>
      </nav>

      <!-- Daftar pertanyaan -->
      <BottomSheet
        v-model:open="paletteOpen"
        title="Daftar pertanyaan"
        :description="`${answeredCount} dari ${total} terjawab`"
      >
        <div
          v-for="s in sections.filter((x) => questions.some((q) => q.section === x.key))"
          :key="s.key"
          class="mb-4"
        >
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {{ s.title }}
          </p>
          <ul class="grid grid-cols-6 gap-2">
            <li v-for="q in questions.filter((x) => x.section === s.key)" :key="q.id">
              <button
                type="button"
                class="pressable flex h-11 w-full items-center justify-center rounded-xl border text-sm font-semibold tabular-nums"
                :class="[
                  missing.has(q.id)
                    ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                    : answers[q.id] !== undefined
                      ? 'border-primary-600 bg-accent-soft text-accent'
                      : 'border-line-strong text-fg-muted',
                  page.items.some((x) => x.id === q.id)
                    ? 'ring-2 ring-[var(--ring)] ring-offset-2 ring-offset-surface'
                    : '',
                ]"
                :aria-label="`Pertanyaan ${(indexById.get(q.id) ?? 0) + 1}, ${answers[q.id] !== undefined ? 'terjawab' : 'belum dijawab'}`"
                @click="jumpToItem(q.id)"
              >
                {{ (indexById.get(q.id) ?? 0) + 1 }}
              </button>
            </li>
          </ul>
        </div>
      </BottomSheet>

      <!-- Pengaturan tampilan -->
      <BottomSheet
        v-model:open="settingsOpen"
        title="Tampilan"
        description="Atur agar nyaman dibaca."
      >
        <fieldset class="mb-5">
          <legend class="mb-2 text-sm font-semibold text-fg">Ukuran huruf</legend>
          <div class="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
            <label
              v-for="(l, i) in FONT_LABELS"
              :key="l"
              class="pressable flex h-10 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold text-fg-muted has-[:checked]:bg-surface has-[:checked]:text-fg has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]"
            >
              <input
                v-model="prefs.fontLevel"
                type="radio"
                class="sr-only"
                name="font-level"
                :value="i"
              />{{ l }}
            </label>
          </div>
        </fieldset>
        <fieldset class="mb-5">
          <legend class="mb-2 text-sm font-semibold text-fg">Pertanyaan per layar</legend>
          <div class="grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1">
            <label
              v-for="n in [1, 5] as const"
              :key="n"
              class="pressable flex h-10 cursor-pointer items-center justify-center rounded-xl text-sm font-semibold text-fg-muted has-[:checked]:bg-surface has-[:checked]:text-fg has-[:checked]:shadow-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)]"
            >
              <input
                v-model="prefs.perPage"
                type="radio"
                class="sr-only"
                name="per-page"
                :value="n"
              />{{ n }} pertanyaan
            </label>
          </div>
        </fieldset>
        <label v-if="prefs.perPage === 1" class="flex cursor-pointer items-start gap-3">
          <input
            v-model="prefs.autoNext"
            type="checkbox"
            class="mt-0.5 h-5 w-5 shrink-0 accent-primary-600"
          />
          <span class="text-sm text-fg"
            >Pindah otomatis ke pertanyaan berikutnya setelah memilih jawaban</span
          >
        </label>
        <p class="mt-5 flex gap-2 text-xs text-fg-subtle">
          <Info :size="14" class="mt-px shrink-0" aria-hidden="true" />
          Jawaban disimpan otomatis. Bila koneksi terputus, jawaban disimpan di perangkat dan
          dikirim saat online kembali.
        </p>
      </BottomSheet>
    </template>
  </div>
</template>
