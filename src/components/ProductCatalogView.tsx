import {
  ArrowDownAZ,
  ArrowUpZA,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Share2,
  ShoppingBasket,
  SlidersHorizontal,
  Store,
  Tag,
  Wallet,
  X,
} from 'lucide-react'
import { memo, useDeferredValue, useMemo, useState } from 'react'
import {
  formatIdrInput,
  formatRupiah,
  normalizeItemName,
  parseIdrInput,
} from '../lib/format'
import {
  formatFullDateLabel,
  formatMonthLabel,
  formatPurchaseChip,
  getStoreCode,
  resolvePurchaseDateKey,
  shiftMonthKey,
} from '../lib/noteParser'
import {
  findCategory,
  getCheapestStore,
  getReferencePriceForStore,
  getTintedPillStyle,
} from '../lib/stores'
import type {
  CategoryConfig,
  MarketCategory,
  MarketItem,
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
  StoreSource,
} from '../types/market'
import { LiquidSegmentedTabs } from './LiquidSegmentedTabs'
import { MonthlyDonutChart, type DonutSegment } from './MonthlyDonutChart'

const EMPTY_ENTRIES: MonthlyPurchaseEntry[] = []

interface ProductRefRowProps {
  productRef: ProductReference
  entries: MonthlyPurchaseEntry[]
  catCfg: CategoryConfig
  stores: StoreConfig[]
  storeMap: Map<string, StoreConfig>
  selectedStore: StoreSource | 'all'
  isInCart: boolean
  onEditRef: (ref: ProductReference, focusStore?: StoreSource) => void
  onAddPurchase: (ref: ProductReference) => void
  onEditPurchase: (ref: ProductReference, entry: MonthlyPurchaseEntry) => void
  onToggleInCart: (ref: ProductReference) => void
}

const ProductRefRow = memo(function ProductRefRow({
  productRef: ref,
  entries,
  catCfg,
  stores,
  storeMap,
  selectedStore,
  isInCart,
  onEditRef,
  onAddPurchase,
  onEditPurchase,
  onToggleInCart,
}: ProductRefRowProps) {
  const itemMonthTotal = entries.reduce((sum, e) => sum + (e.price || 0), 0)
  const lastEntry = entries[entries.length - 1]
  const refFallback = lastEntry
    ? { store: lastEntry.store, price: lastEntry.price }
    : getReferencePriceForStore(
        ref,
        selectedStore !== 'all' ? selectedStore : undefined,
        stores,
      )

  const pricedStoreCount = stores.reduce(
    (acc, s) =>
      ref.prices[s.id]?.price && ref.prices[s.id]!.price > 0 ? acc + 1 : acc,
    0,
  )
  const cheapestStore =
    pricedStoreCount >= 2 ? getCheapestStore(ref, stores) : null
  const cheapestCfg = cheapestStore
    ? storeMap.get(cheapestStore.store)
    : undefined

  return (
    <div
      data-testid={`product-ref-card-${ref.id}`}
      data-product-name={ref.name}
      className="cv-row px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-stone-50/50 transition-colors"
    >
      {/* Main Info + Shorthand Purchase Chips */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <button
            type="button"
            data-testid={`edit-ref-${ref.id}`}
            onClick={() => onEditRef(ref)}
            className="flex items-center gap-1.5 min-w-0 text-left group cursor-pointer"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: catCfg.color }}
            />
            <span className="text-[14px] font-bold text-slate-900 group-hover:text-emerald-700 truncate">
              {ref.name}
            </span>
            {cheapestCfg && (
              <span
                title={`Termurah di ${cheapestCfg.name}`}
                className="px-1.5 py-0.2 rounded-md text-[9.5px] font-extrabold border shrink-0"
                style={getTintedPillStyle(cheapestCfg.color)}
              >
                ★ {cheapestCfg.code}
              </span>
            )}
          </button>

          <div className="shrink-0 text-right tabular-nums">
            {entries.length > 0 ? (
              <span className="text-xs font-extrabold text-slate-800">
                <span className="text-[11px] font-semibold text-stone-400 mr-1">
                  {entries.length}x
                </span>
                {formatRupiah(itemMonthTotal)}
              </span>
            ) : (
              <span className="text-[11px] text-stone-400">
                {getStoreCode(refFallback.store, stores)}
                {refFallback.price > 0
                  ? ` · ${formatRupiah(refFallback.price)}`
                  : ''}
              </span>
            )}
          </div>
        </div>

        {/* Shorthand Chips + Quick Log */}
        <div className="flex flex-wrap items-center gap-1">
          {entries.map((entry) => {
            const sCfg = storeMap.get(entry.store)
            const isMissingPrice = !entry.price || entry.price <= 0
            return (
              <button
                key={entry.id}
                type="button"
                data-testid={`purchase-chip-${entry.id}`}
                onClick={() => onEditPurchase(ref, entry)}
                className={`min-h-7 px-2 rounded-lg text-[11px] font-extrabold border liquid-press cursor-pointer tabular-nums ${
                  isMissingPrice
                    ? 'bg-amber-50 border-dashed border-amber-400 text-amber-800'
                    : ''
                }`}
                style={
                  !isMissingPrice
                    ? getTintedPillStyle(sCfg?.color ?? '#64748B')
                    : undefined
                }
              >
                {formatPurchaseChip(entry, stores)}
              </button>
            )
          })}

          <button
            type="button"
            data-testid={`add-purchase-${ref.id}`}
            aria-label={`Catat pembelian ${ref.name}`}
            onClick={() => onAddPurchase(ref)}
            className="min-h-7 px-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 hover:border-emerald-500 hover:bg-emerald-50 text-stone-500 hover:text-emerald-700 text-[11px] font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3 h-3" strokeWidth={2.5} />
            <span>Catat</span>
          </button>
        </div>
      </div>

      {/* Right-Edge 1-Tap Weekly Keranjang Toggle */}
      <button
        type="button"
        data-testid={`add-ref-to-cart-${ref.id}`}
        aria-pressed={isInCart}
        aria-label={
          isInCart
            ? `Hapus ${ref.name} dari keranjang mingguan`
            : `Masukkan ${ref.name} ke keranjang mingguan`
        }
        title={
          isInCart
            ? 'Di Keranjang (ketuk untuk batal)'
            : 'Masukkan 1 item ke Keranjang Mingguan'
        }
        onClick={() => onToggleInCart(ref)}
        className={`min-w-11 min-h-11 rounded-2xl flex items-center justify-center shrink-0 liquid-press cursor-pointer ${
          isInCart
            ? 'bg-emerald-600/95 text-white shadow-md shadow-emerald-600/30 border border-white/35'
            : 'glass-chip text-slate-600 hover:text-emerald-700'
        }`}
      >
        {isInCart ? (
          <Check className="w-5 h-5" strokeWidth={2.6} />
        ) : (
          <ShoppingBasket className="w-4 h-4" />
        )}
      </button>
    </div>
  )
})

interface ProductCatalogViewProps {
  selectedMonth: string
  activeDateFilter: string | null
  stores: StoreConfig[]
  categories: CategoryConfig[]
  productRefs: ProductReference[]
  monthEntries: MonthlyPurchaseEntry[]
  monthlyTotalSpend: number
  previousMonthTotalSpend?: number
  monthlyBudget?: number | null
  monthlySpendByStore: Record<string, number>
  activeItems: MarketItem[]
  onChangeMonth: (monthKey: string) => void
  onOpenDatePicker: () => void
  onClearDateFilter: () => void
  onSaveBudget: (amount: number | null) => void
  onShareMonthly: () => void
  onOpenImportModal: () => void
  onOpenManageConfig: (tab: 'stores' | 'categories') => void
  onAddNewRef: () => void
  onEditRef: (ref: ProductReference, focusStore?: StoreSource) => void
  onAddPurchase: (ref: ProductReference) => void
  onEditPurchase: (ref: ProductReference, entry: MonthlyPurchaseEntry) => void
  onToggleInCart: (ref: ProductReference) => void
}

export const ProductCatalogView = memo(function ProductCatalogView({
  selectedMonth,
  activeDateFilter,
  stores,
  categories,
  productRefs,
  monthEntries,
  monthlyTotalSpend,
  previousMonthTotalSpend = 0,
  monthlyBudget = null,
  monthlySpendByStore,
  activeItems,
  onChangeMonth,
  onOpenDatePicker,
  onClearDateFilter,
  onSaveBudget,
  onShareMonthly,
  onOpenImportModal,
  onOpenManageConfig,
  onAddNewRef,
  onEditRef,
  onAddPurchase,
  onEditPurchase,
  onToggleInCart,
}: ProductCatalogViewProps) {
  const [chartMode, setChartMode] = useState<'store' | 'category'>('store')
  const [sortOrder, setSortOrder] = useState<'az' | 'za'>('az')
  const [openFilterMenu, setOpenFilterMenu] = useState<
    'store' | 'category' | null
  >(null)
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selectedStore, setSelectedStore] = useState<StoreSource | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<
    MarketCategory | 'all'
  >('all')
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')

  const budgetPct =
    monthlyBudget && monthlyBudget > 0
      ? Math.round((monthlyTotalSpend / monthlyBudget) * 100)
      : null
  const isOverBudget =
    monthlyBudget !== null &&
    monthlyBudget > 0 &&
    monthlyTotalSpend > monthlyBudget
  const isNearBudget =
    !isOverBudget && budgetPct !== null && budgetPct >= 80

  const activeNameSet = useMemo(
    () => new Set(activeItems.map((i) => normalizeItemName(i.name))),
    [activeItems],
  )

  const refById = useMemo(() => {
    const map = new Map<string, ProductReference>()
    for (const r of productRefs) map.set(r.id, r)
    return map
  }, [productRefs])

  const scopedEntries = useMemo(() => {
    if (!activeDateFilter) return monthEntries
    return monthEntries.filter(
      (e) => resolvePurchaseDateKey(e) === activeDateFilter,
    )
  }, [activeDateFilter, monthEntries])

  const scopedTotalSpend = useMemo(() => {
    if (!activeDateFilter) return monthlyTotalSpend
    return scopedEntries.reduce((sum, e) => sum + (e.price || 0), 0)
  }, [activeDateFilter, monthlyTotalSpend, scopedEntries])

  const scopedSpendByStore = useMemo(() => {
    if (!activeDateFilter) return monthlySpendByStore
    const sums: Record<string, number> = {}
    for (const s of stores) sums[s.id] = 0
    for (const e of scopedEntries) {
      sums[e.store] = (sums[e.store] ?? 0) + (e.price || 0)
    }
    return sums
  }, [activeDateFilter, monthlySpendByStore, scopedEntries, stores])

  const entriesByRef = useMemo(() => {
    const map = new Map<string, MonthlyPurchaseEntry[]>()
    for (const entry of scopedEntries) {
      const list = map.get(entry.productRefId) ?? []
      list.push(entry)
      map.set(entry.productRefId, list)
    }
    return map
  }, [scopedEntries])

  const monthlySpendByCategory = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const c of categories) sums[c.id] = 0
    for (const entry of scopedEntries) {
      const catId = refById.get(entry.productRefId)?.category ?? 'Lainnya'
      sums[catId] = (sums[catId] ?? 0) + (entry.price || 0)
    }
    return sums
  }, [categories, refById, scopedEntries])

  const donutSegments: DonutSegment[] = useMemo(() => {
    if (chartMode === 'store') {
      return stores.map((s) => ({
        id: s.id,
        label: s.name,
        shortLabel: s.shortLabel,
        value: scopedSpendByStore[s.id] ?? 0,
        color: s.color,
        bgClass: '',
      }))
    }
    return categories
      .map((cat) => ({
        id: cat.id,
        label: cat.name,
        shortLabel: cat.shortLabel,
        value: monthlySpendByCategory[cat.id] ?? 0,
        color: cat.color,
        bgClass: '',
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [
    categories,
    chartMode,
    monthlySpendByCategory,
    scopedSpendByStore,
    stores,
  ])

  const activeDonutId =
    chartMode === 'store'
      ? selectedStore === 'all'
        ? null
        : selectedStore
      : selectedCategory === 'all'
        ? null
        : selectedCategory

  const handleSelectDonutSegment = (id: string) => {
    if (chartMode === 'store') {
      setSelectedStore((prev) => (prev === id ? 'all' : id))
    } else {
      setSelectedCategory((prev) => (prev === id ? 'all' : id))
    }
  }

  // Filter & sort productRefs (A-Z or Z-A) using deferred search for 0ms typing lag
  const filteredRefs = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    const list = productRefs.filter((ref) => {
      if (activeDateFilter) {
        const dayEntries = entriesByRef.get(ref.id)
        if (!dayEntries || dayEntries.length === 0) return false
      }
      if (
        q &&
        !ref.name.toLowerCase().includes(q) &&
        !(ref.notes ?? '').toLowerCase().includes(q)
      ) {
        return false
      }
      if (selectedCategory !== 'all' && ref.category !== selectedCategory) {
        return false
      }
      if (selectedStore !== 'all') {
        const refEntries = entriesByRef.get(ref.id) ?? []
        const boughtAtStore = refEntries.some((e) => e.store === selectedStore)
        const hasRefPrice = Boolean(ref.prices[selectedStore]?.price)
        if (
          !boughtAtStore &&
          !hasRefPrice &&
          ref.preferredStore !== selectedStore
        ) {
          return false
        }
      }
      return true
    })
    return sortOrder === 'az' ? list : [...list].reverse()
  }, [
    activeDateFilter,
    deferredSearch,
    entriesByRef,
    productRefs,
    selectedCategory,
    selectedStore,
    sortOrder,
  ])

  const hasFilter =
    selectedStore !== 'all' || selectedCategory !== 'all' || search.length > 0

  // Live item counts per store & per category — computed lazily only while filter panel is open
  const storeItemCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (openFilterMenu !== 'store') return counts
    for (const s of stores) counts[s.id] = 0
    for (const ref of productRefs) {
      const refEntries = entriesByRef.get(ref.id) ?? EMPTY_ENTRIES
      for (const s of stores) {
        const match =
          refEntries.some((e) => e.store === s.id) ||
          Boolean(ref.prices[s.id]?.price) ||
          ref.preferredStore === s.id
        if (match) counts[s.id] = (counts[s.id] ?? 0) + 1
      }
    }
    return counts
  }, [entriesByRef, openFilterMenu, productRefs, stores])

  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (openFilterMenu !== 'category') return counts
    for (const c of categories) counts[c.id] = 0
    for (const ref of productRefs) {
      counts[ref.category] = (counts[ref.category] ?? 0) + 1
    }
    return counts
  }, [categories, openFilterMenu, productRefs])

  const storeMap = useMemo(() => {
    const map = new Map<string, StoreConfig>()
    for (const s of stores) map.set(s.id, s)
    return map
  }, [stores])

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryConfig>()
    for (const c of categories) map.set(c.id, c)
    return map
  }, [categories])

  const selectedStoreCfg =
    selectedStore !== 'all' ? storeMap.get(selectedStore) : undefined
  const selectedCategoryCfg =
    selectedCategory !== 'all'
      ? categoryMap.get(selectedCategory) ??
        findCategory(categories, selectedCategory)
      : undefined

  return (
    <div className="space-y-3">
      {/* Compact Liquid Glass Dashboard Card with Circle Diagram */}
      <section
        aria-label="Dashboard Pengeluaran Bulanan"
        className="glass-card rounded-3xl p-3.5 space-y-3"
      >
        {/* Top Row: Compact Month Switcher + Spring-Sliding Liquid Segmented Toggle */}
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
              data-testid="selected-month-label"
              aria-label={`Buka kalender belanja (${formatMonthLabel(selectedMonth)})`}
              onClick={onOpenDatePicker}
              className={`glass-chip min-h-7 px-2 rounded-xl inline-flex items-center gap-1 text-[12.5px] font-extrabold capitalize whitespace-nowrap truncate cursor-pointer ${
                activeDateFilter
                  ? 'text-emerald-700 ring-1 ring-emerald-500/35'
                  : 'text-slate-900 hover:text-emerald-700'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span key={selectedMonth} className="truncate animate-liquid-enter">
                {formatMonthLabel(selectedMonth)}
              </span>
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

          {/* Draggable iOS Liquid Glass Switcher: Toko | Kategori */}
          <LiquidSegmentedTabs
            ariaLabel="Mode Diagram"
            size="sm"
            className="w-[146px] shrink-0"
            value={chartMode}
            onChange={setChartMode}
            options={[
              { id: 'store', label: 'Toko', testId: 'chart-mode-store' },
              {
                id: 'category',
                label: 'Kategori',
                testId: 'chart-mode-category',
              },
            ]}
          />
        </div>

        {/* Active Single-Day Shopping Filter Banner (only when user picks a specific date) */}
        {activeDateFilter && (
          <div
            data-testid="active-date-filter-banner"
            className="glass-chip rounded-2xl px-3 py-2 flex items-center justify-between gap-2 bg-emerald-50/90 border-emerald-200/80 animate-liquid-panel"
          >
            <button
              type="button"
              onClick={onOpenDatePicker}
              className="min-w-0 text-left cursor-pointer"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                Ringkasan Hari Belanja
              </p>
              <p className="text-xs font-extrabold text-slate-900 capitalize truncate">
                {formatFullDateLabel(activeDateFilter)}
              </p>
            </button>
            <button
              type="button"
              data-testid="clear-date-filter-btn"
              onClick={onClearDateFilter}
              className="px-2.5 py-1 rounded-xl bg-white hover:bg-stone-50 text-[11px] font-bold text-slate-700 border border-emerald-200/80 inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <span>1 Bulan</span>
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Interactive Circle (Donut) Diagram + Legend */}
        <MonthlyDonutChart
          segments={donutSegments}
          total={scopedTotalSpend}
          purchaseCount={scopedEntries.length}
          activeSegmentId={activeDonutId}
          onSelectSegment={handleSelectDonutSegment}
        />

        {/* Optional Synced Monthly Budget Target & Progress Bar */}
        {editingBudget ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const parsed = parseIdrInput(budgetDraft)
              onSaveBudget(parsed > 0 ? parsed : null)
              setEditingBudget(false)
            }}
            className="glass-chip rounded-2xl p-2.5 space-y-2 animate-liquid-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700 inline-flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                Target Budget Bulanan
              </span>
              <button
                type="button"
                aria-label="Tutup pengaturan budget"
                onClick={() => setEditingBudget(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 min-w-0 min-h-9 px-2.5 rounded-xl bg-white border border-stone-200 focus-within:border-emerald-600 flex items-center gap-1">
                <span className="text-xs font-bold text-stone-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  enterKeyHint="done"
                  autoFocus
                  data-testid="monthly-budget-input"
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(formatIdrInput(e.target.value))}
                  placeholder="1.500.000"
                  className="flex-1 min-w-0 bg-transparent text-xs font-extrabold text-slate-900 outline-none tabular-nums"
                />
              </div>
              {monthlyBudget && monthlyBudget > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onSaveBudget(null)
                    setEditingBudget(false)
                  }}
                  className="min-h-9 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold cursor-pointer shrink-0"
                >
                  Hapus
                </button>
              )}
              <button
                type="submit"
                data-testid="monthly-budget-save-btn"
                className="min-h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer shrink-0"
              >
                Simpan
              </button>
            </div>
          </form>
        ) : monthlyBudget && monthlyBudget > 0 ? (
          <button
            type="button"
            data-testid="monthly-budget-bar"
            onClick={() => {
              setBudgetDraft(formatIdrInput(monthlyBudget))
              setEditingBudget(true)
            }}
            className="w-full glass-chip rounded-2xl px-3 py-2 text-left space-y-1.5 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-bold text-slate-600 inline-flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Budget {formatRupiah(monthlyBudget)}</span>
              </span>
              <span
                className={`font-extrabold tabular-nums ${
                  isOverBudget
                    ? 'text-rose-600'
                    : isNearBudget
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {isOverBudget
                  ? `Lewat ${formatRupiah(monthlyTotalSpend - monthlyBudget)}`
                  : `Sisa ${formatRupiah(monthlyBudget - monthlyTotalSpend)} (${budgetPct}%)`}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-900/8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isOverBudget
                    ? 'bg-rose-500'
                    : isNearBudget
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, budgetPct ?? 0)}%` }}
              />
            </div>
          </button>
        ) : null}

        {/* Exact Total Footer + MoM Delta + Budget / Share / Manage Actions */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
          <div className="text-stone-500 flex items-center gap-1.5 flex-wrap min-w-0">
            <span>
              Total:{' '}
              <span
                data-testid="monthly-exact-total"
                className="font-extrabold text-slate-900 tabular-nums"
              >
                {formatRupiah(scopedTotalSpend)}
              </span>
            </span>
            {!activeDateFilter &&
              previousMonthTotalSpend > 0 &&
              monthlyTotalSpend > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                  monthlyTotalSpend <= previousMonthTotalSpend
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {monthlyTotalSpend <= previousMonthTotalSpend ? '▼' : '▲'}{' '}
                {formatRupiah(
                  Math.abs(monthlyTotalSpend - previousMonthTotalSpend),
                )}{' '}
                vs bln lalu
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!monthlyBudget && !editingBudget && (
              <button
                type="button"
                data-testid="set-monthly-budget-btn"
                onClick={() => {
                  setBudgetDraft('')
                  setEditingBudget(true)
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50/90 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold cursor-pointer"
              >
                <Wallet className="w-3 h-3" />
                <span>Budget</span>
              </button>
            )}
            {monthEntries.length > 0 && (
              <button
                type="button"
                data-testid="share-monthly-btn"
                aria-label="Bagikan rekap bulanan ke WhatsApp"
                title="Bagikan rekap ke WhatsApp"
                onClick={onShareMonthly}
                className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-stone-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
            {hasFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedStore('all')
                  setSelectedCategory('all')
                  setSearch('')
                  setOpenFilterMenu(null)
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[11px] font-bold cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="dashboard-manage-config-btn"
                onClick={() =>
                  onOpenManageConfig(
                    chartMode === 'store' ? 'stores' : 'categories',
                  )
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>
                  Atur {chartMode === 'store' ? 'Toko' : 'Kategori'}
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Single Compact Frosted Toolbar: Search + Impor Teks + Tambah Produk */}
      <div className="flex items-center gap-1.5">
        <div className="glass-pill flex-1 min-w-0 min-h-11 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/30 px-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            data-testid="ref-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
            placeholder="Cari bahan..."
            className="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          />
          {search && (
            <button
              type="button"
              aria-label="Hapus pencarian"
              onClick={() => setSearch('')}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          data-testid="open-import-note-btn"
          aria-label="Impor atau salin catatan teks"
          onClick={onOpenImportModal}
          className="glass-pill min-h-11 px-3 rounded-2xl text-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Teks</span>
        </button>

        <button
          type="button"
          data-testid="add-product-ref-btn"
          aria-label="Tambah produk baru"
          onClick={onAddNewRef}
          className="min-h-11 min-w-11 px-3 rounded-2xl bg-emerald-600/95 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md shadow-emerald-600/25 border border-white/30 shrink-0 cursor-pointer transition-transform"
        >
          <Plus className="w-4 h-4" strokeWidth={2.6} />
          <span>Baru</span>
        </button>
      </div>

      {/* Upgraded Liquid Glass Unified Filter Bar + Rich Store/Category Picker Cards */}
      <div className="space-y-2">
        <div className="glass-pill rounded-2xl p-1 flex items-center gap-1">
          {/* A-Z / Z-A Reverse Toggle */}
          <button
            type="button"
            data-testid="sort-order-toggle"
            aria-label={
              sortOrder === 'az'
                ? 'Urutan A sampai Z, ketuk untuk balik ke Z sampai A'
                : 'Urutan Z sampai A, ketuk untuk balik ke A sampai Z'
            }
            onClick={() =>
              setSortOrder((prev) => (prev === 'az' ? 'za' : 'az'))
            }
            className={`min-h-8 px-2.5 rounded-xl text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
              sortOrder === 'za'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white/60 text-slate-700 hover:bg-white/85'
            }`}
          >
            {sortOrder === 'az' ? (
              <>
                <ArrowDownAZ className="w-3.5 h-3.5" />
                <span>A–Z</span>
              </>
            ) : (
              <>
                <ArrowUpZA className="w-3.5 h-3.5" />
                <span>Z–A</span>
              </>
            )}
          </button>

          {/* Toko Filter Pill */}
          <button
            type="button"
            data-testid="filter-store-trigger"
            aria-expanded={openFilterMenu === 'store'}
            onClick={() =>
              setOpenFilterMenu((prev) => (prev === 'store' ? null : 'store'))
            }
            className={`flex-1 min-w-0 min-h-8 px-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-1 transition-all cursor-pointer border ${
              selectedStoreCfg
                ? ''
                : openFilterMenu === 'store'
                  ? 'bg-white/95 border-white text-slate-900 shadow-xs'
                  : 'bg-white/50 border-transparent text-slate-700 hover:bg-white/75'
            }`}
            style={
              selectedStoreCfg
                ? getTintedPillStyle(selectedStoreCfg.color)
                : undefined
            }
          >
            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
              {selectedStoreCfg ? (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedStoreCfg.color }}
                />
              ) : (
                <Store className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              )}
              <span className="truncate">
                {selectedStoreCfg ? selectedStoreCfg.shortLabel : 'Toko'}
              </span>
            </span>
            {selectedStoreCfg ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Reset filter toko"
                data-testid="note-store-filter-all"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedStore('all')
                  setOpenFilterMenu(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedStore('all')
                    setOpenFilterMenu(null)
                  }
                }}
                className="p-0.5 rounded-md hover:bg-black/10 shrink-0"
              >
                <X className="w-3 h-3" />
              </span>
            ) : (
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 opacity-60 transition-transform ${
                  openFilterMenu === 'store' ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

          {/* Kategori Filter Pill */}
          <button
            type="button"
            data-testid="filter-category-trigger"
            aria-expanded={openFilterMenu === 'category'}
            onClick={() =>
              setOpenFilterMenu((prev) =>
                prev === 'category' ? null : 'category',
              )
            }
            className={`flex-1 min-w-0 min-h-8 px-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-1 transition-all cursor-pointer border ${
              selectedCategoryCfg
                ? ''
                : openFilterMenu === 'category'
                  ? 'bg-white/95 border-white text-slate-900 shadow-xs'
                  : 'bg-white/50 border-transparent text-slate-700 hover:bg-white/75'
            }`}
            style={
              selectedCategoryCfg
                ? getTintedPillStyle(selectedCategoryCfg.color)
                : undefined
            }
          >
            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
              {selectedCategoryCfg ? (
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: selectedCategoryCfg.color }}
                />
              ) : (
                <Tag className="w-3.5 h-3.5 shrink-0 text-slate-500" />
              )}
              <span className="truncate">
                {selectedCategoryCfg
                  ? selectedCategoryCfg.shortLabel
                  : 'Kategori'}
              </span>
            </span>
            {selectedCategoryCfg ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Reset filter kategori"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedCategory('all')
                  setOpenFilterMenu(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelectedCategory('all')
                    setOpenFilterMenu(null)
                  }
                }}
                className="p-0.5 rounded-md hover:bg-black/10 shrink-0"
              >
                <X className="w-3 h-3" />
              </span>
            ) : (
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 opacity-60 transition-transform ${
                  openFilterMenu === 'category' ? 'rotate-180' : ''
                }`}
              />
            )}
          </button>

          {/* Compact Result Count Pill */}
          <span
            data-testid="filtered-ref-count"
            className="min-w-7 h-7 px-1.5 rounded-xl bg-slate-900/8 text-[11px] font-extrabold text-slate-700 tabular-nums inline-flex items-center justify-center shrink-0"
          >
            {filteredRefs.length}
          </span>
        </div>

        {/* Rich Liquid Glass Store Picker Card Grid */}
        {openFilterMenu === 'store' && (
          <div
            data-testid="store-filter-panel"
            className="glass-card rounded-3xl p-3 space-y-2.5 animate-liquid-panel"
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Filter Tempat Belanja
              </span>
              <button
                type="button"
                data-testid="edit-stores-pill"
                onClick={() => {
                  setOpenFilterMenu(null)
                  onOpenManageConfig('stores')
                }}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Atur Toko</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="note-store-filter-all-panel"
                onClick={() => {
                  setSelectedStore('all')
                  setOpenFilterMenu(null)
                }}
                className={`min-h-14 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-[0.97] cursor-pointer ${
                  selectedStore === 'all'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-white/60 border-white/80 text-slate-800 hover:bg-white/85'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold">Semua Toko</span>
                  {selectedStore === 'all' && <Check className="w-3.5 h-3.5" />}
                </div>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    selectedStore === 'all' ? 'text-white/75' : 'text-slate-500'
                  }`}
                >
                  {productRefs.length} bahan · {formatRupiah(monthlyTotalSpend)}
                </span>
              </button>

              {stores.map((s) => {
                const active = selectedStore === s.id
                const spend = monthlySpendByStore[s.id] ?? 0
                const count = storeItemCounts[s.id] ?? 0
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`note-store-filter-${s.id}`}
                    onClick={() => {
                      setSelectedStore(active ? 'all' : s.id)
                      setOpenFilterMenu(null)
                    }}
                    className={`min-h-14 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-[0.97] cursor-pointer ${
                      active
                        ? 'shadow-sm'
                        : 'bg-white/60 border-white/80 hover:bg-white/85'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: `${s.color}20`,
                            borderColor: s.color,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {s.shortLabel}
                        </span>
                      </span>
                      <span
                        className="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold shrink-0"
                        style={getTintedPillStyle(s.color)}
                      >
                        {s.code}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums truncate">
                      {count} bahan · {formatRupiah(spend)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Rich Liquid Glass Category Picker Card Grid */}
        {openFilterMenu === 'category' && (
          <div
            data-testid="category-filter-panel"
            className="glass-card rounded-3xl p-3 space-y-2.5 animate-liquid-panel"
          >
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                Filter Kategori
              </span>
              <button
                type="button"
                data-testid="edit-categories-pill"
                onClick={() => {
                  setOpenFilterMenu(null)
                  onOpenManageConfig('categories')
                }}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Atur Kategori</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all')
                  setOpenFilterMenu(null)
                }}
                className={`min-h-14 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-[0.97] cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                    : 'bg-white/60 border-white/80 text-slate-800 hover:bg-white/85'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold">Semua Kategori</span>
                  {selectedCategory === 'all' && (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </div>
                <span
                  className={`text-[11px] font-semibold tabular-nums ${
                    selectedCategory === 'all'
                      ? 'text-white/75'
                      : 'text-slate-500'
                  }`}
                >
                  {productRefs.length} bahan
                </span>
              </button>

              {categories.map((cat) => {
                const active = selectedCategory === cat.id
                const count = categoryItemCounts[cat.id] ?? 0
                const spend = monthlySpendByCategory[cat.id] ?? 0
                return (
                  <button
                    key={cat.id}
                    type="button"
                    data-testid={`cat-filter-${cat.id}`}
                    onClick={() => {
                      setSelectedCategory(active ? 'all' : cat.id)
                      setOpenFilterMenu(null)
                    }}
                    className={`min-h-14 px-3 py-2 rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-[0.97] cursor-pointer ${
                      active
                        ? 'shadow-sm'
                        : 'bg-white/60 border-white/80 hover:bg-white/85'
                    }`}
                    style={
                      active
                        ? {
                            backgroundColor: `${cat.color}20`,
                            borderColor: cat.color,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {cat.name}
                        </span>
                      </span>
                      {active && (
                        <Check
                          className="w-3.5 h-3.5 shrink-0"
                          style={{ color: cat.color }}
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums truncate">
                      {count} bahan
                      {spend > 0 ? ` · ${formatRupiah(spend)}` : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Compact Liquid Glass Monthly Note List (Sorted A-Z or Z-A) */}
      {filteredRefs.length > 0 ? (
        <div
          data-testid="product-ref-list"
          className="glass-card rounded-3xl glass-divide overflow-hidden"
        >
          {filteredRefs.map((ref) => (
            <ProductRefRow
              key={ref.id}
              productRef={ref}
              entries={entriesByRef.get(ref.id) ?? EMPTY_ENTRIES}
              catCfg={
                categoryMap.get(ref.category) ??
                findCategory(categories, ref.category)
              }
              stores={stores}
              storeMap={storeMap}
              selectedStore={selectedStore}
              isInCart={activeNameSet.has(ref.normalizedName)}
              onEditRef={onEditRef}
              onAddPurchase={onAddPurchase}
              onEditPurchase={onEditPurchase}
              onToggleInCart={onToggleInCart}
            />
          ))}
        </div>
      ) : (
        <div className="glass-card rounded-3xl p-6 text-center space-y-3 animate-liquid-enter">
          <div className="w-11 h-11 rounded-2xl bg-white/70 text-slate-400 mx-auto flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Bahan tidak ditemukan
          </p>
          <button
            type="button"
            onClick={onAddNewRef}
            className="min-h-11 px-4 rounded-xl bg-emerald-600/95 text-white text-xs font-bold liquid-press cursor-pointer"
          >
            + Tambah Produk Baru
          </button>
        </div>
      )}
    </div>
  )
})
