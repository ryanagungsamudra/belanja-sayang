import type {
  BudgetMonthRecord,
  BudgetPillarConfig,
  BudgetTrackingModeConfig,
  CategoryConfig,
  FrequentItem,
  MarketItem,
  MealTemplate,
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
} from '../types/market'

export interface BelanjaBackupSnapshot {
  version: 1
  app: 'BelanjaSayang'
  exportedAt: string
  stores: StoreConfig[]
  categories: CategoryConfig[]
  productRefs: ProductReference[]
  monthlyPurchases: MonthlyPurchaseEntry[]
  items: MarketItem[]
  templates: MealTemplate[]
  frequentItems: FrequentItem[]
  monthlyBudget?: number | null
  budgetPillars?: BudgetPillarConfig[]
  budgetModes?: BudgetTrackingModeConfig[]
  budgetMonths?: BudgetMonthRecord[]
}

export function buildBackupSnapshot(data: {
  stores: StoreConfig[]
  categories: CategoryConfig[]
  productRefs: ProductReference[]
  monthlyPurchases: MonthlyPurchaseEntry[]
  items: MarketItem[]
  templates: MealTemplate[]
  frequentItems: FrequentItem[]
  monthlyBudget?: number | null
  budgetPillars?: BudgetPillarConfig[]
  budgetModes?: BudgetTrackingModeConfig[]
  budgetMonths?: BudgetMonthRecord[]
}): BelanjaBackupSnapshot {
  return {
    version: 1,
    app: 'BelanjaSayang',
    exportedAt: new Date().toISOString(),
    stores: data.stores,
    categories: data.categories,
    productRefs: data.productRefs,
    monthlyPurchases: data.monthlyPurchases,
    items: data.items,
    templates: data.templates,
    frequentItems: data.frequentItems,
    monthlyBudget:
      typeof data.monthlyBudget === 'number' && data.monthlyBudget > 0
        ? Math.round(data.monthlyBudget)
        : null,
    budgetPillars: data.budgetPillars,
    budgetModes: data.budgetModes,
    budgetMonths: data.budgetMonths,
  }
}

export function parseBackupSnapshot(
  rawJson: string,
): { snapshot: BelanjaBackupSnapshot | null; error: string | null } {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    return { snapshot: null, error: 'File JSON tidak valid atau rusak.' }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { snapshot: null, error: 'Format file backup tidak dikenali.' }
  }

  const obj = parsed as Record<string, unknown>
  if (obj.app !== 'BelanjaSayang' || obj.version !== 1) {
    return {
      snapshot: null,
      error: 'File ini bukan backup BelanjaSayang v1 yang valid.',
    }
  }

  const requiredArrays = [
    'stores',
    'categories',
    'productRefs',
    'monthlyPurchases',
    'items',
    'templates',
  ] as const

  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) {
      return {
        snapshot: null,
        error: `Data backup tidak lengkap (bagian "${key}" hilang).`,
      }
    }
  }

  const stores = obj.stores as StoreConfig[]
  const categories = obj.categories as CategoryConfig[]
  if (stores.length === 0 || categories.length === 0) {
    return {
      snapshot: null,
      error: 'Backup harus memiliki minimal 1 toko dan 1 kategori.',
    }
  }

  const rawBudget = obj.monthlyBudget
  const monthlyBudget =
    typeof rawBudget === 'number' && Number.isFinite(rawBudget) && rawBudget > 0
      ? Math.round(rawBudget)
      : null

  return {
    snapshot: {
      version: 1,
      app: 'BelanjaSayang',
      exportedAt:
        typeof obj.exportedAt === 'string'
          ? obj.exportedAt
          : new Date().toISOString(),
      stores,
      categories,
      productRefs: obj.productRefs as ProductReference[],
      monthlyPurchases: obj.monthlyPurchases as MonthlyPurchaseEntry[],
      items: obj.items as MarketItem[],
      templates: obj.templates as MealTemplate[],
      frequentItems: Array.isArray(obj.frequentItems)
        ? (obj.frequentItems as FrequentItem[])
        : [],
      monthlyBudget,
      budgetPillars: Array.isArray(obj.budgetPillars)
        ? (obj.budgetPillars as BudgetPillarConfig[])
        : undefined,
      budgetModes: Array.isArray(obj.budgetModes)
        ? (obj.budgetModes as BudgetTrackingModeConfig[])
        : undefined,
      budgetMonths: Array.isArray(obj.budgetMonths)
        ? (obj.budgetMonths as BudgetMonthRecord[])
        : undefined,
    },
    error: null,
  }
}

export function downloadBackupFile(snapshot: BelanjaBackupSnapshot): void {
  const dateTag = snapshot.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `belanjasayang-backup-${dateTag}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
