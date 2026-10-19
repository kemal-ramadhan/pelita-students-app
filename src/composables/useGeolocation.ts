import { onBeforeUnmount, ref } from 'vue'

export interface GeoFix {
  latitude: number
  longitude: number
  /** Akurasi (meter) */
  accuracy: number
  timestamp: number
}

export type GeoErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout' | 'insecure'

export const GEO_ERROR_MESSAGES: Record<GeoErrorKind, string> = {
  unsupported: 'Perangkat atau browser Anda tidak mendukung layanan lokasi.',
  insecure: 'Lokasi hanya dapat diakses melalui koneksi aman (HTTPS).',
  denied:
    'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.',
  unavailable: 'Lokasi tidak tersedia. Pastikan GPS aktif dan Anda berada di area terbuka.',
  timeout: 'Waktu mencari lokasi habis. Pastikan GPS aktif lalu coba lagi.',
}

/** Jarak lurus (meter) antara dua koordinat — Haversine. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

/**
 * Pantau posisi GPS (watchPosition, akurasi tinggi). Posisi terus diperbarui
 * sampai `stop()` dipanggil atau komponen dilepas.
 */
export function useGeolocation(timeoutMs = 20_000) {
  const fix = ref<GeoFix | null>(null)
  const error = ref<GeoErrorKind | null>(null)
  const watching = ref(false)
  let watchId: number | null = null
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  function stop() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    watchId = null
    watching.value = false
    clearTimeout(timeoutHandle)
  }

  function start() {
    stop()
    error.value = null
    if (!window.isSecureContext) {
      error.value = 'insecure'
      return
    }
    if (!('geolocation' in navigator)) {
      error.value = 'unsupported'
      return
    }
    watching.value = true
    // Batas waktu untuk fix pertama (watchPosition tidak selalu memicu TIMEOUT).
    timeoutHandle = setTimeout(() => {
      if (!fix.value) {
        stop()
        error.value = 'timeout'
      }
    }, timeoutMs)
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        error.value = null
        fix.value = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          stop()
          error.value = 'denied'
        } else if (err.code === err.TIMEOUT) {
          // Tetap memantau bila sudah punya fix; jika belum, laporkan.
          if (!fix.value) error.value = 'timeout'
        } else if (!fix.value) {
          error.value = 'unavailable'
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: timeoutMs },
    )
  }

  onBeforeUnmount(stop)

  return { fix, error, watching, start, stop }
}
