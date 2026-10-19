<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarDays, MapPin, Phone, Save, UserRound } from 'lucide-vue-next'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import AlertBanner from '@/components/ui/AlertBanner.vue'
import { useAuthStore, type ProfilePayload } from '@/stores/auth'
import { toast } from '@/composables/useToast'
import { getApiError, getApiFieldErrors } from '@/utils/api'
import { emptyToUndefined } from '@/utils/format'
import { isPhone } from '@/utils/validators'

const router = useRouter()
const auth = useAuthStore()
const c = auth.user?.customer

function genderValue(g: unknown): '' | '1' | '2' {
  const s = String(g ?? '').toLowerCase()
  if (s === '1' || s === 'l' || s.startsWith('laki')) return '1'
  if (s === '2' || s === 'p' || s.startsWith('perempuan')) return '2'
  return ''
}

const form = reactive({
  full_name: c?.full_name ?? '',
  phone: auth.user?.phone ?? '',
  birth_place: c?.birth_place ?? '',
  birth_date: c?.birth_date?.slice(0, 10) ?? '',
  gender: genderValue(c?.gender),
})
type Field = keyof typeof form
const errors = reactive<Record<Field, string>>({ full_name: '', phone: '', birth_place: '', birth_date: '', gender: '' })
const saving = ref(false)
const formError = ref('')
const today = new Date().toISOString().slice(0, 10)

async function submit() {
  formError.value = ''
  errors.full_name = form.full_name.trim().length < 3 ? 'Nama lengkap minimal 3 karakter.' : ''
  errors.phone = form.phone.trim() && !isPhone(form.phone) ? 'Nomor HP tidak valid.' : ''
  errors.birth_date = form.birth_date && form.birth_date > today ? 'Tanggal lahir tidak valid.' : ''
  if (Object.values(errors).some(Boolean)) return
  saving.value = true
  const payload: ProfilePayload = {
    full_name: form.full_name.trim(),
    phone: emptyToUndefined(form.phone),
    birth_place: emptyToUndefined(form.birth_place),
    birth_date: emptyToUndefined(form.birth_date),
    gender: form.gender ? (Number(form.gender) as 1 | 2) : undefined,
  }
  try {
    await auth.updateProfile(payload)
    toast.success('Profil disimpan')
    await router.replace('/profil')
  } catch (err) {
    const fields = getApiFieldErrors(err)
    for (const k of Object.keys(errors) as Field[]) if (fields[k]) errors[k] = fields[k]!
    formError.value = getApiError(err, 'Gagal menyimpan profil.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="card space-y-4 p-4" novalidate @submit.prevent="submit">
    <AlertBanner v-if="formError" tone="danger">{{ formError }}</AlertBanner>
    <BaseInput v-model="form.full_name" label="Nama lengkap" autocomplete="name" :icon="UserRound" :error="errors.full_name" required />
    <BaseInput v-model="form.phone" label="No. HP" type="tel" inputmode="tel" autocomplete="tel" :icon="Phone" :error="errors.phone" hint="Opsional" />
    <BaseInput v-model="form.birth_place" label="Tempat lahir" :icon="MapPin" :error="errors.birth_place" hint="Opsional" />
    <BaseInput v-model="form.birth_date" label="Tanggal lahir" type="date" :max="today" :icon="CalendarDays" :error="errors.birth_date" hint="Opsional" />
    <fieldset>
      <legend class="text-sm font-medium text-fg">Jenis kelamin</legend>
      <div class="mt-1.5 grid grid-cols-2 gap-2">
        <label
          v-for="g in [{ v: '1', l: 'Laki-laki' }, { v: '2', l: 'Perempuan' }]"
          :key="g.v"
          class="pressable flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500"
          :class="form.gender === g.v ? 'border-primary-500 bg-accent-soft text-accent' : 'border-line-strong text-fg-muted'"
        >
          <input v-model="form.gender" type="radio" name="gender" :value="g.v" class="sr-only" />
          {{ g.l }}
        </label>
      </div>
    </fieldset>
    <p class="text-xs text-fg-subtle">Email tidak dapat diubah: {{ auth.user?.email }}</p>
    <BaseButton type="submit" block size="lg" :icon="Save" :loading="saving">{{ saving ? 'Menyimpan…' : 'Simpan' }}</BaseButton>
  </form>
</template>
