import type {
  BudgetEnvelopeItem,
  BudgetMonthRecord,
  BudgetPillarConfig,
  BudgetTrackingModeConfig,
} from '../types/market'
import { generateId } from './format'

export const BUDGET_SWATCH_COLORS = [
  '#4F46E5',
  '#059669',
  '#D97706',
  '#E11D48',
  '#0284C7',
  '#7C3AED',
  '#0D9488',
] as const

export const DEFAULT_BUDGET_PILLARS: BudgetPillarConfig[] = [
  { id: 'p1', name: '1. Tempat Tinggal & Utilitas', color: '#4F46E5' },
  { id: 'p2', name: '2. Dapur & Kebersihan', color: '#059669' },
  { id: 'p3', name: '3. Mobilitas & Kerja WFO', color: '#D97706' },
  { id: 'p4', name: '4. Gaya Hidup, Mandiri & Sosial', color: '#E11D48' },
]

export const DEFAULT_BUDGET_MODES: BudgetTrackingModeConfig[] = [
  {
    id: 'mode-bill',
    label: 'Tagihan Lunas ✓',
    desc: '1-tap tandai lunas tiap bulan',
    behavior: 'bill',
    isSystem: true,
  },
  {
    id: 'mode-counter',
    label: 'Hitungan Unit (+1)',
    desc: 'Stepper jumlah hari/kaleng/galon',
    behavior: 'counter',
    unitLabel: 'hari',
    isSystem: true,
  },
  {
    id: 'mode-spend',
    label: 'Catat Cepat (+50rb)',
    desc: 'Tambah pengeluaran fleksibel',
    behavior: 'spend',
    stepAmount: 50000,
    isSystem: true,
  },
  {
    id: 'mode-sweep',
    label: 'Dana Sosial (Sweep)',
    desc: 'Sapu 100% ke tabungan jika nihil',
    behavior: 'sweep',
    isSystem: true,
  },
  {
    id: 'mode-auto',
    label: 'Auto Sync Catatan',
    desc: 'Tarik otomatis dari belanja dapur',
    behavior: 'auto',
    isSystem: true,
  },
]

export function createDefaultBudgetItems(now = Date.now()): BudgetEnvelopeItem[] {
  return [
    {
      id: 'b-kos',
      pillarId: 'p1',
      modeId: 'mode-bill',
      name: 'Sewa Kos Bulanan',
      budget: 3100000,
      actual: 3100000,
      paid: false,
      note: 'Hunian pasutri (wajib lunas awal bulan)',
      updatedAt: now,
    },
    {
      id: 'b-listrik',
      pillarId: 'p1',
      modeId: 'mode-bill',
      name: 'Token Listrik Kos',
      budget: 400000,
      actual: 400000,
      paid: false,
      note: 'AC, kulkas & peralatan elektronik',
      updatedAt: now,
    },
    {
      id: 'b-gas',
      pillarId: 'p1',
      modeId: 'mode-counter',
      name: 'Gas Portable',
      budget: 176000,
      count: 0,
      targetCount: 8,
      unitPrice: 22000,
      unitLabel: 'kaleng',
      note: '8 kaleng @ Rp 22.000 (kompor masak)',
      updatedAt: now,
    },
    {
      id: 'b-galon',
      pillarId: 'p1',
      modeId: 'mode-counter',
      name: 'Air Galon Le Minerale',
      budget: 144000,
      count: 0,
      targetCount: 6,
      unitPrice: 24000,
      unitLabel: 'galon',
      note: '6 galon @ Rp 24.000 konsumsi minum',
      updatedAt: now,
    },
    {
      id: 'b-data',
      pillarId: 'p1',
      modeId: 'mode-bill',
      name: 'Paket Data Suami & Istri',
      budget: 125000,
      actual: 125000,
      paid: false,
      note: 'Suami Rp 60rb + Istri Rp 65rb',
      updatedAt: now,
    },
    {
      id: 'b-icloud',
      pillarId: 'p1',
      modeId: 'mode-bill',
      name: 'Langganan iCloud (2 Akun)',
      budget: 118000,
      actual: 118000,
      paid: false,
      note: '200GB (Rp 59rb x 2 akun)',
      updatedAt: now,
    },
    {
      id: 'b-masak',
      pillarId: 'p2',
      modeId: 'mode-auto',
      name: 'Belanja Masak Mingguan',
      budget: 2000000,
      actual: 0,
      autoLink: 'grocery',
      note: 'Rp 500rb/minggu (auto sinkron dari Catatan)',
      updatedAt: now,
    },
    {
      id: 'b-toiletries',
      pillarId: 'p2',
      modeId: 'mode-spend',
      name: 'Toiletries & Kebersihan',
      budget: 250000,
      actual: 0,
      note: 'Sabun, sampo, deterjen, pasta gigi',
      updatedAt: now,
    },
    {
      id: 'b-laundry',
      pillarId: 'p2',
      modeId: 'mode-counter',
      name: 'Laundry Kiloan',
      budget: 210000,
      count: 0,
      targetCount: 6,
      unitPrice: 35000,
      unitLabel: 'cuci',
      note: '4–6x cuci @ Rp 35.000',
      updatedAt: now,
    },
    {
      id: 'b-wfo-saku',
      pillarId: 'p3',
      modeId: 'mode-counter',
      name: 'Uang Saku WFO Suami',
      budget: 480000,
      count: 0,
      targetCount: 12,
      unitPrice: 40000,
      unitLabel: 'hari',
      note: '12 hari WFO @ Rp 40rb · Hak Mandiri',
      updatedAt: now,
    },
    {
      id: 'b-bensin',
      pillarId: 'p3',
      modeId: 'mode-bill',
      name: 'Bensin Motor Bulanan',
      budget: 150000,
      actual: 150000,
      paid: false,
      note: 'Mobilitas harian + jalan pasutri',
      updatedAt: now,
    },
    {
      id: 'b-parkir',
      pillarId: 'p3',
      modeId: 'mode-counter',
      name: 'Parkir Motor Kantor',
      budget: 120000,
      count: 0,
      targetCount: 12,
      unitPrice: 10000,
      unitLabel: 'hari',
      note: '12 hari WFO @ Rp 10.000/hari',
      updatedAt: now,
    },
    {
      id: 'b-kencan',
      pillarId: 'p4',
      modeId: 'mode-spend',
      name: 'Kencan & Hiburan Pasutri',
      budget: 1000000,
      actual: 0,
      note: 'Rp 250rb x 4 minggu (Weekend / GoFood)',
      updatedAt: now,
    },
    {
      id: 'b-istri',
      pillarId: 'p4',
      modeId: 'mode-bill',
      name: 'Uang Pegangan / Jajan Istri',
      budget: 500000,
      actual: 500000,
      paid: false,
      note: 'Hak mandiri istri (tanpa rasa sungkan)',
      updatedAt: now,
    },
    {
      id: 'b-sosial',
      pillarId: 'p4',
      modeId: 'mode-sweep',
      name: 'Dana Sosial / Amplop Duka',
      budget: 200000,
      actual: 0,
      swept: false,
      note: 'Aturan Sweep: 100% ke tabungan jika nihil',
      updatedAt: now,
    },
  ]
}

export function createDefaultBudgetMonth(monthKey: string): BudgetMonthRecord {
  const now = Date.now()
  return {
    id: monthKey,
    monthKey,
    baseIncome: 10000000,
    extraIncome: 0,
    extraIncomeLabel: '',
    savingsRuleType: 'percent',
    savingsRuleValue: 10,
    savingsStartingBalance: 0,
    savingsTargetYear: 12000000,
    payFirstDone: false,
    effIcloudFamily: false,
    effBrightGas: false,
    items: createDefaultBudgetItems(now),
    updatedAt: now,
  }
}

/**
 * Clones a previous month's customized income, pillars, modes & items into a new month
 * with tracking progress cleanly reset to zero / unpaid.
 */
export function cloneBudgetMonthPlan(
  source: BudgetMonthRecord,
  targetMonthKey: string,
  modes: BudgetTrackingModeConfig[],
): BudgetMonthRecord {
  const now = Date.now()
  const modeMap = new Map(modes.map((m) => [m.id, m]))
  return {
    id: targetMonthKey,
    monthKey: targetMonthKey,
    baseIncome: source.baseIncome,
    extraIncome: 0,
    extraIncomeLabel: '',
    savingsRuleType: source.savingsRuleType ?? 'percent',
    savingsRuleValue: source.savingsRuleValue ?? 10,
    savingsStartingBalance: source.savingsStartingBalance ?? 0,
    savingsTargetYear: source.savingsTargetYear,
    payFirstDone: false,
    effIcloudFamily: source.effIcloudFamily,
    effBrightGas: source.effBrightGas,
    items: source.items.map((item) => {
      const mode = modeMap.get(item.modeId)
      const isBill = mode?.behavior === 'bill'
      return {
        ...item,
        id: item.id || `b-${generateId().slice(0, 8)}`,
        paid: false,
        swept: false,
        count: mode?.behavior === 'counter' ? 0 : item.count,
        actual: isBill ? getBudgetItemAllocation(item, modes, source) : 0,
        updatedAt: now,
      }
    }),
    updatedAt: now,
  }
}

export function getBudgetItemAllocation(
  item: BudgetEnvelopeItem,
  modes: BudgetTrackingModeConfig[],
  month?: Pick<BudgetMonthRecord, 'effIcloudFamily' | 'effBrightGas'>,
): number {
  const mode = modes.find((m) => m.id === item.modeId)
  let base =
    mode?.behavior === 'counter'
      ? Math.max(0, Math.round((item.targetCount || 1) * (item.unitPrice || 0)))
      : Math.max(0, Math.round(item.budget || 0))

  if (month?.effIcloudFamily && item.id === 'b-icloud' && base >= 100000) {
    base = Math.max(0, base - 59000)
  }
  if (month?.effBrightGas && item.id === 'b-gas' && base >= 150000) {
    base = Math.max(0, base - 85000)
  }
  return base
}

export function getBudgetItemActual(
  item: BudgetEnvelopeItem,
  modes: BudgetTrackingModeConfig[],
  groceryTotalFromCatatan: number,
): number {
  const mode = modes.find((m) => m.id === item.modeId)
  if (mode?.behavior === 'auto' || item.autoLink === 'grocery') {
    return Math.max(0, Math.round(groceryTotalFromCatatan))
  }
  if (mode?.behavior === 'bill') {
    return item.paid ? Math.max(0, Math.round(item.actual ?? item.budget)) : 0
  }
  if (mode?.behavior === 'counter') {
    return Math.max(0, Math.round((item.count || 0) * (item.unitPrice || 0)))
  }
  return Math.max(0, Math.round(item.actual || 0))
}

export function computeBudgetMonthSummary(
  month: BudgetMonthRecord,
  modes: BudgetTrackingModeConfig[],
  groceryTotalFromCatatan: number,
) {
  const totalIncome = Math.max(
    0,
    Math.round((month.baseIncome || 0) + (month.extraIncome || 0)),
  )
  let totalAllocation = 0
  let totalSpent = 0
  let sweepSavingsBonus = 0

  for (const item of month.items) {
    const alloc = getBudgetItemAllocation(item, modes, month)
    const actual = getBudgetItemActual(item, modes, groceryTotalFromCatatan)
    totalAllocation += alloc
    totalSpent += actual

    const mode = modes.find((m) => m.id === item.modeId)
    if (mode?.behavior === 'sweep' && item.swept && actual === 0) {
      sweepSavingsBonus += alloc
    }
  }

  const savingsRuleType = month.savingsRuleType ?? 'percent'
  const savingsRuleValue = month.savingsRuleValue ?? 10
  const requiredSavings =
    savingsRuleType === 'fixed'
      ? Math.max(0, Math.round(savingsRuleValue))
      : Math.round((totalIncome * Math.max(0, savingsRuleValue)) / 100)

  const unallocatedCash = totalIncome - totalAllocation - requiredSavings
  const isSavingsBreached = unallocatedCash < 0
  const monthlySavingsTotal = requiredSavings + sweepSavingsBonus
  const realizedMonthlySavings =
    (month.payFirstDone ? requiredSavings : 0) + sweepSavingsBonus
  const burnPct =
    totalAllocation > 0 ? Math.round((totalSpent / totalAllocation) * 100) : 0

  return {
    totalIncome,
    totalAllocation,
    totalSpent,
    remainingBudget: totalAllocation - totalSpent,
    savingsRuleType,
    savingsRuleValue,
    requiredSavings,
    unallocatedCash,
    isSavingsBreached,
    baseSavingsAllocation: requiredSavings,
    sweepSavingsBonus,
    monthlySavingsTotal,
    realizedMonthlySavings,
    burnPct,
  }
}

export function resolveEffectiveMonthBudget(
  month: BudgetMonthRecord,
  item: BudgetEnvelopeItem,
): number | undefined {
  if (month.effIcloudFamily && item.id === 'b-icloud') {
    return Math.max(0, item.budget - 59000)
  }
  return item.budget
}
