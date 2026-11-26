import {
  Check,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { formatRupiah } from '../lib/format'
import { findStore } from '../lib/stores'
import type { MarketItem, StoreConfig } from '../types/market'

interface BasketDrawerProps {
  items: MarketItem[]
  stores: StoreConfig[]
  boughtEstimatedSpend: number
  onToggleBought: (id: string) => void
  onDeleteItem: (id: string) => void
  onClearBought: () => void
}

export function BasketDrawer({
  items,
  stores,
  boughtEstimatedSpend,
  onToggleBought,
  onDeleteItem,
  onClearBought,
}: BasketDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <section
      aria-label="Sudah Dibeli"
      className="glass-card mt-4 rounded-3xl overflow-hidden"
    >
      <button
        type="button"
        data-testid="basket-drawer-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full min-h-[54px] px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 active:bg-stone-100/70 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">
              Sudah Dibeli (Tercatat Bulanan)
            </p>
            <p className="text-xs text-stone-500 tabular-nums">
              {items.length} item selesai
              {boughtEstimatedSpend > 0
                ? ` · ${formatRupiah(boughtEstimatedSpend)}`
                : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-stone-500">
          <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full bg-emerald-600 text-white text-xs font-bold tabular-nums">
            {items.length}
          </span>
          {isOpen ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-stone-100 px-3 pb-3 pt-2 space-y-2 animate-fade-in">
          <div className="space-y-1.5">
            {items.map((item) => {
              const storeCfg = findStore(stores, item.store)
              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  data-testid="bought-item-row"
                  onClick={() => onToggleBought(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onToggleBought(item.id)
                    }
                  }}
                  className="min-h-12 rounded-xl bg-stone-50/90 hover:bg-stone-100/80 pl-3 pr-1 py-1.5 flex items-center gap-3 transition-colors cursor-pointer select-none"
                >
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-stone-500 line-through decoration-stone-400 break-words">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-stone-200/70 text-stone-500">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {storeCfg && (
                        <span className="text-[10px] font-semibold text-stone-400">
                          {storeCfg.shortLabel}
                        </span>
                      )}
                      {item.estimatedPrice > 0 && (
                        <span className="text-[11px] text-stone-400 tabular-nums">
                          {storeCfg ? '· ' : ''}
                          {formatRupiah(item.estimatedPrice)}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-label={`Hapus ${item.name} dari daftar selesai`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteItem(item.id)
                    }}
                    className="min-w-11 min-h-12 flex items-center justify-center rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            data-testid="clear-bought-btn"
            onClick={onClearBought}
            className="w-full min-h-12 mt-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] text-rose-700 text-sm font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Bersihkan Yang Sudah Dibeli ({items.length})</span>
          </button>
        </div>
      )}
    </section>
  )
}
