import { RefreshCw, Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Listens for a newly installed PWA Service Worker waiting to activate or
 * already updated in the background, and displays a centered Liquid Glass
 * pop-up modal with a 1-tap reload trigger.
 */
export function PwaUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(false)
  const [dismissed, setDismissed] = useState(false)

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
      setDismissed(false)
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
            setDismissed(false)
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

  if (!updateReady || dismissed) return null

  const modalNode = (
    <div
      className="fixed inset-0 h-dvh z-50 flex items-center justify-center p-5 bg-slate-900/40 backdrop-blur-[5px] animate-fade-in overscroll-contain"
      onClick={() => setDismissed(true)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pembaruan Aplikasi Tersedia"
        onClick={(e) => e.stopPropagation()}
        className="glass-card w-full max-w-xs rounded-3xl p-5 text-center space-y-4 animate-liquid-pop relative"
      >
        <button
          type="button"
          aria-label="Tutup pemberitahuan"
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/70 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-emerald-600/95 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/25 border border-white/40">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-slate-900">
            Pembaruan Tersedia
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Versi terbaru <b>BelanjaSayang</b> sudah siap dengan peningkatan
            terbaru.
          </p>
        </div>

        <div className="space-y-2 pt-0.5">
          <button
            type="button"
            data-testid="pwa-reload-btn"
            onClick={() => window.location.reload()}
            className="w-full min-h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/25 border border-white/30 liquid-press cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Muat Ulang Sekarang</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="glass-chip w-full min-h-10 rounded-2xl text-slate-600 text-xs font-bold cursor-pointer"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : modalNode
}
