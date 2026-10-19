<script setup lang="ts">
import { computed } from 'vue'
import { Check } from 'lucide-vue-next'
import type { AnswerValue, AttemptQuestion } from '@/types/assessment'
import type { ChoiceItem } from '@/utils/assessment'

const props = defineProps<{
  question: AttemptQuestion
  number: number
  choices: ChoiceItem[]
  modelValue?: AnswerValue
  disabled?: boolean
  /** Belum dijawab menurut server (422 INCOMPLETE). */
  missing?: boolean
  /** 0 = normal, 1 = besar, 2 = sangat besar. */
  fontLevel: number
}>()
const emit = defineEmits<{ answer: [value: AnswerValue, viaPointer: boolean] }>()

const TEXT = ['text-[17px] leading-relaxed', 'text-xl leading-relaxed', 'text-2xl leading-snug']
const OPT = ['text-[15px]', 'text-[17px]', 'text-xl']

const isGrid = computed(() => props.question.type === 'boolean')
const name = computed(() => `q-${props.question.id}`)
let pointer = false

function onChange(v: AnswerValue) {
  emit('answer', v, pointer)
  pointer = false
}
</script>

<template>
  <fieldset
    :id="`item-${question.id}`"
    class="card scroll-mt-32 p-4"
    :class="missing ? 'ring-2 ring-amber-400 dark:ring-amber-500/70' : ''"
    :disabled="disabled"
    :aria-describedby="missing ? `${name}-missing` : undefined"
  >
    <legend class="sr-only">Pertanyaan {{ number }}: {{ question.text }}</legend>
    <p class="text-xs font-semibold uppercase tracking-wide text-fg-subtle" aria-hidden="true">
      Pertanyaan {{ number }}
    </p>
    <p class="mt-1 font-medium text-fg" :class="TEXT[fontLevel]" aria-hidden="true">
      {{ question.text }}
    </p>
    <p
      v-if="missing"
      :id="`${name}-missing`"
      class="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300"
    >
      Pertanyaan ini belum dijawab.
    </p>

    <div class="mt-4 gap-2" :class="isGrid ? 'grid grid-cols-2' : 'flex flex-col'">
      <label
        v-for="c in choices"
        :key="String(c.value)"
        class="pressable flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-fg transition-colors hover:border-primary-400 has-[:checked]:border-primary-600 has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--ring)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 dark:has-[:checked]:border-primary-400"
        :class="[OPT[fontLevel], isGrid ? 'justify-center text-center font-semibold' : '']"
        @pointerdown="pointer = true"
      >
        <input
          type="radio"
          class="sr-only"
          :name="name"
          :value="c.value"
          :checked="modelValue === c.value"
          :disabled="disabled"
          @change="onChange(c.value)"
        />
        <span
          v-if="c.badge && !isGrid"
          class="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted px-1 text-xs font-bold text-fg-muted"
          :class="modelValue === c.value ? '!border-primary-600 !bg-primary-600 !text-white' : ''"
          aria-hidden="true"
          >{{ c.badge }}</span
        >
        <span class="min-w-0 flex-1">{{ c.label }}</span>
        <Check
          v-if="modelValue === c.value && !isGrid"
          :size="18"
          class="shrink-0"
          aria-hidden="true"
        />
      </label>
    </div>
  </fieldset>
</template>
