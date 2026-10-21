import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getApiStatus } from '@/utils/api'
import { toast } from '@/composables/useToast'
import { PENDING_CLAIM_KEY } from '@/utils/claim'
import { sanitizeCode } from '@/utils/attendance'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    title?: string
    /** Judul pada header aplikasi; tanpa ini header menampilkan sapaan. */
    header?: string
    /** Tampilkan tombol kembali di header (halaman turunan). */
    back?: string
    /** Sembunyikan bilah navigasi bawah (mis. pemindai QR). */
    hideTabs?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: (_to, _from, saved) => saved ?? { top: 0 },
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/auth/LoginView.vue'),
      meta: { guestOnly: true, title: 'Masuk' },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/auth/RegisterView.vue'),
      meta: { guestOnly: true, title: 'Daftar' },
    },
    {
      path: '/verify-otp',
      name: 'verify-otp',
      component: () => import('@/views/auth/VerifyOtpView.vue'),
      meta: { guestOnly: true, title: 'Verifikasi Email' },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('@/views/auth/ForgotPasswordView.vue'),
      meta: { title: 'Lupa Kata Sandi' },
    },
    {
      // Publik: tautan dari email (bisa dibuka saat masuk maupun tidak).
      path: '/reset-password',
      name: 'reset-password',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { title: 'Atur Ulang Kata Sandi' },
    },
    {
      // Publik: undangan akun siswa dari sekolah (§7.3, §10.2).
      path: '/activate',
      name: 'activate',
      component: () => import('@/views/auth/ActivateAccountView.vue'),
      meta: { title: 'Aktivasi Akun' },
    },
    {
      // Tautan QR proyektor: ${STUDENT_APP_URL}/attendance/claim?code=XXXXXX (§9)
      path: '/attendance/claim',
      name: 'attendance-claim',
      redirect: (to) => {
        const code = typeof to.query.code === 'string' ? sanitizeCode(to.query.code) : ''
        return { name: 'presensi-kelas', query: code ? { code, auto: '1' } : {} }
      },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/app/HomeView.vue'),
          meta: { title: 'Beranda' },
        },
        {
          path: 'activity',
          name: 'activity',
          component: () => import('@/views/app/ActivityView.vue'),
          meta: { title: 'Aktivitas', header: 'Aktivitas' },
        },
        {
          path: 'presensi',
          name: 'presensi',
          component: () => import('@/views/app/PresensiView.vue'),
          meta: { title: 'Presensi', header: 'Presensi' },
        },
        {
          path: 'presensi/sekolah',
          name: 'presensi-sekolah',
          component: () => import('@/views/app/SchoolAttendanceView.vue'),
          meta: { title: 'Presensi Sekolah', header: 'Presensi Sekolah', back: '/presensi' },
        },
        {
          path: 'presensi/kelas',
          name: 'presensi-kelas',
          component: () => import('@/views/app/ClassAttendanceView.vue'),
          meta: { title: 'Presensi Kelas', header: 'Presensi Kelas', back: '/presensi' },
        },
        {
          path: 'notifikasi',
          name: 'notifications',
          component: () => import('@/views/app/NotificationsView.vue'),
          meta: { title: 'Notifikasi', header: 'Notifikasi' },
        },
        {
          path: 'profil',
          name: 'profile',
          component: () => import('@/views/app/ProfileView.vue'),
          meta: { title: 'Profil', header: 'Profil' },
        },
        {
          path: 'profil/ubah',
          name: 'profile-edit',
          component: () => import('@/views/app/ProfileEditView.vue'),
          meta: { title: 'Ubah Profil', header: 'Ubah Profil', back: '/profil' },
        },
        {
          path: 'gabung-sekolah',
          name: 'join-school',
          component: () => import('@/views/app/JoinSchoolView.vue'),
          meta: { title: 'Gabung Sekolah', header: 'Gabung Sekolah', back: '/' },
        },
        {
          path: 'konseling',
          name: 'counseling',
          component: () => import('@/views/app/CounselingView.vue'),
          meta: { title: 'Konseling BK', header: 'Konseling BK', back: '/' },
        },
        { path: 'counseling', redirect: (to) => ({ name: 'counseling', query: to.query }) },

        // Asesmen Psikologi (API_CONTRACT §13.5)
        {
          path: 'asesmen',
          name: 'assessments',
          component: () => import('@/views/app/AssessmentView.vue'),
          meta: { title: 'Asesmen', header: 'Asesmen', back: '/' },
        },
        {
          // ?attempt=<id> → lanjutkan attempt yang sedang berjalan (tanpa onboarding ulang)
          path: 'asesmen/sesi/:sessionId/:instrument',
          name: 'assessment-take',
          component: () => import('@/views/app/AssessmentTakeView.vue'),
          meta: {
            title: 'Mengerjakan Asesmen',
            header: 'Asesmen',
            back: '/asesmen',
            hideTabs: true,
          },
        },
        {
          path: 'asesmen/proses/:attemptId',
          name: 'assessment-submitting',
          component: () => import('@/views/app/AssessmentSubmittingView.vue'),
          meta: {
            title: 'Memproses Hasil',
            header: 'Memproses Hasil',
            back: '/asesmen',
            hideTabs: true,
          },
        },
        {
          path: 'asesmen/hasil/:attemptId',
          name: 'assessment-result',
          component: () => import('@/views/app/AssessmentResultView.vue'),
          meta: { title: 'Hasil Asesmen', header: 'Hasil Asesmen', back: '/asesmen?tab=riwayat' },
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { title: 'Halaman tidak ditemukan' },
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Ada token tapi data user belum dimuat (mis. setelah reload) → ambil /auth/me
  if (auth.accessToken && !auth.user) {
    try {
      await auth.fetchMe()
    } catch (err) {
      const status = getApiStatus(err)
      if (status === 401 || status === 403) {
        auth.$reset()
      } else if (to.matched.some((r) => r.meta.requiresAuth)) {
        toast.error('Gagal memuat sesi', 'Tidak dapat terhubung ke server. Silakan coba lagi.')
        return { name: 'login', query: { redirect: to.fullPath } }
      }
    }
  }

  if (auth.isAuthenticated && !auth.isStudent) {
    await auth.logout()
    toast.error('Bukan akun siswa', 'Silakan masuk lewat Dasbor Sekolah di Pelita Sekolah.')
    return { name: 'login' }
  }

  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth)
  if (requiresAuth && !auth.isAuthenticated) {
    // Simpan kode klaim agar tetap terkirim setelah daftar/verifikasi OTP.
    if (to.name === 'presensi-kelas' && typeof to.query.code === 'string') {
      try {
        sessionStorage.setItem(PENDING_CLAIM_KEY, to.query.code)
      } catch {
        /* noop */
      }
    }
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' }
  }
  return true
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Pelita Sekolah Siswa` : 'Pelita Sekolah Siswa'
})

export default router
