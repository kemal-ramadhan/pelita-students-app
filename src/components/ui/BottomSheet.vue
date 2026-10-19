<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { lockScroll, unlockScroll } from '@/composables/useScrollLock'

const props = defineProps<{
  title?: string
  description?: string
  /** Cegah penutupan (mis. saat proses berlangsung). */
  persistent?: boolean
  hideHeader?: boolean
  ariaLabel?: string
  /** Selector elemen yang difokuskan pertama kali. */
  initialFocus?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const panel = ref<HTMLElement | null>(null)
const uid = useId()
const titleId = `sheet-title-${uid}`
let lastFocused: HTMLElement | null = null
let locked = false

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function close() {
  if (!props.persistent) open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
    return
  }
  if (e.key !== 'Tab' || !panel.value) return
  const items = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!items.length) return
  const first = items[0]!
  const last = items[items.length - 1]!
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  open,
  async (v) => {
    if (v) {
      lastFocused = document.activeElement as HTMLElement | null
      if (!locked) {
        lockScroll()
        locked = true
      }
      await nextTick()
      const target =
        (props.initialFocus && panel.value?.querySelector<HTMLElement>(props.initialFocus)) ||
        panel.value?.querySelector<HTMLElement>(FOCUSABLE) ||
        panel.value
      target?.focus()
    } else {
      if (locked) {
        unlockScroll()
        locked = false
      }
      lastFocused?.focus?.()
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (locked) unlockScroll()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-[60] flex items-end justify-center" @keydown="onKeydown">
        <div class="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" aria-hidden="true" @click="close" />
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          :aria-labelledby="!hideHeader && title ? titleId : undefined"
          :aria-label="hideHeader || !title ? ariaLabel || title : undefined"
          class="sheet-panel relative max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-surface px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-pop outline-none"
        >
          <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line-strong" aria-hidden="true" />
          <div v-if="!hideHeader && title" class="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 :id="titleId" class="text-lg font-semibold text-fg">{{ title }}</h2>
              <p v-if="description" class="mt-0.5 text-sm text-fg-muted">{{ description }}</p>
            </div>
            <button
              type="button"
              class="pressable -mr-1 rounded-full p-2 text-fg-subtle hover:bg-surface-muted hover:text-fg"
              aria-label="Tutup"
              :disabled="persistent"
              @click="close"
            >
              <X :size="18" aria-hidden="true" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
