import { RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'

/**
 * Listens for a newly installed PWA Service Worker waiting to activate or
 * already updated in the background, offering a 1-tap frosted reload pill.
 */
export function PwaUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      import.meta.env.DEV
    ) {
      return
    }

    let refreshing = false
    const onControllerChange = () => {
      if (refreshing) return
      setUpdateReady(true)
    }

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      onControllerChange,
    )

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return
      if (reg.waiting) {
        setUpdateReady(true)
      }
      reg.addEventListener('updatefound', () => {
        const nextWorker = reg.installing
        if (!nextWorker) return
        nextWorker.addEventListener('statechange', () => {
          if (
            nextWorker.state === 'installed' &&
            navigator.serviceWorker.controller
          ) {
            setUpdateReady(true)
          }
        })
      })
    })

    return () => {
      refreshing = true
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      )
    }
  }, [])

  if (!updateReady) return null

  return (
    <div className="px-3.5 pt-2 relative z-20 animate-liquid-panel">
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="glass-pill w-full min-h-10 px-3.5 rounded-2xl text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 cursor-pointer"
      >
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Versi baru BelanjaSayang siap dipakai</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-extrabold shrink-0">
          <RefreshCw className="w-3 h-3" />
          <span>Muat Ulang</span>
        </span>
      </button>
    </div>
  )
}
