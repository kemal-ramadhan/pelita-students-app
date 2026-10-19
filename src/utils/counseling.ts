import type { Tone } from '@/utils/attendance'
import type { CounselingEvent, CounselingSession, Counselor, Peer } from '@/types/counseling'

/** Bidang layanan BK (pribadi, sosial, belajar, karier) + lainnya. Dikirim sebagai `topic`. */
export const TOPIC_CATEGORIES = [
  { value: 'Belajar', hint: 'Kesulitan belajar, nilai, cara belajar' },
  { value: 'Karier & studi lanjut', hint: 'Jurusan, kuliah, cita-cita' },
  { value: 'Pribadi', hint: 'Perasaan, kepercayaan diri, stres' },
  { value: 'Pertemanan & sosial', hint: 'Teman, konflik, perundungan' },
  { value: 'Keluarga', hint: 'Situasi di rumah' },
  { value: 'Lainnya', hint: 'Hal lain yang ingin dibicarakan' },
] as const

export const DURATIONS = [30, 45, 60] as const

export const DESCRIPTION_MAX = 1000
export const MAX_PEERS = 5
/** Server: maksimal 3 pengajuan berstatus "pending" per siswa (TOO_MANY_PENDING). */
export const MAX_PENDING = 3
/** Server: jadwal paling jauh 1 tahun ke depan. */
export const MAX_DAYS_AHEAD = 365
/** Server: presensi acara dibuka 30 menit sebelum mulai sampai acara selesai. */
export const EVENT_ATTEND_LEAD_MINUTES = 30

export type EventPhase = 'open' | 'soon' | 'ended' | 'upcoming' | 'past'

/** Fase presensi acara menurut waktu sekolah (selaras EventAttendError di server). */
export function eventPhase(e: CounselingEvent, now: { date: string; time: string }): EventPhase {
  if (e.event_date > now.date) return 'upcoming'
  if (e.event_date < now.date) return 'past'
  const toMin = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t)
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0
  }
  const cur = toMin(now.time)
  if (cur < toMin(e.start_time) - EVENT_ATTEND_LEAD_MINUTES) return 'soon'
  if (cur > toMin(e.end_time)) return 'ended'
  return 'open'
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Diajukan', tone: 'warning' },
  scheduled: { label: 'Dijadwalkan', tone: 'info' },
  rescheduled: { label: 'Jadwal diubah', tone: 'violet' },
  completed: { label: 'Selesai', tone: 'success' },
  cancelled: { label: 'Dibatalkan', tone: 'danger' },
}

export function sessionStatus(status: string | null | undefined): { label: string; tone: Tone } {
  return STATUS[status ?? ''] ?? { label: 'Diproses', tone: 'neutral' }
}

export function isSessionOpen(s: CounselingSession): boolean {
  return s.status === 'pending' || s.status === 'scheduled' || s.status === 'rescheduled'
}

export function isSessionScheduled(s: CounselingSession): boolean {
  return s.status === 'scheduled' || s.status === 'rescheduled' || s.status === 'completed'
}

const TYPES: Record<string, string> = {
  individual: 'Konseling pribadi',
  group: 'Konseling bersama teman',
  classical: 'Bimbingan klasikal',
  case_handling: 'Layanan BK',
}
export const sessionTypeLabel = (t: string | null | undefined) => TYPES[t ?? ''] ?? 'Layanan BK'

const OUTCOMES: Record<string, string> = {
  resolved: 'Tuntas',
  needs_followup: 'Perlu tindak lanjut',
  referral: 'Dirujuk ke layanan lanjutan',
}
export const outcomeLabel = (o: string | null | undefined) => (o ? (OUTCOMES[o] ?? '') : '')

export function counselorPhoto(c: Counselor | null | undefined): string | null {
  return c?.photo_url || c?.photo || null
}

export function counselorAvailability(c: Counselor | null | undefined): string {
  return (c?.availability || c?.availability_note || '').trim()
}

export function peerClass(p: Peer): string {
  return (p.class_name || p.class?.display_name || p.class?.name || '').trim()
}

/** Nama teman lain dalam sesi (tanpa diri sendiri, tanpa ID). */
export function otherParticipantNames(s: CounselingSession, me: { id?: string | null; name?: string | null }): string[] {
  const myName = (me.name ?? '').trim().toLowerCase()
  return (s.participants ?? [])
    .filter((p) => {
      const id = p.student_id ?? p.student?.id
      return id ? id !== me.id : true
    })
    .map((p) => (p.full_name || p.student?.full_name || '').trim())
    .filter((n) => n && n.toLowerCase() !== myName)
}

export function isEventAttended(e: CounselingEvent, myStudentId: string | null | undefined, localIds: string[]): boolean {
  if (localIds.includes(e.id)) return true
  if (e.attended || e.is_attended || e.my_attendance) return true
  if (!myStudentId) return false
  return (e.attendances ?? []).some((a) => a.student_id === myStudentId)
}
