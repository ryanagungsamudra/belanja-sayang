import {
  ArrowDownAZ,
  ArrowUpZA,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  ShoppingBasket,
  SlidersHorizontal,
  Store,
  Tag,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { formatRupiah, normalizeItemName } from '../lib/format'
import {
  formatMonthLabel,
  formatPurchaseChip,
  getStoreCode,
  shiftMonthKey,
} from '../lib/noteParser'
import {
  findCategory,
  findStore,
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

interface ProductCatalogViewProps {
  selectedMonth: string
  stores: StoreConfig[]
  categories: CategoryConfig[]
  productRefs: ProductReference[]
  monthEntries: MonthlyPurchaseEntry[]
  monthlyTotalSpend: number
  monthlySpendByStore: Record<string, number>
  activeItems: MarketItem[]
  onChangeMonth: (monthKey: string) => void
  onOpenImportModal: () => void
  onOpenManageConfig: (tab: 'stores' | 'categories') => void
  onAddNewRef: () => void
  onEditRef: (ref: ProductReference, focusStore?: StoreSource) => void
  onAddPurchase: (ref: ProductReference) => void
  onEditPurchase: (ref: ProductReference, entry: MonthlyPurchaseEntry) => void
  onToggleInCart: (ref: ProductReference) => void
}

export function ProductCatalogView({
  selectedMonth,
  stores,
  categories,
  productRefs,
  monthEntries,
  monthlyTotalSpend,
  monthlySpendByStore,
  activeItems,
  onChangeMonth,
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
  const [selectedStore, setSelectedStore] = useState<StoreSource | 'all'>('all')
  const [selectedCategory, setSelectedCategory] = useState<
    MarketCategory | 'all'
  >('all')

  const activeNameSet = useMemo(
    () => new Set(activeItems.map((i) => normalizeItemName(i.name))),
    [activeItems],
  )

  const refById = useMemo(() => {
    const map = new Map<string, ProductReference>()
    for (const r of productRefs) map.set(r.id, r)
    return map
  }, [productRefs])

  const entriesByRef = useMemo(() => {
    const map = new Map<string, MonthlyPurchaseEntry[]>()
    for (const entry of monthEntries) {
      const list = map.get(entry.productRefId) ?? []
      list.push(entry)
      map.set(entry.productRefId, list)
    }
    return map
  }, [monthEntries])

  const monthlySpendByCategory = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const c of categories) sums[c.id] = 0
    for (const entry of monthEntries) {
      const catId = refById.get(entry.productRefId)?.category ?? 'Lainnya'
      sums[catId] = (sums[catId] ?? 0) + (entry.price || 0)
    }
    return sums
  }, [categories, monthEntries, refById])

  const donutSegments: DonutSegment[] = useMemo(() => {
    if (chartMode === 'store') {
      return stores.map((s) => ({
        id: s.id,
        label: s.name,
        shortLabel: s.shortLabel,
        value: monthlySpendByStore[s.id] ?? 0,
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
    monthlySpendByStore,
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

  // Filter & sort productRefs (A-Z or Z-A)
  const filteredRefs = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = productRefs.filter((ref) => {
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
    entriesByRef,
    productRefs,
    search,
    selectedCategory,
    selectedStore,
    sortOrder,
  ])

  const hasFilter =
    selectedStore !== 'all' || selectedCategory !== 'all' || search.length > 0

  // Live item counts per store & per category for the upgraded filter cards
  const storeItemCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const s of stores) counts[s.id] = 0
    for (const ref of productRefs) {
      const refEntries = entriesByRef.get(ref.id) ?? []
      for (const s of stores) {
        const match =
          refEntries.some((e) => e.store === s.id) ||
          Boolean(ref.prices[s.id]?.price) ||
          ref.preferredStore === s.id
        if (match) counts[s.id] = (counts[s.id] ?? 0) + 1
      }
    }
    return counts
  }, [entriesByRef, productRefs, stores])

  const categoryItemCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of categories) counts[c.id] = 0
    for (const ref of productRefs) {
      counts[ref.category] = (counts[ref.category] ?? 0) + 1
    }
    return counts
  }, [categories, productRefs])

  const selectedStoreCfg =
    selectedStore !== 'all' ? findStore(stores, selectedStore) : undefined
  const selectedCategoryCfg =
    selectedCategory !== 'all'
      ? findCategory(categories, selectedCategory)
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
              className="glass-pill w-7 h-7 rounded-xl text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2
              data-testid="selected-month-label"
              className="text-[13px] font-extrabold text-slate-900 capitalize px-1 whitespace-nowrap truncate"
            >
              {formatMonthLabel(selectedMonth)}
            </h2>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => onChangeMonth(shiftMonthKey(selectedMonth, 1))}
              className="glass-pill w-7 h-7 rounded-xl text-slate-700 flex items-center justify-center shrink-0 cursor-pointer"
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

        {/* Interactive Circle (Donut) Diagram + Legend */}
        <MonthlyDonutChart
          segments={donutSegments}
          total={monthlyTotalSpend}
          purchaseCount={monthEntries.length}
          activeSegmentId={activeDonutId}
          onSelectSegment={handleSelectDonutSegment}
        />

        {/* Exact Total Footer + Manage Stores/Categories Link */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
          <div className="text-stone-500">
            Total:{' '}
            <span
              data-testid="monthly-exact-total"
              className="font-extrabold text-slate-900 tabular-nums"
            >
              {formatRupiah(monthlyTotalSpend)}
            </span>
          </div>
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
              <span>Reset filter</span>
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
      </section>

      {/* Single Compact Frosted Toolbar: Search + Impor Teks + Tambah Produk */}
      <div className="flex items-center gap-1.5">
        <div className="glass-pill flex-1 min-w-0 min-h-11 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/30 px-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            data-testid="ref-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            className="glass-card rounded-3xl p-3 space-y-2.5 animate-liquid-enter"
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
            className="glass-card rounded-3xl p-3 space-y-2.5 animate-liquid-enter"
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
          {filteredRefs.map((ref) => {
            const entries = entriesByRef.get(ref.id) ?? []
            const itemMonthTotal = entries.reduce(
              (sum, e) => sum + (e.price || 0),
              0,
            )
            const catCfg = findCategory(categories, ref.category)
            const isInCart = activeNameSet.has(ref.normalizedName)
            const lastEntry = entries[entries.length - 1]
            const refFallback = lastEntry
              ? { store: lastEntry.store, price: lastEntry.price }
              : getReferencePriceForStore(
                  ref,
                  selectedStore !== 'all' ? selectedStore : undefined,
                  stores,
                )

            return (
              <div
                key={ref.id}
                data-testid={`product-ref-card-${ref.id}`}
                data-product-name={ref.name}
                className="px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-stone-50/50 transition-colors"
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
                      const sCfg = findStore(stores, entry.store)
                      const isMissingPrice = !entry.price || entry.price <= 0
                      return (
                        <button
                          key={entry.id}
                          type="button"
                          data-testid={`purchase-chip-${entry.id}`}
                          onClick={() => onEditPurchase(ref, entry)}
                          className={`min-h-7 px-2 rounded-lg text-[11px] font-extrabold border transition-all active:scale-95 cursor-pointer tabular-nums ${
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
                  className={`min-w-11 min-h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer ${
                    isInCart
                      ? 'bg-emerald-600/95 text-white shadow-md shadow-emerald-600/30 border border-white/35'
                      : 'glass-pill text-slate-600 hover:text-emerald-700'
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
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200/80 p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            Bahan tidak ditemukan
          </p>
          <button
            type="button"
            onClick={onAddNewRef}
            className="min-h-11 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
          >
            + Tambah Produk Baru
          </button>
        </div>
      )}
    </div>
  )
}
