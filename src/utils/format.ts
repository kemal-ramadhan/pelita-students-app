export function initials(name: string | null | undefined, max = 2): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, max)
    .map((p) => p.charAt(0).toUpperCase())
    .join('')
}

/** Parse "YYYY-MM-DD" sebagai tanggal lokal (bukan UTC) agar hari tidak bergeser. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const dateFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
const longDateFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const dayFmt = new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' })

export function formatDate(value: string | null | undefined): string {
  const d = parseDate(value)
  return d ? dateFmt.format(d) : value || '—'
}

export function formatLongDate(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseDate(value)
  return d ? longDateFmt.format(d) : '—'
}

export function formatDayShort(value: string | null | undefined): string {
  const d = parseDate(value)
  return d ? dayFmt.format(d) : value || '—'
}

/** "YYYY-MM" → "Oktober 2026" */
export function formatMonth(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym)
  return m ? monthFmt.format(new Date(Number(m[1]), Number(m[2]) - 1, 1)) : ym
}

export function toMonthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  return toMonthKey(new Date(y ?? 2000, (m ?? 1) - 1 + delta, 1))
}

/**
 * Jam dari API: "HH:MM", "HH:MM:SS", atau RFC3339 → "HH.MM" (format Indonesia).
 * Waktu sekolah dikirim sebagai jam dinding, jadi tidak dikonversi zona waktu.
 */
export function formatTime(value: string | null | undefined): string {
  if (!value) return '—'
  const hm = /^(\d{1,2}):(\d{2})/.exec(value)
  if (hm) return `${hm[1]!.padStart(2, '0')}.${hm[2]}`
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const rtf = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' })

export function relativeTime(value: string | null | undefined, now = Date.now()): string {
  if (!value) return ''
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.round((t - now) / 1000)
  const abs = Math.abs(diff)
  if (abs < 60) return 'baru saja'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 604800) return rtf.format(Math.round(diff / 86400), 'day')
  return dateFmt.format(new Date(t))
}

export function greeting(date = new Date()): string {
  const h = date.getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** Ubah string kosong menjadi undefined (agar tidak dikirim ke API). */
export function emptyToUndefined(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim()
  return t === '' ? undefined : t
}

/** Normalisasi URL gambar dari API (absolut, data URI, atau path relatif gateway). */
export function assetUrl(
  v: string | null | undefined,
  base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '',
): string | null {
  if (!v) return null
  if (/^(https?:|data:|blob:)/i.test(v)) return v
  if (v.startsWith('/')) return `${base.replace(/\/+$/, '')}${v}`
  return v
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/* ------------------------------------------------------------------ */
/* Zona waktu sekolah                                                   */
/* ------------------------------------------------------------------ */

export const DEFAULT_SCHOOL_TZ = 'Asia/Jakarta'

function safeTz(tz: string | null | undefined): string {
  if (!tz) return DEFAULT_SCHOOL_TZ
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return tz
  } catch {
    return DEFAULT_SCHOOL_TZ
  }
}

/** Tanggal & jam dinding saat ini di zona waktu sekolah: `{ date: 'YYYY-MM-DD', time: 'HH:MM' }`. */
export function nowInTimeZone(tz?: string | null, at = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

/** Singkatan zona waktu Indonesia (WIB/WITA/WIT), selain itu nama IANA. */
export function timeZoneLabel(tz?: string | null): string {
  const z = safeTz(tz)
  const map: Record<string, string> = {
    'Asia/Jakarta': 'WIB',
    'Asia/Pontianak': 'WIB',
    'Asia/Makassar': 'WITA',
    'Asia/Jayapura': 'WIT',
  }
  return map[z] ?? z
}

/** Tambah menit ke "HH:MM"; null bila melewati tengah malam. */
export function addMinutes(hhmm: string, minutes: number): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes
  if (total >= 24 * 60) return null
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
