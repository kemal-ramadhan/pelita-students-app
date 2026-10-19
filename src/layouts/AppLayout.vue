<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft } from 'lucide-vue-next'
import BottomNav from '@/components/layout/BottomNav.vue'
import BaseAvatar from '@/components/ui/BaseAvatar.vue'
import { useAuthStore } from '@/stores/auth'
import { useStudentStore } from '@/stores/student'
import { useNotificationStore } from '@/stores/notifications'
import { assetUrl, greeting } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const student = useStudentStore()
const notif = useNotificationStore()

const header = computed(() => route.meta.header)
const back = computed(() => route.meta.back)

const subtitle = computed(() => {
  if (student.isActive && student.school) {
    return student.className ? `${student.className} · ${student.school.name}` : student.school.name
  }
  if (student.isPending) return 'Menunggu persetujuan sekolah'
  if (student.hasNoSchool) return 'Belum tergabung dengan sekolah'
  return ''
})

let lastUnreadAt = 0
function refreshUnread(force = false) {
  // Hanya untuk siswa aktif/menunggu; tidak memblokir UI.
  if (!force && Date.now() - lastUnreadAt < 30_000) return
  lastUnreadAt = Date.now()
  void notif.fetchUnreadCount().catch(() => undefined)
}

function onVisible() {
  if (document.visibilityState === 'visible') {
    refreshUnread()
    void student.fetchMe(true).catch(() => undefined)
  }
}

onMounted(() => {
  void student.fetchMe().catch(() => undefined)
  refreshUnread(true)
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
watch(
  () => route.name,
  () => refreshUnread(),
)

function goBack() {
  if (window.history.state?.back) router.back()
  else void router.push(back.value ?? '/')
}
</script>

<template>
  <div class="min-h-dvh bg-app">
    <div class="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-app sm:border-x sm:border-line">
      <a
        href="#main"
        class="sr-only z-50 rounded-lg bg-surface px-3 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
        >Lewati ke konten</a
      >
      <!-- Header -->
      <header
        class="sticky top-0 z-30 border-b border-line/70 bg-app/85 backdrop-blur-md pt-[env(safe-area-inset-top)]"
      >
        <div class="flex h-14 items-center gap-2 px-3">
          <template v-if="back">
            <button
              type="button"
              class="pressable -ml-1 inline-flex h-10 w-10 items-center justify-center rounded-full text-fg hover:bg-surface-muted"
              aria-label="Kembali"
              @click="goBack"
            >
              <ChevronLeft :size="22" aria-hidden="true" />
            </button>
            <h1 class="truncate text-base font-semibold text-fg">{{ header }}</h1>
          </template>
          <template v-else-if="header">
            <h1 class="truncate px-1 text-lg font-semibold text-fg">{{ header }}</h1>
          </template>
          <template v-else>
            <RouterLink to="/profil" class="pressable flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1" aria-label="Buka profil">
              <BaseAvatar :src="assetUrl(auth.user?.photo_profile)" :name="auth.displayName" :size="38" />
              <span class="min-w-0">
                <span class="block truncate text-[15px] font-semibold leading-tight text-fg">
                  {{ greeting() }}, {{ auth.firstName }}
                </span>
                <span v-if="subtitle" class="block truncate text-xs text-fg-muted">{{ subtitle }}</span>
                <span v-else class="mt-1 block h-3 w-32 skeleton" aria-hidden="true" />
              </span>
            </RouterLink>
          </template>
          <div class="ml-auto flex items-center"><div id="header-actions" class="flex items-center" /></div>
        </div>
      </header>

      <main id="main" class="flex-1 px-4 pt-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
        <RouterView v-slot="{ Component, route: r }">
          <Transition name="page" mode="out-in">
            <component :is="Component" :key="r.path" />
          </Transition>
        </RouterView>
      </main>

      <BottomNav v-if="!route.meta.hideTabs" />
    </div>
  </div>
</template>
