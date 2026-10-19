<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Lock, Mail, Phone, UserRound } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import PasswordStrength from '@/components/ui/PasswordStrength.vue'
import { useAuthStore } from '@/stores/auth'
import { getApiError, getApiStatus } from '@/utils/api'
import { isEmail, isPhone } from '@/utils/validators'
import { emptyToUndefined } from '@/utils/format'
import { toast } from '@/composables/useToast'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({ full_name: '', email: '', phone: '', password: '', confirm: '' })
type Field = keyof typeof form
const errors = reactive<Record<Field, string>>({ full_name: '', email: '', phone: '', password: '', confirm: '' })
const touched = reactive<Partial<Record<Field, boolean>>>({})
const loading = ref(false)
const formError = ref('')

function check(field: Field): string {
  const v = form[field].trim()
  switch (field) {
    case 'full_name':
      return !v ? 'Nama lengkap wajib diisi.' : v.length < 3 ? 'Nama minimal 3 karakter.' : ''
    case 'email':
      return !v ? 'Email wajib diisi.' : !isEmail(v) ? 'Format email tidak valid.' : ''
    case 'phone':
      return v && !isPhone(v) ? 'Nomor HP tidak valid (contoh: 081234567890).' : ''
    case 'password':
      return !form.password ? 'Kata sandi wajib diisi.' : form.password.length < 8 ? 'Kata sandi minimal 8 karakter.' : ''
    case 'confirm':
      return !form.confirm ? 'Ulangi kata sandi Anda.' : form.confirm !== form.password ? 'Konfirmasi kata sandi tidak sama.' : ''
  }
}

function blur(field: Field) {
  touched[field] = true
  errors[field] = check(field)
  if (field === 'password' && touched.confirm) errors.confirm = check('confirm')
}

function validateAll() {
  let ok = true
  for (const f of Object.keys(form) as Field[]) {
    touched[f] = true
    errors[f] = check(f)
    if (errors[f]) ok = false
  }
  return ok
}

async function submit() {
  formError.value = ''
  if (!validateAll()) return
  loading.value = true
  const email = form.email.trim()
  try {
    await auth.register({
      full_name: form.full_name.trim(),
      email,
      phone: emptyToUndefined(form.phone),
      password: form.password,
    })
    toast.success('Pendaftaran berhasil', `Kode verifikasi telah dikirim ke ${email}.`)
    await router.push({ name: 'verify-otp', query: { email, sent: '1' } })
  } catch (err) {
    if (getApiStatus(err) === 409) errors.email = getApiError(err, 'Email sudah terdaftar.')
    else formError.value = getApiError(err, 'Gagal mendaftar. Silakan coba lagi.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout title="Daftar akun siswa" subtitle="Setelah mendaftar, gabung ke sekolahmu dengan kode sekolah.">
    <AlertBanner v-if="formError" tone="danger" class="mb-5">{{ formError }}</AlertBanner>

    <form class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput v-model="form.full_name" label="Nama lengkap" placeholder="Sesuai data sekolah" autocomplete="name" autocapitalize="words" :icon="UserRound" :error="errors.full_name" required @blur="blur('full_name')" />
      <BaseInput v-model="form.email" label="Email" type="email" inputmode="email" placeholder="nama@email.com" autocomplete="email" autocapitalize="off" :icon="Mail" :error="errors.email" required @blur="blur('email')" />
      <BaseInput v-model="form.phone" label="No. HP" type="tel" inputmode="tel" placeholder="0812xxxxxxx" autocomplete="tel" :icon="Phone" :error="errors.phone" hint="Opsional" @blur="blur('phone')" />
      <BaseInput
        v-model="form.password"
        label="Kata sandi"
        type="password"
        placeholder="Minimal 8 karakter"
        autocomplete="new-password"
        :icon="Lock"
        :error="errors.password"
        required
        @blur="blur('password')"
        @input="touched.password && (errors.password = check('password'))"
      >
        <template #below><PasswordStrength :password="form.password" /></template>
      </BaseInput>
      <BaseInput
        v-model="form.confirm"
        label="Konfirmasi kata sandi"
        type="password"
        placeholder="Ulangi kata sandi"
        autocomplete="new-password"
        :icon="Lock"
        :error="errors.confirm"
        required
        @blur="blur('confirm')"
        @input="touched.confirm && (errors.confirm = check('confirm'))"
      />

      <BaseButton type="submit" block size="lg" :loading="loading" :icon-right="ArrowRight" class="!mt-6">
        {{ loading ? 'Mendaftarkan…' : 'Daftar' }}
      </BaseButton>
    </form>

    <p class="mt-8 text-center text-sm text-fg-muted">
      Sudah punya akun?
      <RouterLink to="/login" class="rounded font-semibold text-accent hover:underline">Masuk di sini</RouterLink>
    </p>
  </AuthLayout>
</template>
