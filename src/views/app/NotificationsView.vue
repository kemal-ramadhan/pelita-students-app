<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { BellOff, CalendarCheck2, CheckCheck, CircleX, Clock, HeartHandshake, Link2, School } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import ErrorState from '@/components/ui/ErrorState.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import RefreshButton from '@/components/ui/RefreshButton.vue'
import { useNotificationStore } from '@/stores/notifications'
import { useStudentStore } from '@/stores/student'
import { toast } from '@/composables/useToast'
import { getApiError } from '@/utils/api'
import { relativeTime } from '@/utils/format'
import type { AppNotification } from '@/types/api'

const router = useRouter()
const notif = useNotificationStore()
const student = useStudentStore()
const error = ref('')
const loadMoreError = ref('')
const markingAll = ref(false)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const ICONS: Record<string, { icon: Component; cls: string }> = {
  join_approved: { icon: School, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' },
  join_rejected: { icon: CircleX, cls: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400' },
  account_linked: { icon: Link2, cls: 'bg-accent-soft text-accent' },
  attendance_marked: { icon: CalendarCheck2, cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400' },
  late_check_in: { icon: Clock, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' },
}
const COUNSELING_ICON = { icon: HeartHandshake, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400' }
const iconFor = (t: string) =>
  ICONS[t] ?? (t.startsWith('counseling') ? COUNSELING_ICON : { icon: CalendarCheck2, cls: 'bg-surface-muted text-fg-muted' })

async function refresh() {
  error.value = ''
  try {
    await notif.refresh()
  } catch (err) {
    error.value = getApiError(err, 'Tidak dapat memuat notifikasi.')
  }
}

async function more() {
  loadMoreError.value = ''
  try {
    await notif.loadMore()
  } catch (err) {
    loadMoreError.value = getApiError(err, 'Gagal memuat notifikasi berikutnya.')
  }
}

async function open(n: AppNotification) {
  // Notifikasi BK membuka halaman konseling (sesi / kegiatan).
  if (n.type.startsWith('counseling')) {
    void router.push({ name: 'counseling', query: { tab: n.type.includes('event') ? 'kegiatan' : 'sesi' } })
  } else if (n.type.startsWith('assessment')) {
    void router.push({ name: 'assessments' })
  }
  if (n.read_at) return
  try {
    await notif.markRead(n.id)
    // Status sekolah mungkin berubah (disetujui/ditolak/terhubung)
    if (['join_approved', 'join_rejected', 'account_linked'].includes(n.type)) void student.fetchMe(true).catch(() => undefined)
  } catch (err) {
    toast.error('Gagal menandai dibaca', getApiError(err))
  }
}

async function markAll() {
  markingAll.value = true
  try {
    await notif.markAllRead()
    toast.success('Semua notifikasi ditandai dibaca')
  } catch (err) {
    toast.error('Gagal menandai semua', getApiError(err))
  } finally {
    markingAll.value = false
  }
}

onMounted(() => {
  void refresh()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting) && notif.loaded && !loadMoreError.value) void more()
    },
    { rootMargin: '200px' },
  )
})
watch(sentinel, (el, prev) => {
  if (prev) observer?.unobserve(prev)
  if (el) observer?.observe(el)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div class="space-y-3">
    <Teleport defer to="#header-actions">
      <RefreshButton :loading="notif.loading && notif.page <= 1" label="Muat ulang notifikasi" @click="refresh" />
    </Teleport>

    <div v-if="notif.items.length" class="flex items-center justify-between">
      <p class="text-sm text-fg-muted">
        <template v-if="notif.unread">{{ notif.unread }} belum dibaca</template>
        <template v-else>Semua sudah dibaca</template>
      </p>
      <BaseButton variant="ghost" size="sm" :icon="CheckCheck" :loading="markingAll" :disabled="!notif.unread" @click="markAll">
        Tandai semua dibaca
      </BaseButton>
    </div>

    <ErrorState v-if="error && !notif.items.length" :message="error" :loading="notif.loading" @retry="refresh" />
    <div v-else-if="!notif.loaded" class="space-y-2" aria-busy="true" aria-label="Memuat notifikasi">
      <div v-for="i in 5" :key="i" class="skeleton h-20 w-full rounded-2xl" />
    </div>
    <div v-else-if="!notif.items.length" class="card">
      <EmptyState :icon="BellOff" title="Belum ada notifikasi" description="Info persetujuan sekolah dan presensi akan muncul di sini." />
    </div>

    <ul v-else class="space-y-2" aria-label="Daftar notifikasi">
      <li v-for="n in notif.items" :key="n.id">
        <button
          type="button"
          class="pressable card flex w-full items-start gap-3 p-3 text-left"
          :class="n.read_at ? 'opacity-80' : 'border-primary-200 bg-primary-50/50 dark:border-primary-500/30 dark:bg-primary-500/5'"
          :aria-label="`${n.read_at ? '' : 'Belum dibaca. '}${n.title}`"
          @click="open(n)"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" :class="iconFor(n.type).cls">
            <component :is="iconFor(n.type).icon" :size="19" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-start justify-between gap-2">
              <span class="text-sm text-fg" :class="n.read_at ? 'font-medium' : 'font-semibold'">{{ n.title }}</span>
              <span v-if="!n.read_at" class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-hidden="true" />
            </span>
            <span class="mt-0.5 block text-sm text-fg-muted">{{ n.body }}</span>
            <span class="mt-1 block text-[11px] text-fg-subtle">{{ relativeTime(n.created_at) }}</span>
          </span>
        </button>
      </li>
    </ul>

    <div v-if="notif.items.length && notif.hasMore" ref="sentinel" class="py-2 text-center">
      <BaseButton v-if="loadMoreError" variant="secondary" size="sm" @click="more">Coba muat lagi</BaseButton>
      <span v-else class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-line-strong border-t-primary-600" aria-label="Memuat notifikasi berikutnya" />
    </div>
  </div>
</template>
