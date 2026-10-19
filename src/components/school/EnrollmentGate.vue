<script setup lang="ts">
import { onMounted, ref } from 'vue'
import JoinPromptCard from './JoinPromptCard.vue'
import PendingRequestCard from './PendingRequestCard.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import { useStudentStore } from '@/stores/student'
import { getApiError } from '@/utils/api'

/**
 * Menampilkan slot hanya bila siswa sudah aktif di sekolah (§10.5 GET /me).
 * Selain itu menampilkan ajakan gabung / status menunggu.
 */
defineProps<{ joinMessage?: string }>()

const student = useStudentStore()
const error = ref('')

async function load(force = false) {
  error.value = ''
  try {
    await student.fetchMe(force)
  } catch (err) {
    error.value = getApiError(err, 'Tidak dapat memuat status sekolah.')
  }
}
onMounted(() => void load())
</script>

<template>
  <div v-if="!student.loaded && !error" class="space-y-3" aria-busy="true" aria-label="Memuat">
    <div class="skeleton h-36 w-full rounded-2xl" />
    <div class="skeleton h-24 w-full rounded-2xl" />
  </div>
  <ErrorState v-else-if="error && !student.loaded" :message="error" :loading="student.loading" @retry="load(true)" />
  <JoinPromptCard v-else-if="student.hasNoSchool" :message="joinMessage" />
  <PendingRequestCard v-else-if="student.isPending" />
  <slot v-else />
</template>
