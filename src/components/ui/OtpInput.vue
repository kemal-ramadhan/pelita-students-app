<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

const props = withDefaults(defineProps<{ length?: number; disabled?: boolean; invalid?: boolean; label?: string }>(), {
  length: 6,
  label: 'Kode OTP',
})
const model = defineModel<string>({ default: '' })
const emit = defineEmits<{ complete: [code: string] }>()

const inputs = ref<HTMLInputElement[]>([])
const digits = computed(() => Array.from({ length: props.length }, (_, i) => model.value[i] ?? ''))

function setDigits(arr: string[]) {
  model.value = arr.join('').slice(0, props.length)
  if (model.value.length === props.length && /^\d+$/.test(model.value)) emit('complete', model.value)
}

function focusAt(i: number) {
  const el = inputs.value[Math.max(0, Math.min(props.length - 1, i))]
  el?.focus()
  el?.select()
}

function onInput(i: number, e: Event) {
  const el = e.target as HTMLInputElement
  const clean = el.value.replace(/\D/g, '')
  if (!clean) {
    el.value = digits.value[i] ?? ''
    return
  }
  // Mendukung autofill/ketik beberapa digit sekaligus
  const arr = [...digits.value]
  for (let k = 0; k < clean.length && i + k < props.length; k++) arr[i + k] = clean[k]!
  el.value = arr[i] ?? ''
  setDigits(arr)
  nextTick(() => focusAt(Math.min(props.length - 1, i + clean.length)))
}

function onKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace') {
    e.preventDefault()
    const arr = [...digits.value]
    if (arr[i]) {
      arr[i] = ''
      model.value = arr.join('')
    } else if (i > 0) {
      arr[i - 1] = ''
      model.value = arr.join('')
      focusAt(i - 1)
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    focusAt(i - 1)
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    focusAt(i + 1)
  } else if (e.key === 'Home') {
    e.preventDefault()
    focusAt(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    focusAt(props.length - 1)
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? ''
  const clean = text.replace(/\D/g, '').slice(0, props.length)
  if (!clean) return
  e.preventDefault()
  setDigits(clean.split(''))
  nextTick(() => focusAt(Math.min(props.length - 1, clean.length)))
}

defineExpose({ focus: () => focusAt(Math.min(model.value.length, props.length - 1)) })
</script>

<template>
  <div role="group" :aria-label="label" class="flex justify-between gap-2 sm:gap-3">
    <input
      v-for="(d, i) in digits"
      :key="i"
      :ref="(el) => { if (el) inputs[i] = el as HTMLInputElement }"
      :value="d"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :autocomplete="i === 0 ? 'one-time-code' : 'off'"
      maxlength="6"
      :disabled="disabled"
      :aria-label="`Digit ${i + 1} dari ${length}`"
      :aria-invalid="invalid ? 'true' : undefined"
      class="control h-14 w-full min-w-0 max-w-14 text-center text-xl font-semibold tabular-nums caret-primary-500 sm:h-16 sm:text-2xl"
      :class="d ? 'border-primary-400 dark:border-primary-500/60' : ''"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @paste="onPaste"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>
