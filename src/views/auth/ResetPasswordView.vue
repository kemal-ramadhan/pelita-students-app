<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Lock } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import PasswordStrength from '@/components/ui/PasswordStrength.vue'
import { useAuthStore } from '@/stores/auth'
import { resetAllStores } from '@/utils/session'
import { getApiError } from '@/utils/api'
import { toast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token : ''))
const form = reactive({ password: '', confirm: '' })
const errors = reactive({ password: '', confirm: '' })
const loading = ref(false)
const formError = ref('')

async function submit() {
  formError.value = ''
  errors.password = form.password.length < 8 ? 'Kata sandi minimal 8 karakter.' : ''
  errors.confirm = form.confirm !== form.password ? 'Konfirmasi kata sandi tidak sama.' : ''
  if (errors.password || errors.confirm) return
  loading.value = true
  try {
    await auth.resetPassword(token.value, form.password)
    // Reset kata sandi mencabut semua sesi → bersihkan sesi lokal juga
    if (auth.accessToken) resetAllStores()
    toast.success('Kata sandi diperbarui', 'Silakan masuk dengan kata sandi baru Anda.')
    await router.replace({ name: 'login' })
  } catch (err) {
    formError.value = getApiError(err, 'Tautan tidak valid atau sudah kedaluwarsa.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Atur ulang kata sandi" :subtitle="token ? 'Buat kata sandi baru yang kuat untuk akun Anda.' : undefined">
    <div v-if="!token" class="space-y-5">
      <AlertBanner tone="danger" title="Tautan tidak valid">
        Tautan reset kata sandi tidak lengkap atau sudah tidak berlaku. Silakan minta tautan baru.
      </AlertBanner>
      <BaseButton block :to="{ name: 'forgot-password' }">Minta tautan baru</BaseButton>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <AlertBanner v-if="formError" tone="danger">{{ formError }}</AlertBanner>
      <BaseInput v-model="form.password" label="Kata sandi baru" type="password" placeholder="Minimal 8 karakter" autocomplete="new-password" :icon="Lock" :error="errors.password" required>
        <template #below><PasswordStrength :password="form.password" /></template>
      </BaseInput>
      <BaseInput v-model="form.confirm" label="Konfirmasi kata sandi" type="password" placeholder="Ulangi kata sandi" autocomplete="new-password" :icon="Lock" :error="errors.confirm" required />
      <BaseButton type="submit" block size="lg" :loading="loading" class="!mt-6">{{ loading ? 'Menyimpan…' : 'Simpan kata sandi' }}</BaseButton>
    </form>

    <div class="mt-8 text-center">
      <RouterLink :to="auth.isAuthenticated ? '/' : '/login'" class="inline-flex items-center gap-1.5 rounded text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft :size="15" aria-hidden="true" /> {{ auth.isAuthenticated ? 'Kembali ke beranda' : 'Kembali ke halaman masuk' }}
      </RouterLink>
    </div>
  </AuthLayout>
</template>
