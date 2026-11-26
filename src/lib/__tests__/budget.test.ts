import { describe, expect, it } from 'vitest'
import {
  cloneBudgetMonthPlan,
  computeBudgetMonthSummary,
  createDefaultBudgetMonth,
  DEFAULT_BUDGET_MODES,
  DEFAULT_BUDGET_PILLARS,
  getBudgetItemAllocation,
} from '../budget'

describe('Household Monthly Budget ("Anggaran") Logic', () => {
  it('matches exact PDF allocations: Rp 10jt income, Rp 8.973.000 max spend, Rp 1.027.000 base savings', () => {
    const month = createDefaultBudgetMonth('2026-11')
    expect(DEFAULT_BUDGET_PILLARS).toHaveLength(4)
    expect(month.items).toHaveLength(15)

    const summary = computeBudgetMonthSummary(month, DEFAULT_BUDGET_MODES, 0)
    expect(summary.totalIncome).toBe(10000000)
    expect(summary.totalAllocation).toBe(8973000)
    expect(summary.requiredSavings).toBe(1000000) // 10% of 10jt
    expect(summary.unallocatedCash).toBe(27000) // Rp 27.000 free headroom
    expect(summary.isSavingsBreached).toBe(false)
    expect(summary.monthlySavingsTotal).toBe(1000000)
  })

  it('scales savings automatically when salary increases and detects savings rule breach', () => {
    const month = createDefaultBudgetMonth('2026-11')
    month.baseIncome = 15000000
    month.savingsRuleType = 'percent'
    month.savingsRuleValue = 20 // 20% auto-save -> Rp 3.000.000
    month.savingsStartingBalance = 3000000

    const raised = computeBudgetMonthSummary(month, DEFAULT_BUDGET_MODES, 0)
    expect(raised.requiredSavings).toBe(3000000)
    expect(raised.unallocatedCash).toBe(15000000 - 8973000 - 3000000)
    expect(raised.isSavingsBreached).toBe(false)

    // Fixed Rp rule exceeding remaining income triggers breach warning
    month.savingsRuleType = 'fixed'
    month.savingsRuleValue = 7000000
    const breached = computeBudgetMonthSummary(month, DEFAULT_BUDGET_MODES, 0)
    expect(breached.isSavingsBreached).toBe(true)
    expect(breached.unallocatedCash).toBeLessThan(0)
  })

  it('bridges live grocery spend from Catatan into Belanja Masak Mingguan & updates realized total', () => {
    const month = createDefaultBudgetMonth('2026-11')
    const summary = computeBudgetMonthSummary(
      month,
      DEFAULT_BUDGET_MODES,
      904000,
    )
    expect(summary.totalSpent).toBe(904000)
    expect(summary.remainingBudget).toBe(8973000 - 904000)
  })

  it('applies Rule #1 Dana Sosial Sweep (Rp 200k -> Rp 1.227.000 savings) and Rule #4 Pay Yourself First', () => {
    const month = createDefaultBudgetMonth('2026-11')
    month.payFirstDone = true
    const sosial = month.items.find((i) => i.id === 'b-sosial')!
    sosial.swept = true
    sosial.actual = 0

    const summary = computeBudgetMonthSummary(month, DEFAULT_BUDGET_MODES, 0)
    expect(summary.sweepSavingsBonus).toBe(200000)
    expect(summary.monthlySavingsTotal).toBe(1200000)
    expect(summary.realizedMonthlySavings).toBe(1200000)
  })

  it('supports efficiency toggles and clean month-to-month carry-over cloning', () => {
    const nov = createDefaultBudgetMonth('2026-11')
    nov.baseIncome = 11000000
    nov.effIcloudFamily = true // saves 59k
    nov.effBrightGas = true // saves 85k
    nov.items[0].paid = true
    nov.items.push(
      {
        id: 'b-addon-recurring',
        pillarId: 'p3',
        modeId: 'mode-bill',
        name: 'Cicilan Motor',
        budget: 500000,
        actual: 500000,
        paid: true,
        isRecurring: true,
      },
      {
        id: 'b-addon-oneoff',
        pillarId: 'p3',
        modeId: 'mode-bill',
        name: 'Servis Motor (Sekali)',
        budget: 200000,
        actual: 200000,
        paid: true,
        isRecurring: false,
      },
    )

    const icloudItem = nov.items.find((i) => i.id === 'b-icloud')!
    expect(getBudgetItemAllocation(icloudItem, DEFAULT_BUDGET_MODES, nov)).toBe(
      59000,
    )

    const dec = cloneBudgetMonthPlan(nov, '2026-12', DEFAULT_BUDGET_MODES)
    expect(dec.monthKey).toBe('2026-12')
    expect(dec.baseIncome).toBe(11000000)
    expect(dec.payFirstDone).toBe(false)
    expect(dec.items.find((i) => i.id === 'b-addon-recurring')).toBeDefined()
    expect(dec.items.find((i) => i.id === 'b-addon-oneoff')).toBeUndefined()
    expect(dec.items.every((i) => !i.paid && !i.swept)).toBe(true)
  })
})
