<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarDays, Hash, KeyRound, School, Send, UserRound } from 'lucide-vue-next'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import PendingRequestCard from '@/components/school/PendingRequestCard.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { getApiError, getApiErrorCode, getApiFieldErrors, getApiStatus } from '@/utils/api'
import { emptyToUndefined } from '@/utils/format'
import { toast } from '@/composables/useToast'
import { haptic } from '@/composables/useHaptic'

const router = useRouter()
const auth = useAuthStore()
const student = useStudentStore()

const form = reactive({
  school_code: '',
  full_name: auth.user?.customer?.full_name ?? '',
  nisn: '',
  birth_date: auth.user?.customer?.birth_date?.slice(0, 10) ?? '',
  message: '',
})
type Field = keyof typeof form
const errors = reactive<Record<Field, string>>({ school_code: '', full_name: '', nisn: '', birth_date: '', message: '' })
const submitting = ref(false)
const formError = ref('')
const loadError = ref('')
const today = new Date().toISOString().slice(0, 10)

async function load() {
  loadError.value = ''
  try {
    await student.fetchMe(true)
  } catch (err) {
    loadError.value = getApiError(err, 'Tidak dapat memuat status sekolah.')
  }
}
onMounted(load)

function validate() {
  const code = form.school_code.trim()
  errors.school_code = !code ? 'Kode sekolah wajib diisi.' : ''
  errors.full_name = form.full_name.trim().length < 3 ? 'Nama lengkap minimal 3 karakter.' : ''
  errors.nisn = form.nisn && !/^\d{10}$/.test(form.nisn.trim()) ? 'NISN terdiri dari 10 digit angka.' : ''
  errors.birth_date = form.birth_date && form.birth_date > today ? 'Tanggal lahir tidak valid.' : ''
  errors.message = form.message.length > 500 ? 'Pesan maksimal 500 karakter.' : ''
  return !Object.values(errors).some(Boolean)
}

async function submit() {
  formError.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    const req = await student.join({
      school_code: form.school_code.trim(),
      full_name: form.full_name.trim(),
      nisn: emptyToUndefined(form.nisn),
      birth_date: emptyToUndefined(form.birth_date),
      message: emptyToUndefined(form.message),
    })
    haptic([10, 40, 10])
    toast.success('Permintaan terkirim', `Menunggu persetujuan ${req?.school?.name ?? 'sekolah'}.`)
  } catch (err) {
    const code = getApiErrorCode(err)
    if (code === 'SCHOOL_NOT_FOUND') {
      errors.school_code = 'Sekolah tidak ditemukan atau belum menerima pendaftaran siswa. Periksa kembali kodenya.'
    } else if (code === 'ALREADY_LINKED') {
      toast.info('Kamu sudah terdaftar di sekolah')
      await student.fetchMe(true).catch(() => undefined)
      await router.replace('/')
    } else if (code === 'REQUEST_PENDING') {
      toast.info('Masih ada permintaan yang menunggu')
      await student.fetchMe(true).catch(() => undefined)
    } else if (getApiStatus(err) === 429) {
      formError.value = 'Terlalu banyak permintaan. Coba lagi nanti.'
    } else {
      const fields = getApiFieldErrors(err)
      for (const k of Object.keys(errors) as Field[]) if (fields[k]) errors[k] = fields[k]!
      formError.value = getApiError(err, 'Gagal mengirim permintaan. Silakan coba lagi.')
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="!student.loaded && !loadError" class="space-y-3" aria-busy="true" aria-label="Memuat">
      <div class="skeleton h-24 w-full rounded-2xl" />
      <div class="skeleton h-72 w-full rounded-2xl" />
    </div>
    <ErrorState v-else-if="loadError && !student.loaded" :message="loadError" @retry="load" />

    <template v-else-if="student.isActive">
      <AlertBanner tone="success" title="Kamu sudah tergabung">
        Kamu terdaftar di <strong>{{ student.school?.name }}</strong>
        <template v-if="student.className"> · kelas {{ student.className }}</template>.
      </AlertBanner>
      <BaseButton block size="lg" to="/">Ke beranda</BaseButton>
    </template>

    <PendingRequestCard v-else-if="student.isPending" />

    <template v-else>
      <div class="flex items-start gap-3 rounded-2xl bg-accent-soft p-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
          <School :size="20" aria-hidden="true" />
        </span>
        <p class="text-sm text-fg-muted">
          Minta <strong class="text-fg">kode sekolah</strong> ke wali kelas atau operator sekolah. Sekolah akan
          mencocokkan datamu sebelum menyetujui.
        </p>
      </div>

      <form class="card space-y-4 p-4" novalidate @submit.prevent="submit">
        <AlertBanner v-if="formError" tone="danger">{{ formError }}</AlertBanner>
        <BaseInput
          v-model="form.school_code"
          label="Kode sekolah"
          placeholder="Contoh: SMAN1BDG"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          :icon="KeyRound"
          :error="errors.school_code"
          required
        />
        <BaseInput
          v-model="form.full_name"
          label="Nama lengkap"
          autocomplete="name"
          :icon="UserRound"
          :error="errors.full_name"
          hint="Sesuai data di sekolah."
          required
        />
        <BaseInput
          v-model="form.nisn"
          label="NISN"
          inputmode="numeric"
          maxlength="10"
          placeholder="10 digit"
          :icon="Hash"
          :error="errors.nisn"
          hint="Opsional, membantu sekolah menemukan datamu."
        />
        <BaseInput
          v-model="form.birth_date"
          label="Tanggal lahir"
          type="date"
          :max="today"
          :icon="CalendarDays"
          :error="errors.birth_date"
          hint="Opsional"
        />
        <BaseInput
          v-model="form.message"
          as="textarea"
          :rows="3"
          label="Pesan untuk sekolah"
          placeholder="Contoh: Saya siswa kelas X IPA 2."
          maxlength="500"
          :error="errors.message"
          hint="Opsional"
        />
        <BaseButton type="submit" block size="lg" :icon="Send" :loading="submitting">
          {{ submitting ? 'Mengirim…' : 'Kirim permintaan' }}
        </BaseButton>
      </form>
    </template>
  </div>
</template>
