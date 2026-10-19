import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import App from './App.vue'
import router from './router'
import './style.css'

import { configureApi } from '@/utils/api'
import { useAuthStore } from '@/stores/auth'
import { resetAllStores } from '@/utils/session'
import { toast } from '@/composables/useToast'

const app = createApp(App)
const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
app.use(pinia)

const auth = useAuthStore()
let expiring = false
let lastForbiddenAt = 0

configureApi({
  getAccessToken: () => auth.accessToken,
  getRefreshToken: () => auth.refreshToken,
  setTokens: (tokens) => auth.setTokens(tokens),
  onSessionExpired: () => {
    if (expiring) return
    expiring = true
    const current = router.currentRoute.value
    resetAllStores()
    if (current.matched.some((r) => r.meta.requiresAuth)) {
      toast.warning('Sesi berakhir', 'Silakan masuk kembali untuk melanjutkan.')
      void router.replace({ name: 'login', query: { redirect: current.fullPath } })
    }
    setTimeout(() => (expiring = false), 1000)
  },
  onForbiddenRole: () => {
    const now = Date.now()
    if (now - lastForbiddenAt < 3000) return
    lastForbiddenAt = now
    // Peran akun berubah di server / bukan akun siswa → keluar.
    void auth.logout().then(() => {
      toast.error('Akses ditolak', 'Akun ini bukan akun siswa. Silakan masuk lewat Dasbor Sekolah.')
      void router.replace({ name: 'login' })
    })
  },
})

app.use(router)
app.mount('#app')
