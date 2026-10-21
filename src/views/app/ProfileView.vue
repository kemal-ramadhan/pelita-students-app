<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Camera, ChevronRight, KeyRound, LogOut, Moon, School, Sun, SunMoon, UserPen } from 'lucide-vue-next'
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import StatusPill from '@/components/ui/StatusPill.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
import { useLogout } from '@/composables/useLogout'
import { toast } from '@/composables/useToast'
import { getApiError } from '@/utils/api'
import { assetUrl } from '@/utils/format'

const auth = useAuthStore()
const student = useStudentStore()
const { mode, setMode } = useTheme()
const { requestLogout } = useLogout()

const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const MAX_PHOTO = 2 * 1024 * 1024
const PHOTO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

const themes: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Terang', icon: Sun },
  { id: 'dark', label: 'Gelap', icon: Moon },
  { id: 'system', label: 'Sistem', icon: SunMoon },
]

const schoolStatus = computed(() => {
  if (student.isActive) return { label: 'Aktif', tone: 'success' as const }
  if (student.isPending) return { label: 'Menunggu', tone: 'warning' as const }
  if (student.hasNoSchool) return { label: 'Belum bergabung', tone: 'neutral' as const }
  return null
})

onMounted(() => {
  void auth.fetchMe().catch(() => undefined)
  void student.fetchMe().catch(() => undefined)
})

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!PHOTO_TYPES.includes(file.type)) {
    toast.error('Format tidak didukung', 'Gunakan foto PNG, JPG, atau WebP.')
    return
  }
  if (file.size > MAX_PHOTO) {
    toast.error('Foto terlalu besar', 'Ukuran maksimal 2 MB.')
    return
  }
  uploading.value = true
  try {
    await auth.uploadPhotoProfile(file)
    toast.success('Foto profil diperbarui')
  } catch (err) {
    toast.error('Gagal mengunggah foto', getApiError(err))
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Identitas -->
    <section class="card flex flex-col items-center p-5 text-center">
      <div class="relative">
        <BaseAvatar :src="assetUrl(auth.user?.photo_profile)" :name="auth.displayName" :size="88" />
        <button
          type="button"
          class="pressable absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white shadow-md ring-4 ring-surface disabled:opacity-70"
          :aria-label="uploading ? 'Mengunggah foto…' : 'Ganti foto profil'"
          :disabled="uploading"
          @click="fileInput?.click()"
        >
          <span v-if="uploading" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          <Camera v-else :size="16" aria-hidden="true" />
        </button>
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="onFile" />
      </div>
      <h2 class="mt-3 text-lg font-semibold text-fg">{{ auth.displayName }}</h2>
      <p class="text-sm text-fg-muted">{{ auth.user?.email }}</p>
      <p v-if="auth.user?.phone" class="text-xs text-fg-subtle">{{ auth.user.phone }}</p>
    </section>

    <!-- Sekolah -->
    <section class="card p-4" aria-labelledby="school-title">
      <div class="flex items-center justify-between">
        <h2 id="school-title" class="flex items-center gap-2 text-[15px] font-semibold text-fg"><School :size="17" aria-hidden="true" /> Sekolah</h2>
        <StatusPill v-if="schoolStatus" :label="schoolStatus.label" :tone="schoolStatus.tone" />
      </div>
      <div v-if="!student.loaded" class="mt-3 space-y-2" aria-hidden="true">
        <div class="skeleton h-4 w-2/3" />
        <div class="skeleton h-4 w-1/2" />
      </div>
      <template v-else-if="student.isActive && student.school">
        <div class="mt-3 flex items-center gap-3">
          <BaseAvatar :src="assetUrl(student.school.logo)" :name="student.school.name" :size="44" shape="rounded" fit="contain" :alt="`Logo ${student.school.name}`" />
          <div class="min-w-0">
            <p class="truncate font-medium text-fg">{{ student.school.name }}</p>
            <p class="text-xs text-fg-muted">Kode {{ student.school.code }}</p>
          </div>
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-xl bg-surface-muted p-2.5">
            <dt class="text-xs text-fg-subtle">Kelas</dt>
            <dd class="font-medium text-fg">{{ student.className ?? '—' }}</dd>
          </div>
          <div class="rounded-xl bg-surface-muted p-2.5">
            <dt class="text-xs text-fg-subtle">NISN</dt>
            <dd class="font-medium text-fg">{{ student.student?.nisn || '—' }}</dd>
          </div>
          <div v-if="student.student?.current_class?.academic_year_name" class="col-span-2 rounded-xl bg-surface-muted p-2.5">
            <dt class="text-xs text-fg-subtle">Tahun ajaran</dt>
            <dd class="font-medium text-fg">{{ student.student.current_class.academic_year_name }}</dd>
          </div>
        </dl>
      </template>
      <RouterLink
        v-else
        to="/gabung-sekolah"
        class="pressable mt-3 flex items-center justify-between rounded-xl bg-accent-soft px-3 py-3 text-sm font-semibold text-accent"
      >
        {{ student.isPending ? `Menunggu persetujuan ${student.pendingRequest?.school?.name ?? 'sekolah'}` : 'Gabung sekolah' }}
        <ChevronRight :size="18" aria-hidden="true" />
      </RouterLink>
    </section>

    <!-- Akun -->
    <nav class="card divide-y divide-line overflow-hidden" aria-label="Pengaturan akun">
      <RouterLink to="/profil/ubah" class="pressable flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover">
        <UserPen :size="19" class="text-fg-muted" aria-hidden="true" />
        <span class="flex-1 text-sm font-medium text-fg">Ubah data diri</span>
        <ChevronRight :size="18" class="text-fg-subtle" aria-hidden="true" />
      </RouterLink>
      <RouterLink to="/forgot-password" class="pressable flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover">
        <KeyRound :size="19" class="text-fg-muted" aria-hidden="true" />
        <span class="flex-1">
          <span class="block text-sm font-medium text-fg">Ganti kata sandi</span>
          <span class="block text-xs text-fg-subtle">Tautan atur ulang dikirim ke email</span>
        </span>
        <ChevronRight :size="18" class="text-fg-subtle" aria-hidden="true" />
      </RouterLink>
    </nav>

    <!-- Tema -->
    <section class="card p-4" aria-labelledby="theme-title">
      <h2 id="theme-title" class="text-[15px] font-semibold text-fg">Tema tampilan</h2>
      <div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="theme-title">
        <button
          v-for="t in themes"
          :key="t.id"
          type="button"
          role="radio"
          :aria-checked="mode === t.id"
          class="pressable flex flex-col items-center gap-1 rounded-xl border py-3 text-xs font-medium"
          :class="mode === t.id ? 'border-primary-500 bg-accent-soft text-accent' : 'border-line text-fg-muted'"
          @click="setMode(t.id)"
        >
          <component :is="t.icon" :size="19" aria-hidden="true" /> {{ t.label }}
        </button>
      </div>
    </section>

    <button
      type="button"
      class="pressable card flex w-full items-center justify-center gap-2 py-3.5 text-sm font-semibold text-red-600 dark:text-red-400"
      @click="requestLogout"
    >
      <LogOut :size="18" aria-hidden="true" /> Keluar
    </button>
    <p class="text-center text-xs text-fg-subtle">Pelita Sekolah Siswa</p>
  </div>
</template>
