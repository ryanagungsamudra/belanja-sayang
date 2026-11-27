import {
  ArrowDownAZ,
  ArrowUpZA,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  ChevronRight,
  NotebookPen,
  Share2,
  ShoppingBasket,
  Store,
  X,
} from 'lucide-react'
import { memo, useMemo, useState } from 'react'
import { formatRupiah } from '../lib/format'
import { formatShortDateLabel } from '../lib/noteParser'
import {
  findCategory,
  findStore,
  getSolidPillStyle,
  getTintedPillStyle,
  sortByNameAZ,
} from '../lib/stores'
import type { SyncStatus } from '../lib/supabaseSync'
import type {
  CategoryConfig,
  MarketItem,
  StoreConfig,
  StoreSource,
} from '../types/market'
import { BasketDrawer } from './BasketDrawer'
import { CategoryGroup } from './CategoryGroup'

export interface LastShoppingTripSummary {
  dateKey: string
  total: number
  count: number
}

type CartStoreFilter = 'all' | 'unassigned' | StoreSource

interface CartViewProps {
  activeItems: MarketItem[]
  boughtItems: MarketItem[]
  stores: StoreConfig[]
  categories: CategoryConfig[]
  boughtEstimatedSpend: number
  productRefCount: number
  templateCount: number
  lastShoppingTrip: LastShoppingTripSummary | null
  syncStatus: SyncStatus
  onlineDevices: number
  onToggleBought: (id: string) => void
  onAssignStore: (itemId: string, nextStore: StoreSource | null) => void
  onOpenManageStores: () => void
  onEditItem: (item: MarketItem) => void
  onDeleteItem: (id: string) => void
  onClearBought: () => void
  onGoToCatatan: () => void
  onGoToPaket: () => void
  onShareCart: () => void
  onOpenCalendarSummary: () => void
  onOpenLastTrip: (dateKey: string) => void
}

export const CartView = memo(function CartView({
  activeItems,
  boughtItems,
  stores,
  categories,
  boughtEstimatedSpend,
  productRefCount,
  templateCount,
  lastShoppingTrip,
  syncStatus,
  onlineDevices,
  onToggleBought,
  onAssignStore,
  onOpenManageStores,
  onEditItem,
  onDeleteItem,
  onClearBought,
  onGoToCatatan,
  onGoToPaket,
  onShareCart,
  onOpenCalendarSummary,
  onOpenLastTrip,
}: CartViewProps) {
  const [cartSortOrder, setCartSortOrder] = useState<'az' | 'za'>('az')
  const [storeFilter, setStoreFilter] = useState<CartStoreFilter>('all')
  const [filterOpen, setFilterOpen] = useState(false)

  const storeCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 }
    for (const s of stores) counts[s.id] = 0
    for (const item of activeItems) {
      if (!item.store) {
        counts.unassigned += 1
      } else {
        counts[item.store] = (counts[item.store] ?? 0) + 1
      }
    }
    return counts
  }, [activeItems, stores])

  // Auto-fallback to 'all' if user deleted the filtered store or cleared unassigned items
  const effectiveFilter: CartStoreFilter = useMemo(() => {
    if (storeFilter === 'all') return 'all'
    if (storeFilter === 'unassigned') {
      return storeCounts.unassigned > 0 ? 'unassigned' : 'all'
    }
    return stores.some((s) => s.id === storeFilter) ? storeFilter : 'all'
  }, [storeCounts.unassigned, storeFilter, stores])

  const groupedActive = useMemo(() => {
    const filtered = activeItems.filter((item) => {
      if (effectiveFilter === 'all') return true
      if (effectiveFilter === 'unassigned') return item.store === null
      return item.store === effectiveFilter
    })

    const grouped = new Map<
      string,
      { config: CategoryConfig; items: MarketItem[] }
    >()
    for (const cat of categories) {
      grouped.set(cat.id, { config: cat, items: [] })
    }

    for (const item of filtered) {
      const catCfg = findCategory(categories, item.category)
      const bucket = grouped.get(catCfg.id)
      if (bucket) {
        bucket.items.push(item)
      } else {
        grouped.set(catCfg.id, { config: catCfg, items: [item] })
      }
    }

    return Array.from(grouped.values())
      .filter((g) => g.items.length > 0)
      .map((g) => {
        const sorted = sortByNameAZ(g.items)
        return {
          ...g,
          items: cartSortOrder === 'az' ? sorted : sorted.reverse(),
        }
      })
  }, [activeItems, cartSortOrder, categories, effectiveFilter])

  const hasAnyActiveItems = activeItems.length > 0
  const hasFilteredItems = groupedActive.length > 0
  const hasBoughtItems = boughtItems.length > 0

  const selectedStoreCfg =
    effectiveFilter !== 'all' && effectiveFilter !== 'unassigned'
      ? findStore(stores, effectiveFilter)
      : undefined

  const filterPillLabel =
    effectiveFilter === 'all'
      ? `Semua Toko (${activeItems.length})`
      : effectiveFilter === 'unassigned'
        ? `Belum pilih (${storeCounts.unassigned})`
        : `${selectedStoreCfg?.shortLabel ?? effectiveFilter} (${storeCounts[effectiveFilter] ?? 0})`

  return (
    <>
      {/* Live Partner Collaboration Banner when 2+ devices are online */}
      {(syncStatus === 'connected' || syncStatus === 'syncing') &&
        onlineDevices > 1 && (
        <div className="glass-chip px-3.5 py-2.5 rounded-2xl text-emerald-800 text-[11px] font-bold flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <span className="live-dot" />
            Belanja bareng aktif ({onlineDevices} HP terhubung)
          </span>
          <span className="text-emerald-600 shrink-0">Real-time</span>
        </div>
      )}

      {/* Compact Single-Row Store Filter Pill + A–Z + Bagikan (only when cart has items) */}
      {hasAnyActiveItems && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 min-w-0">
              <button
                type="button"
                data-testid="cart-store-filter-trigger"
                aria-expanded={filterOpen}
                onClick={() => setFilterOpen((prev) => !prev)}
                className={`min-h-10 px-3 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1.5 liquid-press cursor-pointer max-w-[205px] ${
                  effectiveFilter === 'unassigned'
                    ? 'bg-amber-50/95 border-amber-300 text-amber-800 shadow-xs'
                    : selectedStoreCfg
                      ? 'shadow-xs'
                      : 'glass-chip text-slate-800 hover:border-emerald-400'
                }`}
                style={
                  selectedStoreCfg
                    ? getTintedPillStyle(selectedStoreCfg.color)
                    : undefined
                }
              >
                <Store className="w-3.5 h-3.5 shrink-0 opacity-85" />
                <span className="truncate tabular-nums">{filterPillLabel}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 shrink-0 opacity-75 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                    filterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {effectiveFilter !== 'all' && (
                <button
                  type="button"
                  data-testid="cart-store-filter-reset"
                  aria-label="Reset filter toko"
                  onClick={() => {
                    setStoreFilter('all')
                    setFilterOpen(false)
                  }}
                  className="glass-chip w-10 h-10 rounded-xl text-slate-600 hover:text-slate-900 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                data-testid="cart-sort-order-toggle"
                aria-label={
                  cartSortOrder === 'az'
                    ? 'Urutan A sampai Z, ketuk untuk balik ke Z sampai A'
                    : 'Urutan Z sampai A, ketuk untuk balik ke A sampai Z'
                }
                onClick={() =>
                  setCartSortOrder((prev) => (prev === 'az' ? 'za' : 'az'))
                }
                className={`min-h-10 px-2.5 rounded-xl border text-xs font-extrabold inline-flex items-center gap-1 liquid-press cursor-pointer ${
                  cartSortOrder === 'za'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'glass-chip text-slate-800 hover:border-emerald-400'
                }`}
              >
                {cartSortOrder === 'az' ? (
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

              <button
                type="button"
                data-testid="cart-share-btn"
                aria-label="Bagikan daftar belanja ke WhatsApp"
                onClick={onShareCart}
                className="glass-chip min-h-10 px-2.5 rounded-xl text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Bagikan</span>
              </button>
            </div>
          </div>

          {/* 2-Column Matte Store Picker Dropdown */}
          {filterOpen && (
            <div
              data-testid="cart-store-filter-panel"
              className="surface-card rounded-2xl p-2.5 animate-liquid-panel"
            >
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="cart-filter-all"
                  onClick={() => {
                    setStoreFilter('all')
                    setFilterOpen(false)
                  }}
                  className={`min-h-10 px-2.5 rounded-xl text-left flex items-center justify-between gap-1.5 text-xs font-bold border liquid-press cursor-pointer ${
                    effectiveFilter === 'all'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-white/85 border-white text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className="truncate">Semua Toko</span>
                  <span
                    className={`text-[11px] font-extrabold tabular-nums ${
                      effectiveFilter === 'all'
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {activeItems.length}
                  </span>
                </button>

                {storeCounts.unassigned > 0 && (
                  <button
                    type="button"
                    data-testid="cart-filter-unassigned"
                    onClick={() => {
                      setStoreFilter('unassigned')
                      setFilterOpen(false)
                    }}
                    className={`min-h-10 px-2.5 rounded-xl text-left flex items-center justify-between gap-1.5 text-xs font-bold border liquid-press cursor-pointer ${
                      effectiveFilter === 'unassigned'
                        ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                        : 'bg-amber-50/90 border-amber-200/80 text-amber-800'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          effectiveFilter === 'unassigned'
                            ? 'bg-white'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span className="truncate">Belum pilih</span>
                    </span>
                    <span className="text-[11px] font-extrabold tabular-nums">
                      {storeCounts.unassigned}
                    </span>
                  </button>
                )}

                {stores.map((s) => {
                  const isSelected = effectiveFilter === s.id
                  const count = storeCounts[s.id] ?? 0
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`cart-filter-${s.id}`}
                      onClick={() => {
                        setStoreFilter(s.id)
                        setFilterOpen(false)
                      }}
                      className={`min-h-10 px-2.5 rounded-xl text-left flex items-center justify-between gap-1.5 text-xs font-bold border liquid-press cursor-pointer ${
                        isSelected
                          ? 'shadow-xs'
                          : count > 0
                            ? 'bg-white/85 border-white text-slate-800 hover:bg-white'
                            : 'bg-white/45 border-white/70 text-slate-400'
                      }`}
                      style={isSelected ? getSolidPillStyle(s.color) : undefined}
                    >
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: isSelected ? '#ffffff' : s.color,
                          }}
                        />
                        <span className="truncate">{s.shortLabel}</span>
                      </span>
                      <span
                        className={`text-[11px] font-extrabold tabular-nums ${
                          isSelected ? 'text-white/90' : ''
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {hasFilteredItems ? (
        <div className="space-y-4">
          {groupedActive.map((group) => (
            <CategoryGroup
              key={group.config.id}
              categoryConfig={group.config}
              items={group.items}
              stores={stores}
              onToggleBought={onToggleBought}
              onAssignStore={onAssignStore}
              onOpenManageStores={onOpenManageStores}
              onEditItem={onEditItem}
              onDeleteItem={onDeleteItem}
            />
          ))}
        </div>
      ) : hasAnyActiveItems && effectiveFilter !== 'all' ? (
        <div className="surface-card rounded-2xl px-4 py-4 flex items-center justify-between gap-3 animate-liquid-enter">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-slate-800">
              Belum ada item di {selectedStoreCfg?.shortLabel ?? 'filter ini'}
            </p>
            <p className="text-[11px] text-slate-600">
              Atur toko langsung di tiap baris item keranjang.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStoreFilter('all')}
            className="glass-chip min-h-10 px-3 rounded-xl text-emerald-700 text-xs font-bold shrink-0 cursor-pointer"
          >
            Semua
          </button>
        </div>
      ) : hasBoughtItems ? (
        <div className="surface-card rounded-2xl px-4 py-3.5 flex items-center gap-3 animate-liquid-enter">
          <div className="w-10 h-10 rounded-xl bg-emerald-50/90 text-emerald-600 flex items-center justify-center border border-emerald-200/70 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-900">
              Belanja minggu ini selesai
            </h2>
            <p className="text-xs text-slate-600">
              Semua item sudah tercatat di Catatan Bulanan.
            </p>
          </div>
        </div>
      ) : (
        /* Compact Inset-Grouped Empty State */
        <section
          aria-label="Keranjang kosong"
          className="surface-card rounded-2xl overflow-hidden glass-divide animate-liquid-enter"
        >
          {/* Compact Left-Aligned Header Row */}
          <div className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50/95 text-emerald-600 flex items-center justify-center border border-emerald-200/70 shrink-0">
              <ShoppingBasket className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[14px] font-extrabold text-slate-900 leading-snug">
                Keranjang kosong
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Pilih dari catatan, paket, atau ketik cepat di bawah
              </p>
            </div>
          </div>

          {/* Action Row 1: Catatan Bulanan */}
          <button
            type="button"
            data-testid="empty-goto-catatan-btn"
            onClick={onGoToCatatan}
            className="w-full min-h-12 px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/55 active:bg-emerald-50/50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <NotebookPen className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[13px] font-bold text-slate-800 truncate">
                Pilih dari Catatan
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 shrink-0 tabular-nums">
              <span>{productRefCount} produk</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </span>
          </button>

          {/* Action Row 2: Paket Masak */}
          <button
            type="button"
            data-testid="empty-goto-paket-btn"
            onClick={onGoToPaket}
            className="w-full min-h-12 px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/55 active:bg-emerald-50/50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <ChefHat className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[13px] font-bold text-slate-800 truncate">
                Muat Paket Masak
              </span>
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-400 shrink-0 tabular-nums">
              <span>{templateCount} paket</span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </span>
          </button>

          {/* Action Row 3: Last Shopping Trip (when purchase history exists) */}
          {lastShoppingTrip && (
            <button
              type="button"
              data-testid="empty-last-trip-btn"
              onClick={() => onOpenLastTrip(lastShoppingTrip.dateKey)}
              className="w-full min-h-12 px-4 py-2.5 flex items-center justify-between gap-3 text-left hover:bg-white/55 active:bg-emerald-50/50 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
                <span className="text-[13px] font-semibold text-slate-700 truncate">
                  Belanja terakhir ·{' '}
                  {formatShortDateLabel(lastShoppingTrip.dateKey)}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-700 shrink-0 tabular-nums">
                <span>{formatRupiah(lastShoppingTrip.total)}</span>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </span>
            </button>
          )}
        </section>
      )}

      {boughtItems.length > 0 && (
        <BasketDrawer
          items={boughtItems}
          stores={stores}
          boughtEstimatedSpend={boughtEstimatedSpend}
          onToggleBought={onToggleBought}
          onDeleteItem={onDeleteItem}
          onClearBought={onClearBought}
          onOpenCalendarSummary={onOpenCalendarSummary}
        />
      )}
    </>
  )
})
