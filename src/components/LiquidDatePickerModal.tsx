import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatRupiah } from '../lib/format'
import {
  formatCompactRupiahShort,
  formatFullDateLabel,
  formatMonthLabel,
  formatPurchaseChip,
  getTodayDateKey,
  resolvePurchaseDateKey,
  shiftMonthKey,
} from '../lib/noteParser'
import { getTintedPillStyle } from '../lib/stores'
import type { MonthlyPurchaseEntry, StoreConfig } from '../types/market'
import { GlassSheetModal } from './GlassSheetModal'
import { LiquidSegmentedTabs } from './LiquidSegmentedTabs'

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

interface LiquidDatePickerModalProps {
  isOpen: boolean
  selectedMonth: string
  activeDateFilter: string | null
  allPurchases: MonthlyPurchaseEntry[]
  stores: StoreConfig[]
  onClose: () => void
  onSelectMonthOnly: (monthKey: string) => void
  onSelectDateFilter: (monthKey: string, dateKey: string) => void
  onInspectPurchase?: (entry: MonthlyPurchaseEntry) => void
}

export function LiquidDatePickerModal({
  isOpen,
  selectedMonth,
  activeDateFilter,
  allPurchases,
  stores,
  onClose,
  onSelectMonthOnly,
  onSelectDateFilter,
  onInspectPurchase,
}: LiquidDatePickerModalProps) {
  const [todayKey] = useState<string>(() => getTodayDateKey())
  const todayYear = Number(todayKey.slice(0, 4)) || 2026
  const [mode, setMode] = useState<'calendar' | 'month'>('calendar')
  const [viewMonth, setViewMonth] = useState<string>(selectedMonth)
  const [viewYear, setViewYear] = useState<number>(
    () => Number(selectedMonth.split('-')[0]) || todayYear,
  )

  const storeMap = useMemo(() => {
    const map = new Map<string, StoreConfig>()
    for (const s of stores) map.set(s.id, s)
    return map
  }, [stores])

  // Group all entries by YYYY-MM-DD and by YYYY-MM in one fast pass
  const { entriesByDate, spendByMonth } = useMemo(() => {
    const byDate = new Map<string, MonthlyPurchaseEntry[]>()
    const byMonth = new Map<string, number>()

    for (const entry of allPurchases) {
      const dKey = resolvePurchaseDateKey(entry)
      const list = byDate.get(dKey) ?? []
      list.push(entry)
      byDate.set(dKey, list)

      byMonth.set(
        entry.monthKey,
        (byMonth.get(entry.monthKey) ?? 0) + (entry.price || 0),
      )
    }
    return { entriesByDate: byDate, spendByMonth: byMonth }
  }, [allPurchases])

  const defaultPreviewDate = useMemo(() => {
    if (activeDateFilter && activeDateFilter.startsWith(selectedMonth)) {
      return activeDateFilter
    }
    if (todayKey.startsWith(selectedMonth) && entriesByDate.has(todayKey)) {
      return todayKey
    }
    let latestInMonth: string | null = null
    for (const dateKey of entriesByDate.keys()) {
      if (
        dateKey.startsWith(selectedMonth) &&
        (!latestInMonth || dateKey > latestInMonth)
      ) {
        latestInMonth = dateKey
      }
    }
    return (
      latestInMonth ??
      (todayKey.startsWith(selectedMonth) ? todayKey : `${selectedMonth}-01`)
    )
  }, [activeDateFilter, entriesByDate, selectedMonth, todayKey])

  const [previewDate, setPreviewDate] = useState<string>(defaultPreviewDate)

  const handleShiftViewMonth = (delta: number) => {
    const nextMonth = shiftMonthKey(viewMonth, delta)
    setViewMonth(nextMonth)
    setViewYear(Number(nextMonth.split('-')[0]) || viewYear)
    let latest: string | null = null
    for (const dk of entriesByDate.keys()) {
      if (dk.startsWith(nextMonth) && (!latest || dk > latest)) {
        latest = dk
      }
    }
    setPreviewDate(
      latest ?? (todayKey.startsWith(nextMonth) ? todayKey : `${nextMonth}-01`),
    )
  }

  const handleJumpToday = () => {
    const todayMonth = todayKey.slice(0, 7)
    setViewMonth(todayMonth)
    setViewYear(Number(todayMonth.split('-')[0]))
    setPreviewDate(todayKey)
  }

  const handlePickMonthFromGrid = (monthIndex: number) => {
    const nextMonth = `${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`
    setViewMonth(nextMonth)
    let latest: string | null = null
    for (const dk of entriesByDate.keys()) {
      if (dk.startsWith(nextMonth) && (!latest || dk > latest)) {
        latest = dk
      }
    }
    setPreviewDate(
      latest ?? (todayKey.startsWith(nextMonth) ? todayKey : `${nextMonth}-01`),
    )
    setMode('calendar')
  }

  const [yearNum, monthNum] = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number)
    return [y || todayYear, m || 1]
  }, [todayYear, viewMonth])

  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(yearNum, monthNum - 1, 1).getDay()
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate()
    const cells: Array<
      | { empty: true; key: string }
      | {
          empty: false
          key: string
          day: number
          dateKey: string
          total: number
          storeColors: string[]
          count: number
        }
    > = []

    for (let i = 0; i < firstWeekday; i++) {
      cells.push({ empty: true, key: `pad-${i}` })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const dayEntries = entriesByDate.get(dateKey) ?? []
      let total = 0
      const seenColors = new Set<string>()
      for (const e of dayEntries) {
        total += e.price || 0
        const col = storeMap.get(e.store)?.color ?? '#059669'
        seenColors.add(col)
      }
      cells.push({
        empty: false,
        key: dateKey,
        day: d,
        dateKey,
        total,
        storeColors: Array.from(seenColors).slice(0, 3),
        count: dayEntries.length,
      })
    }

    return cells
  }, [entriesByDate, monthNum, storeMap, yearNum])

  const previewEntries = useMemo(
    () => entriesByDate.get(previewDate) ?? [],
    [entriesByDate, previewDate],
  )

  const { previewTotal, previewStoreBreakdown } = useMemo(() => {
    let total = 0
    const byStore = new Map<string, number>()
    for (const e of previewEntries) {
      total += e.price || 0
      byStore.set(e.store, (byStore.get(e.store) ?? 0) + (e.price || 0))
    }
    const breakdown = Array.from(byStore.entries())
      .map(([storeId, sum]) => ({
        storeId,
        cfg: storeMap.get(storeId),
        sum,
      }))
      .sort((a, b) => b.sum - a.sum)
    return { previewTotal: total, previewStoreBreakdown: breakdown }
  }, [previewEntries, storeMap])

  if (!isOpen) return null

  return (
    <GlassSheetModal
      ariaLabel="Kalender Belanja dan Ringkasan Harian"
      maxHeightClass="max-h-[90dvh]"
      onClose={onClose}
    >
      {/* Frosted Sheet Header */}
      <div className="px-4 pt-1 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <CalendarDays className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900 truncate">
              Kalender Belanja
            </h2>
            <p className="text-[11px] text-stone-500 truncate">
              Ketuk tanggal untuk rincian bayar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <LiquidSegmentedTabs
            ariaLabel="Mode Kalender"
            size="sm"
            className="w-[136px]"
            value={mode}
            onChange={setMode}
            options={[
              { id: 'calendar', label: 'Kalender', testId: 'dp-mode-calendar' },
              { id: 'month', label: 'Bulan', testId: 'dp-mode-month' },
            ]}
          />
          <button
            type="button"
            aria-label="Tutup kalender"
            onClick={onClose}
            className="min-w-9 min-h-9 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {mode === 'calendar' ? (
          <>
            {/* Month Navigation Row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Bulan sebelumnya"
                  onClick={() => handleShiftViewMonth(-1)}
                  className="glass-chip w-8 h-8 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span
                  data-testid="dp-view-month-label"
                  className="text-sm font-extrabold text-slate-900 capitalize px-1"
                >
                  {formatMonthLabel(viewMonth)}
                </span>
                <button
                  type="button"
                  aria-label="Bulan berikutnya"
                  onClick={() => handleShiftViewMonth(1)}
                  className="glass-chip w-8 h-8 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                data-testid="dp-today-btn"
                onClick={handleJumpToday}
                className="glass-chip px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-emerald-700 cursor-pointer"
              >
                Hari ini
              </button>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">
              {WEEKDAYS_ID.map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            {/* 7-Column Liquid Glass Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell) => {
                if (cell.empty) {
                  return <div key={cell.key} />
                }
                const isSelected = previewDate === cell.dateKey
                const isToday = cell.dateKey === todayKey
                const hasPurchases = cell.count > 0

                return (
                  <button
                    key={cell.key}
                    type="button"
                    data-testid={`dp-day-${cell.dateKey}`}
                    aria-pressed={isSelected}
                    onClick={() => setPreviewDate(cell.dateKey)}
                    className={`min-h-[48px] rounded-2xl py-1 px-0.5 flex flex-col items-center justify-center liquid-press cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-300/60'
                        : hasPurchases
                          ? 'glass-chip text-slate-900 hover:bg-emerald-50/80'
                          : isToday
                            ? 'border border-dashed border-emerald-500 bg-emerald-50/45 text-emerald-700'
                            : 'text-slate-500 hover:bg-white/70'
                    }`}
                  >
                    <span className="text-[12px] font-extrabold leading-none tabular-nums">
                      {cell.day}
                    </span>
                    {hasPurchases ? (
                      <>
                        <span
                          className={`text-[9px] font-extrabold tabular-nums mt-0.5 leading-none ${
                            isSelected ? 'text-emerald-100' : 'text-emerald-700'
                          }`}
                        >
                          {cell.total > 0
                            ? formatCompactRupiahShort(cell.total)
                            : `${cell.count}x`}
                        </span>
                        <span className="flex items-center gap-0.5 mt-0.5">
                          {cell.storeColors.map((col) => (
                            <span
                              key={col}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{
                                backgroundColor: isSelected ? '#ffffff' : col,
                              }}
                            />
                          ))}
                        </span>
                      </>
                    ) : isToday ? (
                      <span className="text-[8.5px] font-bold mt-1 leading-none">
                        Hari ini
                      </span>
                    ) : (
                      <span className="h-[14px]" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Selected Shopping Day Payment Summary Card */}
            <div
              data-testid="dp-day-summary"
              className="glass-chip rounded-2xl p-3.5 space-y-2.5 animate-liquid-panel"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                    Ringkasan Pembayaran
                  </p>
                  <p className="text-xs font-extrabold text-slate-900 capitalize truncate">
                    {formatFullDateLabel(previewDate)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-emerald-700 tabular-nums">
                    {formatRupiah(previewTotal)}
                  </p>
                  <p className="text-[10px] font-semibold text-stone-400 tabular-nums">
                    {previewEntries.length} transaksi
                  </p>
                </div>
              </div>

              {previewEntries.length > 0 ? (
                <>
                  {/* Per-Store Breakdown Pills */}
                  {previewStoreBreakdown.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {previewStoreBreakdown.map(({ storeId, cfg, sum }) => (
                        <span
                          key={storeId}
                          className="px-2 py-0.5 rounded-lg text-[10.5px] font-extrabold border tabular-nums"
                          style={getTintedPillStyle(cfg?.color ?? '#059669')}
                        >
                          {cfg?.shortLabel ?? storeId} · {formatRupiah(sum)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Compact Scrollable Itemized Receipt */}
                  <div className="max-h-[150px] overflow-y-auto no-scrollbar divide-y divide-slate-900/6 border-t border-slate-900/6 pt-1">
                    {previewEntries.map((entry) => {
                      const cfg = storeMap.get(entry.store)
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            if (onInspectPurchase) {
                              onClose()
                              onInspectPurchase(entry)
                            }
                          }}
                          className="w-full py-1.5 flex items-center justify-between gap-2 text-left text-xs hover:bg-white/60 rounded-lg px-1 cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: cfg?.color ?? '#059669',
                              }}
                            />
                            <span className="font-semibold text-slate-800 truncate">
                              {entry.productName}
                            </span>
                            <span className="text-[10px] font-bold text-stone-400 shrink-0">
                              {formatPurchaseChip(entry, stores)}
                            </span>
                          </span>
                          <span className="font-extrabold text-slate-900 tabular-nums shrink-0">
                            {entry.price > 0
                              ? formatRupiah(entry.price)
                              : 'Rp ?'}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Apply Actions */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      data-testid="dp-apply-month-btn"
                      onClick={() => {
                        onSelectMonthOnly(viewMonth)
                        onClose()
                      }}
                      className="min-h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Tampilkan 1 Bulan
                    </button>
                    <button
                      type="button"
                      data-testid="dp-apply-date-btn"
                      onClick={() => {
                        onSelectDateFilter(viewMonth, previewDate)
                        onClose()
                      }}
                      className="min-h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/25 cursor-pointer"
                    >
                      Filter ke Tgl Ini
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-stone-400 py-0.5">
                    <ReceiptText className="w-4 h-4 shrink-0 opacity-70" />
                    <span>
                      Belum ada transaksi belanja pada tanggal ini. Pilih
                      tanggal bertanda nominal hijau.
                    </span>
                  </div>
                  {viewMonth !== selectedMonth || activeDateFilter ? (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectMonthOnly(viewMonth)
                        onClose()
                      }}
                      className="w-full min-h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Buka Bulan {formatMonthLabel(viewMonth)}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Month / Year Quick-Jump Grid */
          <div className="space-y-3 animate-liquid-panel">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Tahun sebelumnya"
                onClick={() => setViewYear((y) => y - 1)}
                className="glass-chip w-9 h-9 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-base font-extrabold text-slate-900 tabular-nums">
                {viewYear}
              </span>
              <button
                type="button"
                aria-label="Tahun berikutnya"
                onClick={() => setViewYear((y) => y + 1)}
                className="glass-chip w-9 h-9 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {MONTHS_SHORT_ID.map((label, idx) => {
                const ym = `${viewYear}-${String(idx + 1).padStart(2, '0')}`
                const monthSpend = spendByMonth.get(ym) ?? 0
                const isSelected = viewMonth === ym
                return (
                  <button
                    key={ym}
                    type="button"
                    data-testid={`dp-month-${ym}`}
                    onClick={() => handlePickMonthFromGrid(idx)}
                    className={`rounded-2xl p-2.5 text-center liquid-press cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                        : monthSpend > 0
                          ? 'glass-chip text-slate-900 hover:bg-emerald-50/80'
                          : 'bg-white/50 text-slate-400 border border-white/75 hover:bg-white/80'
                    }`}
                  >
                    <div className="text-xs font-extrabold">{label}</div>
                    <div
                      className={`text-[10px] font-bold tabular-nums mt-0.5 ${
                        isSelected
                          ? 'text-emerald-100'
                          : monthSpend > 0
                            ? 'text-emerald-700'
                            : 'text-slate-300'
                      }`}
                    >
                      {monthSpend > 0
                        ? formatCompactRupiahShort(monthSpend)
                        : '—'}
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onSelectMonthOnly(viewMonth)
                onClose()
              }}
              className="w-full min-h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              Tampilkan {formatMonthLabel(viewMonth)}
            </button>
          </div>
        )}
      </div>
    </GlassSheetModal>
  )
}
