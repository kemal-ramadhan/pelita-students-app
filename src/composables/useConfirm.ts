import { reactive } from 'vue'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** `danger` untuk tindakan yang menghapus data; `warning` untuk tindakan berisiko yang dapat diulang. */
  tone?: 'primary' | 'warning' | 'danger'
  /** Jika diisi, dialog menampilkan loading sampai promise selesai. */
  onConfirm?: () => Promise<void> | void
}

interface ConfirmState {
  open: boolean
  loading: boolean
  options: ConfirmOptions
  resolve: ((value: boolean) => void) | null
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  loading: false,
  options: { title: '' },
  resolve: null,
})

export function settleConfirm(value: boolean) {
  const resolve = confirmState.resolve
  confirmState.open = false
  confirmState.loading = false
  confirmState.resolve = null
  resolve?.(value)
}

export async function acceptConfirm() {
  const action = confirmState.options.onConfirm
  if (!action) return settleConfirm(true)
  confirmState.loading = true
  try {
    await action()
    settleConfirm(true)
  } catch {
    settleConfirm(false)
  }
}

/** Dialog konfirmasi berbasis promise: `if (await confirm({...})) {...}` */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (confirmState.resolve) settleConfirm(false)
  confirmState.options = options
  confirmState.open = true
  return new Promise<boolean>((resolve) => {
    confirmState.resolve = resolve
  })
}

export function useConfirm() {
  return confirm
}
