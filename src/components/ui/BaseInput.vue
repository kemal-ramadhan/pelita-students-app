<script setup lang="ts">
import { computed, ref, useAttrs, useId, type Component } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    label?: string
    hint?: string
    error?: string
    type?: string
    as?: 'input' | 'textarea'
    rows?: number
    required?: boolean
    /** Ikon di kiri (komponen lucide). */
    icon?: Component
    /** Teks prefix statis, mis. "https://" */
    prefix?: string
    suffix?: string
    id?: string
  }>(),
  { type: 'text', as: 'input', rows: 3 },
)

const model = defineModel<string | number | null>()
const attrs = useAttrs()
const autoId = useId()
const inputId = computed(() => props.id || `in-${autoId}`)
const descId = computed(() => `${inputId.value}-desc`)

const showPassword = ref(false)
const actualType = computed(() => (props.type === 'password' && showPassword.value ? 'text' : props.type))

const passthrough = computed(() => {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(attrs)) if (k !== 'class' && k !== 'style') out[k] = v
  return out
})

const padLeft = computed(() => (props.icon ? 'pl-10' : props.prefix ? 'pl-[4.5rem]' : 'pl-3.5'))
const padRight = computed(() => (props.type === 'password' ? 'pr-11' : props.suffix ? 'pr-16' : 'pr-3.5'))
</script>

<template>
  <div class="flex w-full flex-col gap-1.5" :class="attrs.class as string" :style="attrs.style as string">
    <div v-if="label || $slots['label-right']" class="flex items-center justify-between gap-2">
      <span v-if="label" class="flex items-center gap-1.5">
        <label :for="inputId" class="text-sm font-medium text-fg">
          {{ label }}<span v-if="required" class="ml-0.5 text-red-500" aria-hidden="true">*</span>
        </label>
      </span>
      <slot name="label-right" />
    </div>

    <div class="relative">
      <component
        :is="icon"
        v-if="icon"
        :size="17"
        class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        aria-hidden="true"
      />
      <span
        v-else-if="prefix"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center rounded-l-[10px] border-r border-line bg-surface-muted px-3 text-xs text-fg-subtle"
        >{{ prefix }}</span
      >

      <textarea
        v-if="as === 'textarea'"
        :id="inputId"
        v-bind="passthrough"
        v-model="model"
        :rows="rows"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? descId : undefined"
        class="control resize-y px-3.5 py-2.5 text-base sm:text-sm"
      />
      <input
        v-else
        :id="inputId"
        v-bind="passthrough"
        v-model="model"
        :type="actualType"
        :required="required"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? descId : undefined"
        class="control h-12 text-base sm:h-11 sm:text-sm"
        :class="[padLeft, padRight]"
      />

      <span
        v-if="suffix && type !== 'password'"
        class="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-fg-subtle"
        >{{ suffix }}</span
      >
      <button
        v-if="type === 'password'"
        type="button"
        class="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-subtle transition-colors duration-150 hover:bg-surface-muted hover:text-fg"
        :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
        :aria-pressed="showPassword"
        @click="showPassword = !showPassword"
      >
        <EyeOff v-if="showPassword" :size="17" aria-hidden="true" />
        <Eye v-else :size="17" aria-hidden="true" />
      </button>
    </div>

    <p v-if="error" :id="descId" class="text-xs font-medium text-red-600 dark:text-red-400" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="descId" class="text-xs text-fg-subtle">{{ hint }}</p>
    <slot name="below" />
  </div>
</template>
