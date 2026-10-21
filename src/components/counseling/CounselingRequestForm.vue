<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { CalendarDays, Clock, LockKeyhole, Search, Send, UserPlus, Users, X } from 'lucide-vue-next'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useCounselingStore } from '@/stores/counseling'
import { useStudentStore } from '@/stores/student'
import { toast } from '@/composables/useToast'
import { haptic } from '@/composables/useHaptic'
import { getApiError, getApiErrorCode } from '@/utils/api'
import { addMinutes, assetUrl, formatTime, nowInTimeZone, timeZoneLabel } from '@/utils/format'
import {
  DESCRIPTION_MAX,
  DURATIONS,
  MAX_DAYS_AHEAD,
  MAX_PEERS,
  MAX_PENDING,
  TOPIC_CATEGORIES,
  counselorAvailability,
  counselorPhoto,
  peerClass,
} from '@/utils/counseling'
import type { CounselingSession, Peer } from '@/types/counseling'

defineProps<{ counselorsLoading?: boolean; counselorsError?: string }>()
const emit = defineEmits<{ submitted: [session: CounselingSession]; retryCounselors: [] }>()

const counseling = useCounselingStore()
const student = useStudentStore()

const tz = computed(() => student.school?.timezone)
const tzLabel = computed(() => timeZoneLabel(tz.value))
const schoolNow = ref(nowInTimeZone(tz.value))

function defaultDate() {
  // Besok bila hari ini sudah sore; guru BK tetap dapat menyesuaikan.
  const n = nowInTimeZone(tz.value)
  if (n.time < '13:00') return n.date
  const d = new Date(`${n.date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

const form = reactive({
  counselor_id: '',
  topic: '' as string,
  description: '',
  mode: 'individual' as 'individual' | 'group',
  date: defaultDate(),
  start: '10:00',
  duration: 30 as number,
  consent: false,
})
const errors = reactive({ topic: '', description: '', date: '', start: '', peers: '', consent: '' })
const formError = ref('')
const submitting = ref(false)

const noCounselor = computed(() => counseling.counselorsLoaded && counseling.counselors.length === 0)
const pendingCount = computed(
  () => counseling.sessions.filter((s) => s.status === 'pending' && s.is_initiator !== false).length,
)
const tooManyPending = computed(() => counseling.sessionsLoaded && pendingCount.value >= MAX_PENDING)
const maxDate = computed(() => {
  const d = new Date(`${schoolNow.value.date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + MAX_DAYS_AHEAD)
  return d.toISOString().slice(0, 10)
})
const endTime = computed(() => addMinutes(form.start, form.duration))

/* ---------------- Teman (konseling kelompok) ---------------- */
const peerQuery = ref('')
const peerResults = ref<Peer[]>([])
const peerSearching = ref(false)
const peerSearchError = ref('')
const selectedPeers = ref<Peer[]>([])
let peerTimer: ReturnType<typeof setTimeout> | undefined
let peerAbort: AbortController | null = null

watch(peerQuery, (q) => {
  clearTimeout(peerTimer)
  peerAbort?.abort()
  peerSearchError.value = ''
  const term = q.trim()
  if (term.length < 2) {
    peerResults.value = []
    peerSearching.value = false
    return
  }
  peerSearching.value = true
  peerTimer = setTimeout(async () => {
    const ctrl = new AbortController()
    peerAbort = ctrl
    try {
      const list = await counseling.searchPeers(term, ctrl.signal)
      if (ctrl.signal.aborted) return
      const chosen = new Set(selectedPeers.value.map((p) => p.id))
      peerResults.value = list.filter((p) => !chosen.has(p.id)).slice(0, 8)
    } catch (err) {
      if (ctrl.signal.aborted) return
      if (getApiErrorCode(err) === 'NOT_ENROLLED') void student.fetchMe(true).catch(() => undefined)
      peerSearchError.value = getApiError(err, 'Gagal mencari teman.')
      peerResults.value = []
    } finally {
      if (!ctrl.signal.aborted) peerSearching.value = false
    }
  }, 300)
})
onBeforeUnmount(() => {
  clearTimeout(peerTimer)
  peerAbort?.abort()
})

function addPeer(p: Peer) {
  if (selectedPeers.value.length >= MAX_PEERS) {
    toast.info(`Maksimal ${MAX_PEERS} teman`)
    return
  }
  if (!selectedPeers.value.some((x) => x.id === p.id)) selectedPeers.value.push(p)
  haptic(8)
  errors.peers = ''
  peerQuery.value = ''
  peerResults.value = []
}
function removePeer(p: Peer) {
  selectedPeers.value = selectedPeers.value.filter((x) => x.id !== p.id)
}

watch(
  () => form.mode,
  (m) => {
    if (m === 'individual') {
      errors.peers = ''
      errors.consent = ''
    }
  },
)

/* ---------------- Kirim ---------------- */
function validate(): boolean {
  schoolNow.value = nowInTimeZone(tz.value)
  errors.topic = form.topic ? '' : 'Pilih topik yang ingin dibicarakan.'
  errors.description = form.description.length > DESCRIPTION_MAX ? `Maksimal ${DESCRIPTION_MAX} karakter.` : ''
  errors.date = !/^\d{4}-\d{2}-\d{2}$/.test(form.date)
    ? 'Pilih tanggal.'
    : form.date < schoolNow.value.date
      ? 'Tanggal sudah lewat.'
      : form.date > maxDate.value
        ? 'Maksimal 1 tahun ke depan.'
        : ''
  errors.start = !/^\d{2}:\d{2}$/.test(form.start)
    ? 'Pilih jam mulai.'
    : !endTime.value
      ? 'Sesi harus selesai sebelum tengah malam.'
      : form.date === schoolNow.value.date && form.start <= schoolNow.value.time
        ? `Jam sudah lewat (sekarang ${formatTime(schoolNow.value.time)} ${tzLabel.value}).`
        : ''
  errors.peers = form.mode === 'group' && !selectedPeers.value.length ? 'Pilih minimal satu teman, atau ganti ke "Sendiri".' : ''
  errors.consent = form.mode === 'group' && !form.consent ? 'Pastikan temanmu sudah setuju untuk ikut.' : ''
  return !Object.values(errors).some(Boolean)
}

function reset() {
  form.topic = ''
  form.description = ''
  form.mode = 'individual'
  form.consent = false
  selectedPeers.value = []
  peerQuery.value = ''
}

async function submit() {
  formError.value = ''
  if (!validate()) {
    haptic([20, 40, 20])
    return
  }
  submitting.value = true
  try {
    const group = form.mode === 'group'
    const session = await counseling.createSession({
      counselor_id: form.counselor_id || undefined,
      counseling_type: group ? 'group' : 'individual',
      topic: form.topic,
      description: form.description.trim() || undefined,
      requested_date: form.date,
      start_time: form.start,
      end_time: endTime.value!,
      participant_student_ids: group ? selectedPeers.value.map((p) => p.id) : undefined,
    })
    haptic(15)
    toast.success('Pengajuan terkirim', 'Guru BK akan menentukan jadwal. Kamu akan mendapat notifikasi.')
    reset()
    emit('submitted', session)
  } catch (err) {
    const code = getApiErrorCode(err)
    if (code === 'NOT_ENROLLED') {
      void student.fetchMe(true).catch(() => undefined)
      return
    }
    if (code === 'TOO_MANY_PENDING') void counseling.fetchSessions().catch(() => undefined)
    if (code === 'NO_COUNSELOR') void counseling.fetchCounselors(true).catch(() => undefined)
    formError.value = getApiError(err, 'Gagal mengirim pengajuan. Coba lagi.')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <!-- Privasi -->
    <div class="flex items-start gap-3 rounded-2xl bg-emerald-50 p-3 text-emerald-900 ring-1 ring-inset ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-400/20">
      <LockKeyhole :size="18" class="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
      <p class="text-sm">
        <span class="font-semibold">Pengajuanmu hanya dilihat guru BK</span><template v-if="form.mode === 'group'"> dan teman yang kamu ajak</template>.
        Ceritakan seperlunya — detailnya bisa dibicarakan langsung saat sesi.
      </p>
    </div>

    <AlertBanner v-if="formError" tone="danger">{{ formError }}</AlertBanner>
    <AlertBanner v-if="tooManyPending" tone="warning" title="Pengajuanmu masih menunggu">
      Kamu punya {{ pendingCount }} pengajuan yang belum dijadwalkan guru BK. Tunggu konfirmasinya dulu sebelum mengajukan lagi.
    </AlertBanner>
    <AlertBanner v-if="noCounselor" tone="warning" title="Belum ada guru BK">
      Sekolahmu belum menetapkan guru BK di Pelita Sekolah. Hubungi wali kelas atau datangi ruang BK secara langsung.
    </AlertBanner>

    <!-- Guru BK -->
    <fieldset class="card p-4">
      <legend class="sr-only">Pilih guru BK</legend>
      <p class="text-sm font-semibold text-fg" aria-hidden="true">Guru BK</p>
      <p class="mt-0.5 text-xs text-fg-subtle">Pilih guru yang membuatmu nyaman, atau biarkan sekolah yang menentukan.</p>

      <div v-if="counselorsLoading && !counseling.counselorsLoaded" class="mt-3 space-y-2" aria-busy="true" aria-label="Memuat guru BK">
        <div v-for="i in 2" :key="i" class="skeleton h-14 w-full rounded-xl" />
      </div>
      <div v-else-if="counselorsError && !counseling.counselorsLoaded" class="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface-muted p-3 text-sm text-fg-muted">
        <span>{{ counselorsError }}</span>
        <BaseButton variant="secondary" size="sm" @click="emit('retryCounselors')">Coba lagi</BaseButton>
      </div>
      <div v-else-if="!noCounselor" class="mt-3 space-y-2" role="radiogroup" aria-label="Guru BK">
        <label
          class="pressable flex cursor-pointer items-center gap-3 rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
          :class="form.counselor_id === '' ? 'border-primary-500 bg-accent-soft' : 'border-line-strong'"
        >
          <input v-model="form.counselor_id" type="radio" name="counselor" value="" class="sr-only" />
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-fg-muted">
            <Users :size="18" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-fg">Siapa saja yang tersedia</span>
            <span class="block text-xs text-fg-subtle">Sekolah memilihkan guru BK untukmu</span>
          </span>
        </label>
        <label
          v-for="c in counseling.counselors"
          :key="c.id"
          class="pressable flex cursor-pointer items-center gap-3 rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
          :class="form.counselor_id === c.id ? 'border-primary-500 bg-accent-soft' : 'border-line-strong'"
        >
          <input v-model="form.counselor_id" type="radio" name="counselor" :value="c.id" class="sr-only" />
          <BaseAvatar :src="assetUrl(counselorPhoto(c))" :name="c.full_name" :size="40" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium text-fg">{{ c.full_name }}</span>
            <span class="block truncate text-xs text-fg-subtle">{{ counselorAvailability(c) || 'Guru BK' }}</span>
          </span>
        </label>
      </div>
    </fieldset>

    <!-- Topik -->
    <fieldset class="card p-4">
      <legend class="sr-only">Topik</legend>
      <p class="text-sm font-semibold text-fg" aria-hidden="true">Mau membicarakan apa?<span class="ml-0.5 text-red-500">*</span></p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <label
          v-for="t in TOPIC_CATEGORIES"
          :key="t.value"
          class="pressable flex cursor-pointer flex-col rounded-xl border p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
          :class="form.topic === t.value ? 'border-primary-500 bg-accent-soft' : 'border-line-strong'"
        >
          <input v-model="form.topic" type="radio" name="topic" :value="t.value" class="sr-only" @change="errors.topic = ''" />
          <span class="text-sm font-medium" :class="form.topic === t.value ? 'text-accent' : 'text-fg'">{{ t.value }}</span>
          <span class="mt-0.5 text-[11px] leading-snug text-fg-subtle">{{ t.hint }}</span>
        </label>
      </div>
      <p v-if="errors.topic" id="topic-err" class="mt-2 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{{ errors.topic }}</p>

      <BaseInput
        v-model="form.description"
        class="mt-4"
        as="textarea"
        :rows="3"
        label="Ceritakan singkat"
        :maxlength="DESCRIPTION_MAX"
        placeholder="Mis. aku sering susah fokus saat belajar Matematika…"
        :error="errors.description"
        :hint="`Opsional · ${form.description.length}/${DESCRIPTION_MAX}`"
      />
    </fieldset>

    <!-- Sendiri / bersama teman -->
    <fieldset class="card p-4">
      <legend class="sr-only">Ikut serta</legend>
      <p class="text-sm font-semibold text-fg" aria-hidden="true">Ikut serta</p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <label
          v-for="m in [
            { v: 'individual', l: 'Sendiri' },
            { v: 'group', l: 'Bersama teman' },
          ]"
          :key="m.v"
          class="pressable flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
          :class="form.mode === m.v ? 'border-primary-500 bg-accent-soft text-accent' : 'border-line-strong text-fg-muted'"
        >
          <input v-model="form.mode" type="radio" name="mode" :value="m.v" class="sr-only" />
          {{ m.l }}
        </label>
      </div>

      <div v-if="form.mode === 'group'" class="mt-4 space-y-3">
        <ul v-if="selectedPeers.length" class="flex flex-wrap gap-2" aria-label="Teman yang diajak">
          <li v-for="p in selectedPeers" :key="p.id" class="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm text-accent">
            {{ p.full_name }}
            <button
              type="button"
              class="pressable inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-primary-100 dark:hover:bg-primary-500/25"
              :aria-label="`Hapus ${p.full_name}`"
              @click="removePeer(p)"
            >
              <X :size="14" aria-hidden="true" />
            </button>
          </li>
        </ul>

        <BaseInput
          v-if="selectedPeers.length < MAX_PEERS"
          v-model="peerQuery"
          type="search"
          label="Cari teman"
          :icon="Search"
          placeholder="Ketik minimal 2 huruf nama"
          autocomplete="off"
          enterkeyhint="search"
          :error="errors.peers || peerSearchError"
          :hint="`Maksimal ${MAX_PEERS} teman`"
        />
        <div v-if="peerSearching" class="space-y-2" aria-busy="true" aria-label="Mencari teman">
          <div v-for="i in 2" :key="i" class="skeleton h-11 w-full rounded-xl" />
        </div>
        <p v-else-if="peerQuery.trim().length >= 2 && !peerResults.length && !peerSearchError" class="text-sm text-fg-muted" role="status">
          Tidak ada teman dengan nama itu.
        </p>
        <ul v-else-if="peerResults.length" class="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label="Hasil pencarian teman">
          <li v-for="p in peerResults" :key="p.id">
            <button type="button" class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-muted" @click="addPeer(p)">
              <BaseAvatar :name="p.full_name" :size="32" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-fg">{{ p.full_name }}</span>
                <span v-if="peerClass(p)" class="block truncate text-xs text-fg-subtle">Kelas {{ peerClass(p) }}</span>
              </span>
              <UserPlus :size="18" class="shrink-0 text-accent" aria-hidden="true" />
              <span class="sr-only">Ajak</span>
            </button>
          </li>
        </ul>

        <label class="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-muted p-3">
          <input v-model="form.consent" type="checkbox" class="mt-0.5 h-5 w-5 shrink-0 accent-primary-600" @change="errors.consent = ''" />
          <span class="text-sm text-fg">
            Teman yang kuajak <b>sudah setuju</b> ikut. Aku paham mereka akan melihat topik, cerita singkat, dan jadwal sesi ini.
          </span>
        </label>
        <p v-if="errors.consent" class="-mt-1 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{{ errors.consent }}</p>
      </div>
    </fieldset>

    <!-- Waktu -->
    <fieldset class="card space-y-4 p-4">
      <legend class="sr-only">Waktu yang diinginkan</legend>
      <div aria-hidden="true">
        <p class="text-sm font-semibold text-fg">Waktu yang kamu inginkan</p>
        <p class="mt-0.5 text-xs text-fg-subtle">Waktu sekolah ({{ tzLabel }}). Guru BK dapat menyesuaikan jadwalnya.</p>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <BaseInput v-model="form.date" type="date" label="Tanggal" :min="schoolNow.date" :max="maxDate" :icon="CalendarDays" :error="errors.date" required />
        <BaseInput v-model="form.start" type="time" label="Jam mulai" step="300" :icon="Clock" :error="errors.start" required />
      </div>
      <div>
        <p id="duration-label" class="text-sm font-medium text-fg">Durasi</p>
        <div class="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="duration-label">
          <label
            v-for="d in DURATIONS"
            :key="d"
            class="pressable flex h-10 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
            :class="form.duration === d ? 'border-primary-500 bg-accent-soft text-accent' : 'border-line-strong text-fg-muted'"
          >
            <input v-model="form.duration" type="radio" name="duration" :value="d" class="sr-only" />
            {{ d }} menit
          </label>
        </div>
        <p v-if="endTime" class="mt-2 text-xs text-fg-subtle">Selesai sekitar pukul {{ formatTime(endTime) }} {{ tzLabel }}</p>
      </div>
    </fieldset>

    <BaseButton type="submit" block size="lg" :icon="Send" :loading="submitting" :disabled="noCounselor || tooManyPending">
      {{ submitting ? 'Mengirim…' : 'Kirim pengajuan' }}
    </BaseButton>
  </form>
</template>
