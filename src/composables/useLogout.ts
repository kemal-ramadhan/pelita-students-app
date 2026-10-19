import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { confirm } from './useConfirm'
import { toast } from './useToast'

export function useLogout() {
  const router = useRouter()
  const auth = useAuthStore()

  async function logoutNow() {
    await auth.logout()
    await router.replace({ name: 'login' })
    toast.info('Anda telah keluar', 'Sampai jumpa lagi!')
  }

  async function requestLogout() {
    const ok = await confirm({
      title: 'Keluar dari akun?',
      message: 'Anda perlu masuk kembali untuk melakukan presensi.',
      confirmText: 'Ya, keluar',
      tone: 'danger',
    })
    if (ok) await logoutNow()
  }

  return { requestLogout, logoutNow }
}
