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
  getSolidPillStyle,
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

  const selectedStoreCfg =
    selectedStore !== 'all' ? findStore(stores, selectedStore) : undefined
  const selectedCategoryCfg =
    selectedCategory !== 'all'
      ? findCategory(categories, selectedCategory)
      : undefined

  return (
    <div className="space-y-3">
      {/* Compact Dashboard Card with Circle Diagram */}
      <section
        aria-label="Dashboard Pengeluaran Bulanan"
        className="bg-white rounded-3xl border border-stone-200/80 p-3.5 shadow-xs space-y-3"
      >
        {/* Top Row: Compact Month Switcher + Chart Mode Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Bulan sebelumnya"
              onClick={() => onChangeMonth(shiftMonthKey(selectedMonth, -1))}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2
              data-testid="selected-month-label"
              className="text-sm font-extrabold text-slate-900 capitalize px-1.5"
            >
              {formatMonthLabel(selectedMonth)}
            </h2>
            <button
              type="button"
              aria-label="Bulan berikutnya"
              onClick={() => onChangeMonth(shiftMonthKey(selectedMonth, 1))}
              className="w-8 h-8 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-slate-700 flex items-center justify-center cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Toggle: Per Toko vs Per Kategori */}
          <div className="bg-stone-100 p-0.5 rounded-xl flex items-center text-[11px] font-bold">
            <button
              type="button"
              data-testid="chart-mode-store"
              onClick={() => setChartMode('store')}
              className={`px-2.5 py-1.5 rounded-[10px] transition-all cursor-pointer ${
                chartMode === 'store'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-stone-500 hover:text-slate-700'
              }`}
            >
              Toko
            </button>
            <button
              type="button"
              data-testid="chart-mode-category"
              onClick={() => setChartMode('category')}
              className={`px-2.5 py-1.5 rounded-[10px] transition-all cursor-pointer ${
                chartMode === 'category'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-stone-500 hover:text-slate-700'
              }`}
            >
              Kategori
            </button>
          </div>
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

      {/* Single Compact Toolbar: Search + Impor Teks + Tambah Produk */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 min-h-11 bg-white rounded-2xl border border-stone-200/90 focus-within:border-emerald-600 px-3 flex items-center gap-2 shadow-2xs">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            data-testid="ref-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari bahan..."
            className="flex-1 min-w-0 bg-transparent text-sm font-medium text-slate-900 placeholder:text-stone-400 outline-none"
          />
          {search && (
            <button
              type="button"
              aria-label="Hapus pencarian"
              onClick={() => setSearch('')}
              className="text-stone-400 hover:text-stone-600 cursor-pointer"
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
          className="min-h-11 px-3 rounded-2xl bg-white border border-stone-200/90 hover:border-emerald-400 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
        >
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Teks</span>
        </button>

        <button
          type="button"
          data-testid="add-product-ref-btn"
          aria-label="Tambah produk baru"
          onClick={onAddNewRef}
          className="min-h-11 min-w-11 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs shadow-emerald-600/20 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2.6} />
          <span>Baru</span>
        </button>
      </div>

      {/* Ultra-Compact Single-Row Filter Bar (Sort + Toko + Kategori + Count) */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
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
            className={`min-h-9 px-2.5 rounded-xl border text-xs font-extrabold shrink-0 inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
              sortOrder === 'za'
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white border-stone-200/90 text-slate-700 hover:border-emerald-400'
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

          {/* Compact Store Filter Dropdown Trigger */}
          <button
            type="button"
            data-testid="filter-store-trigger"
            aria-expanded={openFilterMenu === 'store'}
            onClick={() =>
              setOpenFilterMenu((prev) => (prev === 'store' ? null : 'store'))
            }
            className={`flex-1 min-w-0 min-h-9 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-between gap-1 transition-all cursor-pointer ${
              selectedStoreCfg
                ? ''
                : openFilterMenu === 'store'
                  ? 'bg-stone-100 border-stone-300 text-slate-900'
                  : 'bg-white border-stone-200/90 text-slate-700 hover:bg-stone-50'
            }`}
            style={
              selectedStoreCfg
                ? getTintedPillStyle(selectedStoreCfg.color)
                : undefined
            }
          >
            <span className="inline-flex items-center gap-1 min-w-0 truncate">
              <Store className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <span className="truncate">
                {selectedStoreCfg
                  ? `${selectedStoreCfg.code} · ${selectedStoreCfg.shortLabel}`
                  : 'Toko'}
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
                className="p-0.5 rounded hover:bg-black/10 shrink-0"
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

          {/* Compact Category Filter Dropdown Trigger */}
          <button
            type="button"
            data-testid="filter-category-trigger"
            aria-expanded={openFilterMenu === 'category'}
            onClick={() =>
              setOpenFilterMenu((prev) =>
                prev === 'category' ? null : 'category',
              )
            }
            className={`flex-1 min-w-0 min-h-9 px-2.5 rounded-xl border text-xs font-bold inline-flex items-center justify-between gap-1 transition-all cursor-pointer ${
              selectedCategoryCfg
                ? ''
                : openFilterMenu === 'category'
                  ? 'bg-stone-100 border-stone-300 text-slate-900'
                  : 'bg-white border-stone-200/90 text-slate-700 hover:bg-stone-50'
            }`}
            style={
              selectedCategoryCfg
                ? getTintedPillStyle(selectedCategoryCfg.color)
                : undefined
            }
          >
            <span className="inline-flex items-center gap-1 min-w-0 truncate">
              <Tag className="w-3.5 h-3.5 shrink-0 opacity-80" />
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
                className="p-0.5 rounded hover:bg-black/10 shrink-0"
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

          {/* Compact Result Count */}
          <span
            data-testid="filtered-ref-count"
            className="text-[11px] font-bold text-stone-400 tabular-nums shrink-0 px-0.5"
          >
            {filteredRefs.length}
          </span>
        </div>

        {/* Expandable Inline Store Picker Panel */}
        {openFilterMenu === 'store' && (
          <div
            data-testid="store-filter-panel"
            className="bg-white rounded-2xl border border-stone-200/90 p-2.5 shadow-sm flex flex-wrap gap-1.5 animate-fade-in"
          >
            <button
              type="button"
              data-testid="note-store-filter-all-panel"
              onClick={() => {
                setSelectedStore('all')
                setOpenFilterMenu(null)
              }}
              className={`min-h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                selectedStore === 'all'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-stone-50 border-stone-200 text-stone-600'
              }`}
            >
              Semua Toko
            </button>
            {stores.map((s) => {
              const active = selectedStore === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  data-testid={`note-store-filter-${s.id}`}
                  onClick={() => {
                    setSelectedStore(active ? 'all' : s.id)
                    setOpenFilterMenu(null)
                  }}
                  className="min-h-8 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer"
                  style={
                    active
                      ? getSolidPillStyle(s.color)
                      : getTintedPillStyle(s.color)
                  }
                >
                  {s.code} · {s.shortLabel}
                </button>
              )
            })}
            <button
              type="button"
              data-testid="edit-stores-pill"
              onClick={() => {
                setOpenFilterMenu(null)
                onOpenManageConfig('stores')
              }}
              className="min-h-8 px-2.5 rounded-lg border border-dashed border-stone-300 bg-white text-xs font-bold text-stone-500 hover:text-emerald-700 hover:border-emerald-400 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Atur Toko</span>
            </button>
          </div>
        )}

        {/* Expandable Inline Category Picker Panel */}
        {openFilterMenu === 'category' && (
          <div
            data-testid="category-filter-panel"
            className="bg-white rounded-2xl border border-stone-200/90 p-2.5 shadow-sm flex flex-wrap gap-1.5 animate-fade-in"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all')
                setOpenFilterMenu(null)
              }}
              className={`min-h-8 px-2.5 rounded-lg text-xs font-bold border cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-stone-50 border-stone-200 text-stone-600'
              }`}
            >
              Semua Kategori
            </button>
            {categories.map((cat) => {
              const active = selectedCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`cat-filter-${cat.id}`}
                  onClick={() => {
                    setSelectedCategory(active ? 'all' : cat.id)
                    setOpenFilterMenu(null)
                  }}
                  className="min-h-8 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer"
                  style={
                    active
                      ? getSolidPillStyle(cat.color)
                      : getTintedPillStyle(cat.color)
                  }
                >
                  {cat.shortLabel}
                </button>
              )
            })}
            <button
              type="button"
              data-testid="edit-categories-pill"
              onClick={() => {
                setOpenFilterMenu(null)
                onOpenManageConfig('categories')
              }}
              className="min-h-8 px-2.5 rounded-lg border border-dashed border-stone-300 bg-white text-xs font-bold text-stone-500 hover:text-emerald-700 hover:border-emerald-400 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Atur Kategori</span>
            </button>
          </div>
        )}
      </div>

      {/* Compact Scannable Monthly Note List (Sorted A-Z or Z-A) */}
      {filteredRefs.length > 0 ? (
        <div
          data-testid="product-ref-list"
          className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 shadow-2xs overflow-hidden"
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
                      ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/25'
                      : 'bg-stone-100 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border border-stone-200/80'
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
