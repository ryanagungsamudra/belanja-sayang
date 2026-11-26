import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Lightbulb,
  Pencil,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react'
import { lazy, memo, Suspense, useMemo, useState } from 'react'
import {
  computeBudgetMonthSummary,
  getBudgetItemAllocation,
  getBudgetItemActual,
} from '../lib/budget'
import { formatRupiah } from '../lib/format'
import {
  formatCompactRupiahShort,
  formatMonthLabel,
  shiftMonthKey,
} from '../lib/noteParser'
import type {
  BudgetEnvelopeItem,
  BudgetMonthRecord,
  BudgetPillarConfig,
  BudgetTrackingBehavior,
  BudgetTrackingModeConfig,
} from '../types/market'

const BudgetRealisasiModal = lazy(() =>
  import('./BudgetModals').then((m) => ({ default: m.BudgetRealisasiModal })),
)
const BudgetEnvelopeModal = lazy(() =>
  import('./BudgetModals').then((m) => ({ default: m.BudgetEnvelopeModal })),
)
const BudgetIncomeModal = lazy(() =>
  import('./BudgetModals').then((m) => ({ default: m.BudgetIncomeModal })),
)
const BudgetConfigModal = lazy(() =>
  import('./BudgetModals').then((m) => ({ default: m.BudgetConfigModal })),
)
const BudgetAnnualModal = lazy(() =>
  import('./BudgetModals').then((m) => ({ default: m.BudgetAnnualModal })),
)
const BudgetDeleteMonthModal = lazy(() =>
  import('./BudgetModals').then((m) => ({
    default: m.BudgetDeleteMonthModal,
  })),
)

interface BudgetViewProps {
  selectedMonth: string
  pillars: BudgetPillarConfig[]
  modes: BudgetTrackingModeConfig[]
  budgetMonths: BudgetMonthRecord[]
  grocerySpendByMonth: Record<string, number>
  onChangeMonth: (monthKey: string) => void
  onSeedPreset: (monthKey: string) => void
  onCopyFromPrevious: (sourceMonthKey: string, targetMonthKey: string) => void
  onDeleteMonth: (monthKey: string) => void
  onTogglePayFirst: (monthKey: string) => void
  onToggleEfficiency: (
    monthKey: string,
    key: 'effIcloudFamily' | 'effBrightGas',
  ) => void
  onUpdateIncome: (
    monthKey: string,
    patch: {
      baseIncome: number
      extraIncome: number
      extraIncomeLabel?: string
      savingsRuleType: 'percent' | 'fixed'
      savingsRuleValue: number
      savingsStartingBalance: number
      savingsTargetYear: number
    },
  ) => void
  onToggleBillPaid: (monthKey: string, itemId: string) => void
  onStepCounter: (monthKey: string, itemId: string, delta: number) => void
  onQuickSpend: (monthKey: string, itemId: string, deltaAmount: number) => void
  onToggleSweep: (monthKey: string, itemId: string) => void
  onSaveRealisasi: (
    monthKey: string,
    itemId: string,
    patch: { actual: number; count?: number; paid?: boolean; note?: string },
  ) => void
  onUpsertEnvelope: (
    monthKey: string,
    input: {
      id?: string
      pillarId: string
      modeId: string
      name: string
      budget: number
      actual?: number
      targetCount?: number
      count?: number
      unitPrice?: number
      unitLabel?: string
      isRecurring?: boolean
      note?: string
    },
  ) => void
  onDeleteEnvelope: (monthKey: string, itemId: string) => void
  onSavePillar: (input: { id?: string; name: string; color: string }) => void
  onDeletePillar: (id: string) => void
  onSaveMode: (input: {
    id?: string
    label: string
    desc?: string
    behavior: BudgetTrackingBehavior
    stepAmount?: number
    unitLabel?: string
  }) => void
  onDeleteMode: (id: string) => void
  onGoToCatatan: () => void
}

export const BudgetView = memo(function BudgetView({
  selectedMonth,
  pillars,
  modes,
  budgetMonths,
  grocerySpendByMonth,
  onChangeMonth,
  onSeedPreset,
  onCopyFromPrevious,
  onDeleteMonth,
  onTogglePayFirst,
  onToggleEfficiency,
  onUpdateIncome,
  onToggleBillPaid,
  onStepCounter,
  onQuickSpend,
  onToggleSweep,
  onSaveRealisasi,
  onUpsertEnvelope,
  onDeleteEnvelope,
  onSavePillar,
  onDeletePillar,
  onSaveMode,
  onDeleteMode,
  onGoToCatatan,
}: BudgetViewProps) {
  const [editPlanMode, setEditPlanMode] = useState(false)
  const [privacyMasked, setPrivacyMasked] = useState(false)
  const [collapsedPillars, setCollapsedPillars] = useState<
    Record<string, boolean>
  >({})

  const [realisasiItem, setRealisasiItem] = useState<BudgetEnvelopeItem | null>(
    null,
  )
  const [envelopeModalOpen, setEnvelopeModalOpen] = useState(false)
  const [editingEnvelope, setEditingEnvelope] =
    useState<BudgetEnvelopeItem | null>(null)
  const [incomeModalOpen, setIncomeModalOpen] = useState(false)
  const [configModalTab, setConfigModalTab] = useState<
    'pillars' | 'modes' | null
  >(null)
  const [annualModalOpen, setAnnualModalOpen] = useState(false)
  const [deleteMonthModalOpen, setDeleteMonthModalOpen] = useState(false)

  const monthRecord = useMemo(
    () => budgetMonths.find((m) => m.monthKey === selectedMonth) ?? null,
    [budgetMonths, selectedMonth],
  )

  const nearestPreviousMonth = useMemo(() => {
    const candidates = budgetMonths
      .filter((m) => m.monthKey < selectedMonth)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    if (candidates.length > 0) return candidates[0]
    const fallback = budgetMonths
      .filter((m) => m.monthKey !== selectedMonth)
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    return fallback[0] ?? null
  }, [budgetMonths, selectedMonth])

  const grocerySpendThisMonth = grocerySpendByMonth[selectedMonth] ?? 0

  const modeMap = useMemo(() => {
    const map = new Map<string, BudgetTrackingModeConfig>()
    for (const m of modes) map.set(m.id, m)
    return map
  }, [modes])

  const summary = useMemo(() => {
    if (!monthRecord) return null
    return computeBudgetMonthSummary(monthRecord, modes, grocerySpendThisMonth)
  }, [grocerySpendThisMonth, modes, monthRecord])

  const cumulativeYearSavings = useMemo(() => {
    const yearPrefix = selectedMonth.slice(0, 4) + '-'
    let sum = 0
    let startingBalance = monthRecord?.savingsStartingBalance ?? 0
    for (const m of budgetMonths) {
      if (!m.monthKey.startsWith(yearPrefix)) continue
      const s = computeBudgetMonthSummary(
        m,
        modes,
        grocerySpendByMonth[m.monthKey] ?? 0,
      )
      sum += s.realizedMonthlySavings
      if ((m.savingsStartingBalance ?? 0) > startingBalance) {
        startingBalance = m.savingsStartingBalance ?? 0
      }
    }
    return startingBalance + sum
  }, [budgetMonths, grocerySpendByMonth, modes, monthRecord, selectedMonth])

  const fmtVal = (amount: number) =>
    privacyMasked ? 'Rp ••••••' : formatRupiah(amount)
  const fmtShort = (amount: number) =>
    privacyMasked ? '•••' : formatCompactRupiahShort(amount) || '0'

  const togglePillarCollapse = (pid: string) => {
    setCollapsedPillars((prev) => ({ ...prev, [pid]: !prev[pid] }))
  }

  return (
    <div className="space-y-3">
      {/* Top Toolbar: Month Picker, Privacy Mask & Track vs. Atur Plan Toggle */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            aria-label="Bulan sebelumnya"
            onClick={() => onChangeMonth(shiftMonthKey(selectedMonth, -1))}
            className="glass-chip w-7 h-7 rounded-xl text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            data-testid="budget-month-pill"
            onClick={() => setAnnualModalOpen(true)}
            className="glass-chip min-h-7 px-2 rounded-xl inline-flex items-center gap-1 text-[12.5px] font-extrabold text-slate-900 hover:text-emerald-700 capitalize whitespace-nowrap truncate cursor-pointer"
          >
            <CalendarDays className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">{formatMonthLabel(selectedMonth)}</span>
            <ChevronDown className="w-3 h-3 text-emerald-600 shrink-0 opacity-80" />
          </button>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => onChangeMonth(shiftMonthKey(selectedMonth, 1))}
            className="glass-chip w-7 h-7 rounded-xl text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={
              privacyMasked ? 'Tampilkan nominal' : 'Sembunyikan nominal'
            }
            title={privacyMasked ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
            onClick={() => setPrivacyMasked((p) => !p)}
            className="glass-chip w-8 h-8 rounded-xl text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer"
          >
            {privacyMasked ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>

          {monthRecord && (
            <button
              type="button"
              data-testid="budget-edit-mode-toggle"
              onClick={() => setEditPlanMode((p) => !p)}
              className={`min-h-8 px-2.5 rounded-xl text-[11px] font-extrabold inline-flex items-center gap-1 liquid-press cursor-pointer border ${
                editPlanMode
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'glass-chip text-slate-700 hover:border-emerald-400'
              }`}
            >
              {editPlanMode ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Selesai</span>
                </>
              ) : (
                <>
                  <Pencil className="w-3 h-3" />
                  <span>Atur</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Empty Month State — Carry-Over or Seed Pedoman Rumah Tangga Preset */}
      {!monthRecord || !summary ? (
        <section
          aria-label="Inisialisasi Anggaran Bulanan"
          className="glass-card rounded-3xl p-5 space-y-3.5 animate-liquid-enter"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50/95 text-emerald-600 flex items-center justify-center border border-emerald-200/70 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-slate-900 capitalize">
                Anggaran {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-xs text-slate-500">
                Mulai dari pedoman rumah tangga atau salin rencana bulan lalu
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {nearestPreviousMonth && (
              <button
                type="button"
                data-testid="budget-copy-prev-btn"
                onClick={() =>
                  onCopyFromPrevious(nearestPreviousMonth.monthKey, selectedMonth)
                }
                className="w-full min-h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm liquid-press cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>
                  Salin Rencana{' '}
                  {formatMonthLabel(nearestPreviousMonth.monthKey)}
                </span>
              </button>
            )}

            <button
              type="button"
              data-testid="budget-seed-preset-btn"
              onClick={() => onSeedPreset(selectedMonth)}
              className={`w-full min-h-11 px-4 rounded-2xl text-xs font-extrabold flex items-center justify-center gap-2 liquid-press cursor-pointer ${
                nearestPreviousMonth
                  ? 'glass-chip text-emerald-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Terapkan Pedoman Rumah Tangga (Rp 10jt)</span>
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* Admin Action Bar (Visible ONLY in Explicit Atur Plan Mode) */}
          {editPlanMode && (
            <div
              data-testid="budget-admin-bar"
              className="glass-card rounded-2xl p-2 space-y-2 animate-liquid-panel"
            >
              <div className="flex items-center justify-between gap-2 px-1">
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 min-w-0 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">
                    Atur · {formatMonthLabel(selectedMonth)}
                  </span>
                </span>
                <button
                  type="button"
                  data-testid="delete-budget-month-btn"
                  aria-label={`Hapus anggaran ${formatMonthLabel(selectedMonth)}`}
                  onClick={() => setDeleteMonthModalOpen(true)}
                  className="min-h-7 px-2.5 rounded-xl bg-rose-500/8 hover:bg-rose-500/15 border border-rose-300/60 text-rose-600 hover:text-rose-700 text-[10.5px] font-bold inline-flex items-center gap-1 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] liquid-press cursor-pointer"
                >
                  <Trash2 className="w-3 h-3 shrink-0" />
                  <span>Hapus Bulan</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  data-testid="budget-open-income-btn"
                  onClick={() => setIncomeModalOpen(true)}
                  className="glass-chip min-h-9 px-2 rounded-xl text-[11px] font-bold text-slate-700 hover:text-emerald-700 inline-flex items-center justify-center gap-1 liquid-press cursor-pointer"
                >
                  <Pencil className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Pemasukan</span>
                </button>
                <button
                  type="button"
                  data-testid="budget-open-config-btn"
                  onClick={() => setConfigModalTab('pillars')}
                  className="glass-chip min-h-9 px-2 rounded-xl text-[11px] font-bold text-slate-700 hover:text-emerald-700 inline-flex items-center justify-center gap-1 liquid-press cursor-pointer"
                >
                  <SlidersHorizontal className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">Pilar &amp; Mode</span>
                </button>
                <button
                  type="button"
                  data-testid="budget-add-env-btn"
                  onClick={() => {
                    setEditingEnvelope(null)
                    setEnvelopeModalOpen(true)
                  }}
                  className="min-h-9 px-2 rounded-xl bg-gradient-to-b from-emerald-500/95 to-emerald-600/95 hover:from-emerald-600 hover:to-emerald-700 text-white text-[11px] font-extrabold inline-flex items-center justify-center gap-1 border border-white/35 shadow-[0_4px_12px_-3px_rgba(5,150,105,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] liquid-press cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Pos Baru</span>
                </button>
              </div>
            </div>
          )}

          {/* Macro Cashflow Card + Pay Yourself First */}
          <section
            aria-label="Ringkasan Arus Kas Bulanan"
            className="glass-card rounded-3xl p-3.5 space-y-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                disabled={!editPlanMode}
                onClick={() => editPlanMode && setIncomeModalOpen(true)}
                className={`text-left min-w-0 ${editPlanMode ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
                  Pemasukan Bersih
                  {monthRecord.extraIncome > 0
                    ? ` + ${monthRecord.extraIncomeLabel || 'Bonus'}`
                    : ''}
                  {editPlanMode && (
                    <span className="text-emerald-600 ml-1">✎</span>
                  )}
                </p>
                <p className="text-base font-extrabold text-slate-900 tabular-nums">
                  {fmtVal(summary.totalIncome)}
                </p>
              </button>

              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Tabungan
                  {summary.savingsRuleType === 'percent'
                    ? ` (${summary.savingsRuleValue}%)`
                    : ''}
                </p>
                <p className="text-sm font-extrabold text-emerald-700 tabular-nums">
                  {fmtVal(summary.monthlySavingsTotal)}
                </p>
                {summary.sweepSavingsBonus > 0 && (
                  <p className="text-[9.5px] font-bold text-emerald-600 tabular-nums">
                    +{fmtShort(summary.sweepSavingsBonus)} Sweep
                  </p>
                )}
              </div>
            </div>

            {/* Unallocated Cash Headroom OR Savings Breach Warning */}
            {summary.unallocatedCash !== 0 && (
              <div
                className={`rounded-xl px-2.5 py-1.5 text-[11px] font-bold flex items-center justify-between gap-2 ${
                  summary.isSavingsBreached
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-emerald-50/75 border border-emerald-200/70 text-emerald-800'
                }`}
              >
                <span>
                  {summary.isSavingsBreached
                    ? 'Alokasi melebihi batas tabungan'
                    : 'Sisa Bebas (Belum Dialokasikan)'}
                </span>
                <span className="font-extrabold tabular-nums">
                  {summary.isSavingsBreached
                    ? `-${fmtVal(Math.abs(summary.unallocatedCash))}`
                    : fmtVal(summary.unallocatedCash)}
                </span>
              </div>
            )}

            {/* Realisasi vs Target Bar */}
            <div className="glass-chip rounded-2xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-slate-600">
                  Terpakai{' '}
                  <strong className="text-slate-900 tabular-nums">
                    {fmtVal(summary.totalSpent)}
                  </strong>
                </span>
                <span className="font-bold text-stone-400 tabular-nums">
                  Maks {fmtShort(summary.totalAllocation)} ({summary.burnPct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900/8 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    summary.totalSpent > summary.totalAllocation
                      ? 'bg-rose-500'
                      : summary.burnPct >= 85
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                  }`}
                  style={{ width: `${Math.min(100, summary.burnPct)}%` }}
                />
              </div>
            </div>

            {/* Rule #4 Pay Yourself First Toggle + Year-1 Goal Progress */}
            <div className="flex items-center justify-between gap-2 text-[11px] pt-0.5">
              <span className="text-stone-500 tabular-nums truncate">
                Dana 1 Thn:{' '}
                <strong className="text-slate-800">
                  {fmtShort(cumulativeYearSavings)}
                </strong>{' '}
                / {fmtShort(monthRecord.savingsTargetYear)}
              </span>
              <button
                type="button"
                data-testid="budget-pay-first-btn"
                onClick={() => onTogglePayFirst(selectedMonth)}
                className={`px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold shrink-0 liquid-press cursor-pointer border ${
                  monthRecord.payFirstDone
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-amber-50 border-amber-300 text-amber-800'
                }`}
              >
                {monthRecord.payFirstDone
                  ? 'Pay First ✓'
                  : 'Sisihkan Tabungan'}
              </button>
            </div>
          </section>

          {/* Dynamic Pillar Cards (Strictly Separated Track vs. Atur Mode!) */}
          {pillars.map((pillar) => {
            const pillarItems = monthRecord.items.filter(
              (i) => i.pillarId === pillar.id,
            )
            if (pillarItems.length === 0 && !editPlanMode) return null

            const pAlloc = pillarItems.reduce(
              (sum, i) =>
                sum + getBudgetItemAllocation(i, modes, monthRecord),
              0,
            )
            const pSpent = pillarItems.reduce(
              (sum, i) =>
                sum + getBudgetItemActual(i, modes, grocerySpendThisMonth),
              0,
            )
            const isOpen = !collapsedPillars[pillar.id]

            return (
              <section
                key={pillar.id}
                className="glass-card rounded-3xl glass-divide overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => togglePillarCollapse(pillar.id)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left hover:bg-white/40 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: pillar.color }}
                      />
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {pillar.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 tabular-nums mt-0.5">
                      {fmtVal(pSpent)} / {fmtVal(pAlloc)}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isOpen &&
                  (pillarItems.length === 0 ? (
                    <div className="px-3.5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEnvelope(null)
                          setEnvelopeModalOpen(true)
                        }}
                        className="text-xs font-bold text-emerald-700 cursor-pointer"
                      >
                        + Tambah Pos di Pilar Ini
                      </button>
                    </div>
                  ) : (
                    pillarItems.map((item) => {
                      const mode =
                        modeMap.get(item.modeId) ?? modes[0]
                      const alloc = getBudgetItemAllocation(
                        item,
                        modes,
                        monthRecord,
                      )
                      const actual = getBudgetItemActual(
                        item,
                        modes,
                        grocerySpendThisMonth,
                      )
                      const behavior = mode?.behavior ?? 'bill'
                      const isOver = actual > alloc && alloc > 0
                      const billSavings =
                        behavior === 'bill' && item.paid
                          ? alloc - actual
                          : 0

                      return (
                        <div
                          key={item.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-2.5"
                        >
                          {/* Row Info: Track Mode -> Realisasi | Atur Mode -> Edit Structure */}
                          <button
                            type="button"
                            onClick={() => {
                              if (editPlanMode) {
                                setEditingEnvelope(item)
                                setEnvelopeModalOpen(true)
                              } else if (
                                behavior === 'auto' ||
                                item.autoLink === 'grocery'
                              ) {
                                onGoToCatatan()
                              } else {
                                setRealisasiItem(item)
                              }
                            }}
                            className="flex-1 min-w-0 text-left cursor-pointer group"
                          >
                            <p className="text-[13px] font-bold text-slate-900 group-hover:text-emerald-700 truncate flex items-center gap-1.5">
                              <span className="truncate">{item.name}</span>
                              {item.isRecurring === false && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[9.5px] font-extrabold shrink-0">
                                  Sekali
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-stone-500 tabular-nums truncate">
                              <strong
                                className={
                                  isOver
                                    ? 'text-rose-600'
                                    : 'text-slate-700'
                                }
                              >
                                {fmtVal(actual)}
                              </strong>{' '}
                              / {fmtShort(alloc)}
                              {billSavings > 0 && (
                                <span className="text-emerald-700 font-bold">
                                  {' '}
                                  · hemat {fmtShort(billSavings)}
                                </span>
                              )}
                              {behavior === 'auto' && !editPlanMode && (
                                <span className="text-emerald-700 font-bold">
                                  {' '}
                                  · dari Catatan
                                </span>
                              )}
                            </p>
                          </button>

                          {/* Right Control: Strictly separated by Track vs. Atur Mode */}
                          {editPlanMode ? (
                            <button
                              type="button"
                              aria-label={`Edit struktur ${item.name}`}
                              onClick={() => {
                                setEditingEnvelope(item)
                                setEnvelopeModalOpen(true)
                              }}
                              className="glass-chip min-h-8 px-2.5 rounded-xl text-[11px] font-bold text-slate-700 hover:text-emerald-700 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                          ) : behavior === 'bill' ? (
                            <button
                              type="button"
                              data-testid={`budget-bill-${item.id}`}
                              onClick={() =>
                                onToggleBillPaid(selectedMonth, item.id)
                              }
                              className={`min-h-8 px-2.5 rounded-xl text-[11px] font-extrabold border shrink-0 liquid-press cursor-pointer ${
                                item.paid
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                  : 'glass-chip text-slate-700 hover:border-emerald-400'
                              }`}
                            >
                              {item.paid ? 'Lunas ✓' : 'Bayar'}
                            </button>
                          ) : behavior === 'counter' ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                aria-label={`Kurangi ${item.name}`}
                                onClick={() =>
                                  onStepCounter(selectedMonth, item.id, -1)
                                }
                                className="w-7 h-7 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 font-extrabold text-sm cursor-pointer"
                              >
                                −
                              </button>
                              <span className="min-w-[38px] text-center text-[11px] font-extrabold text-slate-800 tabular-nums">
                                {item.count || 0}/{item.targetCount || 1}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name}`}
                                onClick={() =>
                                  onStepCounter(selectedMonth, item.id, 1)
                                }
                                className="w-7 h-7 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm liquid-press cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          ) : behavior === 'auto' ||
                            item.autoLink === 'grocery' ? (
                            <button
                              type="button"
                              onClick={onGoToCatatan}
                              className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10.5px] font-extrabold shrink-0 cursor-pointer"
                            >
                              Catatan →
                            </button>
                          ) : behavior === 'sweep' ? (
                            <button
                              type="button"
                              data-testid={`budget-sweep-${item.id}`}
                              disabled={(item.actual || 0) > 0}
                              onClick={() =>
                                onToggleSweep(selectedMonth, item.id)
                              }
                              className={`min-h-8 px-2.5 rounded-xl text-[10.5px] font-extrabold border shrink-0 liquid-press cursor-pointer disabled:opacity-50 ${
                                item.swept && (item.actual || 0) === 0
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-amber-50 border-amber-300 text-amber-800'
                              }`}
                            >
                              {item.swept && (item.actual || 0) === 0
                                ? 'Disapu ✓'
                                : 'Sweep'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onQuickSpend(
                                  selectedMonth,
                                  item.id,
                                  mode?.stepAmount || 50000,
                                )
                              }
                              className="glass-chip min-h-8 px-2.5 rounded-xl text-[11px] font-extrabold text-slate-700 hover:text-emerald-700 shrink-0 cursor-pointer tabular-nums"
                            >
                              +{fmtShort(mode?.stepAmount || 50000)}
                            </button>
                          )}
                        </div>
                      )
                    })
                  ))}
              </section>
            )
          })}

          {/* PDF Page-2 Efficiency Opportunities */}
          <section className="glass-card rounded-3xl p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-800 inline-flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span>Opsi Efisiensi Bulanan</span>
              </span>
              {(monthRecord.effIcloudFamily || monthRecord.effBrightGas) && (
                <span className="text-[11px] font-extrabold text-emerald-700 tabular-nums">
                  Hemat{' '}
                  {fmtVal(
                    (monthRecord.effIcloudFamily ? 59000 : 0) +
                      (monthRecord.effBrightGas ? 85000 : 0),
                  )}
                </span>
              )}
            </div>
            <label className="glass-chip rounded-2xl px-3 py-2 flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700">
                iCloud Family Sharing{' '}
                <span className="text-emerald-700">(-59rb/bln)</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(monthRecord.effIcloudFamily)}
                onChange={() =>
                  onToggleEfficiency(selectedMonth, 'effIcloudFamily')
                }
                className="accent-emerald-600 w-4 h-4 cursor-pointer"
              />
            </label>
            <label className="glass-chip rounded-2xl px-3 py-2 flex items-center justify-between gap-2 cursor-pointer">
              <span className="text-xs font-bold text-slate-700">
                Konversi Bright Gas 5,5kg{' '}
                <span className="text-emerald-700">(-85rb/bln)</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(monthRecord.effBrightGas)}
                onChange={() =>
                  onToggleEfficiency(selectedMonth, 'effBrightGas')
                }
                className="accent-emerald-600 w-4 h-4 cursor-pointer"
              />
            </label>
          </section>
        </>
      )}

      {/* Lazy Modals */}
      <Suspense fallback={null}>
        {realisasiItem && monthRecord && (
          <BudgetRealisasiModal
            key={realisasiItem.id}
            item={realisasiItem}
            mode={modeMap.get(realisasiItem.modeId) ?? modes[0]}
            month={monthRecord}
            onClose={() => setRealisasiItem(null)}
            onSave={(patch) =>
              onSaveRealisasi(selectedMonth, realisasiItem.id, patch)
            }
          />
        )}

        {envelopeModalOpen && (
          <BudgetEnvelopeModal
            key={editingEnvelope?.id ?? 'new-env'}
            editingItem={editingEnvelope}
            pillars={pillars}
            modes={modes}
            onClose={() => setEnvelopeModalOpen(false)}
            onOpenConfig={(tab) => {
              setEnvelopeModalOpen(false)
              setConfigModalTab(tab)
            }}
            onSave={(input) => onUpsertEnvelope(selectedMonth, input)}
            onDelete={(itemId) => onDeleteEnvelope(selectedMonth, itemId)}
          />
        )}

        {incomeModalOpen && monthRecord && (
          <BudgetIncomeModal
            key={`income-${monthRecord.monthKey}`}
            month={monthRecord}
            onClose={() => setIncomeModalOpen(false)}
            onSave={(patch) => onUpdateIncome(selectedMonth, patch)}
          />
        )}

        {configModalTab && (
          <BudgetConfigModal
            key={`cfg-${configModalTab}`}
            initialTab={configModalTab}
            pillars={pillars}
            modes={modes}
            onClose={() => setConfigModalTab(null)}
            onSavePillar={onSavePillar}
            onDeletePillar={onDeletePillar}
            onSaveMode={onSaveMode}
            onDeleteMode={onDeleteMode}
          />
        )}

        {annualModalOpen && (
          <BudgetAnnualModal
            selectedMonth={selectedMonth}
            budgetMonths={budgetMonths}
            modes={modes}
            grocerySpendByMonth={grocerySpendByMonth}
            privacyMasked={privacyMasked}
            onClose={() => setAnnualModalOpen(false)}
            onSelectMonth={onChangeMonth}
          />
        )}

        {deleteMonthModalOpen && monthRecord && (
          <BudgetDeleteMonthModal
            monthKey={selectedMonth}
            itemCount={monthRecord.items.length}
            onClose={() => setDeleteMonthModalOpen(false)}
            onConfirm={() => {
              onDeleteMonth(selectedMonth)
              setEditPlanMode(false)
            }}
          />
        )}
      </Suspense>
    </div>
  )
})
