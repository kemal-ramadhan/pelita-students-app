<script setup lang="ts">
import { ref } from 'vue'
import { Hourglass, X } from 'lucide-vue-next'
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import { useStudentStore } from '@/stores/student'
import { confirm } from '@/composables/useConfirm'
import { toast } from '@/composables/useToast'
import { getApiError } from '@/utils/api'
import { assetUrl, formatDate } from '@/utils/format'

const student = useStudentStore()
const cancelling = ref(false)

async function cancel() {
  const ok = await confirm({
    title: 'Batalkan permintaan?',
    message: 'Permintaan bergabung ke sekolah ini akan dibatalkan. Kamu bisa mengirim permintaan baru kapan saja.',
    confirmText: 'Ya, batalkan',
    tone: 'danger',
  })
  if (!ok) return
  cancelling.value = true
  try {
    await student.cancelJoin()
    toast.info('Permintaan dibatalkan')
  } catch (err) {
    toast.error('Gagal membatalkan', getApiError(err))
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <section v-if="student.pendingRequest" class="card overflow-hidden" aria-labelledby="pending-title">
    <div class="flex items-center gap-2 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
      <Hourglass :size="14" aria-hidden="true" class="animate-pulse" /> Menunggu persetujuan sekolah
    </div>
    <div class="p-4">
      <div class="flex items-center gap-3">
        <BaseAvatar
          :src="assetUrl(student.pendingRequest.school?.logo)"
          :name="student.pendingRequest.school?.name"
          :size="52"
          shape="rounded"
          fit="contain"
          :alt="`Logo ${student.pendingRequest.school?.name ?? 'sekolah'}`"
        />
        <div class="min-w-0">
          <h2 id="pending-title" class="truncate font-semibold text-fg">{{ student.pendingRequest.school?.name ?? 'Sekolah' }}</h2>
          <p class="text-xs text-fg-muted">Kode: {{ student.pendingRequest.school?.code ?? '—' }}</p>
        </div>
      </div>
      <dl class="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface-muted p-3 text-xs">
        <div>
          <dt class="text-fg-subtle">Nama</dt>
          <dd class="mt-0.5 truncate font-medium text-fg">{{ student.pendingRequest.full_name }}</dd>
        </div>
        <div>
          <dt class="text-fg-subtle">Dikirim</dt>
          <dd class="mt-0.5 font-medium text-fg">{{ formatDate(student.pendingRequest.created_at) }}</dd>
        </div>
        <div v-if="student.pendingRequest.nisn">
          <dt class="text-fg-subtle">NISN</dt>
          <dd class="mt-0.5 font-medium text-fg">{{ student.pendingRequest.nisn }}</dd>
        </div>
      </dl>
      <p class="mt-3 text-sm text-fg-muted">
        Sekolah akan memeriksa datamu. Kamu akan menerima notifikasi setelah permintaan disetujui atau ditolak.
      </p>
      <BaseButton class="mt-4" variant="danger-soft" block :icon="X" :loading="cancelling" @click="cancel">
        Batalkan permintaan
      </BaseButton>
    </div>
  </section>
</template>
