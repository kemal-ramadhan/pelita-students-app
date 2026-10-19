import axios from 'axios'
import { getApiError, getApiErrorCode } from '@/utils/api'
import type { Tone } from '@/utils/attendance'
import type {
  AnswerValue,
  AttemptQuestion,
  InstrumentCode,
  InstrumentStatus,
  SessionInstrument,
} from '@/types/assessment'

/* ------------------------------------------------------------------ */
/* Label                                                               */
/* ------------------------------------------------------------------ */

export const INSTRUMENT_LABELS: Record<
  InstrumentCode,
  { name: string; short: string; color: string }
> = {
  TMB: {
    name: 'Tes Minat dan Bakat',
    short: 'Minat & Bakat',
    color: 'from-emerald-500 to-teal-600',
  },
  RIA: {
    name: 'Asesmen Preferensi Karier (RIASEC)',
    short: 'Preferensi Karier',
    color: 'from-primary-500 to-primary-700',
  },
  PMK: {
    name: 'Penelusuran Minat Karier Holland',
    short: 'Minat Karier',
    color: 'from-violet-500 to-indigo-600',
  },
  ADN: {
    name: 'Asesmen Diagnostik Non-Kognitif',
    short: 'Gaya Belajar',
    color: 'from-amber-500 to-orange-600',
  },
}

export function instrumentName(code: string, fallback?: string | null): string {
  return fallback || INSTRUMENT_LABELS[code as InstrumentCode]?.name || code
}

export const RIASEC_LABELS: Record<string, string> = {
  R: 'Realistic',
  I: 'Investigative',
  A: 'Artistic',
  S: 'Social',
  E: 'Enterprising',
  C: 'Conventional',
}
export const RIASEC_ID: Record<string, string> = {
  R: 'Pelaksana',
  I: 'Pemikir',
  A: 'Kreatif',
  S: 'Penolong',
  E: 'Pemimpin',
  C: 'Penata',
}
export const TMB_MINAT_LABELS: Record<string, string> = {
  M: 'MIPA',
  T: 'Teknologi & Rekayasa',
  S: 'Sosial',
  E: 'Ekonomi & Bisnis',
  B: 'Bahasa & Budaya',
  K: 'Seni & Kreatif',
}
export const TMB_BAKAT_LABELS: Record<string, string> = {
  V: 'Verbal',
  N: 'Numerik',
  L: 'Penalaran Logis',
  S: 'Spasial',
}
export const TMB_RUMPUN_LABELS: Record<string, string> = {
  IPA: 'IPA',
  IPS: 'IPS',
  Bahasa: 'Bahasa & Budaya',
  Vokasi: 'Teknologi & Vokasi',
  Seni: 'Seni & Kreatif',
}
export const VARK_LABELS: Record<string, string> = {
  V: 'Visual',
  A: 'Auditori',
  R: 'Baca-Tulis',
  K: 'Kinestetik',
}

export const SOCIO_LABELS: Record<string, string> = {
  motivasi: 'Motivasi',
  efikasi_diri: 'Efikasi diri',
  regulasi_belajar: 'Regulasi belajar',
  kecemasan_belajar: 'Kecemasan belajar',
  dukungan_sosial: 'Dukungan sosial',
}

/** PRD §10.4 — dipakai bila server (seharusnya selalu) tidak mengirim disclaimer. */
export const DEFAULT_DISCLAIMER =
  'Hasil ini adalah gambaran minat, kecenderungan, dan preferensi belajar pada saat pengisian, bukan diagnosis, bukan vonis kemampuan, dan bukan satu-satunya dasar memilih jurusan/karier. Diskusikan hasil bersama Guru BK, orang tua, dan pertimbangkan nilai, cita-cita, serta kondisi pribadi.'

/* ------------------------------------------------------------------ */
/* Status instrumen & CTA                                              */
/* ------------------------------------------------------------------ */

export const INSTRUMENT_STATUS: Record<InstrumentStatus, { label: string; tone: Tone }> = {
  not_started: { label: 'Belum dikerjakan', tone: 'neutral' },
  in_progress: { label: 'Sedang dikerjakan', tone: 'info' },
  queued: { label: 'Sedang diproses', tone: 'warning' },
  processing: { label: 'Sedang diproses', tone: 'warning' },
  completed: { label: 'Selesai', tone: 'success' },
  failed: { label: 'Gagal diproses', tone: 'danger' },
}

export type InstrumentAction =
  | { kind: 'start' }
  | { kind: 'resume'; attemptId: string }
  | { kind: 'processing'; attemptId: string }
  | { kind: 'result'; attemptId: string }
  | { kind: 'none'; reason: string }

export function instrumentAction(state: string, ins: SessionInstrument): InstrumentAction {
  const id = ins.attempt_id ?? ''
  if (ins.status === 'completed' && id) return { kind: 'result', attemptId: id }
  if ((ins.status === 'queued' || ins.status === 'processing' || ins.status === 'failed') && id)
    return { kind: 'processing', attemptId: id }
  if (state === 'upcoming') return { kind: 'none', reason: 'Belum dibuka' }
  if (state === 'closed') return { kind: 'none', reason: 'Sesi ditutup' }
  if (ins.status === 'in_progress' && id) return { kind: 'resume', attemptId: id }
  if (ins.status === 'not_started' || ins.status === 'in_progress') return { kind: 'start' }
  return { kind: 'none', reason: '' }
}

/* ------------------------------------------------------------------ */
/* Galat                                                               */
/* ------------------------------------------------------------------ */

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  SESSION_NOT_OPEN: {
    title: 'Sesi belum dibuka atau sudah ditutup',
    message:
      'Asesmen ini hanya bisa dikerjakan selama jadwal sesi berlangsung. Cek kembali jadwalnya di daftar asesmen.',
  },
  MAX_ATTEMPTS: {
    title: 'Batas pengerjaan tercapai',
    message:
      'Kamu sudah mengerjakan tes ini sebanyak batas yang ditentukan sekolah. Hasilmu tetap bisa dilihat di riwayat.',
  },
  QUOTA_EXHAUSTED: {
    title: 'Kuota asesmen sekolah habis',
    message:
      'Saat ini kuota asesmen sekolahmu sedang habis. Beri tahu Guru BK agar dapat ditindaklanjuti.',
  },
  CONSENT_REQUIRED: {
    title: 'Persetujuan diperlukan',
    message: 'Baca ketentuan lalu centang persetujuan sebelum memulai.',
  },
  NOT_ENROLLED: {
    title: 'Akun belum terdaftar di sekolah',
    message: 'Asesmen hanya tersedia untuk siswa yang sudah tergabung dan aktif di sekolah.',
  },
  STUDENT_ONLY: {
    title: 'Khusus akun siswa',
    message: 'Fitur asesmen hanya dapat dibuka dengan akun siswa.',
  },
  SCHOOL_NOT_SET_UP: {
    title: 'Sekolah belum siap',
    message: 'Sekolahmu belum mengaktifkan layanan asesmen.',
  },
  SCHOOL_INACTIVE: {
    title: 'Sekolah tidak aktif',
    message: 'Layanan asesmen sekolahmu sedang tidak aktif.',
  },
  ALREADY_SUBMITTED: {
    title: 'Jawaban sudah dikirim',
    message: 'Tes ini sudah dikumpulkan dan sedang/selesai diproses.',
  },
}

export function assessmentError(
  err: unknown,
  fallback: string,
): { code?: string; title: string; message: string } {
  const code = getApiErrorCode(err)
  const known = code ? ERROR_MESSAGES[code] : undefined
  if (known) return { code, ...known }
  return { code, title: fallback, message: getApiError(err) }
}

/** Galat jaringan (tidak ada respons server) → antrekan ulang. */
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response
}

/** 422 INCOMPLETE `{ missing: [item_id] }` (di root body atau di `details`). */
export function missingItems(err: unknown): string[] {
  if (!axios.isAxiosError(err)) return []
  const body = err.response?.data as Record<string, unknown> | undefined
  const pick = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  const details = body?.details as Record<string, unknown> | undefined
  return pick(body?.missing).length ? pick(body?.missing) : pick(details?.missing)
}

/* ------------------------------------------------------------------ */
/* Bendera validitas → pesan lembut (kode FLAG_* tidak pernah tampil)  */
/* ------------------------------------------------------------------ */

const FLAG_MESSAGES: Record<string, string> = {
  RESPON_TIDAK_VALID_POTENSIAL:
    'Beberapa jawaban terlihat kurang konsisten. Hasil ini sebaiknya dibaca bersama Guru BK; bila perlu kamu dapat mengulang di kesempatan lain.',
  POLA_JAWABAN_BERUNTUN:
    'Banyak jawaban beruntun yang sama. Tidak apa-apa — coba tinjau hasil ini bersama Guru BK untuk memastikan sudah menggambarkan dirimu.',
  WAKTU_TERLALU_CEPAT:
    'Kamu menyelesaikan tes cukup cepat. Hasil ini tetap berguna sebagai gambaran awal; diskusikan bersama Guru BK.',
  PROFIL_DATAR:
    'Minatmu tersebar cukup merata di banyak bidang. Ini wajar — eksplorasi pengalaman baru dapat membantu memperjelas arahmu.',
  PROFIL_BELUM_JELAS:
    'Arah minat dan kemampuanmu belum terlihat menonjol pada satu rumpun. Mencoba tes karier lain dan berdiskusi dengan Guru BK dapat membantu.',
  PENGUATAN_KEMAMPUAN:
    'Minatmu kuat pada rumpun teratas. Kemampuan pendukungnya bisa terus diasah lewat latihan bertahap.',
  EKSPLORASI_MINAT:
    'Kemampuanmu menonjol pada rumpun teratas. Coba jelajahi kegiatan di bidang ini untuk melihat apakah minatmu ikut tumbuh.',
  KECEMASAN_BELAJAR_TINGGI:
    'Rasa cemas sebelum ujian umum dialami. Latihan soal bertahap dan teknik pernapasan dapat membantu; Guru BK bisa mendampingi.',
  TIE_FLAG:
    'Beberapa tipe minatmu memiliki skor yang sama, jadi urutan kodenya bisa dibaca fleksibel.',
  DUA_ALTERNATIF_SETARA:
    'Dua rumpun teratasmu memiliki skor yang hampir sama — keduanya layak dipertimbangkan bersama Guru BK.',
  MINAT_TINGGI_KOMPETENSI_BELUM:
    'Minatmu di beberapa bidang lebih kuat daripada kemampuan yang kamu rasakan saat ini — ini peluang untuk berlatih.',
  KOMPETENSI_TINGGI_MINAT_RENDAH:
    'Kamu merasa mampu di beberapa bidang yang belum terlalu kamu minati. Coba eksplorasi apa yang membuatmu termotivasi.',
}

/** Ubah bendera menjadi pesan siswa; FLAG_* (staf) & kode tak dikenal disembunyikan. */
export function flagMessages(flags: Array<string | null | undefined>): string[] {
  const out = new Set<string>()
  for (const raw of flags) {
    if (!raw) continue
    const f = raw.toUpperCase()
    if (f.startsWith('FLAG_')) continue
    const direct = FLAG_MESSAGES[f]
    if (direct) {
      out.add(direct)
      continue
    }
    const gap = /^(MINAT_TINGGI_KOMPETENSI_BELUM|KOMPETENSI_TINGGI_MINAT_RENDAH)_([RIASEC])$/.exec(
      f,
    )
    if (gap) {
      const t = `${RIASEC_LABELS[gap[2]!]} (${gap[2]})`
      out.add(
        gap[1] === 'MINAT_TINGGI_KOMPETENSI_BELUM'
          ? `Minatmu pada tipe ${t} tinggi, sementara keterampilannya masih berkembang — kesempatan bagus untuk berlatih.`
          : `Kamu sudah cukup terampil pada tipe ${t}, walau minatmu belum besar. Coba gali lagi apa yang membuatnya menarik.`,
      )
    }
  }
  return [...out]
}

/* ------------------------------------------------------------------ */
/* Pertanyaan & jawaban                                                */
/* ------------------------------------------------------------------ */

export interface ChoiceItem {
  value: AnswerValue
  label: string
  /** Lencana kecil di depan label (angka skala / kunci opsi). */
  badge?: string
}

export function questionChoices(q: AttemptQuestion, sectionLabels?: string[] | null): ChoiceItem[] {
  if (q.type === 'multiple_choice') {
    return (q.options ?? []).map((o) => ({ value: o.key, label: o.text, badge: o.key }))
  }
  if (q.type === 'boolean') {
    const labels =
      q.scale_labels?.length === 2
        ? q.scale_labels
        : sectionLabels?.length === 2
          ? sectionLabels
          : null
    return [
      { value: true, label: labels?.[0] ?? 'Ya' },
      { value: false, label: labels?.[1] ?? 'Tidak' },
    ]
  }
  const min = q.scale_min ?? 1
  const max = q.scale_max ?? (q.scale_labels?.length ? min + q.scale_labels.length - 1 : 4)
  const labels = q.scale_labels?.length ? q.scale_labels : (sectionLabels ?? [])
  const out: ChoiceItem[] = []
  for (let v = min; v <= max; v++)
    out.push({ value: v, label: labels[v - min] ?? String(v), badge: String(v) })
  return out
}

/** Samakan bentuk jawaban dari server/penyimpanan lokal dengan tipe butir. */
export function normalizeAnswer(
  q: AttemptQuestion | undefined,
  v: unknown,
): AnswerValue | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (!q) return v as AnswerValue
  if (q.type === 'boolean') {
    if (v === true || v === 1 || v === '1' || v === 'true') return true
    if (v === false || v === 0 || v === '0' || v === 'false') return false
    return undefined
  }
  if (q.type === 'likert') {
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : undefined
  }
  return String(v)
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* Penyimpanan lokal (selalu dibungkus try/catch)                      */
/* ------------------------------------------------------------------ */

export function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* penyimpanan penuh/diblokir — jawaban tetap di memori */
  }
}

/* ------------------------------------------------------------------ */
/* Data grafik dari `scores` (bentuk kunci tidak dirinci kontrak)      */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  key: string
  label: string
  value: number
  max: number
  /** Teks nilai yang dibacakan / ditampilkan. */
  display: string
  note?: string
}

function numericRecord(v: unknown, keys: string[]): Record<string, number> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const obj = v as Record<string, unknown>
  const out: Record<string, number> = {}
  let hits = 0
  for (const k of keys) {
    const n = typeof obj[k] === 'number' ? (obj[k] as number) : Number(obj[k])
    if (obj[k] !== undefined && obj[k] !== null && Number.isFinite(n)) {
      out[k] = n
      hits++
    }
  }
  return hits >= Math.min(keys.length, 2) ? out : null
}

/**
 * Cari rekaman skor pertama yang cocok di `scores` (atau di root bila datar).
 * `candidates` = [nama kunci, nilai maksimum (null → 100 untuk persen)].
 */
export function findScores(
  scores: Record<string, unknown> | null | undefined,
  keys: string[],
  candidates: Array<[string, number]>,
  allowFlat = false,
): { values: Record<string, number>; max: number; percent: boolean } | null {
  if (!scores) return null
  for (const [name, max] of candidates) {
    const rec = numericRecord(scores[name], keys)
    if (rec) return { values: rec, max, percent: max === 100 }
  }
  if (allowFlat) {
    const rec = numericRecord(scores, keys)
    if (rec) return { values: rec, max: Math.max(...Object.values(rec), 1), percent: false }
  }
  return null
}

export function toBars(
  found: { values: Record<string, number>; max: number; percent: boolean } | null,
  keys: string[],
  labels: Record<string, string>,
  notes?: Record<string, string>,
): BarDatum[] {
  if (!found) return []
  return keys
    .filter((k) => k in found.values)
    .map((k) => {
      const value = found.values[k]!
      return {
        key: k,
        label: labels[k] ?? k,
        value,
        max: found.max,
        display: found.percent ? `${Math.round(value)}%` : `${Math.round(value * 10) / 10}`,
        note: notes?.[k],
      }
    })
}

export function stringRecord(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  return Object.fromEntries(
    Object.entries(v as Record<string, unknown>).filter(
      (e): e is [string, string] => typeof e[1] === 'string',
    ),
  )
}

/** Indeks C Brown–Gore 0–18 → kategori (PRD §7.4). */
export function cIndexLevel(c: number): { label: string; tone: Tone } {
  if (c >= 14) return { label: 'Kecocokan tinggi', tone: 'success' }
  if (c >= 8) return { label: 'Kecocokan sedang', tone: 'info' }
  return { label: 'Bisa dijelajahi', tone: 'neutral' }
}
