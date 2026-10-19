import { defineStore } from 'pinia'
import api from '@/utils/api'
import { resetAllStores } from '@/utils/session'
import type { ActivationInfo, LoginResponse, TokenPair, UserDTO } from '@/types/api'

export const AUTH_STORAGE_KEY = 'edupilot-students-auth'

/** Akun siswa = users.role `customer` + customers.role `students` (API_CONTRACT §10.1). */
export function isStudentAccount(user: UserDTO | null | undefined): boolean {
  return !!user && user.role === 'customer' && user.customer?.role === 'students'
}

export class NotStudentError extends Error {
  constructor() {
    super('Akun ini bukan akun siswa. Silakan masuk lewat Dasbor Sekolah EduPilot.')
    this.name = 'NotStudentError'
  }
}

export interface RegisterPayload {
  full_name: string
  email: string
  phone?: string
  password: string
}

export interface ProfilePayload {
  full_name: string
  phone?: string
  birth_place?: string
  birth_date?: string
  /** 1 = Laki-laki, 2 = Perempuan */
  gender?: 1 | 2
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: UserDTO | null
  /** Email yang sedang menunggu verifikasi OTP (tidak dipersist). */
  pendingEmail: string
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    pendingEmail: '',
  }),

  getters: {
    isAuthenticated: (s) => !!s.accessToken && !!s.user,
    isStudent: (s) => isStudentAccount(s.user),
    displayName: (s) => s.user?.customer?.full_name?.trim() || s.user?.email || 'Siswa',
    firstName(): string {
      return this.displayName.split(/\s+/)[0] ?? this.displayName
    },
  },

  actions: {
    setTokens(tokens: TokenPair) {
      this.accessToken = tokens.access_token
      this.refreshToken = tokens.refresh_token
    },

    async applyLoginResponse(res: LoginResponse) {
      this.setTokens(res)
      this.user = res.user ?? null
      this.pendingEmail = ''
      if (!this.user) await this.fetchMe()
      if (!this.isStudent) {
        await this.logout()
        throw new NotStudentError()
      }
    },

    async login(email: string, password: string) {
      const { data } = await api.post<LoginResponse>('/auth/login', { email, password })
      await this.applyLoginResponse(data)
    },

    /** Registrasi tidak mengembalikan token; lanjut ke verifikasi OTP (§5, §10.2). */
    async register(payload: RegisterPayload) {
      const { data } = await api.post<{ message: string; data: { email: string } }>('/auth/register', {
        ...payload,
        app: 'students',
      })
      this.pendingEmail = data?.data?.email || payload.email
      return data
    },

    async verifyOtp(email: string, otp: string) {
      const { data } = await api.post<LoginResponse>('/auth/verify', { email, otp })
      await this.applyLoginResponse(data)
    },

    async resendOtp(email: string) {
      const { data } = await api.post<{ message: string }>('/auth/resend-otp', { email })
      return data
    },

    async fetchMe() {
      const { data } = await api.get<{ data: UserDTO }>('/auth/me')
      this.user = data.data
      return this.user
    },

    async updateProfile(payload: ProfilePayload) {
      const { data } = await api.put<{ data: UserDTO }>('/auth/profile', payload)
      if (data?.data) this.user = data.data
      else await this.fetchMe()
    },

    async uploadPhotoProfile(file: File) {
      const form = new FormData()
      form.append('photo', file)
      const { data } = await api.put<{ data: UserDTO }>('/auth/photo-profile', form)
      if (data?.data) this.user = data.data
      else await this.fetchMe()
    },

    /** Cek token aktivasi (undangan akun siswa dari sekolah, §7.3 & §10.2). */
    async checkActivation(token: string) {
      const { data } = await api.get<{ data: ActivationInfo }>('/auth/activate', { params: { token } })
      return data.data
    },

    async activateAccount(token: string, password: string) {
      const { data } = await api.post<LoginResponse>('/auth/activate', { token, password })
      resetAllStores()
      await this.applyLoginResponse(data)
    },

    async forgotPassword(email: string) {
      const { data } = await api.post<{ message: string }>('/auth/forgot-password', { email })
      return data
    },

    async resetPassword(token: string, password: string) {
      const { data } = await api.post<{ message: string }>('/auth/reset-password', { token, password })
      return data
    },

    /** Logout di server (best effort), lalu bersihkan seluruh state lokal. */
    async logout() {
      const refreshToken = this.refreshToken
      if (this.accessToken) {
        try {
          await api.post('/auth/logout', refreshToken ? { refresh_token: refreshToken } : {}, {
            skipAuthRefresh: true,
            headers: { Authorization: `Bearer ${this.accessToken}` },
          })
        } catch {
          // Abaikan: sesi lokal tetap dibersihkan.
        }
      }
      resetAllStores()
    },
  },

  persist: {
    key: AUTH_STORAGE_KEY,
    // Hanya token yang dipersist; data user selalu diambil ulang dari /auth/me.
    pick: ['accessToken', 'refreshToken'],
  },
})
