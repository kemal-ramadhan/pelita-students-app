import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useStudentAssessmentStore } from '@/stores/assessmentStudent'
import { getApiErrorCode, getApiStatus } from '@/utils/api'
import { isNetworkError, readLocal, writeLocal } from '@/utils/assessment'
import type { AnswerMap, AnswerValue, SaveAnswersPayload } from '@/types/assessment'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error'

interface PendingBatch {
  answers: AnswerMap
  rt_ms: Record<string, number>
  section_started?: string
}

const DEBOUNCE_MS = 800
const RETRY_MIN_MS = 2_000
const RETRY_MAX_MS = 30_000

export const pendingKey = (attemptId: string) => `edupilot.assessment.pending.${attemptId}`

/** Jawaban yang belum terkirim untuk sebuah attempt (dari localStorage). */
export function readPending(attemptId: string): PendingBatch | null {
  const p = readLocal<PendingBatch>(pendingKey(attemptId))
  return p && typeof p === 'object' && p.answers
    ? { answers: p.answers, rt_ms: p.rt_ms ?? {}, section_started: p.section_started }
    : null
}

/**
 * Autosave jawaban (PUT /attempts/:id/answers) dengan debounce, antrean offline di
 * localStorage, dan percobaan ulang (backoff) saat koneksi kembali.
 */
export function useAnswerAutosave(opts: {
  /** Dipanggil saat server menolak karena attempt sudah dikumpulkan (409). */
  onAlreadySubmitted: () => void
  /** Waktu server dari respons simpan (untuk koreksi timer). */
  onServerTime?: (iso: string) => void
}) {
  const store = useStudentAssessmentStore()
  const status = ref<SaveStatus>('idle')
  const lastSavedAt = ref<number | null>(null)

  let attemptId: string | null = null
  let pending: PendingBatch = { answers: {}, rt_ms: {} }
  let debounce: ReturnType<typeof setTimeout> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let retryDelay = RETRY_MIN_MS
  let inflight: Promise<boolean> | null = null
  let stopped = false

  const hasPending = () => Object.keys(pending.answers).length > 0 || !!pending.section_started
  const persist = () =>
    attemptId && writeLocal(pendingKey(attemptId), hasPending() ? pending : null)

  /** Mulai untuk attempt tertentu; antrean lokal lama ikut dimuat. */
  function attach(id: string) {
    attemptId = id
    pending = readPending(id) ?? { answers: {}, rt_ms: {} }
    status.value = hasPending() ? 'saving' : 'idle'
    if (hasPending()) void flush()
  }

  function queue(itemId: string, value: AnswerValue, rtMs?: number) {
    pending.answers[itemId] = value
    if (rtMs !== undefined && rtMs > 0) pending.rt_ms[itemId] = Math.round(rtMs)
    persist()
    status.value = navigator.onLine ? 'saving' : 'offline'
    clearTimeout(debounce)
    debounce = setTimeout(() => void flush(), DEBOUNCE_MS)
  }

  function markSectionStarted(key: string) {
    pending.section_started = key
    persist()
    return flush()
  }

  function scheduleRetry() {
    if (stopped) return
    clearTimeout(retry)
    retry = setTimeout(() => void flush(), retryDelay)
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
  }

  async function flush(): Promise<boolean> {
    clearTimeout(debounce)
    if (!attemptId) return false
    if (inflight) await inflight.catch(() => false)
    if (!hasPending()) {
      if (status.value === 'saving') status.value = 'saved'
      return true
    }
    if (!navigator.onLine) {
      status.value = 'offline'
      scheduleRetry()
      return false
    }

    const id = attemptId
    const snap: PendingBatch = {
      answers: { ...pending.answers },
      rt_ms: { ...pending.rt_ms },
      section_started: pending.section_started,
    }
    const payload: SaveAnswersPayload = { answers: snap.answers }
    if (Object.keys(snap.rt_ms).length) payload.rt_ms = snap.rt_ms
    if (snap.section_started) payload.section_started = snap.section_started

    status.value = 'saving'
    inflight = (async () => {
      try {
        const res = await store.saveAnswers(id, payload)
        if (id !== attemptId) return true
        for (const [k, v] of Object.entries(snap.answers)) {
          if (pending.answers[k] === v) {
            delete pending.answers[k]
            delete pending.rt_ms[k]
          }
        }
        if (pending.section_started === snap.section_started) delete pending.section_started
        persist()
        retryDelay = RETRY_MIN_MS
        clearTimeout(retry)
        lastSavedAt.value = Date.now()
        if (res?.server_time) opts.onServerTime?.(res.server_time)
        if (hasPending()) debounce = setTimeout(() => void flush(), DEBOUNCE_MS)
        else status.value = 'saved'
        return true
      } catch (err) {
        const code = getApiErrorCode(err)
        const http = getApiStatus(err)
        if (code === 'ALREADY_SUBMITTED' || http === 409) {
          opts.onAlreadySubmitted()
          return false
        }
        if (isNetworkError(err)) status.value = 'offline'
        else status.value = 'error'
        // Galat sementara (jaringan/5xx/429) → coba lagi. 4xx lain: tetap disimpan lokal, dicoba saat ada jawaban baru.
        if (isNetworkError(err) || (http !== undefined && (http >= 500 || http === 429)))
          scheduleRetry()
        return false
      } finally {
        inflight = null
      }
    })()
    return inflight
  }

  /** Hapus antrean lokal (setelah dikumpulkan). */
  function clear() {
    clearTimeout(debounce)
    clearTimeout(retry)
    pending = { answers: {}, rt_ms: {} }
    if (attemptId) writeLocal(pendingKey(attemptId), null)
  }

  const onOnline = () => {
    retryDelay = RETRY_MIN_MS
    void flush()
  }
  const onOffline = () => {
    if (hasPending() || status.value === 'saving') status.value = 'offline'
  }
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush()
  }

  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onHide)
  })
  onBeforeUnmount(() => {
    stopped = true
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onHide)
    clearTimeout(retry)
    // Kirim sisa jawaban terakhir (tetap aman di localStorage bila gagal).
    if (hasPending()) void flush()
    clearTimeout(debounce)
  })

  return { status, lastSavedAt, attach, queue, markSectionStarted, flush, clear, hasPending }
}
