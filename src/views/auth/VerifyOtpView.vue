<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Mail, MailCheck } from 'lucide-vue-next'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import OtpInput from '@/components/ui/OtpInput.vue'
import { NotStudentError, useAuthStore } from '@/stores/auth'
import { getApiError } from '@/utils/api'
import { isEmail } from '@/utils/validators'
import { postLoginTarget } from '@/utils/claim'
import { toast } from '@/composables/useToast'

const COOLDOWN = 60
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const email = ref((typeof route.query.email === 'string' && route.query.email) || auth.pendingEmail || '')
const editingEmail = ref(!email.value)
const emailDraft = ref(email.value)
const emailError = ref('')
const otp = ref('')
const otpRef = ref<InstanceType<typeof OtpInput> | null>(null)
const verifying = ref(false)
const resending = ref(false)
const error = ref('')
const remaining = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const cooldownKey = computed(() => `otp-cooldown:${email.value.toLowerCase()}`)

function startCooldown(seconds = COOLDOWN) {
  const until = Date.now() + seconds * 1000
  try {
    sessionStorage.setItem(cooldownKey.value, String(until))
  } catch {
    /* noop */
  }
  tick(until)
}

function tick(until: number) {
  clearInterval(timer)
  const update = () => {
    remaining.value = Math.max(0, Math.ceil((until - Date.now()) / 1000))
    if (remaining.value === 0) clearInterval(timer)
  }
  update()
  timer = setInterval(update, 500)
}

onMounted(() => {
  if (!email.value) return
  let until = 0
  try {
    until = Number(sessionStorage.getItem(cooldownKey.value) || 0)
  } catch {
    /* noop */
  }
  if (until > Date.now()) tick(until)
  else if (route.query.sent === '1') startCooldown()
  otpRef.value?.focus()
})
onBeforeUnmount(() => clearInterval(timer))

function confirmEmail() {
  const v = emailDraft.value.trim()
  if (!isEmail(v)) {
    emailError.value = 'Masukkan email yang valid.'
    return
  }
  emailError.value = ''
  email.value = v
  editingEmail.value = false
  void router.replace({ query: { ...route.query, email: v, sent: undefined } })
}

async function verify() {
  error.value = ''
  if (!/^\d{6}$/.test(otp.value)) {
    error.value = 'Masukkan 6 digit kode OTP.'
    return
  }
  verifying.value = true
  try {
    await auth.verifyOtp(email.value, otp.value)
    try {
      sessionStorage.removeItem(cooldownKey.value)
    } catch {
      /* noop */
    }
    await router.replace(postLoginTarget(route.query.redirect))
    toast.success('Email berhasil diverifikasi', 'Selamat datang! Yuk gabung ke sekolahmu.')
  } catch (err) {
    error.value =
      err instanceof NotStudentError ? err.message : getApiError(err, 'Kode OTP tidak valid atau sudah kedaluwarsa.')
    otp.value = ''
    otpRef.value?.focus()
  } finally {
    verifying.value = false
  }
}

async function resend() {
  if (remaining.value > 0 || resending.value) return
  error.value = ''
  resending.value = true
  try {
    await auth.resendOtp(email.value)
    toast.success('Kode baru terkirim', 'Periksa kotak masuk atau folder spam Anda.')
    startCooldown()
  } catch (err) {
    toast.error('Gagal mengirim ulang kode', getApiError(err))
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <AuthLayout title="Verifikasi email Anda">
    <template #subtitle>
      <template v-if="!editingEmail">
        Masukkan 6 digit kode yang kami kirim ke
        <span class="font-semibold text-white">{{ email }}</span>.
        <button type="button" class="ml-1 rounded font-semibold text-white underline underline-offset-2" @click="editingEmail = true">Ubah</button>
      </template>
      <template v-else>Masukkan email yang Anda gunakan saat mendaftar.</template>
    </template>

    <form v-if="editingEmail" class="space-y-4" novalidate @submit.prevent="confirmEmail">
      <BaseInput v-model="emailDraft" label="Email" type="email" autocomplete="email" :icon="Mail" :error="emailError" required />
      <BaseButton type="submit" block size="lg">Lanjutkan</BaseButton>
    </form>

    <form v-else class="space-y-6" novalidate @submit.prevent="verify">
      <div class="flex justify-center">
        <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <MailCheck :size="26" aria-hidden="true" />
        </span>
      </div>
      <OtpInput ref="otpRef" v-model="otp" :invalid="!!error" :disabled="verifying" @complete="verify" />
      <AlertBanner v-if="error" tone="danger">{{ error }}</AlertBanner>
      <BaseButton type="submit" block size="lg" :loading="verifying" :disabled="otp.length < 6">
        {{ verifying ? 'Memverifikasi…' : 'Verifikasi' }}
      </BaseButton>
      <p class="text-center text-sm text-fg-muted" aria-live="polite">
        Belum menerima kode?
        <button
          type="button"
          class="rounded font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-fg-subtle disabled:no-underline"
          :disabled="remaining > 0 || resending"
          @click="resend"
        >
          {{ resending ? 'Mengirim…' : remaining > 0 ? `Kirim ulang dalam ${remaining} dtk` : 'Kirim ulang' }}
        </button>
      </p>
    </form>

    <div class="mt-8 text-center">
      <RouterLink to="/login" class="inline-flex items-center gap-1.5 rounded text-sm font-medium text-fg-muted hover:text-fg">
        <ArrowLeft :size="15" aria-hidden="true" /> Kembali ke halaman masuk
      </RouterLink>
    </div>
  </AuthLayout>
</template>
