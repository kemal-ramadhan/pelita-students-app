<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  CircleCheckBig,
  Crosshair,
  LocateFixed,
  LocateOff,
  LogIn,
  LogOut,
  MapPin,
  RotateCw,
  TriangleAlert,
} from 'lucide-vue-next'
import EnrollmentGate from '@/components/school/EnrollmentGate.vue'
import TodayAttendanceCard from '@/components/presensi/TodayAttendanceCard.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import { useStudentStore } from '@/stores/student'
import { useAttendanceStore } from '@/stores/attendance'
import { useTodayAttendance } from '@/composables/useTodayAttendance'
import { GEO_ERROR_MESSAGES, haversineDistance, useGeolocation } from '@/composables/useGeolocation'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { haptic } from '@/composables/useHaptic'
import { getApiError, getApiErrorCode, getApiErrorDetailsObject } from '@/utils/api'
import { formatDistance, formatTime } from '@/utils/format'
import { statusLabel } from '@/utils/attendance'

const student = useStudentStore()
const attendance = useAttendanceStore()
const { today, loading, error, load } = useTodayAttendance()
const geo = useGeolocation()

const submitting = ref(false)
const actionError = ref<{ title: string; message: string } | null>(null)

const location = computed(() => today.value?.school_location ?? null)
const hasLocation = computed(
  () => !!location.value && Number.isFinite(location.value.latitude) && Number.isFinite(location.value.longitude) && location.value.radius_meters > 0,
)

const distance = computed(() => {
  if (!geo.fix.value || !hasLocation.value) return null
  const l = location.value!
  return haversineDistance(geo.fix.value.latitude, geo.fix.value.longitude, l.latitude, l.longitude)
})
const radius = computed(() => location.value?.radius_meters ?? 0)
const accuracy = computed(() => (geo.fix.value ? Math.round(geo.fix.value.accuracy) : null))

/** inside | uncertain (batas akurasi menyentuh radius) | outside */
const zone = computed<'inside' | 'uncertain' | 'outside' | null>(() => {
  if (distance.value === null) return null
  if (distance.value <= radius.value) return 'inside'
  if (distance.value - (accuracy.value ?? 0) <= radius.value) return 'uncertain'
  return 'outside'
})
/** Server menolak akurasi > 2× radius (LOW_GPS_ACCURACY). */
const lowAccuracy = computed(() => accuracy.value !== null && radius.value > 0 && accuracy.value > radius.value * 2)

const mode = computed<'in' | 'out' | 'done'>(() => {
  if (today.value?.is_checked_out) return 'done'
  if (today.value?.is_checked_in) return 'out'
  return 'in'
})

const canSubmit = computed(
  () =>
    !!geo.fix.value &&
    hasLocation.value &&
    !lowAccuracy.value &&
    zone.value !== 'outside' &&
    zone.value !== null &&
    mode.value !== 'done' &&
    !submitting.value,
)

/** Posisi titik pengguna pada visual radar (0..1 dari pusat). */
const dotOffset = computed(() => {
  if (distance.value === null || !radius.value) return 0
  return Math.min(1, distance.value / (radius.value * 2))
})

onMounted(async () => {
  await student.fetchMe().catch(() => undefined)
  if (student.isActive) {
    void load()
    geo.start()
  }
})
watch(
  () => student.isActive,
  (a) => {
    if (a && !geo.watching.value && !geo.fix.value) {
      void load()
      geo.start()
    }
  },
)

function nowHM(): string {
  const n = today.value?.now
  const m = n ? /T(\d{2}:\d{2})/.exec(n) : null
  if (m) return m[1]!
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

async function submit() {
  if (!canSubmit.value || !geo.fix.value) return
  actionError.value = null
  const out = mode.value === 'out'
  if (out && today.value?.target_check_out_time && nowHM() < today.value.target_check_out_time.slice(0, 5)) {
    const ok = await confirm({
      title: 'Pulang lebih awal?',
      message: `Jam pulang mulai ${formatTime(today.value.target_check_out_time)}. Presensi pulang sekarang akan tercatat pulang lebih awal.`,
      confirmText: 'Ya, presensi pulang',
      tone: 'warning',
    })
    if (!ok) return
  }
  submitting.value = true
  const payload = {
    latitude: geo.fix.value.latitude,
    longitude: geo.fix.value.longitude,
    accuracy: Math.round(geo.fix.value.accuracy),
  }
  try {
    const res = out ? await attendance.checkOut(payload) : await attendance.checkIn(payload)
    haptic([12, 50, 12])
    if (out) toast.success('Presensi pulang tercatat', `Pukul ${formatTime(res.check_out_time)}. Hati-hati di jalan!`)
    else
      toast.success(
        'Presensi masuk tercatat',
        `Pukul ${formatTime(res.check_in_time)} · ${statusLabel(res.status)}${res.late_minutes ? ` (${res.late_minutes} menit)` : ''}`,
      )
  } catch (err) {
    haptic([30, 40, 30])
    const code = getApiErrorCode(err)
    const details = getApiErrorDetailsObject(err)
    switch (code) {
      case 'OUTSIDE_GEOFENCE': {
        const d = Number(details?.distance_m)
        const r = Number(details?.radius_m)
        actionError.value = {
          title: 'Kamu di luar area sekolah',
          message:
            Number.isFinite(d) && Number.isFinite(r)
              ? `Jarakmu ${formatDistance(d)} dari titik sekolah, batas radius ${formatDistance(r)}. Mendekatlah ke sekolah lalu coba lagi.`
              : 'Mendekatlah ke area sekolah lalu coba lagi.',
        }
        break
      }
      case 'LOW_GPS_ACCURACY':
        actionError.value = {
          title: 'Akurasi GPS terlalu rendah',
          message: 'Aktifkan mode lokasi akurasi tinggi, pindah ke area terbuka, tunggu sebentar lalu coba lagi.',
        }
        break
      case 'ALREADY_CHECKED_IN':
        toast.info('Kamu sudah presensi masuk hari ini')
        await load()
        break
      case 'ALREADY_CHECKED_OUT':
        toast.info('Kamu sudah presensi pulang hari ini')
        await load()
        break
      case 'NOT_CHECKED_IN':
        actionError.value = { title: 'Belum presensi masuk', message: 'Lakukan presensi masuk terlebih dahulu.' }
        await load()
        break
      default:
        actionError.value = { title: 'Presensi gagal', message: getApiError(err) }
    }
  } finally {
    submitting.value = false
  }
}

function retryGeo() {
  actionError.value = null
  geo.start()
}
</script>

<template>
  <div class="space-y-4">
    <Teleport defer to="#header-actions">
      <RefreshButton :loading="loading" label="Muat ulang presensi" @click="load" />
    </Teleport>

    <EnrollmentGate join-message="Presensi sekolah tersedia setelah kamu tergabung dan disetujui oleh sekolah.">
      <ErrorState v-if="error && !today" :message="error" :loading="loading" @retry="load" />

      <template v-else>
        <TodayAttendanceCard :today="today" :loading="loading" />

        <div v-if="mode === 'done'" class="card mt-4 flex flex-col items-center p-6 text-center">
          <span class="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CircleCheckBig :size="28" aria-hidden="true" />
          </span>
          <p class="mt-3 font-semibold text-fg">Presensi hari ini sudah lengkap</p>
          <p class="mt-1 text-sm text-fg-muted">Sampai jumpa besok!</p>
        </div>

        <template v-else>
          <AlertBanner v-if="today && !hasLocation" tone="warning" title="Lokasi sekolah belum diatur" class="mt-4">
            Sekolah belum menentukan titik lokasi presensi. Hubungi operator sekolah.
          </AlertBanner>

          <!-- Status GPS -->
          <section class="card mt-4 p-4" aria-labelledby="gps-title" aria-live="polite">
            <div class="flex items-center justify-between">
              <h2 id="gps-title" class="flex items-center gap-2 text-[15px] font-semibold text-fg">
                <Crosshair :size="17" aria-hidden="true" /> Lokasi kamu
              </h2>
              <span v-if="geo.watching.value" class="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
                <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" /> GPS aktif
              </span>
            </div>

            <div v-if="geo.error.value" class="mt-4 flex flex-col items-center text-center">
              <span class="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                <LocateOff :size="24" aria-hidden="true" />
              </span>
              <p class="mt-2 text-sm font-medium text-fg">Lokasi tidak dapat diakses</p>
              <p class="mt-1 text-sm text-fg-muted">{{ GEO_ERROR_MESSAGES[geo.error.value] }}</p>
              <BaseButton class="mt-4" variant="secondary" :icon="RotateCw" @click="retryGeo">Coba lagi</BaseButton>
            </div>

            <div v-else-if="!geo.fix.value" class="mt-4 flex flex-col items-center py-4 text-center" aria-busy="true">
              <span class="relative flex h-14 w-14 items-center justify-center">
                <span class="absolute inset-0 animate-ping rounded-full bg-primary-400/30" aria-hidden="true" />
                <LocateFixed :size="26" class="relative text-accent" aria-hidden="true" />
              </span>
              <p class="mt-3 text-sm text-fg-muted">Mencari lokasi… Pastikan GPS aktif dan izinkan akses lokasi.</p>
            </div>

            <template v-else>
              <!-- Visual radar -->
              <div class="relative mx-auto mt-4 aspect-square w-48" aria-hidden="true">
                <div class="absolute inset-0 rounded-full border border-dashed border-line-strong" />
                <div
                  class="absolute inset-1/4 rounded-full border-2"
                  :class="zone === 'inside' ? 'border-emerald-500 bg-emerald-500/10' : zone === 'uncertain' ? 'border-amber-500 bg-amber-500/10' : 'border-red-500 bg-red-500/10'"
                />
                <MapPin :size="20" class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full text-primary-600 dark:text-primary-400" />
                <span
                  class="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600 ring-4 ring-primary-500/30 transition-all duration-500 dark:bg-primary-400"
                  :style="{ left: '50%', top: `${50 - dotOffset * 50}%` }"
                />
              </div>

              <div
                class="mt-4 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
                :class="
                  zone === 'inside'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : zone === 'uncertain'
                      ? 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                      : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                "
              >
                <CircleCheckBig v-if="zone === 'inside'" :size="17" aria-hidden="true" />
                <TriangleAlert v-else :size="17" aria-hidden="true" />
                {{
                  zone === 'inside'
                    ? 'Di dalam area sekolah'
                    : zone === 'uncertain'
                      ? 'Di tepi area sekolah (GPS kurang akurat)'
                      : 'Di luar area sekolah'
                }}
              </div>

              <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
                <div class="rounded-xl bg-surface-muted p-2.5">
                  <dt class="text-[11px] text-fg-subtle">Jarak</dt>
                  <dd class="text-sm font-semibold tabular-nums text-fg">{{ distance !== null ? formatDistance(distance) : '—' }}</dd>
                </div>
                <div class="rounded-xl bg-surface-muted p-2.5">
                  <dt class="text-[11px] text-fg-subtle">Radius</dt>
                  <dd class="text-sm font-semibold tabular-nums text-fg">{{ radius ? formatDistance(radius) : '—' }}</dd>
                </div>
                <div class="rounded-xl bg-surface-muted p-2.5">
                  <dt class="text-[11px] text-fg-subtle">Akurasi</dt>
                  <dd class="text-sm font-semibold tabular-nums" :class="lowAccuracy ? 'text-red-600 dark:text-red-400' : 'text-fg'">
                    ±{{ accuracy }} m
                  </dd>
                </div>
              </dl>
              <p v-if="location?.location_name" class="mt-2 text-center text-xs text-fg-subtle">Titik: {{ location.location_name }}</p>
              <AlertBanner v-if="lowAccuracy" tone="warning" class="mt-3">
                Akurasi GPS terlalu rendah. Pindah ke area terbuka dan tunggu beberapa detik.
              </AlertBanner>
            </template>
          </section>

          <AlertBanner v-if="actionError" tone="danger" :title="actionError.title" class="mt-4">{{ actionError.message }}</AlertBanner>

          <div class="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] mt-4">
            <BaseButton
              block
              size="lg"
              class="!h-14 !rounded-2xl !text-base shadow-lg"
              :icon="mode === 'out' ? LogOut : LogIn"
              :loading="submitting"
              :disabled="!canSubmit"
              @click="submit"
            >
              {{
                submitting
                  ? 'Mengirim…'
                  : zone === 'outside'
                    ? 'Di luar area sekolah'
                    : mode === 'out'
                      ? 'Presensi Pulang'
                      : 'Presensi Masuk'
              }}
            </BaseButton>
          </div>
        </template>
      </template>
    </EnrollmentGate>
  </div>
</template>
