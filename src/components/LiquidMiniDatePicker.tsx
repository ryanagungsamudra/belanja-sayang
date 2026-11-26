import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { triggerHaptic } from '../lib/format'
import {
  formatFullDateLabel,
  formatMonthLabel,
  getTodayDateKey,
  isValidDateKey,
  shiftMonthKey,
} from '../lib/noteParser'

const WEEKDAYS_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'] as const
const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const

interface LiquidMiniDatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (dateKey: string) => void
  testId?: string
}

/**
 * Minimalist Liquid Glass inline datepicker (no item/receipt details).
 * Uses .glass-chip inside modals to stay 100% flicker-free on iOS Safari PWAs.
 */
export function LiquidMiniDatePicker({
  value,
  onChange,
  testId = 'purchase-date-input',
}: LiquidMiniDatePickerProps) {
  const [todayKey] = useState<string>(() => getTodayDateKey())
  const safeValue = isValidDateKey(value) ? value : todayKey
  const todayYear = Number(todayKey.slice(0, 4)) || 2026

  const [isOpen, setIsOpen] = useState(false)
  const [pickingMonth, setPickingMonth] = useState(false)
  const [viewMonth, setViewMonth] = useState<string>(() => safeValue.slice(0, 7))
  const [viewYear, setViewYear] = useState<number>(
    () => Number(safeValue.slice(0, 4)) || todayYear,
  )

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        setViewMonth(safeValue.slice(0, 7))
        setViewYear(Number(safeValue.slice(0, 4)) || todayYear)
        setPickingMonth(false)
      }
      return next
    })
  }

  const [yearNum, monthNum] = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number)
    return [y || todayYear, m || 1]
  }, [todayYear, viewMonth])

  const cells = useMemo(() => {
    const firstWeekday = new Date(yearNum, monthNum - 1, 1).getDay()
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
    const list: Array<{ empty: true; key: string } | { empty: false; key: string; day: number; dateKey: string }> = []

    for (let i = 0; i < firstWeekday; i++) {
      list.push({ empty: true, key: `pad-${i}` })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      list.push({ empty: false, key: dateKey, day: d, dateKey })
    }
    return list
  }, [monthNum, yearNum])

  const handleSelectDate = (dateKey: string) => {
    triggerHaptic(8)
    onChange(dateKey)
    setViewMonth(dateKey.slice(0, 7))
    setIsOpen(false)
    setPickingMonth(false)
  }

  const isTodaySelected = safeValue === todayKey

  return (
    <div className="space-y-2">
      {/* Minimal Trigger Pill */}
      <button
        type="button"
        data-testid={testId}
        aria-expanded={isOpen}
        onClick={handleToggleOpen}
        className={`w-full min-h-11 px-3.5 rounded-xl bg-white border flex items-center justify-between gap-2 text-left transition-colors liquid-press cursor-pointer ${
          isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20'
            : 'border-stone-300 hover:border-emerald-500'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-bold text-slate-900 capitalize truncate">
            {formatFullDateLabel(safeValue)}
          </span>
          {isTodaySelected && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold shrink-0">
              Hari ini
            </span>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            isOpen ? 'rotate-180 text-emerald-600' : ''
          }`}
        />
      </button>

      {/* Inline Minimalist Liquid Glass Calendar */}
      {isOpen && (
        <div
          data-testid="mini-datepicker-panel"
          className="glass-chip rounded-2xl p-3 space-y-2.5 animate-liquid-panel"
        >
          {!pickingMonth ? (
            <>
              {/* Month Nav + Quick Today */}
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Bulan sebelumnya"
                    onClick={() => {
                      const next = shiftMonthKey(viewMonth, -1)
                      setViewMonth(next)
                      setViewYear(Number(next.slice(0, 4)) || viewYear)
                    }}
                    className="w-7 h-7 rounded-xl bg-white/90 border border-stone-200/80 text-slate-700 flex items-center justify-center liquid-press cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPickingMonth(true)}
                    className="min-h-7 px-2 rounded-xl hover:bg-white/80 inline-flex items-center gap-1 text-xs font-extrabold text-slate-900 capitalize cursor-pointer"
                  >
                    <span>{formatMonthLabel(viewMonth)}</span>
                    <ChevronDown className="w-3 h-3 text-emerald-600" />
                  </button>
                  <button
                    type="button"
                    aria-label="Bulan berikutnya"
                    onClick={() => {
                      const next = shiftMonthKey(viewMonth, 1)
                      setViewMonth(next)
                      setViewYear(Number(next.slice(0, 4)) || viewYear)
                    }}
                    className="w-7 h-7 rounded-xl bg-white/90 border border-stone-200/80 text-slate-700 flex items-center justify-center liquid-press cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleSelectDate(todayKey)}
                  className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold liquid-press cursor-pointer"
                >
                  Hari ini
                </button>
              </div>

              {/* Weekday Labels */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-stone-400 uppercase">
                {WEEKDAYS_ID.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              {/* Clean Minimalist 7-Column Day Grid */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell) => {
                  if (cell.empty) return <div key={cell.key} />
                  const isSelected = safeValue === cell.dateKey
                  const isToday = todayKey === cell.dateKey
                  return (
                    <button
                      key={cell.key}
                      type="button"
                      data-testid={`mini-dp-day-${cell.dateKey}`}
                      aria-pressed={isSelected}
                      onClick={() => handleSelectDate(cell.dateKey)}
                      className={`h-9 rounded-xl text-xs font-bold tabular-nums flex items-center justify-center liquid-press cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-300/60'
                          : isToday
                            ? 'border border-dashed border-emerald-500 bg-emerald-50/60 text-emerald-700 font-extrabold'
                            : 'text-slate-700 hover:bg-white/90'
                      }`}
                    >
                      {cell.day}
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            /* Compact Month / Year Jump Grid */
            <div className="space-y-2.5 animate-liquid-panel">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Tahun sebelumnya"
                  onClick={() => setViewYear((y) => y - 1)}
                  className="w-8 h-8 rounded-xl bg-white/90 border border-stone-200/80 text-slate-700 flex items-center justify-center liquid-press cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-extrabold text-slate-900 tabular-nums">
                  {viewYear}
                </span>
                <button
                  type="button"
                  aria-label="Tahun berikutnya"
                  onClick={() => setViewYear((y) => y + 1)}
                  className="w-8 h-8 rounded-xl bg-white/90 border border-stone-200/80 text-slate-700 flex items-center justify-center liquid-press cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {MONTHS_SHORT_ID.map((label, idx) => {
                  const ym = `${viewYear}-${String(idx + 1).padStart(2, '0')}`
                  const active = viewMonth === ym
                  return (
                    <button
                      key={ym}
                      type="button"
                      onClick={() => {
                        setViewMonth(ym)
                        setPickingMonth(false)
                      }}
                      className={`h-9 rounded-xl text-xs font-extrabold liquid-press cursor-pointer ${
                        active
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                          : 'bg-white/85 text-slate-700 hover:bg-emerald-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
