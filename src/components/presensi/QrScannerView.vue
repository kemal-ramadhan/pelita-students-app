<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { CameraOff, Flashlight, FlashlightOff, RotateCw } from 'lucide-vue-next'
import type QrScanner from 'qr-scanner'
import BaseButton from '@/components/ui/BaseButton.vue'
import { parseClaimPayload } from '@/utils/attendance'

/**
 * Pemindai QR kamera belakang. Pustaka `qr-scanner` memakai BarcodeDetector
 * native bila tersedia, dan fallback ke decoder WebWorker (tanpa layanan pihak ketiga).
 */
const emit = defineEmits<{ code: [code: string]; invalid: [text: string] }>()

const video = ref<HTMLVideoElement | null>(null)
const state = ref<'starting' | 'scanning' | 'error'>('starting')
const errorMsg = ref('')
const hasFlash = ref(false)
const flashOn = ref(false)
let scanner: QrScanner | null = null
let lastInvalidAt = 0
let done = false

function describe(err: unknown): string {
  const name = err instanceof Error ? err.name : ''
  const text = err instanceof Error ? err.message : String(err ?? '')
  if (!window.isSecureContext) return 'Kamera hanya dapat diakses melalui koneksi aman (HTTPS).'
  if (name === 'NotAllowedError' || /permission|denied/i.test(text))
    return 'Izin kamera ditolak. Aktifkan izin kamera untuk situs ini di pengaturan browser, atau masukkan kode secara manual.'
  if (name === 'NotFoundError' || /not found|no camera/i.test(text)) return 'Kamera tidak ditemukan di perangkat ini.'
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
  return 'Kamera tidak dapat dibuka. Masukkan kode secara manual.'
}

async function start() {
  if (!video.value) return
  state.value = 'starting'
  errorMsg.value = ''
  done = false
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera')
    const { default: QrScannerLib } = await import('qr-scanner')
    scanner?.destroy()
    scanner = new QrScannerLib(
      video.value,
      (result) => {
        if (done) return
        const code = parseClaimPayload(result.data)
        if (code) {
          done = true
          scanner?.stop()
          emit('code', code)
        } else if (Date.now() - lastInvalidAt > 2500) {
          lastInvalidAt = Date.now()
          emit('invalid', result.data)
        }
      },
      {
        preferredCamera: 'environment',
        maxScansPerSecond: 8,
        highlightScanRegion: false,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      },
    )
    await scanner.start()
    state.value = 'scanning'
    hasFlash.value = await scanner.hasFlash().catch(() => false)
  } catch (err) {
    state.value = 'error'
    errorMsg.value = describe(err)
  }
}

async function toggleFlash() {
  if (!scanner) return
  try {
    await scanner.toggleFlash()
    flashOn.value = scanner.isFlashOn()
  } catch {
    hasFlash.value = false
  }
}

onMounted(start)
onBeforeUnmount(() => {
  scanner?.destroy()
  scanner = null
})

defineExpose({ restart: start })
</script>

<template>
  <div class="relative aspect-square w-full overflow-hidden rounded-3xl bg-slate-950">
    <video ref="video" class="h-full w-full object-cover" muted playsinline aria-label="Pratinjau kamera untuk memindai QR" />

    <!-- Bingkai bidik -->
    <div v-if="state === 'scanning'" class="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div class="relative h-[65%] w-[65%]">
        <span class="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-white" />
        <span class="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-white" />
        <span class="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-white" />
        <span class="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-white" />
        <span class="scanline absolute inset-x-2 h-0.5 rounded-full bg-primary-400 shadow-[0_0_12px_2px] shadow-primary-400/70" />
      </div>
    </div>

    <div v-if="state === 'starting'" class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-white/80" aria-live="polite">
      <span class="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
      Membuka kamera…
    </div>

    <div v-if="state === 'error'" class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white" role="alert">
      <CameraOff :size="32" aria-hidden="true" class="text-white/80" />
      <p class="mt-3 text-sm text-white/90">{{ errorMsg }}</p>
      <BaseButton class="mt-4" variant="secondary" size="sm" :icon="RotateCw" @click="start">Coba lagi</BaseButton>
    </div>

    <button
      v-if="state === 'scanning' && hasFlash"
      type="button"
      class="pressable absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
      :aria-label="flashOn ? 'Matikan senter' : 'Nyalakan senter'"
      :aria-pressed="flashOn"
      @click="toggleFlash"
    >
      <FlashlightOff v-if="flashOn" :size="20" aria-hidden="true" />
      <Flashlight v-else :size="20" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.scanline {
  animation: scan 2.2s ease-in-out infinite alternate;
}
@keyframes scan {
  from {
    top: 6%;
  }
  to {
    top: 94%;
  }
}
</style>
