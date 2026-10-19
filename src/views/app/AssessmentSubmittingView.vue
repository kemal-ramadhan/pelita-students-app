<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BrainCircuit, CircleAlert, CircleCheck, Hourglass, RotateCw } from 'lucide-vue-next'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useStudentAssessmentStore } from '@/stores/assessmentStudent'
import { haptic } from '@/composables/useHaptic'
import { getApiStatus } from '@/utils/api'
import { assessmentError } from '@/utils/assessment'

const route = useRoute()
const router = useRouter()
const store = useStudentAssessmentStore()
const attemptId = computed(() => String(route.params.attemptId ?? ''))

type View = 'waiting' | 'completed' | 'failed' | 'slow' | 'error'
const view = ref<View>('waiting')
const errorText = ref('')
const networkTrouble = ref(false)

const INITIAL_DELAY = 1500
const MAX_DELAY = 10_000
/** Setelah ±2 menit tanpa hasil, berhenti dan tawarkan cek manual. */
const GIVE_UP_MS = 120_000

let timer: ReturnType<typeof setTimeout> | undefined
let delay = INITIAL_DELAY
let startedAt = 0
let failures = 0
let active = false

function schedule() {
  if (!active) return
  clearTimeout(timer)
  if (Date.now() - startedAt > GIVE_UP_MS) {
    active = false
    view.value = 'slow'
    return
  }
  timer = setTimeout(() => void check(), delay)
  delay = Math.min(Math.round(delay * 1.5), MAX_DELAY)
}

async function check() {
  if (!active) return
  try {
    const res = await store.fetchStatus(attemptId.value)
    if (!active) return
    failures = 0
    networkTrouble.value = false
    if (res.status === 'completed') {
      active = false
      view.value = 'completed'
      haptic(15)
      timer = setTimeout(
        () =>
          void router.replace({
            name: 'assessment-result',
            params: { attemptId: attemptId.value },
          }),
        700,
      )
      return
    }
    if (res.status === 'failed') {
      active = false
      view.value = 'failed'
      return
    }
    if (res.status === 'in_progress') {
      // Belum dikumpulkan → kembali ke daftar agar bisa dilanjutkan.
      active = false
      void router.replace({ name: 'assessments' })
      return
    }
    schedule()
  } catch (err) {
    if (!active) return
    const http = getApiStatus(err)
    if (http === 404 || http === 403) {
      active = false
      view.value = 'error'
      errorText.value =
        http === 404
          ? 'Data pengerjaan tidak ditemukan.'
          : assessmentError(err, 'Tidak dapat membuka status').message
      return
    }
    failures++
    networkTrouble.value = failures >= 2
    schedule()
  }
}

function startPolling() {
  clearTimeout(timer)
  active = true
  delay = INITIAL_DELAY
  failures = 0
  startedAt = Date.now()
  view.value = 'waiting'
  networkTrouble.value = false
  void check()
}

onMounted(startPolling)
onBeforeUnmount(() => {
  active = false
  clearTimeout(timer)
})
</script>

<template>
  <div class="flex min-h-[60dvh] flex-col items-center justify-center">
    <section
      v-if="view === 'waiting'"
      class="card w-full px-6 py-10 text-center"
      aria-busy="true"
      aria-live="polite"
    >
      <span class="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
        <span
          class="absolute inset-0 animate-ping rounded-full bg-primary-500/20"
          aria-hidden="true"
        />
        <span
          class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-md"
        >
          <BrainCircuit :size="26" aria-hidden="true" />
        </span>
      </span>
      <h2 class="text-base font-semibold text-fg">Jawabanmu sedang diproses</h2>
      <p class="mx-auto mt-1 max-w-xs text-sm text-fg-muted">
        Biasanya hanya beberapa detik. Kamu boleh meninggalkan halaman ini — hasilnya tetap
        tersimpan di riwayat.
      </p>
      <p v-if="networkTrouble" class="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
        Koneksi tidak stabil, mencoba lagi…
      </p>
      <BaseButton class="mt-5" variant="secondary" :to="{ name: 'assessments' }"
        >Kembali ke daftar</BaseButton
      >
    </section>

    <section
      v-else-if="view === 'completed'"
      class="card w-full px-6 py-10 text-center"
      role="status"
    >
      <span
        class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
      >
        <CircleCheck :size="24" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">Hasil siap</h2>
      <p class="mt-1 text-sm text-fg-muted">Membuka hasil asesmenmu…</p>
    </section>

    <section v-else-if="view === 'slow'" class="card w-full px-6 py-10 text-center" role="status">
      <span
        class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
      >
        <Hourglass :size="22" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">Masih diproses</h2>
      <p class="mx-auto mt-1 max-w-xs text-sm text-fg-muted">
        Pemrosesan butuh waktu lebih lama dari biasanya. Jawabanmu sudah aman; cek lagi beberapa
        saat lagi.
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        <BaseButton variant="secondary" :to="{ name: 'assessments' }">Kembali ke daftar</BaseButton>
        <BaseButton :icon="RotateCw" @click="startPolling">Cek lagi</BaseButton>
      </div>
    </section>

    <section v-else class="card w-full px-6 py-10 text-center" role="alert">
      <span
        class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400"
      >
        <CircleAlert :size="22" aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold text-fg">
        {{ view === 'failed' ? 'Hasil belum dapat diproses' : 'Tidak dapat membuka status' }}
      </h2>
      <p class="mx-auto mt-1 max-w-xs text-sm text-fg-muted">
        {{
          view === 'failed'
            ? 'Terjadi kendala saat mengolah jawabanmu. Jawabanmu tetap tersimpan; beri tahu Guru BK agar dapat dibantu.'
            : errorText
        }}
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        <BaseButton variant="secondary" :to="{ name: 'assessments' }">Kembali ke daftar</BaseButton>
        <BaseButton v-if="view === 'failed'" variant="soft" :to="{ name: 'counseling' }"
          >Hubungi Guru BK</BaseButton
        >
        <BaseButton v-else :icon="RotateCw" @click="startPolling">Coba lagi</BaseButton>
      </div>
    </section>
  </div>
</template>
