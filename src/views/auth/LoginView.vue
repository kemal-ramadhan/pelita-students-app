<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Lock, Mail, QrCode } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import { NotStudentError, useAuthStore } from '@/stores/auth'
import { getApiError, getApiErrorCode } from '@/utils/api'
import { isEmail } from '@/utils/validators'
import { postLoginTarget } from '@/utils/claim'
import { toast } from '@/composables/useToast'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const loading = ref(false)
const formError = ref('')
const notStudent = ref(false)

/** Sedang membuka tautan QR presensi kelas sebelum masuk. */
const fromClaim = computed(
  () => typeof route.query.redirect === 'string' && route.query.redirect.includes('code='),
)

function validate() {
  errors.email = !form.email.trim() ? 'Email wajib diisi.' : !isEmail(form.email) ? 'Format email tidak valid.' : ''
  errors.password = !form.password ? 'Kata sandi wajib diisi.' : ''
  return !errors.email && !errors.password
}

async function submit() {
  formError.value = ''
  notStudent.value = false
  if (!validate()) return
  loading.value = true
  const email = form.email.trim()
  try {
    await auth.login(email, form.password)
    await router.replace(postLoginTarget(route.query.redirect))
    toast.success('Selamat datang kembali!', auth.displayName)
  } catch (err) {
    if (err instanceof NotStudentError) {
      notStudent.value = true
      formError.value = err.message
    } else if (getApiErrorCode(err) === 'EMAIL_NOT_VERIFIED') {
      try {
        await auth.resendOtp(email)
      } catch {
        /* resend bersifat generik; abaikan */
      }
      auth.pendingEmail = email
      toast.info('Email belum diverifikasi', 'Kami telah mengirim kode OTP baru ke email Anda.')
      await router.push({ name: 'verify-otp', query: { email, sent: '1' } })
    } else {
      formError.value = getApiError(err, 'Gagal masuk. Periksa kembali email dan kata sandi Anda.')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Masuk" subtitle="Presensi sekolah & kelas jadi lebih mudah.">
    <AlertBanner v-if="fromClaim" tone="info" class="mb-5">
      <span class="inline-flex items-center gap-1.5"><QrCode :size="15" aria-hidden="true" /> Masuk dulu untuk mencatat presensi kelas.</span>
    </AlertBanner>
    <AlertBanner v-if="formError" :tone="notStudent ? 'warning' : 'danger'" :title="notStudent ? 'Bukan akun siswa' : undefined" class="mb-5">
      {{ formError }}
    </AlertBanner>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="form.email"
        label="Email"
        type="email"
        inputmode="email"
        placeholder="nama@email.com"
        autocomplete="email"
        autocapitalize="off"
        :icon="Mail"
        :error="errors.email"
        required
        @blur="form.email && (errors.email = isEmail(form.email) ? '' : 'Format email tidak valid.')"
      />
      <BaseInput
        v-model="form.password"
        label="Kata sandi"
        type="password"
        placeholder="Masukkan kata sandi"
        autocomplete="current-password"
        :icon="Lock"
        :error="errors.password"
        required
      >
        <template #label-right>
          <RouterLink to="/forgot-password" class="rounded py-1 text-xs font-medium text-accent hover:underline">Lupa kata sandi?</RouterLink>
        </template>
      </BaseInput>

      <BaseButton type="submit" block size="lg" :loading="loading" :icon-right="ArrowRight" class="!mt-6">
        {{ loading ? 'Memproses…' : 'Masuk' }}
      </BaseButton>
    </form>

    <p class="mt-8 text-center text-sm text-fg-muted">
      Belum punya akun?
      <RouterLink to="/register" class="rounded font-semibold text-accent hover:underline">Daftar sebagai siswa</RouterLink>
    </p>
  </AuthLayout>
</template>
