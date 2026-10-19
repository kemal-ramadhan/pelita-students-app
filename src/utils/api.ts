import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { TokenPair } from '@/types/api'

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Jangan coba refresh token ketika request ini mendapat 401. */
    skipAuthRefresh?: boolean
    /** Penanda internal: request sudah pernah diulang setelah refresh. */
    _retried?: boolean
  }
}

export const API_BASE_URL: string = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8888'
).replace(/\/+$/, '')

/**
 * Jembatan antara klien HTTP dan state sesi (auth store) agar tidak ada
 * import melingkar. Dikonfigurasi sekali di main.ts.
 */
export interface SessionBridge {
  getAccessToken: () => string | null
  getRefreshToken: () => string | null
  setTokens: (tokens: TokenPair) => void
  onSessionExpired: () => void
  /** 403 FORBIDDEN_ROLE: peran pengguna tidak boleh mengakses endpoint ini. */
  onForbiddenRole?: () => void
}

let bridge: SessionBridge | null = null

export function configureApi(sessionBridge: SessionBridge) {
  bridge = sessionBridge
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
})

/** Klien terpisah tanpa interceptor untuk refresh token. */
const refreshClient = axios.create({ baseURL: API_BASE_URL, timeout: 15_000 })

const PUBLIC_AUTH_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/verify',
  '/auth/resend-otp',
  '/auth/refresh',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/activate',
  '/auth/logout',
]

function isPublicAuthRequest(url?: string) {
  if (!url) return false
  return PUBLIC_AUTH_PATHS.some((p) => url.startsWith(p))
}

api.interceptors.request.use((config) => {
  const token = bridge?.getAccessToken()
  if (token && !isPublicAuthRequest(config.url)) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// Single-flight refresh: semua request 401 yang bersamaan menunggu satu promise.
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    const refreshToken = bridge?.getRefreshToken()
    if (!refreshToken) return Promise.reject(new Error('NO_REFRESH_TOKEN'))

    refreshPromise = refreshClient
      .post<TokenPair>('/auth/refresh', { refresh_token: refreshToken })
      .then((res) => {
        const { access_token, refresh_token } = res.data
        if (!access_token || !refresh_token) throw new Error('INVALID_REFRESH_RESPONSE')
        bridge?.setTokens({ access_token, refresh_token })
        return access_token
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined
    // 401 UNAUTHORIZED_GATEWAY = secret antar-service tidak cocok (salah konfigurasi server),
    // bukan sesi pengguna yang habis — jangan refresh/logout.
    const gatewayMisconfig =
      error.response?.status === 401 &&
      (error.response.data as { code?: string } | undefined)?.code === 'UNAUTHORIZED_GATEWAY'
    const status = gatewayMisconfig ? 502 : error.response?.status

    if (status === 403 && getApiErrorCode(error) === 'FORBIDDEN_ROLE') {
      bridge?.onForbiddenRole?.()
    }

    if (
      status === 401 &&
      config &&
      !config._retried &&
      !config.skipAuthRefresh &&
      !isPublicAuthRequest(config.url) &&
      bridge?.getRefreshToken()
    ) {
      config._retried = true
      try {
        const newToken = await refreshAccessToken()
        config.headers.set('Authorization', `Bearer ${newToken}`)
        return api(config)
      } catch {
        bridge?.onSessionExpired()
        return Promise.reject(error)
      }
    }

    if (status === 401 && config && !isPublicAuthRequest(config.url) && !config.skipAuthRefresh) {
      bridge?.onSessionExpired()
    }

    return Promise.reject(error)
  },
)

export default api

/* ------------------------------------------------------------------ */
/* Helper error                                                        */
/* ------------------------------------------------------------------ */

interface ErrorBody {
  error?: string
  message?: string
  code?: string
  details?: unknown
}

function detailsText(details: unknown): string {
  if (!details) return ''
  if (typeof details === 'string') return details
  if (Array.isArray(details)) return details.map(detailsText).filter(Boolean).join('; ')
  if (typeof details === 'object') {
    const obj = details as Record<string, unknown>
    if (typeof obj.message === 'string') return obj.message
    return Object.values(obj).map(detailsText).filter(Boolean).join('; ')
  }
  return String(details)
}

/** Detail validasi (bila ada) dari body error. */
export function getApiErrorDetails(err: unknown): string {
  return detailsText(errorBody(err)?.details)
}

function errorBody(err: unknown): ErrorBody | undefined {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (data && typeof data === 'object' && !(data instanceof Blob)) return data as ErrorBody
  }
  return undefined
}

export function getApiStatus(err: unknown): number | undefined {
  return axios.isAxiosError(err) ? err.response?.status : undefined
}

export function getApiErrorCode(err: unknown): string | undefined {
  return errorBody(err)?.code
}

export function getApiError(err: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (axios.isAxiosError(err)) {
    if (!err.response) {
      return err.code === 'ECONNABORTED'
        ? 'Permintaan terlalu lama. Periksa koneksi Anda dan coba lagi.'
        : 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
    }
    const body = errorBody(err)
    const extra = detailsText(body?.details)
    if (body?.error) return extra && !body.error.includes(extra) ? `${body.error}: ${extra}` : body.error
    if (body?.message) return body.message
    if (err.response.status === 413) return 'Ukuran berkas terlalu besar.'
    if (err.response.status === 429) return 'Terlalu banyak percobaan. Coba lagi beberapa saat lagi.'
    if (err.response.status >= 500) return 'Server sedang bermasalah. Coba lagi nanti.'
  }
  if (err instanceof Error && err.message && !/^[A-Z_]+$/.test(err.message)) return err.message
  return fallback
}

/**
 * Peta galat per field dari `details` (400/422). Mendukung bentuk:
 * `{ "identity.nisn": "..." }`, `{ nisn: "..." }`, `{ identity: { nisn: "..." } }`,
 * `[{ field, message }]`. Kunci dinormalisasi ke path bertitik (mis. `identity.nisn`,
 * `guardians.0.nik`).
 */
export function getApiFieldErrors(err: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (value: unknown, prefix: string) => {
    if (value === null || value === undefined) return
    if (typeof value === 'string') {
      if (prefix) out[prefix] = value
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const o = item as Record<string, unknown>
          const field = typeof o.field === 'string' ? o.field : typeof o.path === 'string' ? o.path : ''
          const message = typeof o.message === 'string' ? o.message : typeof o.error === 'string' ? o.error : ''
          if (field && message) {
            out[prefix ? `${prefix}.${field}` : field] = message
            return
          }
        }
        if (typeof item === 'string' && prefix) {
          out[prefix] = out[prefix] ? `${out[prefix]}; ${item}` : item
          return
        }
        walk(item, prefix ? `${prefix}.${i}` : String(i))
      })
      return
    }
    if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, prefix ? `${prefix}.${k}` : k)
    }
  }
  walk(errorBody(err)?.details, '')
  // Bentuk `{ field, message }` tunggal
  const d = errorBody(err)?.details as Record<string, unknown> | undefined
  if (d && typeof d === 'object' && typeof d.field === 'string' && typeof d.message === 'string') {
    delete out.field
    delete out.message
    out[d.field] = d.message
  }
  return out
}

/** Objek `details` mentah (mis. `{ distance_m, radius_m }` pada OUTSIDE_GEOFENCE). */
export function getApiErrorDetailsObject(err: unknown): Record<string, unknown> | undefined {
  const d = errorBody(err)?.details
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, unknown>) : undefined
}

/** Pesan galat mentah dari server (tanpa detail), untuk kode galat yang ditangani khusus. */
export function getApiErrorMessage(err: unknown): string | undefined {
  return errorBody(err)?.error || errorBody(err)?.message
}
