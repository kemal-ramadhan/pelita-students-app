<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-vue-next'
import { useToastState, type ToastItem } from '@/composables/useToast'

const { toasts, dismiss } = useToastState()

const icons = { success: CircleCheck, error: CircleAlert, warning: TriangleAlert, info: Info }
const iconColor = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-primary-500',
}

const timers = new Map<number, { handle: ReturnType<typeof setTimeout>; remaining: number; start: number }>()

function schedule(t: ToastItem, ms = t.duration) {
  const handle = setTimeout(() => {
    timers.delete(t.id)
    dismiss(t.id)
  }, ms)
  timers.set(t.id, { handle, remaining: ms, start: Date.now() })
}
function pause(t: ToastItem) {
  const tm = timers.get(t.id)
  if (!tm) return
  clearTimeout(tm.handle)
  tm.remaining -= Date.now() - tm.start
}
function resume(t: ToastItem) {
  const tm = timers.get(t.id)
  if (tm) schedule(t, Math.max(1200, tm.remaining))
}
watch(
  toasts,
  (list) => {
    for (const t of list) if (!timers.has(t.id)) schedule(t)
  },
  { immediate: true },
)
function close(t: ToastItem) {
  const tm = timers.get(t.id)
  if (tm) clearTimeout(tm.handle)
  timers.delete(t.id)
  dismiss(t.id)
}
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t.handle)))
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[70] mx-auto flex max-w-[480px] flex-col items-center gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
      aria-live="polite"
      aria-relevant="additions"
    >
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :role="t.kind === 'error' ? 'alert' : 'status'"
          class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface p-3.5 pr-2.5 shadow-pop"
          @mouseenter="pause(t)"
          @mouseleave="resume(t)"
          @focusin="pause(t)"
          @focusout="resume(t)"
        >
          <component :is="icons[t.kind]" :size="19" class="mt-px shrink-0" :class="iconColor[t.kind]" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold text-fg">{{ t.title }}</p>
            <p v-if="t.message" class="mt-0.5 text-sm text-fg-muted">{{ t.message }}</p>
          </div>
          <button
            type="button"
            class="rounded-md p-1 text-fg-subtle transition-colors duration-150 hover:bg-surface-muted hover:text-fg"
            aria-label="Tutup notifikasi"
            @click="close(t)"
          >
            <X :size="15" aria-hidden="true" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 180ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-12px) scale(0.98);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
.toast-move {
  transition: transform 200ms ease;
}
</style>
