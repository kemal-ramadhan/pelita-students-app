<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Lock, Mail } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import PasswordStrength from '@/components/ui/PasswordStrength.vue'
import { NotStudentError, useAuthStore } from '@/stores/auth'
import type { ActivationInfo } from '@/types/api'
import { getApiError, getApiErrorCode, getApiStatus } from '@/utils/api'
import { toast } from '@/composables/useToast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const token = computed(() => (typeof route.query.token === 'string' ? route.query.token.trim() : ''))

type State = 'checking' | 'ready' | 'invalid' | 'error'
const state = ref<State>(token.value ? 'checking' : 'invalid')
const info = ref<ActivationInfo | null>(null)
const loadError = ref('')

const form = reactive({ password: '', confirm: '' })
const errors = reactive({ password: '', confirm: '' })
const submitting = ref(false)
const formError = ref('')

/** Sesi lain yang sedang aktif di perangkat ini (akan diakhiri secara lokal saat aktivasi). */
const otherSession = computed(() => (auth.isAuthenticated && auth.user ? auth.user.email : ''))

const isInvalidToken = (err: unknown) => getApiErrorCode(err) === 'INVALID_OR_EXPIRED_TOKEN' || getApiStatus(err) === 400

async function check() {
  if (!token.value) {
    state.value = 'invalid'
    return
  }
  state.value = 'checking'
  loadError.value = ''
  try {
    info.value = await auth.checkActivation(token.value)
    state.value = 'ready'
  } catch (err) {
    if (isInvalidToken(err)) {
      state.value = 'invalid'
    } else {
      loadError.value = getApiError(err, 'Gagal memeriksa tautan aktivasi.')
      state.value = 'error'
    }
  }
}
onMounted(check)

async function submit() {
  formError.value = ''
  errors.password = form.password.length < 8 ? 'Kata sandi minimal 8 karakter.' : ''
  errors.confirm = form.confirm !== form.password ? 'Konfirmasi kata sandi tidak sama.' : ''
  if (errors.password || errors.confirm || submitting.value) return
  submitting.value = true
  try {
    await auth.activateAccount(token.value, form.password)
    await router.replace({ name: 'home' })
    toast.success('Akun berhasil diaktifkan', `Selamat datang, ${auth.displayName}!`)
  } catch (err) {
    if (err instanceof NotStudentError) {
      formError.value = err.message
    } else if (isInvalidToken(err)) {
      state.value = 'invalid'
    } else {
      formError.value = getApiError(err, 'Gagal mengaktifkan akun. Silakan coba lagi.')
    }
  } finally {
    submitting.value = false
  }
}

const title = computed(() => (state.value === 'invalid' ? 'Tautan aktivasi tidak berlaku' : 'Aktivasi akun siswa'))
</script>

<template>
  <AuthLayout :title="title">
    <template v-if="state === 'ready' && info" #subtitle>
      Halo <span class="font-semibold text-white">{{ info.full_name }}</span>, aktifkan akun
      <span class="font-semibold text-white">{{ info.email }}</span> dengan membuat kata sandi.
    </template>

    <template v-if="state === 'ready' && info">

      <AlertBanner v-if="otherSession" tone="warning" title="Anda sedang masuk dengan akun lain" class="mb-5">
        Perangkat ini masih masuk sebagai <strong>{{ otherSession }}</strong>. Sesi tersebut akan diakhiri di perangkat ini
        saat Anda mengaktifkan akun baru.
      </AlertBanner>

      <form class="space-y-4" novalidate @submit.prevent="submit">
        <AlertBanner v-if="formError" tone="danger">{{ formError }}</AlertBanner>
        <BaseInput :model-value="info.email" label="Email" :icon="Mail" readonly autocomplete="username" hint="Email ini digunakan untuk masuk." />
        <BaseInput
          v-model="form.password"
          label="Kata sandi"
          type="password"
          placeholder="Minimal 8 karakter"
          autocomplete="new-password"
          :icon="Lock"
          :error="errors.password"
          required
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
        />
        <BaseButton type="submit" block size="lg" :loading="submitting" class="!mt-6">
          {{ submitting ? 'Mengaktifkan…' : 'Aktifkan akun' }}
        </BaseButton>
      </form>
    </template>

    <div v-else-if="state === 'checking'" class="space-y-4" aria-busy="true" aria-label="Memeriksa tautan aktivasi">
      <div class="skeleton h-4 w-3/4" />
      <div v-for="i in 3" :key="i" class="space-y-2"><div class="skeleton h-4 w-28" /><div class="skeleton h-10 w-full" /></div>
      <div class="skeleton h-12 w-full" />
    </div>

    <div v-else-if="state === 'error'" class="space-y-5">
      <AlertBanner tone="danger" title="Tidak dapat memeriksa tautan">{{ loadError }}</AlertBanner>
      <BaseButton block @click="check">Coba lagi</BaseButton>
    </div>

    <div v-else class="space-y-5">
      <AlertBanner tone="danger" title="Tautan tidak valid atau sudah kedaluwarsa">
        Tautan aktivasi hanya dapat dipakai sekali dan berlaku 72 jam. Silakan
        <strong>minta sekolahmu mengirim ulang undangan</strong> ke email Anda, lalu buka tautan terbaru.
      </AlertBanner>
      <p class="text-sm text-fg-muted">
        Sudah pernah mengaktifkan akun? Masuk dengan email dan kata sandi Anda, atau gunakan
        <RouterLink :to="{ name: 'forgot-password' }" class="font-medium text-accent hover:underline">lupa kata sandi</RouterLink>.
      </p>
    </div>

    <div class="mt-8 text-center">
      <RouterLink
        :to="auth.isAuthenticated ? '/' : '/login'"
        class="inline-flex items-center gap-1.5 rounded text-sm font-medium text-fg-muted hover:text-fg"
      >
        <ArrowLeft :size="15" aria-hidden="true" /> {{ auth.isAuthenticated ? 'Kembali ke beranda' : 'Kembali ke halaman masuk' }}
      </RouterLink>
    </div>
  </AuthLayout>
</template>
