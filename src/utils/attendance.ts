/** Label & warna status presensi (Bahasa Indonesia). */

export const DAILY_STATUS_LABELS: Record<string, string> = {
  present: 'Hadir',
  late: 'Terlambat',
  sick: 'Sakit',
  permission: 'Izin',
  absent: 'Alpa',
  dispensation: 'Dispensasi',
  business_trip: 'Dinas Luar',
  remote: 'Jarak Jauh',
}

export function statusLabel(status: string | null | undefined): string {
  if (!status) return 'Belum presensi'
  return DAILY_STATUS_LABELS[status] ?? status
}

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'violet'

export function statusTone(status: string | null | undefined): Tone {
  switch (status) {
    case 'present':
      return 'success'
    case 'late':
      return 'warning'
    case 'sick':
      return 'info'
    case 'permission':
    case 'dispensation':
      return 'violet'
    case 'absent':
      return 'danger'
    default:
      return 'neutral'
  }
}

export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/20',
  neutral: 'bg-surface-muted text-fg-muted ring-line',
}

export const SESSION_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Belum dimulai',
  not_started: 'Belum dimulai',
  in_progress: 'Berlangsung',
  active: 'Berlangsung',
  open: 'Berlangsung',
  ended: 'Selesai',
  completed: 'Selesai',
  closed: 'Selesai',
}

export function isSessionLive(status: string | null | undefined): boolean {
  return status === 'in_progress' || status === 'active' || status === 'open'
}

/* ------------------------------------------------------------------ */
/* Kode presensi kelas (§9): 6 karakter, tanpa 0/O/1/I                  */
/* ------------------------------------------------------------------ */

export const CODE_LENGTH = 6
/** Alfabet tak-ambigu: A–Z tanpa I & O, angka 2–9. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`)

/** Uppercase + buang karakter di luar alfabet. */
export function sanitizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH)
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code)
}

/**
 * Ambil kode dari isi QR. Mendukung URL `…/attendance/claim?code=XXXXXX`
 * (QR proyektor) maupun teks kode polos.
 */
export function parseClaimPayload(text: string): string | null {
  const raw = text.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    const code = url.searchParams.get('code')
    if (code) {
      const clean = sanitizeCode(code)
      return isValidCode(clean) ? clean : null
    }
    return null
  } catch {
    // bukan URL
  }
  const clean = sanitizeCode(raw)
  return isValidCode(clean) && raw.replace(/[\s-]/g, '').length === CODE_LENGTH ? clean : null
}
