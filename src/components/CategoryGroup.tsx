import { ChevronDown, Pencil, Plus, Store, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { formatRupiah } from '../lib/format'
import {
  findStore,
  getSolidPillStyle,
  getTintedPillStyle,
} from '../lib/stores'
import type {
  CategoryConfig,
  MarketItem,
  StoreConfig,
  StoreSource,
} from '../types/market'

interface CategoryGroupProps {
  categoryConfig: CategoryConfig
  items: MarketItem[]
  stores: StoreConfig[]
  onToggleBought: (id: string) => void
  onAssignStore: (id: string, storeId: StoreSource | null) => void
  onOpenManageStores: () => void
  onEditItem: (item: MarketItem) => void
  onDeleteItem: (id: string) => void
}

export function CategoryGroup({
  categoryConfig,
  items,
  stores,
  onToggleBought,
  onAssignStore,
  onOpenManageStores,
  onEditItem,
  onDeleteItem,
}: CategoryGroupProps) {
  const [pickingItemId, setPickingItemId] = useState<string | null>(null)

  if (items.length === 0) return null

  return (
    <section aria-label={categoryConfig.name} className="space-y-1.5">
      <div className="flex items-center justify-between px-1">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border"
          style={getTintedPillStyle(categoryConfig.color)}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: categoryConfig.color }}
          />
          {categoryConfig.name}
        </span>
        <span className="text-[11px] font-semibold text-stone-400 tabular-nums">
          {items.length} item
        </span>
      </div>

      {/* Compact Grouped Card List with Inline Store Picker */}
      <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 shadow-2xs overflow-hidden">
        {items.map((item) => {
          const storeCfg = findStore(stores, item.store)
          const isPickingStore = pickingItemId === item.id

          return (
            <div key={item.id} className="transition-colors">
              <div
                role="button"
                tabIndex={0}
                data-testid="active-item-row"
                onClick={() => onToggleBought(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggleBought(item.id)
                  }
                }}
                className="group w-full min-h-[56px] pl-3.5 pr-1 py-2 flex items-center gap-2.5 hover:bg-stone-50/60 active:bg-emerald-50/50 transition-colors cursor-pointer select-none touch-manipulation"
              >
                {/* Circular checkbox */}
                <div
                  aria-hidden="true"
                  className="w-6 h-6 rounded-full border-2 border-stone-300 group-hover:border-emerald-500 shrink-0 transition-colors"
                />

                {/* Compact 2-line Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-slate-900 truncate">
                      {item.name}
                    </span>
                    {item.quantity && item.quantity !== '1' && (
                      <span className="px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-semibold shrink-0">
                        {item.quantity}
                      </span>
                    )}
                  </div>

                  {/* Inline Store Picker Trigger + Price (only the store button stops propagation!) */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <button
                      type="button"
                      data-testid={`cart-item-store-btn-${item.id}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPickingItemId((prev) =>
                          prev === item.id ? null : item.id,
                        )
                      }}
                      className={`min-h-7 px-2 py-0.5 rounded-lg text-[11px] font-extrabold border inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer touch-manipulation ${
                        storeCfg
                          ? ''
                          : 'bg-amber-50 border-dashed border-amber-400 text-amber-800 hover:bg-amber-100'
                      }`}
                      style={
                        storeCfg
                          ? getTintedPillStyle(storeCfg.color)
                          : undefined
                      }
                    >
                      <Store className="w-3 h-3 shrink-0" />
                      <span>
                        {storeCfg ? storeCfg.shortLabel : 'Pilih toko'}
                      </span>
                      <ChevronDown className="w-3 h-3 shrink-0 opacity-75" />
                    </button>

                    {item.estimatedPrice > 0 && (
                      <span
                        data-testid={`cart-item-price-${item.id}`}
                        className="text-xs font-bold text-emerald-700 tabular-nums"
                      >
                        {formatRupiah(item.estimatedPrice)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quick Edit & Delete */}
                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    aria-label={`Ubah ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditItem(item)
                    }}
                    className="min-w-10 min-h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-slate-700 hover:bg-stone-100 cursor-pointer touch-manipulation"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteItem(item.id)
                    }}
                    className="min-w-10 min-h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer touch-manipulation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline Store Selection Drawer right under the Cart Item */}
              {isPickingStore && (
                <div
                  data-testid="inline-store-picker"
                  className="px-3.5 pb-2.5 pt-1 bg-stone-50/90 border-t border-stone-100 flex flex-wrap items-center gap-1.5 animate-fade-in"
                >
                  <span className="text-[10px] font-bold uppercase text-stone-400 mr-0.5">
                    Beli di:
                  </span>
                  {stores.map((s) => {
                    const isSelected = item.store === s.id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        data-testid={`pick-store-${s.id}`}
                        onClick={() => {
                          onAssignStore(item.id, s.id)
                          setPickingItemId(null)
                        }}
                        className="min-h-8 px-2.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer"
                        style={
                          isSelected
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
                    onClick={() => {
                      setPickingItemId(null)
                      onOpenManageStores()
                    }}
                    className="min-h-8 px-2 rounded-lg border border-dashed border-stone-300 bg-white text-[11px] font-bold text-stone-500 hover:text-emerald-700 hover:border-emerald-400 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Toko</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
