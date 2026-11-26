import { Lock, LockOpen, ShieldCheck, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'

interface PinSettingsModalProps {
  isOpen: boolean
  pinEnabled: boolean
  onClose: () => void
  onSetPin: (pin: string) => void
  onDisablePin: () => void
  onLockNow: () => void
}

export function PinSettingsModal({
  isOpen,
  pinEnabled,
  onClose,
  onSetPin,
  onDisablePin,
  onLockNow,
}: PinSettingsModalProps) {
  const [newPin, setNewPin] = useState('')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSavePin = (e: FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN harus tepat 4 digit angka.')
      return
    }
    onSetPin(newPin)
    setNewPin('')
    setError('')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pengaturan Privasi & PIN"
        onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full max-w-md rounded-t-3xl overflow-hidden animate-slide-up"
      >
        <div className="px-5 pt-4 pb-3 bg-white/60 backdrop-blur-md border-b border-white/70 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Privasi & Kunci PIN
              </h2>
              <p className="text-xs text-stone-500">
                PIN yang sama berlaku di semua HP & browser yang terhubung
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="min-w-12 min-h-12 rounded-2xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Current Status Card */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${pinEnabled
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-500'
                  }`}
              >
                {pinEnabled ? (
                  <Lock className="w-5 h-5" />
                ) : (
                  <LockOpen className="w-5 h-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {pinEnabled ? 'Kunci PIN Aktif' : 'Kunci PIN Nonaktif'}
                </p>
                <p className="text-xs text-stone-500">
                  {pinEnabled
                    ? 'Meminta 4 digit PIN saat aplikasi dibuka'
                    : 'Langsung masuk ke daftar belanja'}
                </p>
              </div>
            </div>
          </div>

          {pinEnabled && (
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onLockNow()
                }}
                className="min-h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Kunci Sekarang</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onDisablePin()
                  onClose()
                }}
                className="min-h-12 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-bold cursor-pointer"
              >
                Matikan PIN
              </button>
            </div>
          )}

          {/* Set or Change PIN Form */}
          <form
            onSubmit={handleSavePin}
            className="bg-white rounded-2xl border border-stone-200/90 p-4 space-y-3"
          >
            <label className="block text-xs font-bold text-stone-500 uppercase tracking-wide">
              {pinEnabled ? 'Ganti PIN 4 Digit' : 'Aktifkan PIN 4 Digit'}
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => {
                setError('')
                setNewPin(e.target.value.replace(/[^\d]/g, '').slice(0, 4))
              }}
              placeholder="••••"
              className="w-full min-h-12 px-4 rounded-xl bg-stone-50 border border-stone-300 focus:border-emerald-600 focus:bg-white text-center text-xl font-bold tracking-[0.6em] text-slate-900 outline-none"
            />
            {error && (
              <p className="text-xs font-semibold text-rose-600">{error}</p>
            )}
            <button
              type="submit"
              className="w-full min-h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors cursor-pointer"
            >
              {pinEnabled ? 'Simpan PIN Baru' : 'Aktifkan Kunci PIN'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
