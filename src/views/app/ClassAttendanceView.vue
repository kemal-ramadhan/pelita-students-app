<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CircleCheckBig, Keyboard, MapPin, ScanLine, Send } from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import QrScannerView from '@/components/presensi/QrScannerView.vue'
import LessonList from '@/components/presensi/LessonList.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useStudentStore } from '@/stores/student'
import { useAttendanceStore } from '@/stores/attendance'
import { useTodayAttendance } from '@/composables/useTodayAttendance'
import { toast } from '@/composables/useToast'
import { haptic } from '@/composables/useHaptic'
import { getApiError, getApiErrorCode, getApiStatus } from '@/utils/api'
import { CODE_LENGTH, isValidCode, sanitizeCode } from '@/utils/attendance'
import { clearPendingClaim } from '@/utils/claim'
import { formatTime } from '@/utils/format'
import type { ClaimResult } from '@/types/api'

const route = useRoute()
const router = useRouter()
const student = useStudentStore()
const attendance = useAttendanceStore()
const { today, loading: todayLoading, load: loadToday } = useTodayAttendance()

const tab = ref<'scan' | 'code'>(typeof route.query.code === 'string' ? 'code' : 'scan')
const code = ref(typeof route.query.code === 'string' ? sanitizeCode(route.query.code) : '')
const withLocation = ref(false)
const submitting = ref(false)
const result = ref<ClaimResult | null>(null)
const error = ref<{ title: string; message: string } | null>(null)
const codeInput = ref<HTMLInputElement | null>(null)

const codeValid = computed(() => isValidCode(code.value))

function onCodeInput(e: Event) {
  const el = e.target as HTMLInputElement
  const clean = sanitizeCode(el.value)
  code.value = clean
  el.value = clean
  error.value = null
}

function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  if (!withLocation.value || !('geolocation' in navigator)) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    )
  })
}

async function submit(value = code.value) {
  const clean = sanitizeCode(value)
  if (!isValidCode(clean) || submitting.value) {
    if (!isValidCode(clean)) error.value = { title: 'Kode belum lengkap', message: `Masukkan ${CODE_LENGTH} karakter kode presensi.` }
    return
  }
  code.value = clean
  submitting.value = true
  error.value = null
  try {
    const pos = await getPosition()
    result.value = await attendance.claim(clean, pos)
    haptic([12, 50, 12])
    clearPendingClaim()
  } catch (err) {
    haptic([30, 40, 30])
    const c = getApiErrorCode(err)
    if (c === 'INVALID_CODE')
      error.value = { title: 'Kode tidak valid', message: 'Kode tidak ditemukan atau sesi belum dimulai. Periksa kembali kode dari guru.' }
    else if (c === 'CODE_EXPIRED')
      error.value = { title: 'Kode kedaluwarsa', message: 'Kode ini sudah tidak berlaku. Minta guru menampilkan kode terbaru.' }
    else if (c === 'NOT_IN_CLASS')
      error.value = { title: 'Bukan kelasmu', message: 'Sesi ini bukan untuk kelasmu. Pastikan kamu memindai kode di kelas yang benar.' }
    else if (c === 'NOT_ENROLLED') {
      await student.fetchMe(true).catch(() => undefined)
    } else if (getApiStatus(err) === 429)
      error.value = { title: 'Terlalu banyak percobaan', message: 'Tunggu sebentar lalu coba lagi.' }
    else error.value = { title: 'Presensi gagal', message: getApiError(err) }
    if (tab.value === 'scan') tab.value = 'code'
  } finally {
    submitting.value = false
  }
}

function onScanned(c: string) {
  haptic(15)
  code.value = c
  void submit(c)
}
function onInvalidQr() {
  toast.warning('QR tidak dikenali', 'Pindai QR presensi kelas yang ditampilkan guru.')
}

function again() {
  result.value = null
  error.value = null
  code.value = ''
  tab.value = 'scan'
}

watch(tab, async (t) => {
  if (t === 'code') {
    await nextTick()
    codeInput.value?.focus()
  }
})

/** Tautan QR (/attendance/claim?code=…) → isi otomatis lalu kirim. */
let autoTried = false
async function autoClaim() {
  if (autoTried || route.query.auto !== '1' || !codeValid.value) return
  autoTried = true
  await router.replace({ query: {} })
  await submit()
}

onMounted(async () => {
  await student.fetchMe().catch(() => undefined)
  if (student.isActive) {
    void loadToday()
    void autoClaim()
  }
})
watch(
  () => student.isActive,
  (a) => {
    if (a) {
      void loadToday()
      void autoClaim()
    }
  },
)

const liveSessions = computed(() => today.value?.sessions ?? [])
</script>

<template>
  <div class="space-y-4">
    <EnrollmentGate join-message="Presensi kelas tersedia setelah kamu tergabung dan disetujui oleh sekolah.">
      <!-- Sukses -->
      <section v-if="result" class="card overflow-hidden text-center animate-scale-in" aria-live="assertive">
        <div class="bg-gradient-to-br from-emerald-500 to-teal-600 px-6 py-7 text-white">
          <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-8 ring-white/10">
            <CircleCheckBig :size="34" aria-hidden="true" />
          </span>
          <h2 class="mt-3 text-lg font-semibold">Presensi kelas berhasil</h2>
          <p class="text-sm text-emerald-50">Kehadiranmu sudah tercatat.</p>
        </div>
        <dl class="grid grid-cols-2 gap-3 p-4 text-left">
          <div class="col-span-2 rounded-xl bg-surface-muted p-3">
            <dt class="text-xs text-fg-subtle">Mata pelajaran</dt>
            <dd class="mt-0.5 font-semibold text-fg">{{ result.subject_name }}</dd>
          </div>
          <div class="rounded-xl bg-surface-muted p-3">
            <dt class="text-xs text-fg-subtle">Kelas</dt>
            <dd class="mt-0.5 font-semibold text-fg">{{ result.class_name || '—' }}</dd>
          </div>
          <div class="rounded-xl bg-surface-muted p-3">
            <dt class="text-xs text-fg-subtle">Waktu</dt>
            <dd class="mt-0.5 font-semibold tabular-nums text-fg">{{ formatTime(result.check_in_time) }}</dd>
          </div>
          <div class="col-span-2 flex items-center justify-between rounded-xl bg-surface-muted p-3">
            <dt class="text-xs text-fg-subtle">Status</dt>
            <dd><StatusPill :status="result.status" size="md" /></dd>
          </div>
        </dl>
        <div class="grid grid-cols-2 gap-2 px-4 pb-4">
          <BaseButton variant="secondary" size="lg" to="/">Beranda</BaseButton>
          <BaseButton size="lg" :icon="ScanLine" @click="again">Pindai lagi</BaseButton>
        </div>
      </section>

      <template v-else>
        <!-- Pilihan metode -->
        <div class="grid grid-cols-2 gap-1 rounded-2xl bg-surface-muted p-1" role="tablist" aria-label="Metode presensi kelas">
          <button
            v-for="t in [{ id: 'scan', label: 'Pindai QR', icon: ScanLine }, { id: 'code', label: 'Masukkan Kode', icon: Keyboard }] as const"
            :id="`tab-${t.id}`"
            :key="t.id"
            type="button"
            role="tab"
            :aria-selected="tab === t.id"
            :aria-controls="`panel-${t.id}`"
            class="pressable flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            :class="tab === t.id ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted'"
            @click="tab = t.id"
          >
            <component :is="t.icon" :size="17" aria-hidden="true" /> {{ t.label }}
          </button>
        </div>

        <AlertBanner v-if="error" tone="danger" :title="error.title" class="mt-4">{{ error.message }}</AlertBanner>

        <div v-if="tab === 'scan'" id="panel-scan" role="tabpanel" aria-labelledby="tab-scan" class="mt-4">
          <div v-if="submitting" class="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-3xl bg-surface-muted text-sm text-fg-muted" aria-live="polite">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-primary-600" aria-hidden="true" />
            Mengirim presensi {{ code }}…
          </div>
          <QrScannerView v-else @code="onScanned" @invalid="onInvalidQr" />
          <p class="mt-3 text-center text-sm text-fg-muted">Arahkan kamera ke QR presensi yang ditampilkan guru.</p>
        </div>

        <form v-else id="panel-code" role="tabpanel" aria-labelledby="tab-code" class="card mt-4 p-4" novalidate @submit.prevent="submit()">
          <label for="claim-code" class="text-sm font-medium text-fg">Kode presensi ({{ CODE_LENGTH }} karakter)</label>
          <input
            id="claim-code"
            ref="codeInput"
            :value="code"
            type="text"
            inputmode="text"
            autocomplete="off"
            autocapitalize="characters"
            autocorrect="off"
            spellcheck="false"
            :maxlength="CODE_LENGTH + 4"
            placeholder="ABC234"
            aria-describedby="claim-code-hint"
            :aria-invalid="error ? 'true' : undefined"
            class="control mt-2 h-16 text-center font-mono text-3xl font-bold uppercase tracking-[0.45em] placeholder:tracking-[0.45em] placeholder:text-fg-subtle/50"
            @input="onCodeInput"
          />
          <p id="claim-code-hint" class="mt-2 text-xs text-fg-subtle">
            Huruf & angka dari layar guru. Huruf O/I dan angka 0/1 tidak dipakai.
          </p>
          <label class="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-3">
            <span class="flex items-center gap-2 text-sm text-fg">
              <MapPin :size="16" aria-hidden="true" class="text-fg-subtle" /> Sertakan lokasi
              <span class="text-xs text-fg-subtle">(opsional)</span>
            </span>
            <input v-model="withLocation" type="checkbox" class="h-5 w-5 accent-primary-600" />
          </label>
          <BaseButton type="submit" block size="lg" class="mt-4" :icon="Send" :loading="submitting" :disabled="!codeValid">
            {{ submitting ? 'Mengirim…' : 'Kirim presensi' }}
          </BaseButton>
        </form>

        <section class="mt-6" aria-labelledby="class-lessons-title">
          <h2 id="class-lessons-title" class="mb-2 text-[15px] font-semibold text-fg">Pelajaran hari ini</h2>
          <LessonList :sessions="liveSessions" :loading="todayLoading" />
        </section>
      </template>
    </EnrollmentGate>
  </div>
</template>
