import { RefreshCw, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Listens for a newly installed PWA Service Worker waiting to activate or
 * already updated in the background, and displays a centered Liquid Glass
 * pop-up modal with a 1-tap reload trigger.
 */
export function PwaUpdateBanner() {
  const [updateReady, setUpdateReady] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('previewUpdate') === '1',
  )
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onPreviewEvent = () => {
      setUpdateReady(true)
      setDismissed(false)
    }
    window.addEventListener('belanjasayang:preview-pwa-update', onPreviewEvent)

    if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
      return () => {
        window.removeEventListener(
          'belanjasayang:preview-pwa-update',
          onPreviewEvent,
        )
      }
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
      window.removeEventListener(
        'belanjasayang:preview-pwa-update',
        onPreviewEvent,
      )
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        onControllerChange,
      )
    }
  }, [])

  if (!updateReady || dismissed) return null

  const modalNode = (
    <div
      className="fixed inset-0 h-dvh z-50 flex items-center justify-center p-6 bg-slate-900/45 backdrop-blur-[8px] animate-fade-in overscroll-contain"
      onClick={() => setDismissed(true)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pembaruan Aplikasi Tersedia"
        onClick={(e) => e.stopPropagation()}
        className="w-[calc(100%-2rem)] max-w-[300px] max-h-[80dvh] overflow-y-auto rounded-[28px] p-5 text-center space-y-3.5 animate-liquid-pop relative bg-[rgba(250,252,251,0.92)] backdrop-blur-2xl border border-white shadow-[0_24px_64px_-12px_rgba(15,23,42,0.38),0_0_0_0.5px_rgba(15,23,42,0.08),inset_0_1.5px_1px_rgba(255,255,255,1)]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-44 h-24 rounded-full bg-emerald-400/20 blur-2xl"
        />

        <div className="relative flex flex-col items-center gap-2.5">
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 text-white flex items-center justify-center border border-white/50 shadow-[0_12px_26px_-6px_rgba(5,150,105,0.42),inset_0_1.5px_1px_rgba(255,255,255,0.65)]">
            <Sparkles className="w-6 h-6" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/12 border border-emerald-500/25 text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Versi Baru Siap
          </span>
        </div>

        <div className="relative space-y-1.5">
          <h2 className="text-[17px] font-extrabold text-slate-900 tracking-tight">
            Pembaruan BelanjaSayang
          </h2>
          <p className="text-[13px] font-medium text-slate-700 leading-relaxed">
            Pembaruan aplikasi sudah siap dipakai. Muat ulang sekarang agar
            perubahan terbaru aktif.
          </p>
        </div>

        <div className="relative space-y-2 pt-1">
          <button
            type="button"
            data-testid="pwa-reload-btn"
            onClick={() => window.location.reload()}
            className="w-full min-h-12 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white text-[13px] font-extrabold inline-flex items-center justify-center gap-2 border border-white/45 shadow-[0_10px_24px_-6px_rgba(5,150,105,0.45),inset_0_1.5px_1px_rgba(255,255,255,0.55)] liquid-press cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Muat Ulang Sekarang</span>
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full min-h-10 rounded-2xl bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 text-xs font-bold border border-slate-200/80 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.95)] liquid-press cursor-pointer"
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
