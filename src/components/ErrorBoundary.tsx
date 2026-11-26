import { RefreshCw, RotateCcw, ShoppingBasket } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Kesalahan tidak terduga',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('BelanjaSayang UI Error:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleResetLocalCache = () => {
    try {
      const keepPin = window.localStorage.getItem('belanjasayang:pin:v1')
      const keepSync = window.localStorage.getItem(
        'belanjasayang:sync-config:v1',
      )
      window.localStorage.clear()
      if (keepPin) window.localStorage.setItem('belanjasayang:pin:v1', keepPin)
      if (keepSync) {
        window.localStorage.setItem('belanjasayang:sync-config:v1', keepSync)
      }
    } catch {
      // Ignore storage errors
    }
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="liquid-shell w-full max-w-md mx-auto min-h-dvh flex items-center justify-center p-6 relative overflow-hidden">
        <div className="liquid-blob liquid-blob-1 w-64 h-64 -top-14 -left-16" />
        <div className="liquid-blob liquid-blob-2 w-72 h-72 top-44 -right-24" />
        <div className="relative z-10 glass-card rounded-3xl p-6 w-full text-center space-y-4">
          <div className="w-14 h-14 rounded-3xl bg-emerald-600/95 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-600/25">
            <ShoppingBasket className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-extrabold text-slate-900">
              Terjadi Gangguan Tampilan
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tenang, data belanjamu di cloud tetap aman. Muat ulang halaman
              untuk melanjutkan.
            </p>
            {this.state.errorMessage && (
              <p className="text-[11px] font-mono text-rose-600/80 pt-1 break-words">
                {this.state.errorMessage}
              </p>
            )}
          </div>
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center justify-center gap-2 liquid-press cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Aplikasi</span>
            </button>
            <button
              type="button"
              onClick={this.handleResetLocalCache}
              className="glass-chip w-full min-h-11 rounded-2xl text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Segarkan Cache Lokal</span>
            </button>
          </div>
        </div>
      </div>
    )
  }
}
