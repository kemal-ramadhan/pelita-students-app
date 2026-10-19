<script setup lang="ts">
import { computed, type Component } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { LoaderCircle } from 'lucide-vue-next'

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'danger-soft'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    loading?: boolean
    block?: boolean
    /** Ikon (komponen lucide) di kiri teks. */
    icon?: Component
    /** Ikon di kanan teks. */
    iconRight?: Component
    /** Tombol ikon persegi (wajib beri aria-label). */
    iconOnly?: boolean
    to?: RouteLocationRaw
    href?: string
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const variants: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white shadow-sm shadow-primary-600/20 hover:bg-primary-700 active:bg-primary-800 dark:bg-primary-500 dark:hover:bg-primary-400 dark:text-white',
  secondary:
    'bg-surface text-fg border border-line-strong shadow-xs hover:bg-surface-hover hover:border-primary-400 active:bg-surface-muted',
  ghost: 'text-fg-muted hover:bg-surface-muted hover:text-fg active:bg-surface-muted',
  soft: 'bg-accent-soft text-accent hover:bg-primary-100 dark:hover:bg-primary-500/25',
  danger: 'bg-red-600 text-white shadow-sm shadow-red-600/20 hover:bg-red-700 active:bg-red-800',
  'danger-soft':
    'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 active:bg-red-100',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
}

const iconSizes: Record<Size, string> = { sm: 'h-8 w-8 rounded-lg', md: 'h-10 w-10 rounded-[10px]', lg: 'h-12 w-12 rounded-xl' }
const iconPx: Record<Size, number> = { sm: 15, md: 17, lg: 18 }

const isDisabled = computed(() => props.disabled || props.loading)

const classes = computed(() => [
  'relative inline-flex select-none items-center justify-center font-medium whitespace-nowrap',
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out',
  'focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98]',
  'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55',
  variants[props.variant],
  props.iconOnly ? iconSizes[props.size] : sizes[props.size],
  props.block ? 'w-full' : '',
])

const tag = computed(() => (props.to ? RouterLink : props.href ? 'a' : 'button'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    :href="href"
    :type="!to && !href ? type : undefined"
    :disabled="!to && !href ? isDisabled : undefined"
    :aria-disabled="(to || href) && isDisabled ? 'true' : undefined"
    :aria-busy="loading || undefined"
    :class="classes"
  >
    <LoaderCircle v-if="loading" :size="iconPx[size]" class="animate-spin" aria-hidden="true" />
    <component :is="icon" v-else-if="icon" :size="iconPx[size]" aria-hidden="true" class="shrink-0" />
    <span v-if="$slots.default && !iconOnly" class="truncate"><slot /></span>
    <span v-else-if="$slots.default" class="sr-only"><slot /></span>
    <component :is="iconRight" v-if="iconRight && !loading" :size="iconPx[size]" aria-hidden="true" class="shrink-0" />
  </component>
</template>
