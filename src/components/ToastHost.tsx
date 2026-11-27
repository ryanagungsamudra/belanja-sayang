import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useVisualViewport } from '../hooks/useVisualViewport'
import { subscribeToast, type ToastPayload } from '../lib/toastBus'

export function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null)
  const timerRef = useRef<number | null>(null)
  const vp = useVisualViewport(Boolean(toast))

  useEffect(() => {
    const unsubscribe = subscribeToast((payload) => {
      setToast(payload)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      const duration = payload.action ? 4600 : 2500
      timerRef.current = window.setTimeout(() => {
        setToast(null)
      }, duration)
    })

    return () => {
      unsubscribe()
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (!toast) return null

  const keyboardAwareStyle = vp.keyboardOpen
    ? {
        bottom: `${vp.keyboardBottomOffset > 0 ? vp.keyboardBottomOffset + 14 : 16}px`,
      }
    : undefined

  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      style={keyboardAwareStyle}
      className="liquid-toast fixed bottom-28 left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100%-2rem)] pl-4 pr-2.5 py-2 rounded-full text-white text-xs font-semibold animate-liquid-pop flex items-center gap-2.5"
    >
      <span className="truncate">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          data-testid="toast-undo-btn"
          onClick={() => {
            const act = toast.action
            if (timerRef.current) window.clearTimeout(timerRef.current)
            setToast(null)
            act?.onAction()
          }}
          className="px-2.5 py-1 rounded-full bg-emerald-500/95 hover:bg-emerald-400 text-white text-[11px] font-extrabold inline-flex items-center gap-1 shrink-0 liquid-press cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{toast.action.label}</span>
        </button>
      )}
    </div>
  )
}
