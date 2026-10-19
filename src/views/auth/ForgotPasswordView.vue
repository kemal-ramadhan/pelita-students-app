<script setup lang="ts">
import { ref } from 'vue'
import { ArrowLeft, Mail, MailCheck } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useAuthStore } from '@/stores/auth'
import { getApiError } from '@/utils/api'
import { isEmail } from '@/utils/validators'
import { toast } from '@/composables/useToast'

const auth = useAuthStore()
const email = ref(auth.user?.email ?? '')
const emailError = ref('')
const loading = ref(false)
const sent = ref(false)

async function submit() {
  emailError.value = !email.value.trim() ? 'Email wajib diisi.' : !isEmail(email.value) ? 'Format email tidak valid.' : ''
  if (emailError.value) return
  loading.value = true
  try {
    await auth.forgotPassword(email.value.trim())
    sent.value = true
  } catch (err) {
    toast.error('Gagal mengirim tautan', getApiError(err))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout
    :title="sent ? 'Periksa email Anda' : 'Lupa kata sandi?'"
    :subtitle="sent ? undefined : 'Masukkan email akun Anda. Kami akan mengirimkan tautan untuk mengatur ulang kata sandi.'"
  >
    <div v-if="sent" class="space-y-6 animate-fade-in">
      <div class="flex items-start gap-4 rounded-2xl border border-line bg-surface-muted/60 p-5">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <MailCheck :size="22" aria-hidden="true" />
        </span>
        <p class="text-sm text-fg-muted">
          Jika <span class="font-medium text-fg">{{ email }}</span> terdaftar, tautan untuk mengatur ulang kata sandi akan
          segera dikirim. Periksa juga folder spam Anda.
        </p>
      </div>
      <BaseButton variant="secondary" block @click="sent = false">Gunakan email lain</BaseButton>
    </div>

    <form v-else class="space-y-4" novalidate @submit.prevent="submit">
      <BaseInput v-model="email" label="Email" type="email" placeholder="nama@email.com" inputmode="email" autocapitalize="off" autocomplete="email" :icon="Mail" :error="emailError" required />
      <BaseButton type="submit" block size="lg" :loading="loading">{{ loading ? 'Mengirim…' : 'Kirim tautan reset' }}</BaseButton>
    </form>

    <div class="mt-8 text-center">
      <RouterLink :to="auth.isAuthenticated ? '/profil' : '/login'" class="inline-flex items-center gap-1.5 rounded py-2 text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft :size="15" aria-hidden="true" /> {{ auth.isAuthenticated ? 'Kembali ke profil' : 'Kembali ke halaman masuk' }}
      </RouterLink>
    </div>
  </AuthLayout>
</template>
