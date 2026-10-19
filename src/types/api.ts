// Tipe data mengikuti services/docs/API_CONTRACT.md (§1, §5, §7.3, §9, §10)

export type UserRole = 'super_admin' | 'admin' | 'institution' | 'customer' | 'teacher' | (string & {})

export interface CustomerDTO {
  id: number
  full_name: string
  school_name?: string | null
  birth_place?: string | null
  birth_date?: string | null
  gender?: number | string | null
  /** `students` untuk akun siswa (§10.1) */
  role?: string | null
}

export interface UserDTO {
  id: number
  email: string
  role: UserRole
  phone?: string | null
  photo_profile?: string | null
  cover?: string | null
  email_verified_at?: string | null
  customer?: CustomerDTO | null
}

export interface LoginResponse {
  message: string
  access_token: string
  refresh_token: string
  user: UserDTO
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface Paginated<T> {
  message?: string
  data: T[]
  meta: PaginationMeta
}

export interface ActivationInfo {
  email: string
  full_name: string
}

/* ------------------------------------------------------------------ */
/* §10 Siswa                                                            */
/* ------------------------------------------------------------------ */

export interface SchoolBrief {
  id: string
  name: string
  code: string
  logo?: string | null
  timezone?: string | null
}

export interface CurrentClass {
  class_id: string
  display_name: string
  grade_level_name?: string
  academic_year_name?: string
}

export interface StudentSummary {
  id: string
  full_name: string
  nickname?: string
  gender?: string
  nisn?: string
  nis?: string
  birth_place?: string
  birth_date?: string
  status?: string
  photo?: string | null
  current_class: CurrentClass | null
}

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface JoinRequest {
  id: string
  school: { id: string; name: string; code: string; logo?: string | null } | null
  email: string
  full_name: string
  nisn?: string | null
  birth_date?: string | null
  message?: string | null
  status: JoinRequestStatus | string
  reject_reason?: string | null
  student_id?: string | null
  created_at: string
  reviewed_at?: string | null
}

export type StudentStatus = 'no_school' | 'pending' | 'active'

export interface StudentMe {
  status: StudentStatus
  school: SchoolBrief | null
  student: StudentSummary | null
  pending_request: JoinRequest | null
}

export interface JoinPayload {
  school_code: string
  full_name: string
  nisn?: string
  birth_date?: string
  message?: string
}

/* ------------------------------------------------------------------ */
/* Presensi                                                             */
/* ------------------------------------------------------------------ */

export type DailyStatus = 'present' | 'late' | 'sick' | 'permission' | 'absent' | (string & {})

export interface DailyAttendance {
  id: string
  date: string
  status: DailyStatus
  /** "HH:MM:SS" (waktu sekolah) */
  check_in_time?: string | null
  check_in_status?: 'on_time' | 'late' | string
  late_minutes?: number
  check_in_method?: string
  check_in_distance?: number | null
  check_out_time?: string | null
  check_out_status?: 'on_time' | 'early' | string
  early_minutes?: number
  check_out_distance?: number | null
}

export type SessionMyStatus = 'present' | 'sick' | 'permission' | 'absent' | 'dispensation'

export interface TodaySession {
  schedule_id: string
  subject_name: string
  teacher_name?: string | null
  start_time: string
  end_time: string
  room?: string | null
  session_id: string | null
  session_status?: string | null
  my_status: SessionMyStatus | null
  my_check_in_time?: string | null
}

export interface SchoolLocation {
  latitude: number
  longitude: number
  radius_meters: number
  location_name?: string | null
}

export interface AttendanceToday {
  date: string
  now: string
  school_location: SchoolLocation | null
  target_check_in_time?: string | null
  target_check_out_time?: string | null
  late_tolerance_minutes?: number | null
  daily_attendance: DailyAttendance | null
  is_checked_in: boolean
  is_checked_out: boolean
  sessions: TodaySession[]
}

export interface GeoPayload {
  latitude: number
  longitude: number
  accuracy?: number
}

export interface ClaimResult {
  session_id: string
  subject_name: string
  class_name: string
  status: string
  check_in_time?: string | null
}

export interface HistorySummary {
  present: number
  late: number
  sick: number
  permission: number
  absent: number
}

export interface HistorySession {
  date: string
  subject_name: string
  teacher_name?: string | null
  start_time: string
  status: string
  check_in_method?: string | null
}

export interface AttendanceHistory {
  summary: HistorySummary
  daily: DailyAttendance[]
  sessions: HistorySession[]
}

/* ------------------------------------------------------------------ */
/* Notifikasi                                                           */
/* ------------------------------------------------------------------ */

export type NotificationType =
  | 'join_approved'
  | 'join_rejected'
  | 'account_linked'
  | 'attendance_marked'
  | 'late_check_in'
  | (string & {})

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body: string
  data?: Record<string, unknown> | null
  read_at: string | null
  created_at: string
}
