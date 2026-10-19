import { defineStore } from 'pinia'
import api from '@/utils/api'
import type {
  CounselingEvent,
  CounselingEventAttendance,
  CounselingSession,
  Counselor,
  CreateCounselingPayload,
  Peer,
} from '@/types/counseling'

const BASE = '/instantion/student/counseling'
/** Batas maksimum server (counselingMaxLimit). */
const LIST_LIMIT = 100

interface CounselingState {
  counselors: Counselor[]
  counselorsLoaded: boolean
  sessions: CounselingSession[]
  sessionsLoaded: boolean
  events: CounselingEvent[]
  eventsLoaded: boolean
  /** Acara yang sudah dipresensi pada sesi ini (bila server tidak mengirim penanda). */
  attendedIds: string[]
}

/** Bimbingan Konseling siswa (memerlukan siswa aktif — NOT_ENROLLED bila tidak). */
export const useCounselingStore = defineStore('counseling', {
  state: (): CounselingState => ({
    counselors: [],
    counselorsLoaded: false,
    sessions: [],
    sessionsLoaded: false,
    events: [],
    eventsLoaded: false,
    attendedIds: [],
  }),

  actions: {
    async fetchCounselors(force = false) {
      if (this.counselorsLoaded && !force) return this.counselors
      const { data } = await api.get<{ data: Counselor[] | null }>(`${BASE}/counselors`)
      this.counselors = data.data ?? []
      this.counselorsLoaded = true
      return this.counselors
    },

    async searchPeers(search: string, signal?: AbortSignal) {
      const { data } = await api.get<{ data: Peer[] | null }>(`${BASE}/peers`, { params: { search }, signal })
      return data.data ?? []
    },

    async fetchSessions() {
      const { data } = await api.get<{ data: CounselingSession[] | null }>(`${BASE}/sessions`, {
        params: { limit: LIST_LIMIT },
      })
      this.sessions = data.data ?? []
      this.sessionsLoaded = true
      return this.sessions
    },

    async getSession(id: string) {
      const { data } = await api.get<{ data: CounselingSession }>(`${BASE}/sessions/${encodeURIComponent(id)}`)
      const i = this.sessions.findIndex((s) => s.id === id)
      if (i >= 0) this.sessions[i] = data.data
      return data.data
    },

    async createSession(payload: CreateCounselingPayload) {
      const { data } = await api.post<{ data: CounselingSession }>(`${BASE}/sessions`, payload)
      if (data.data) this.sessions = [data.data, ...this.sessions.filter((s) => s.id !== data.data.id)]
      return data.data
    },

    async fetchEvents() {
      const { data } = await api.get<{ data: CounselingEvent[] | null }>(`${BASE}/events`, {
        params: { limit: LIST_LIMIT },
      })
      this.events = data.data ?? []
      this.eventsLoaded = true
      return this.events
    },

    async attendEvent(id: string) {
      const { data } = await api.post<{ data: CounselingEventAttendance }>(`${BASE}/events/${encodeURIComponent(id)}/attend`, {})
      if (!this.attendedIds.includes(id)) this.attendedIds.push(id)
      return data.data
    },
  },
})
