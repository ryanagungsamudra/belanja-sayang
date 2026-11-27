import { memo, useEffect, useRef, useState } from 'react'
import { formatRupiah } from '../lib/format'
import { formatCompactRupiahShort } from '../lib/noteParser'

interface HeroAnimValues {
  remainingAbs: number
  spent: number
  burnPct: number
  barRatio: number
  unallocatedAbs: number
  income: number
  savings: number
  yearSavings: number
}

const ZERO_HERO_VALUES: HeroAnimValues = {
  remainingAbs: 0,
  spent: 0,
  burnPct: 0,
  barRatio: 0,
  unallocatedAbs: 0,
  income: 0,
  savings: 0,
  yearSavings: 0,
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export interface BudgetHeroCardProps {
  animKey: string
  remainingBudget: number
  totalSpent: number
  totalAllocation: number
  burnPct: number
  unallocatedCash: number
  isSavingsBreached: boolean
  totalIncome: number
  extraIncome: number
  extraIncomeLabel?: string
  savingsRuleType: 'percent' | 'fixed'
  savingsRuleValue: number
  requiredSavings: number
  monthlySavingsTotal: number
  cumulativeYearSavings: number
  savingsTargetYear: number
  payFirstDone: boolean
  privacyMasked: boolean
  editPlanMode: boolean
  onOpenIncome: () => void
  onTogglePayFirst: () => void
}

/**
 * Isolated leaf card for the Anggaran monthly cashflow summary.
 * Runs a single requestAnimationFrame loop internally so parent pillar lists
 * never re-render during count-up or bar fill animations, and animates the bar
 * purely on the GPU compositor using `transform: scaleX(...)`.
 */
export const BudgetHeroCard = memo(function BudgetHeroCard({
  animKey,
  remainingBudget,
  totalSpent,
  totalAllocation,
  burnPct,
  unallocatedCash,
  isSavingsBreached,
  totalIncome,
  extraIncome,
  extraIncomeLabel,
  savingsRuleType,
  savingsRuleValue,
  requiredSavings,
  monthlySavingsTotal,
  cumulativeYearSavings,
  savingsTargetYear,
  payFirstDone,
  privacyMasked,
  editPlanMode,
  onOpenIncome,
  onTogglePayFirst,
}: BudgetHeroCardProps) {
  const targetRemainingAbs = Math.abs(remainingBudget)
  const targetBarRatio = Math.min(1, Math.max(0, burnPct / 100))
  const targetUnallocatedAbs = Math.abs(unallocatedCash)

  const [display, setDisplay] = useState<HeroAnimValues>(() =>
    prefersReducedMotion()
      ? {
          remainingAbs: targetRemainingAbs,
          spent: totalSpent,
          burnPct,
          barRatio: targetBarRatio,
          unallocatedAbs: targetUnallocatedAbs,
          income: totalIncome,
          savings: monthlySavingsTotal,
          yearSavings: cumulativeYearSavings,
        }
      : ZERO_HERO_VALUES,
  )

  const displayRef = useRef<HeroAnimValues>(ZERO_HERO_VALUES)
  const prevAnimKeyRef = useRef<string | null>(null)

  useEffect(() => {
    const target: HeroAnimValues = {
      remainingAbs: targetRemainingAbs,
      spent: totalSpent,
      burnPct,
      barRatio: targetBarRatio,
      unallocatedAbs: targetUnallocatedAbs,
      income: totalIncome,
      savings: monthlySavingsTotal,
      yearSavings: cumulativeYearSavings,
    }

    if (
      prefersReducedMotion() ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      displayRef.current = target
      const id = window.setTimeout(() => setDisplay(target), 0)
      return () => window.clearTimeout(id)
    }

    const shouldReset =
      prevAnimKeyRef.current === null || prevAnimKeyRef.current !== animKey
    prevAnimKeyRef.current = animKey

    const from = shouldReset ? ZERO_HERO_VALUES : displayRef.current
    const durationMs = 620
    let rafId = 0
    let startTime: number | null = null

    const tick = (now: number) => {
      if (startTime === null) startTime = now
      const rawT = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - rawT, 4)

      const next: HeroAnimValues = {
        remainingAbs: Math.round(
          from.remainingAbs + (target.remainingAbs - from.remainingAbs) * eased,
        ),
        spent: Math.round(from.spent + (target.spent - from.spent) * eased),
        burnPct: Math.round(
          from.burnPct + (target.burnPct - from.burnPct) * eased,
        ),
        barRatio:
          from.barRatio + (target.barRatio - from.barRatio) * eased,
        unallocatedAbs: Math.round(
          from.unallocatedAbs +
            (target.unallocatedAbs - from.unallocatedAbs) * eased,
        ),
        income: Math.round(from.income + (target.income - from.income) * eased),
        savings: Math.round(
          from.savings + (target.savings - from.savings) * eased,
        ),
        yearSavings: Math.round(
          from.yearSavings + (target.yearSavings - from.yearSavings) * eased,
        ),
      }

      displayRef.current = next
      setDisplay(next)

      if (rawT < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        displayRef.current = target
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [
    animKey,
    burnPct,
    cumulativeYearSavings,
    monthlySavingsTotal,
    targetBarRatio,
    targetRemainingAbs,
    targetUnallocatedAbs,
    totalIncome,
    totalSpent,
  ])

  const fmtVal = (amount: number) =>
    privacyMasked ? 'Rp ••••••' : formatRupiah(amount)
  const fmtShort = (amount: number) =>
    privacyMasked ? '•••' : formatCompactRupiahShort(amount) || '0'

  return (
    <section
      aria-label="Ringkasan Arus Kas Bulanan"
      className="glass-card rounded-2xl p-4 space-y-3.5"
    >
      {/* Primary Focal Point: Remaining Spendable Budget + Savings Margin */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-600">
            {remainingBudget < 0
              ? 'Pengeluaran melebihi alokasi'
              : 'Sisa anggaran bulan ini'}
          </p>
          <p
            className={`text-[28px] font-extrabold tracking-[-0.025em] tabular-nums leading-[1.15] mt-0.5 ${
              remainingBudget < 0 ? 'text-rose-700' : 'text-slate-900'
            }`}
          >
            {remainingBudget < 0
              ? `-${fmtVal(display.remainingAbs)}`
              : fmtVal(display.remainingAbs)}
          </p>
          <p className="text-xs font-medium text-slate-600 tabular-nums mt-0.5">
            Terpakai{' '}
            <strong className="font-semibold text-slate-800">
              {fmtVal(display.spent)}
            </strong>{' '}
            dari {fmtShort(totalAllocation)} ({display.burnPct}%)
          </p>
        </div>

        {unallocatedCash !== 0 && (
          <div
            className={`rounded-lg px-2.5 py-1.5 text-right shrink-0 border ${
              isSavingsBreached
                ? 'bg-amber-50/90 border-amber-300/80 text-amber-900'
                : 'bg-emerald-50/85 border-emerald-200/80 text-emerald-900'
            }`}
          >
            <p className="text-[13px] font-bold tabular-nums leading-tight">
              {isSavingsBreached
                ? `-${fmtShort(display.unallocatedAbs)}`
                : `+${fmtShort(display.unallocatedAbs)}`}
            </p>
            <p className="text-[11px] font-medium leading-tight mt-0.5">
              {isSavingsBreached ? 'sentuh tabungan' : 'sisa bebas'}
            </p>
          </div>
        )}
      </div>

      {/* GPU-Composited Left-to-Right Progress Bar + Safe-Ceiling Marker */}
      <div className="space-y-1.5">
        <div className="relative h-2 rounded-full bg-slate-900/10 overflow-hidden">
          <div
            className={`h-full w-full rounded-full origin-left will-change-transform transition-colors duration-300 ${
              totalSpent > totalAllocation
                ? 'bg-rose-600'
                : burnPct >= 85
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
            }`}
            style={{
              transform: `scaleX(${Math.min(1, Math.max(0, display.barRatio))})`,
            }}
          />
          {isSavingsBreached &&
            totalAllocation > 0 &&
            totalIncome > requiredSavings && (
              <div
                aria-hidden="true"
                title="Batas aman belanja sebelum menyentuh tabungan"
                className="absolute top-0 bottom-0 w-0.5 bg-slate-900/55"
                style={{
                  left: `${Math.min(
                    98,
                    Math.max(
                      2,
                      Math.round(
                        ((totalIncome - requiredSavings) / totalAllocation) *
                          100,
                      ),
                    ),
                  )}%`,
                }}
              />
            )}
        </div>
        {isSavingsBreached && (
          <p className="text-[11px] font-medium text-amber-900 tabular-nums">
            Alokasi {fmtShort(totalAllocation)} melewati batas aman belanja{' '}
            {fmtShort(Math.max(0, totalIncome - requiredSavings))}
          </p>
        )}
      </div>

      {/* Hairline Footer: Income, Savings Target & Pay First Action */}
      <div className="pt-3 border-t border-slate-900/8 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-3.5">
          <button
            type="button"
            disabled={!editPlanMode}
            onClick={() => editPlanMode && onOpenIncome()}
            className={`text-left min-w-0 ${editPlanMode ? 'cursor-pointer hover:text-emerald-700' : 'cursor-default'}`}
          >
            <p className="text-[11px] font-medium text-slate-600">
              Pemasukan
              {extraIncome > 0 ? ` + ${extraIncomeLabel || 'Bonus'}` : ''}
            </p>
            <p className="text-sm font-bold text-slate-900 tabular-nums leading-snug">
              {fmtShort(display.income)}
            </p>
          </button>

          <div className="pl-3.5 border-l border-slate-900/10 min-w-0">
            <p className="text-[11px] font-medium text-slate-600">
              Tabungan
              {savingsRuleType === 'percent' ? ` ${savingsRuleValue}%` : ''}
            </p>
            <p className="text-sm font-bold text-emerald-700 tabular-nums truncate leading-snug">
              {fmtShort(display.savings)}
              <span className="text-xs text-slate-600 font-medium">
                {' '}
                · 1 thn {fmtShort(display.yearSavings)}/
                {fmtShort(savingsTargetYear)}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="budget-pay-first-btn"
          onClick={onTogglePayFirst}
          className={`min-h-10 px-3 rounded-xl text-xs font-bold shrink-0 liquid-press cursor-pointer border ${
            payFirstDone
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          {payFirstDone ? 'Tersisihkan ✓' : 'Sisihkan'}
        </button>
      </div>
    </section>
  )
})
