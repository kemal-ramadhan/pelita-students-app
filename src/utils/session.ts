import { useAuthStore, AUTH_STORAGE_KEY } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { useAttendanceStore } from '@/stores/attendance'
import { useNotificationStore } from '@/stores/notifications'
import { useCounselingStore } from '@/stores/counseling'

/** Kunci sessionStorage yang tetap dipertahankan (mis. kode klaim yang menunggu login). */
const KEEP_SESSION_KEYS = ['pending-claim-code']

/**
 * Reset seluruh store Pinia dan hapus data sesi yang tersimpan.
 * Dipanggil saat logout atau saat sesi kedaluwarsa.
 */
export function resetAllStores() {
  useAuthStore().$reset()
  useStudentStore().$reset()
  useAttendanceStore().$reset()
  useNotificationStore().$reset()
  useCounselingStore().$reset()

  try {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    const keep = KEEP_SESSION_KEYS.map((k) => [k, sessionStorage.getItem(k)] as const)
    sessionStorage.clear()
    for (const [k, v] of keep) if (v) sessionStorage.setItem(k, v)
  } catch {
    // storage tidak tersedia (mode privat, dll.)
  }
}
