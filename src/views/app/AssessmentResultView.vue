<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  Briefcase,
  HeartHandshake,
  Info,
  Lightbulb,
  MessageCircleHeart,
  ShieldCheck,
} from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import ScoreBars from '@/components/assessment/ScoreBars.vue'
import RiasecHexagon from '@/components/assessment/RiasecHexagon.vue'
import { useStudentAssessmentStore } from '@/stores/assessmentStudent'
import { useStudentStore } from '@/stores/student'
import { getApiErrorCode, getApiStatus } from '@/utils/api'
import { formatLongDate } from '@/utils/format'
import {
  DEFAULT_DISCLAIMER,
  INSTRUMENT_LABELS,
  RIASEC_ID,
  SOCIO_LABELS,
  TMB_BAKAT_LABELS,
  TMB_MINAT_LABELS,
  TMB_RUMPUN_LABELS,
  VARK_LABELS,
  assessmentError,
  cIndexLevel,
  findScores,
  flagMessages,
  instrumentName,
  stringRecord,
  toBars,
  type BarDatum,
} from '@/utils/assessment'
import type { StudentResult } from '@/types/assessment'

const route = useRoute()
const store = useStudentAssessmentStore()
const student = useStudentStore()
const attemptId = computed(() => String(route.params.attemptId ?? ''))

const result = ref<StudentResult | null>(null)
const loading = ref(true)
const error = ref('')
const notFound = ref(false)

async function load(force = false) {
  loading.value = true
  error.value = ''
  try {
    result.value = await store.fetchResult(attemptId.value, force)
  } catch (err) {
    if (getApiErrorCode(err) === 'NOT_ENROLLED') void student.fetchMe(true).catch(() => undefined)
    notFound.value = getApiStatus(err) === 404
    error.value = notFound.value
      ? 'Hasil belum tersedia. Bila baru saja mengumpulkan, tunggu sebentar lalu coba lagi.'
      : assessmentError(err, 'Gagal memuat hasil').message
  } finally {
    loading.value = false
  }
}
onMounted(() => void load())

const RIASEC = ['R', 'I', 'A', 'S', 'E', 'C']
const RIASEC_LABEL_ID = Object.fromEntries(RIASEC.map((k) => [k, `${k} · ${RIASEC_ID[k]}`]))

const scores = computed(() => result.value?.scores ?? null)
const code = computed(() => result.value?.instrument_code)
const hollandLetters = computed(() => (result.value?.holland_code ?? '').toUpperCase().split(''))

const riasecBars = computed<BarDatum[]>(() => {
  if (code.value === 'RIA')
    return toBars(
      findScores(
        scores.value,
        RIASEC,
        [
          ['percentages', 100],
          ['pct', 100],
          ['raw_scores', 40],
          ['raw', 40],
        ],
        true,
      ),
      RIASEC,
      RIASEC_LABEL_ID,
    )
  if (code.value === 'PMK')
    return toBars(
      findScores(
        scores.value,
        RIASEC,
        [
          ['percentages', 100],
          ['pct', 100],
          ['total_scores', 23],
          ['totals', 23],
        ],
        true,
      ),
      RIASEC,
      RIASEC_LABEL_ID,
    )
  return []
})

const tmbMinat = computed(() =>
  code.value === 'TMB'
    ? toBars(
        findScores(scores.value, Object.keys(TMB_MINAT_LABELS), [
          ['minat_scores', 100],
          ['minat', 100],
          ['minat_percentages', 100],
        ]),
        Object.keys(TMB_MINAT_LABELS),
        TMB_MINAT_LABELS,
      )
    : [],
)
const tmbBakat = computed(() =>
  code.value === 'TMB'
    ? toBars(
        findScores(scores.value, Object.keys(TMB_BAKAT_LABELS), [
          ['bakat_percentages', 100],
          ['bakat', 100],
          ['bakat_scores', 6],
        ]),
        Object.keys(TMB_BAKAT_LABELS),
        TMB_BAKAT_LABELS,
        stringRecord(scores.value?.bakat_categories),
      )
    : [],
)
const tmbRumpun = computed(() =>
  code.value === 'TMB'
    ? toBars(
        findScores(scores.value, Object.keys(TMB_RUMPUN_LABELS), [
          ['rumpun_scores', 100],
          ['rumpun', 100],
        ]),
        Object.keys(TMB_RUMPUN_LABELS),
        TMB_RUMPUN_LABELS,
        stringRecord(scores.value?.rumpun_categories),
      ).sort((a, b) => b.value - a.value)
    : [],
)

const varkBars = computed(() =>
  code.value === 'ADN'
    ? toBars(
        findScores(scores.value, Object.keys(VARK_LABELS), [
          ['vark_scores', 20],
          ['vark', 20],
          ['vark_percentages', 100],
        ]),
        Object.keys(VARK_LABELS),
        VARK_LABELS,
      )
    : [],
)
const varkDominant = computed(() => {
  const d = scores.value?.vark_dominant
  return Array.isArray(d) ? d.filter((x): x is string => typeof x === 'string') : []
})
const adnCareer = computed(() =>
  code.value === 'ADN'
    ? toBars(
        findScores(scores.value, RIASEC, [
          ['brief_career_scores', 8],
          ['career_scores', 8],
        ]),
        RIASEC,
        RIASEC_LABEL_ID,
      )
    : [],
)
/** Kebiasaan belajar (tanpa butir waspada — server sudah membuangnya, tetap disaring). */
const socioLevels = computed(() => {
  if (code.value !== 'ADN') return []
  const levels = stringRecord(scores.value?.socio_emotional_levels)
  return Object.keys(SOCIO_LABELS)
    .filter((k) => levels[k])
    .map((k) => ({ key: k, label: SOCIO_LABELS[k]!, level: levels[k]! }))
})
const levelTone = (l: string) =>
  (/kuat/i.test(l) ? 'success' : /berkembang/i.test(l) ? 'info' : 'warning') as
    | 'success'
    | 'info'
    | 'warning'

/** Indeks sekunder RIASEC/PMK yang ramah siswa. */
const indexChips = computed(() => {
  const src = { ...scores.value, ...result.value?.indices } as Record<string, unknown>
  const out: { label: string; value: string }[] = []
  const str = (k: string) => (typeof src[k] === 'string' ? (src[k] as string) : '')
  if (str('consistency')) out.push({ label: 'Konsistensi minat', value: str('consistency') })
  const diff = str('differentiation_category') || str('diff_category')
  if (diff) out.push({ label: 'Kejelasan profil', value: diff })
  return out
})

const keyBadges = computed(() => {
  const r = result.value
  if (!r) return []
  const out: { label: string; value: string }[] = []
  if (r.holland_code) out.push({ label: 'Kode Holland', value: r.holland_code })
  if (r.recommended_track)
    out.push({
      label: 'Rumpun teratas',
      value: TMB_RUMPUN_LABELS[r.recommended_track] ?? r.recommended_track,
    })
  if (r.vark_category) out.push({ label: 'Gaya belajar', value: r.vark_category })
  return out
})

const summary = computed(
  () => result.value?.interpretation?.summary || result.value?.report_summary || '',
)
const sections = computed(() => result.value?.interpretation?.sections ?? [])
const careers = computed(() =>
  [...(result.value?.interpretation?.careers ?? [])].sort((a, b) => b.c_index - a.c_index),
)
const tips = computed(() => result.value?.interpretation?.study_tips ?? [])
const notes = computed(() =>
  flagMessages([...(result.value?.validity_flags ?? []), ...(result.value?.flags ?? [])]),
)
const disclaimer = computed(() => result.value?.disclaimer || DEFAULT_DISCLAIMER)
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3" aria-busy="true" aria-label="Memuat hasil">
      <div class="skeleton h-36 w-full rounded-2xl" />
      <div class="skeleton h-64 w-full rounded-2xl" />
      <div class="skeleton h-40 w-full rounded-2xl" />
    </div>

    <ErrorState
      v-else-if="error || !result"
      :title="notFound ? 'Hasil belum tersedia' : 'Gagal memuat hasil'"
      :message="error"
      @retry="load(true)"
    />

    <template v-else>
      <!-- 1. Ringkasan -->
      <section
        class="relative overflow-hidden rounded-[var(--radius-card)] bg-gradient-to-br p-4 text-white shadow-card"
        :class="
          INSTRUMENT_LABELS[result.instrument_code]?.color ?? 'from-primary-600 to-primary-800'
        "
        aria-labelledby="res-title"
      >
        <div
          class="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl"
          aria-hidden="true"
        />
        <p class="relative text-xs font-medium text-white/80">
          Hasil skrining · {{ formatLongDate(new Date(result.created_at)) }}
        </p>
        <h2 id="res-title" class="relative mt-0.5 text-lg font-semibold">
          {{ instrumentName(result.instrument_code) }}
        </h2>
        <dl v-if="keyBadges.length" class="relative mt-3 flex flex-wrap gap-2">
          <div
            v-for="b in keyBadges"
            :key="b.label"
            class="rounded-xl bg-white/15 px-3 py-1.5 ring-1 ring-white/25"
          >
            <dt class="text-[11px] text-white/80">{{ b.label }}</dt>
            <dd class="text-sm font-bold">{{ b.value }}</dd>
          </div>
        </dl>
      </section>

      <p v-if="summary" class="card p-4 text-[15px] leading-relaxed text-fg">{{ summary }}</p>

      <!-- Pesan kesejahteraan (netral, bukan diagnosis) -->
      <section
        v-if="result.wellbeing_message"
        class="flex gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-100"
        role="status"
      >
        <MessageCircleHeart
          :size="18"
          class="mt-px shrink-0 text-primary-600 dark:text-primary-300"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <p>{{ result.wellbeing_message }}</p>
          <BaseButton class="mt-2" size="sm" variant="soft" :to="{ name: 'counseling' }"
            >Ngobrol dengan Guru BK</BaseButton
          >
        </div>
      </section>

      <!-- Catatan validitas (lembut; kode tidak ditampilkan) -->
      <section v-if="notes.length" class="card p-4" aria-labelledby="notes-title">
        <h3 id="notes-title" class="flex items-center gap-2 text-sm font-semibold text-fg">
          <Info :size="16" class="text-accent" aria-hidden="true" />Catatan untuk membaca hasil
        </h3>
        <ul class="mt-2 space-y-1.5 text-[13px] text-fg-muted">
          <li v-for="n in notes" :key="n" class="flex gap-2">
            <span
              class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fg-subtle"
              aria-hidden="true"
            />{{ n }}
          </li>
        </ul>
      </section>

      <!-- 2. Grafik -->
      <RiasecHexagon v-if="riasecBars.length >= 3" :data="riasecBars" :code="result.holland_code" />
      <div v-if="indexChips.length" class="flex flex-wrap gap-2">
        <span
          v-for="c in indexChips"
          :key="c.label"
          class="rounded-full bg-surface-muted px-3 py-1 text-xs text-fg-muted"
        >
          {{ c.label }}: <strong class="text-fg">{{ c.value }}</strong>
        </span>
      </div>
      <ScoreBars
        v-if="riasecBars.length"
        title="Skor per tipe"
        :caption="riasecBars[0]?.max === 100 ? 'Persentase 0–100' : undefined"
        :data="riasecBars"
        :highlight="hollandLetters"
      />

      <ScoreBars
        v-if="tmbRumpun.length"
        title="Kecocokan rumpun"
        caption="Gabungan minat dan bakat (0–100)"
        :data="tmbRumpun"
        :highlight="result.recommended_track ? [result.recommended_track] : []"
      />
      <ScoreBars
        v-if="tmbMinat.length"
        title="Minat bidang"
        caption="Persentase 0–100"
        :data="tmbMinat"
      />
      <ScoreBars
        v-if="tmbBakat.length"
        title="Bakat (kemampuan dasar)"
        :caption="tmbBakat[0]?.max === 6 ? 'Jawaban benar dari 6 soal' : 'Persentase 0–100'"
        :data="tmbBakat"
      />

      <ScoreBars
        v-if="varkBars.length"
        title="Gaya belajar"
        :caption="varkBars[0]?.max === 20 ? 'Skor 5–20 per gaya' : undefined"
        :data="varkBars"
        :highlight="varkDominant"
      />
      <section v-if="socioLevels.length" class="card p-4" aria-labelledby="socio-title">
        <h3 id="socio-title" class="text-[15px] font-semibold text-fg">Kebiasaan belajar</h3>
        <ul class="mt-3 space-y-2">
          <li
            v-for="s in socioLevels"
            :key="s.key"
            class="flex items-center justify-between gap-2 text-[13px] text-fg-muted"
          >
            {{ s.label }}<StatusPill :label="s.level" :tone="levelTone(s.level)" />
          </li>
        </ul>
      </section>
      <ScoreBars v-if="adnCareer.length" title="Minat karier singkat" :data="adnCareer" />

      <!-- 3. Interpretasi -->
      <section v-for="(s, i) in sections" :key="i" class="card p-4">
        <h3 class="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <BookOpen :size="17" class="shrink-0 text-accent" aria-hidden="true" />{{ s.title }}
        </h3>
        <p class="mt-2 text-sm leading-relaxed text-fg-muted">{{ s.body }}</p>
        <ul v-if="s.items?.length" class="mt-2 space-y-1 text-sm text-fg-muted">
          <li v-for="(it, j) in s.items" :key="j" class="flex gap-2">
            <span
              class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
              aria-hidden="true"
            />{{ it }}
          </li>
        </ul>
      </section>

      <!-- 4. Saran tindak lanjut -->
      <section v-if="careers.length" class="card p-4" aria-labelledby="careers-title">
        <h3 id="careers-title" class="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Briefcase :size="17" class="text-accent" aria-hidden="true" />Contoh bidang untuk
          dijelajahi
        </h3>
        <p class="text-xs text-fg-subtle">
          Contoh, bukan batasan. Kecocokan dihitung dari kode minatmu.
        </p>
        <ul class="mt-3 divide-y divide-line">
          <li
            v-for="c in careers"
            :key="`${c.title}-${c.code}`"
            class="flex items-center justify-between gap-2 py-2.5"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-fg">{{ c.title }}</span>
              <span class="text-xs text-fg-subtle">Kode {{ c.code }}</span>
            </span>
            <StatusPill :label="cIndexLevel(c.c_index).label" :tone="cIndexLevel(c.c_index).tone" />
          </li>
        </ul>
      </section>

      <section v-if="tips.length" class="card p-4" aria-labelledby="tips-title">
        <h3 id="tips-title" class="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <Lightbulb :size="17" class="text-accent" aria-hidden="true" />Tips belajar
        </h3>
        <ul class="mt-2 space-y-1.5 text-sm text-fg-muted">
          <li v-for="(t, i) in tips" :key="i" class="flex gap-2">
            <span
              class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
              aria-hidden="true"
            />{{ t }}
          </li>
        </ul>
      </section>

      <!-- 5. Disclaimer (selalu tampil) + konsultasi -->
      <section class="card p-4" aria-labelledby="disc-title">
        <h3 id="disc-title" class="flex items-center gap-2 text-sm font-semibold text-fg">
          <ShieldCheck :size="16" class="text-accent" aria-hidden="true" />Tentang hasil ini
        </h3>
        <p class="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{{ disclaimer }}</p>
        <BaseButton class="mt-4" block :icon="HeartHandshake" :to="{ name: 'counseling' }"
          >Minta konsultasi Guru BK</BaseButton
        >
      </section>
    </template>
  </div>
</template>
