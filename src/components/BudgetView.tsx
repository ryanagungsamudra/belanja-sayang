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
import { BudgetHeroCard } from './BudgetHeroCard'
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
            className="glass-chip w-10 h-10 rounded-xl text-slate-700 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-testid="budget-month-pill"
            onClick={() => setAnnualModalOpen(true)}
            className="glass-chip min-h-10 px-2.5 rounded-xl inline-flex items-center gap-1.5 text-[13px] font-bold text-slate-900 hover:text-emerald-700 capitalize whitespace-nowrap truncate cursor-pointer"
          >
            <CalendarDays
              className="w-3.5 h-3.5 text-emerald-700 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{formatMonthLabel(selectedMonth)}</span>
            <ChevronDown
              className="w-3.5 h-3.5 text-slate-500 shrink-0"
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            aria-label="Bulan berikutnya"
            onClick={() => onChangeMonth(shiftMonthKey(selectedMonth, 1))}
            className="glass-chip w-10 h-10 rounded-xl text-slate-700 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label={
              privacyMasked ? 'Tampilkan nominal' : 'Sembunyikan nominal'
            }
            title={privacyMasked ? 'Tampilkan nominal' : 'Sembunyikan nominal'}
            onClick={() => setPrivacyMasked((p) => !p)}
            className="glass-chip w-10 h-10 rounded-xl text-slate-700 hover:text-slate-900 flex items-center justify-center cursor-pointer"
          >
            {privacyMasked ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {monthRecord && (
            <button
              type="button"
              data-testid="budget-edit-mode-toggle"
              onClick={() => setEditPlanMode((p) => !p)}
              className={`min-h-10 px-3 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 liquid-press cursor-pointer border ${
                editPlanMode
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'glass-chip text-slate-800 hover:border-emerald-500'
              }`}
            >
              {editPlanMode ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Selesai</span>
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
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
          className="glass-card rounded-2xl p-5 space-y-3.5 animate-liquid-enter"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50/95 text-emerald-600 flex items-center justify-center border border-emerald-200/70 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold tracking-[-0.015em] text-slate-900 capitalize">
                Anggaran {formatMonthLabel(selectedMonth)}
              </h2>
              <p className="text-xs font-medium text-slate-600 mt-0.5">
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
                className="w-full min-h-11 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm liquid-press cursor-pointer"
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
              className={`w-full min-h-11 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 liquid-press cursor-pointer ${
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
          {/* Compact Single-Row Atur Strip (Replaces bloated multi-row admin card) */}
          {editPlanMode && (
            <div
              data-testid="budget-admin-bar"
              className="flex items-center gap-1.5 animate-liquid-panel"
            >
              <button
                type="button"
                data-testid="budget-open-income-btn"
                onClick={() => setIncomeModalOpen(true)}
                className="glass-chip flex-1 min-w-0 min-h-11 px-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:text-emerald-700 inline-flex items-center justify-center gap-1.5 liquid-press cursor-pointer"
              >
                <Pencil
                  className="w-3.5 h-3.5 text-emerald-700 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">Pemasukan</span>
              </button>
              <button
                type="button"
                data-testid="budget-open-config-btn"
                onClick={() => setConfigModalTab('pillars')}
                className="glass-chip flex-1 min-w-0 min-h-11 px-2.5 rounded-xl text-xs font-semibold text-slate-800 hover:text-emerald-700 inline-flex items-center justify-center gap-1.5 liquid-press cursor-pointer"
              >
                <SlidersHorizontal
                  className="w-3.5 h-3.5 text-emerald-700 shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">Pilar &amp; Mode</span>
              </button>
              <button
                type="button"
                data-testid="budget-add-env-btn"
                onClick={() => {
                  setEditingEnvelope(null)
                  setEnvelopeModalOpen(true)
                }}
                className="min-h-11 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1 shrink-0 shadow-xs liquid-press cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Pos</span>
              </button>
              <button
                type="button"
                data-testid="delete-budget-month-btn"
                aria-label={`Hapus anggaran ${formatMonthLabel(selectedMonth)}`}
                title={`Hapus anggaran ${formatMonthLabel(selectedMonth)}`}
                onClick={() => setDeleteMonthModalOpen(true)}
                className="min-h-11 min-w-11 rounded-xl bg-rose-50/90 hover:bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0 liquid-press cursor-pointer"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Isolated Hero Cashflow Card (0 parent/pillar re-renders during animations) */}
          <BudgetHeroCard
            animKey={`${selectedMonth}:ready`}
            remainingBudget={summary.remainingBudget}
            totalSpent={summary.totalSpent}
            totalAllocation={summary.totalAllocation}
            burnPct={summary.burnPct}
            unallocatedCash={summary.unallocatedCash}
            isSavingsBreached={summary.isSavingsBreached}
            totalIncome={summary.totalIncome}
            extraIncome={monthRecord.extraIncome}
            extraIncomeLabel={monthRecord.extraIncomeLabel}
            savingsRuleType={summary.savingsRuleType}
            savingsRuleValue={summary.savingsRuleValue}
            requiredSavings={summary.requiredSavings}
            monthlySavingsTotal={summary.monthlySavingsTotal}
            cumulativeYearSavings={cumulativeYearSavings}
            savingsTargetYear={monthRecord.savingsTargetYear}
            payFirstDone={Boolean(monthRecord.payFirstDone)}
            privacyMasked={privacyMasked}
            editPlanMode={editPlanMode}
            onOpenIncome={() => setIncomeModalOpen(true)}
            onTogglePayFirst={() => onTogglePayFirst(selectedMonth)}
          />

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
                className="surface-card rounded-2xl glass-divide overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => togglePillarCollapse(pillar.id)}
                  className="w-full px-3.5 py-3 flex items-center justify-between gap-2 text-left hover:bg-white/40 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: pillar.color }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-bold tracking-[-0.01em] text-slate-900 truncate">
                        {pillar.name}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-600 tabular-nums mt-0.5">
                      {fmtVal(pSpent)} / {fmtVal(pAlloc)}
                    </p>
                  </div>
                  <ChevronDown
                    aria-hidden="true"
                    className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
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
                        className="text-xs font-semibold text-emerald-700 cursor-pointer"
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
                            <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-700 truncate flex items-center gap-1.5 leading-snug">
                              <span className="truncate">{item.name}</span>
                              {item.isRecurring === false && (
                                <span className="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold shrink-0 leading-none">
                                  Sekali
                                </span>
                              )}
                            </p>
                            <p className="text-xs font-medium text-slate-600 tabular-nums truncate mt-0.5">
                              <strong
                                className={
                                  isOver
                                    ? 'font-semibold text-rose-600'
                                    : 'font-semibold text-slate-700'
                                }
                              >
                                {fmtVal(actual)}
                              </strong>{' '}
                              / {fmtShort(alloc)}
                              {billSavings > 0 && (
                                <span className="text-emerald-700 font-semibold">
                                  {' '}
                                  · hemat {fmtShort(billSavings)}
                                </span>
                              )}
                              {behavior === 'auto' && !editPlanMode && (
                                <span className="text-emerald-700 font-semibold">
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
                              className="glass-chip min-h-10 px-3 rounded-xl text-xs font-semibold text-slate-800 hover:text-emerald-700 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                          ) : behavior === 'bill' ? (
                            <button
                              type="button"
                              data-testid={`budget-bill-${item.id}`}
                              onClick={() =>
                                onToggleBillPaid(selectedMonth, item.id)
                              }
                              className={`min-h-10 px-3 rounded-xl text-xs font-semibold border shrink-0 liquid-press cursor-pointer ${
                                item.paid
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                                  : 'glass-chip text-slate-800 hover:border-emerald-500'
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
                                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-800 font-bold text-sm cursor-pointer"
                              >
                                −
                              </button>
                              <span className="min-w-[38px] text-center text-xs font-bold text-slate-800 tabular-nums">
                                {item.count || 0}/{item.targetCount || 1}
                              </span>
                              <button
                                type="button"
                                aria-label={`Tambah ${item.name}`}
                                onClick={() =>
                                  onStepCounter(selectedMonth, item.id, 1)
                                }
                                className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm liquid-press cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          ) : behavior === 'auto' ||
                            item.autoLink === 'grocery' ? (
                            <button
                              type="button"
                              onClick={onGoToCatatan}
                              className="min-h-10 px-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-semibold shrink-0 cursor-pointer"
                            >
                              Catatan
                            </button>
                          ) : behavior === 'sweep' ? (
                            <button
                              type="button"
                              data-testid={`budget-sweep-${item.id}`}
                              disabled={(item.actual || 0) > 0}
                              onClick={() =>
                                onToggleSweep(selectedMonth, item.id)
                              }
                              className={`min-h-10 px-3 rounded-xl text-xs font-semibold border shrink-0 liquid-press cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                item.swept && (item.actual || 0) === 0
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-amber-50 border-amber-300 text-amber-900'
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
                              className="glass-chip min-h-10 px-3 rounded-xl text-xs font-semibold text-slate-800 hover:text-emerald-700 shrink-0 cursor-pointer tabular-nums"
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

          {/* Monthly Efficiency Opportunities */}
          <section className="surface-card rounded-2xl glass-divide overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
              <span className="text-sm font-bold tracking-[-0.01em] text-slate-900 inline-flex items-center gap-1.5">
                <Lightbulb
                  className="w-3.5 h-3.5 text-amber-600"
                  aria-hidden="true"
                />
                <span>Opsi Efisiensi Bulanan</span>
              </span>
              {(monthRecord.effIcloudFamily || monthRecord.effBrightGas) && (
                <span className="text-xs font-bold text-emerald-700 tabular-nums">
                  Hemat{' '}
                  {fmtVal(
                    (monthRecord.effIcloudFamily ? 59000 : 0) +
                      (monthRecord.effBrightGas ? 85000 : 0),
                  )}
                </span>
              )}
            </div>
            <label className="min-h-11 px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-white/40 cursor-pointer">
              <span className="text-[13px] font-semibold text-slate-800">
                iCloud Family Sharing{' '}
                <span className="text-emerald-700 font-semibold">(-59rb/bln)</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(monthRecord.effIcloudFamily)}
                onChange={() =>
                  onToggleEfficiency(selectedMonth, 'effIcloudFamily')
                }
                className="accent-emerald-600 w-4.5 h-4.5 cursor-pointer"
              />
            </label>
            <label className="min-h-11 px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-white/40 cursor-pointer">
              <span className="text-[13px] font-semibold text-slate-800">
                Konversi Bright Gas 5,5kg{' '}
                <span className="text-emerald-700 font-semibold">(-85rb/bln)</span>
              </span>
              <input
                type="checkbox"
                checked={Boolean(monthRecord.effBrightGas)}
                onChange={() =>
                  onToggleEfficiency(selectedMonth, 'effBrightGas')
                }
                className="accent-emerald-600 w-4.5 h-4.5 cursor-pointer"
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
