import { Delete, Lock, ShieldCheck, ShoppingBasket } from 'lucide-react'
import { useState } from 'react'

interface PinLockScreenProps {
  mode: 'onboarding' | 'unlock'
  onSetPin: (pin: string) => void
  onSkipPin: () => void
  onVerifyPin: (pin: string) => boolean
}

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

export function PinLockScreen({
  mode,
  onSetPin,
  onSkipPin,
  onVerifyPin,
}: PinLockScreenProps) {
  const [digits, setDigits] = useState('')
  const [firstPin, setFirstPin] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [shaking, setShaking] = useState(false)

  const triggerError = (msg: string) => {
    setErrorMsg(msg)
    setShaking(true)
    setTimeout(() => {
      setShaking(false)
      setDigits('')
    }, 360)
  }

  const handleDigit = (val: string) => {
    if (digits.length >= 4) return
    setErrorMsg('')
    const next = digits + val
    setDigits(next)

    if (next.length === 4) {
      if (mode === 'unlock') {
        const ok = onVerifyPin(next)
        if (!ok) {
          triggerError('PIN salah, coba lagi')
        }
      } else {
        // Onboarding 2-step confirmation
        if (!firstPin) {
          setTimeout(() => {
            setFirstPin(next)
            setDigits('')
          }, 120)
        } else if (next === firstPin) {
          setTimeout(() => onSetPin(next), 100)
        } else {
          setFirstPin(null)
          triggerError('PIN tidak cocok, ulangi dari awal')
        }
      }
    }
  }

  const handleBackspace = () => {
    setErrorMsg('')
    setDigits((prev) => prev.slice(0, -1))
  }

  const heading =
    mode === 'unlock'
      ? 'Masukkan PIN Belanja'
      : firstPin
        ? 'Konfirmasi PIN 4 Digit'
        : 'Buat PIN Privasi (Opsional)'

  const subheading =
    mode === 'unlock'
      ? 'Daftar belanjamu terlindungi secara lokal di perangkat ini.'
      : firstPin
        ? 'Ketik ulang 4 digit PIN yang sama untuk menyimpan.'
        : 'Kunci daftar belanja di HP bersama. Bisa diubah atau dimatikan kapan saja.'

  return (
    <div className="max-w-md mx-auto min-h-dvh bg-[#FAF9F6] shadow-xl shadow-stone-900/5 flex flex-col justify-between px-6 py-8">
      {/* Top Brand & Prompt */}
      <div className="pt-6 text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
          {mode === 'unlock' ? (
            <Lock className="w-7 h-7" />
          ) : (
            <ShoppingBasket className="w-8 h-8" />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>BelanjaSayang</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{heading}</h1>
          <p className="text-sm text-stone-500 max-w-xs mx-auto leading-relaxed">
            {subheading}
          </p>
        </div>

        {/* 4-Dot PIN Indicator */}
        <div
          className={`flex items-center justify-center gap-4 pt-3 ${
            shaking ? 'animate-shake' : ''
          }`}
        >
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length
            return (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-150 ${
                  filled
                    ? 'bg-emerald-600 scale-110'
                    : 'bg-stone-200 border border-stone-300'
                }`}
              />
            )
          })}
        </div>

        <p className="min-h-5 text-xs font-semibold text-rose-600">
          {errorMsg}
        </p>
      </div>

      {/* Numeric Keypad */}
      <div className="space-y-5 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {KEYPAD.map((key, idx) => {
            if (key === '') {
              return <div key={`empty-${idx}`} />
            }
            if (key === 'back') {
              return (
                <button
                  key="back"
                  type="button"
                  aria-label="Hapus digit"
                  onClick={handleBackspace}
                  className="min-h-14 rounded-2xl bg-stone-100 hover:bg-stone-200 active:scale-95 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
                >
                  <Delete className="w-6 h-6" />
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                data-testid={`pin-key-${key}`}
                onClick={() => handleDigit(key)}
                className="min-h-14 rounded-2xl bg-white border border-stone-200/90 hover:border-emerald-400 active:scale-95 active:bg-emerald-50 text-2xl font-bold text-slate-900 shadow-2xs transition-all cursor-pointer tabular-nums"
              >
                {key}
              </button>
            )
          })}
        </div>

        {mode === 'onboarding' && (
          <button
            type="button"
            data-testid="skip-pin-btn"
            onClick={onSkipPin}
            className="w-full min-h-12 rounded-2xl text-sm font-semibold text-stone-500 hover:text-slate-900 hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            Lewati, masuk tanpa PIN
          </button>
        )}
      </div>
    </div>
  )
}
