// Bimbingan Konseling (BK) — portal siswa: /instantion/student/counseling/*
// Bentuk data mengikuti services/edupilot-instantion-service (model/Counseling.go,
// dto/counseling_dto.go). Field opsional dibuat toleran karena respons siswa
// dapat disaring server demi privasi.

export type CounselingType = 'individual' | 'group' | 'classical' | 'case_handling'
export type CounselingStatus = 'pending' | 'scheduled' | 'rescheduled' | 'completed' | 'cancelled'
export type OutcomeStatus = 'resolved' | 'needs_followup' | 'referral'

/** Guru BK yang dapat dipilih siswa (GET /counselors). */
export interface Counselor {
  id: string
  full_name: string
  photo?: string | null
  photo_url?: string | null
  /** Teks ketersediaan bebas (mis. "Senin–Jumat, 08.00–14.00") bila server mengirimkan. */
  availability?: string | null
  availability_note?: string | null
}

/** Teman sekolah untuk konseling kelompok (GET /peers) — data minimal. */
export interface Peer {
  id: string
  full_name: string
  class_name?: string | null
  class?: { name?: string | null; display_name?: string | null } | null
}

/** Umpan balik guru BK yang memang ditujukan untuk siswa (catatan rahasia tidak pernah dikirim). */
export interface CounselingOutcome {
  student_feedback?: string | null
  outcome_status?: OutcomeStatus | (string & {}) | null
  follow_up_plan?: string | null
  follow_up_date?: string | null
}

export interface CounselingParticipant {
  student_id?: string
  is_initiator?: boolean
  full_name?: string | null
  student?: { id?: string; full_name?: string | null } | null
}

export interface CounselingSession {
  id: string
  counseling_type: CounselingType | (string & {})
  topic: string
  description?: string | null
  /** YYYY-MM-DD (waktu sekolah) */
  requested_date: string
  /** HH:MM (waktu sekolah) */
  start_time: string
  end_time: string
  place?: string | null
  status: CounselingStatus | (string & {})
  reschedule_reason?: string | null
  created_at: string
  updated_at?: string

  initiator_student_id?: string
  /** Siswa ini yang mengajukan sesi. */
  is_initiator?: boolean
  counselor?: { id?: string; full_name?: string | null } | null
  participants?: CounselingParticipant[] | null
  outcome?: CounselingOutcome | null
}

export interface CounselingEvent {
  id: string
  title: string
  category?: string | null
  description?: string | null
  /** YYYY-MM-DD */
  event_date: string
  start_time: string
  end_time: string
  location?: string | null
  status?: string
  counselor?: { id?: string; full_name?: string | null } | null
  /** Penanda kehadiran siswa sendiri (bila server menyediakan). */
  attended?: boolean
  is_attended?: boolean
  my_attendance?: { check_in_time?: string | null } | null
  /** Bentuk lama: daftar kehadiran (hanya dipakai untuk mencocokkan diri sendiri). */
  attendances?: { student_id?: string | null; check_in_time?: string | null }[] | null
}

export interface CounselingEventAttendance {
  event_id?: string
  check_in_time?: string | null
}

/** POST /sessions */
export interface CreateCounselingPayload {
  counselor_id?: string
  counseling_type: 'individual' | 'group'
  topic: string
  description?: string
  requested_date: string
  start_time: string
  end_time: string
  participant_student_ids?: string[]
}
