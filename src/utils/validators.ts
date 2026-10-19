const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isEmail = (v: string) => EMAIL_RE.test(v.trim())
export const isPhone = (v: string) => PHONE_RE.test(v.trim())
export const isUuid = (v: string) => UUID_RE.test(v.trim())
export const isUrl = (v: string) => {
  try {
    const u = new URL(v.trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  hints: string[]
}

export function passwordStrength(pw: string): PasswordStrength {
  const hints: string[] = []
  if (pw.length < 8) hints.push('Minimal 8 karakter')
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw)) hints.push('Gabungkan huruf besar dan kecil')
  if (!/\d/.test(pw)) hints.push('Tambahkan angka')
  if (!/[^A-Za-z0-9]/.test(pw)) hints.push('Tambahkan simbol')

  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (pw.length < 8) score = Math.min(score, 1)
  const clamped = Math.min(4, score) as PasswordStrength['score']
  const labels = ['Sangat lemah', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat']
  return { score: pw ? clamped : 0, label: pw ? labels[clamped]! : '', hints }
}
