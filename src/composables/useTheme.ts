import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'edupilot-theme'

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* noop */
  }
  return 'system'
}

const mode = ref<ThemeMode>(readMode())
const systemDark = ref(false)
let initialized = false

const isDark = computed(() => mode.value === 'dark' || (mode.value === 'system' && systemDark.value))

function apply() {
  document.documentElement.classList.toggle('dark', isDark.value)
}

export function useTheme() {
  const initTheme = () => {
    if (initialized) return
    initialized = true
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = mql.matches
    mql.addEventListener('change', (e) => {
      systemDark.value = e.matches
      apply()
    })
    apply()
  }

  const setMode = (next: ThemeMode) => {
    mode.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* noop */
    }
    apply()
  }

  /** Beralih eksplisit antara terang dan gelap. */
  const toggleDarkMode = () => setMode(isDark.value ? 'light' : 'dark')

  return { mode, isDark, initTheme, setMode, toggleDarkMode }
}
