export interface ToastAction {
  label: string
  onAction: () => void
}

export interface ToastPayload {
  id: number
  message: string
  action?: ToastAction
}

type ToastListener = (payload: ToastPayload) => void

let nextToastId = 1
const listeners = new Set<ToastListener>()

/**
 * Publishes a floating Liquid Glass toast without triggering a re-render of App
 * or its heavy child lists. Supports an optional Undo action button.
 */
export function emitToast(message: string, action?: ToastAction): void {
  const payload: ToastPayload = { id: nextToastId++, message, action }
  for (const listener of listeners) {
    listener(payload)
  }
}

export function subscribeToast(listener: ToastListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
