import { defineStore } from 'pinia'
import api from '@/utils/api'
import type {
  AttemptState,
  AttemptStatusResponse,
  InstrumentCode,
  OnboardingData,
  ResultHistoryItem,
  SaveAnswersPayload,
  SaveAnswersResponse,
  StudentResult,
  StudentSession,
  SubmitResponse,
  AnswerMap,
} from '@/types/assessment'

const BASE = '/assessment/student'
const enc = encodeURIComponent

/**
 * Kontrak hanya merinci envelope `{ data }` untuk daftar & start; respons objek lain
 * bisa langsung atau terbungkus `data`. `probe` = field yang pasti ada pada objek.
 */
function unwrap<T>(body: unknown, probe: string): T {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>
    if (probe in obj) return obj as T
    if (obj.data && typeof obj.data === 'object') return obj.data as T
  }
  return body as T
}

interface State {
  sessions: StudentSession[]
  sessionsLoaded: boolean
  results: ResultHistoryItem[]
  resultsLoaded: boolean
  /** Cache hasil per attempt_id. */
  resultByAttempt: Record<string, StudentResult>
}

/** Asesmen Psikologi siswa — §13.5 (`/assessment/student/*`, siswa terdaftar saja). */
export const useStudentAssessmentStore = defineStore('studentAssessment', {
  state: (): State => ({
    sessions: [],
    sessionsLoaded: false,
    results: [],
    resultsLoaded: false,
    resultByAttempt: {},
  }),

  actions: {
    async fetchSessions() {
      const { data } = await api.get<{ data: StudentSession[] | null }>(`${BASE}/sessions`)
      this.sessions = (data.data ?? []).map((s) => ({ ...s, instruments: s.instruments ?? [] }))
      this.sessionsLoaded = true
      return this.sessions
    },

    async fetchResults() {
      const { data } = await api.get<{ data: ResultHistoryItem[] | null }>(`${BASE}/results`, {
        params: { limit: 100 },
      })
      this.results = data.data ?? []
      this.resultsLoaded = true
      return this.results
    },

    async fetchOnboarding(sessionId: string, instrument: InstrumentCode) {
      const { data } = await api.get(`${BASE}/sessions/${enc(sessionId)}/onboarding`, {
        params: { instrument },
      })
      const ob = unwrap<OnboardingData>(data, 'instrument')
      return {
        ...ob,
        instrument: { ...ob.instrument, sections: ob.instrument?.sections ?? [] },
        terms_and_conditions: {
          title: ob.terms_and_conditions?.title ?? 'Syarat & ketentuan',
          points: ob.terms_and_conditions?.points ?? [],
          disclaimer: ob.terms_and_conditions?.disclaimer ?? '',
        },
        interactive_examples: ob.interactive_examples ?? [],
      } satisfies OnboardingData
    },

    /** 201 baru / 200 lanjut. Galat: SESSION_NOT_OPEN, MAX_ATTEMPTS, QUOTA_EXHAUSTED, CONSENT_REQUIRED. */
    async startAttempt(sessionId: string, instrument: InstrumentCode) {
      const { data } = await api.post(`${BASE}/sessions/${enc(sessionId)}/start`, {
        instrument_code: instrument,
        consent_accepted: true,
      })
      return normalizeAttempt(unwrap<AttemptState>(data, 'attempt'))
    },

    async fetchAttempt(attemptId: string) {
      const { data } = await api.get(`${BASE}/attempts/${enc(attemptId)}`)
      return normalizeAttempt(unwrap<AttemptState>(data, 'attempt'))
    },

    async saveAnswers(attemptId: string, payload: SaveAnswersPayload) {
      const { data } = await api.put(`${BASE}/attempts/${enc(attemptId)}/answers`, payload)
      return unwrap<SaveAnswersResponse>(data, 'server_time')
    },

    /** 202 queued; 409 ALREADY_SUBMITTED; 422 INCOMPLETE { missing }. */
    async submitAttempt(attemptId: string, answers: AnswerMap, durationSec: number) {
      const { data } = await api.post(`${BASE}/attempts/${enc(attemptId)}/submit`, {
        answers,
        duration_sec: durationSec,
      })
      return unwrap<SubmitResponse>(data, 'status')
    },

    async fetchStatus(attemptId: string) {
      const { data } = await api.get(`${BASE}/attempts/${enc(attemptId)}/status`)
      return unwrap<AttemptStatusResponse>(data, 'status')
    },

    async fetchResult(attemptId: string, force = false) {
      const cached = this.resultByAttempt[attemptId]
      if (cached && !force) return cached
      const { data } = await api.get(`${BASE}/attempts/${enc(attemptId)}/result`)
      const result = unwrap<StudentResult>(data, 'instrument_code')
      this.resultByAttempt[attemptId] = result
      return result
    },
  },
})

function normalizeAttempt(s: AttemptState): AttemptState {
  return {
    ...s,
    sections: s.sections ?? [],
    questions: s.questions ?? [],
    answers: s.answers ?? {},
  }
}
