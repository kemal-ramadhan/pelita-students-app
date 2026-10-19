import { ref } from 'vue'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  message?: string
  duration: number
}

const toasts = ref<ToastItem[]>([])
let seq = 0

function push(kind: ToastKind, title: string, message?: string, duration?: number) {
  const id = ++seq
  const item: ToastItem = { id, kind, title, message, duration: duration ?? (kind === 'error' ? 6000 : 4000) }
  toasts.value = [...toasts.value.slice(-4), item]
  return id
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export const toast = {
  success: (title: string, message?: string, duration?: number) => push('success', title, message, duration),
  error: (title: string, message?: string, duration?: number) => push('error', title, message, duration),
  warning: (title: string, message?: string, duration?: number) => push('warning', title, message, duration),
  info: (title: string, message?: string, duration?: number) => push('info', title, message, duration),
  dismiss,
}

export function useToast() {
  return toast
}

export function useToastState() {
  return { toasts, dismiss }
}
