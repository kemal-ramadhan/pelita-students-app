import { computed, ref } from 'vue'
import { useAttendanceStore } from '@/stores/attendance'
import { useStudentStore } from '@/stores/student'
import { getApiError, getApiErrorCode } from '@/utils/api'

/** Muat GET /attendance/today; 403 NOT_ENROLLED → segarkan status sekolah. */
export function useTodayAttendance() {
  const attendance = useAttendanceStore()
  const student = useStudentStore()
  const loading = ref(false)
  const error = ref('')

  async function load() {
    if (loading.value) return
    loading.value = true
    error.value = ''
    try {
      await attendance.fetchToday()
    } catch (err) {
      if (getApiErrorCode(err) === 'NOT_ENROLLED') {
        await student.fetchMe(true).catch(() => undefined)
      } else {
        error.value = getApiError(err, 'Tidak dapat memuat presensi hari ini.')
      }
    } finally {
      loading.value = false
    }
  }

  return { today: computed(() => attendance.today), loading, error, load }
}
