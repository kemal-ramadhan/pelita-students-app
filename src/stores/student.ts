import { defineStore } from 'pinia'
import api from '@/utils/api'
import type { JoinPayload, JoinRequest, StudentMe } from '@/types/api'

interface StudentState {
  me: StudentMe | null
  loading: boolean
  loaded: boolean
  error: string
}

/** Status keanggotaan sekolah siswa: GET /instantion/student/me (§10.5). */
export const useStudentStore = defineStore('student', {
  state: (): StudentState => ({ me: null, loading: false, loaded: false, error: '' }),

  getters: {
    status: (s) => s.me?.status ?? null,
    isActive: (s) => s.me?.status === 'active',
    isPending: (s) => s.me?.status === 'pending',
    hasNoSchool: (s) => s.me?.status === 'no_school',
    school: (s) => s.me?.school ?? null,
    student: (s) => s.me?.student ?? null,
    className: (s) => s.me?.student?.current_class?.display_name ?? null,
    pendingRequest: (s) => s.me?.pending_request ?? null,
  },

  actions: {
    async fetchMe(force = false) {
      if (this.loading) return this.me
      if (this.loaded && !force) return this.me
      this.loading = true
      this.error = ''
      try {
        const { data } = await api.get<{ data: StudentMe }>('/instantion/student/me')
        this.me = data.data
        this.loaded = true
        return this.me
      } finally {
        this.loading = false
      }
    },

    async join(payload: JoinPayload) {
      const { data } = await api.post<{ data: JoinRequest }>('/instantion/student/join', payload)
      await this.fetchMe(true)
      return data.data
    },

    async cancelJoin() {
      await api.delete('/instantion/student/join')
      await this.fetchMe(true)
    },
  },
})
