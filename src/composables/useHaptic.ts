/** Getaran singkat (bila didukung perangkat) sebagai umpan balik sentuhan. */
export function haptic(pattern: number | number[] = 10) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    /* noop */
  }
}
