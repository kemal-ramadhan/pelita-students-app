import type { RouteLocationRaw } from 'vue-router'
import { isValidCode, sanitizeCode } from './attendance'

/** Kode presensi kelas dari tautan QR yang dibuka sebelum login (sessionStorage). */
export const PENDING_CLAIM_KEY = 'pending-claim-code'

/** Ambil & hapus kode klaim yang tertunda. */
export function takePendingClaim(): string | null {
  try {
    const v = sessionStorage.getItem(PENDING_CLAIM_KEY)
    sessionStorage.removeItem(PENDING_CLAIM_KEY)
    const code = v ? sanitizeCode(v) : ''
    return isValidCode(code) ? code : null
  } catch {
    return null
  }
}

export function clearPendingClaim() {
  try {
    sessionStorage.removeItem(PENDING_CLAIM_KEY)
  } catch {
    /* noop */
  }
}

/** Tujuan setelah login: `redirect` aman → kode klaim tertunda → beranda. */
export function postLoginTarget(redirect: unknown): RouteLocationRaw {
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    clearPendingClaim()
    return redirect
  }
  const code = takePendingClaim()
  if (code) return { name: 'presensi-kelas', query: { code, auto: '1' } }
  return { name: 'home' }
}
