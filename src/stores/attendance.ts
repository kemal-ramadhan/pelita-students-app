import { defineStore } from 'pinia'
import api from '@/utils/api'
import type {
  AttendanceHistory,
  AttendanceToday,
  ClaimResult,
  DailyAttendance,
  GeoPayload,
} from '@/types/api'

interface AttendanceState {
  today: AttendanceToday | null
  todayLoadedAt: number
  history: Record<string, AttendanceHistory>
}

/** Presensi siswa: /instantion/student/attendance/* (§10.5). */
export const useAttendanceStore = defineStore('attendance', {
  state: (): AttendanceState => ({ today: null, todayLoadedAt: 0, history: {} }),

  actions: {
    async fetchToday() {
      const { data } = await api.get<{ data: AttendanceToday }>('/instantion/student/attendance/today')
      this.today = { ...data.data, sessions: data.data.sessions ?? [] }
      this.todayLoadedAt = Date.now()
      return this.today
    },

    async checkIn(pos: GeoPayload) {
      const { data } = await api.post<{ data: DailyAttendance }>('/instantion/student/attendance/check-in', pos)
      await this.fetchToday().catch(() => undefined)
      return data.data
    },

    async checkOut(pos: GeoPayload) {
      const { data } = await api.post<{ data: DailyAttendance }>('/instantion/student/attendance/check-out', pos)
      await this.fetchToday().catch(() => undefined)
      return data.data
    },

    async claim(code: string, pos?: { latitude: number; longitude: number } | null) {
      const body: Record<string, unknown> = { code }
      if (pos) {
        body.latitude = pos.latitude
        body.longitude = pos.longitude
      }
      const { data } = await api.post<{ data: ClaimResult }>('/instantion/student/attendance/claim', body)
      void this.fetchToday().catch(() => undefined)
      return data.data
    },

    async fetchHistory(month: string, force = false) {
      if (!force && this.history[month]) return this.history[month]!
      const { data } = await api.get<{ data: AttendanceHistory }>('/instantion/student/attendance/history', {
        params: { month },
      })
      const h: AttendanceHistory = {
        summary: data.data?.summary ?? { present: 0, late: 0, sick: 0, permission: 0, absent: 0 },
        daily: data.data?.daily ?? [],
        sessions: data.data?.sessions ?? [],
      }
      this.history[month] = h
      return h
    },
  },
})
