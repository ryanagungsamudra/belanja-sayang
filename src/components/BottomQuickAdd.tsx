import { Plus, SlidersHorizontal, Sparkles, Tag, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { formatRupiah } from '../lib/format'
import {
  findStore,
  getReferencePriceForStore,
  getSolidPillStyle,
  getTintedPillStyle,
} from '../lib/stores'
import type {
  AddItemInput,
  CategoryConfig,
  FrequentItem,
  MarketCategory,
  ProductReference,
  StoreConfig,
  StoreSource,
} from '../types/market'

const QUANTITY_PRESETS = [
  '1',
  '1/4 kg',
  '1/2 kg',
  '1 kg',
  '1 ikat',
  '2 ikat',
  '1 papan',
  '1 bungkus',
  '1 liter',
]

interface BottomQuickAddProps {
  stores: StoreConfig[]
  categories: CategoryConfig[]
  frequentChips: FrequentItem[]
  productRefs: ProductReference[]
  defaultStore: StoreSource | null
  resolveDetectedCategory: (name: string) => MarketCategory
  onAddItem: (input: AddItemInput) => void
}

export function BottomQuickAdd({
  stores,
  categories,
  frequentChips,
  productRefs,
  defaultStore,
  resolveDetectedCategory,
  onAddItem,
}: BottomQuickAddProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [priceText, setPriceText] = useState('')
  const [manualCategory, setManualCategory] = useState<MarketCategory | null>(
    null,
  )
  const [manualStore, setManualStore] = useState<StoreSource | null | undefined>(
    undefined,
  )
  const [showDetails, setShowDetails] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const detectedCategory = useMemo(
    () => resolveDetectedCategory(name),
    [name, resolveDetectedCategory],
  )
  const effectiveCategory = manualCategory ?? detectedCategory
  const effectiveStore =
    manualStore !== undefined ? manualStore : defaultStore
  const isExpanded = showDetails || name.trim().length > 0

  const refMatches = useMemo(() => {
    const q = name.trim().toLowerCase()
    if (q.length < 2) return []
    return productRefs
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 4)
  }, [name, productRefs])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      inputRef.current?.focus()
      return
    }

    const parsedPrice = Number(priceText.replace(/[^\d]/g, '')) || 0
    onAddItem({
      name: trimmed,
      quantity: quantity.trim() || '1',
      category: effectiveCategory,
      store: effectiveStore,
      estimatedPrice: parsedPrice,
      syncToReference: parsedPrice > 0 && Boolean(effectiveStore),
    })

    setName('')
    setQuantity('1')
    setPriceText('')
    setManualCategory(null)
    setManualStore(undefined)
    setShowDetails(false)
  }

  const handleChipClick = (chip: FrequentItem) => {
    onAddItem({
      name: chip.name,
      quantity: chip.quantity,
      category: chip.category,
      store: defaultStore,
      estimatedPrice: chip.estimatedPrice,
      syncToReference: false,
    })
  }

  const handleRefSuggestionClick = (ref: ProductReference) => {
    const resolved = getReferencePriceForStore(ref, effectiveStore, stores)
    onAddItem({
      name: ref.name,
      quantity: ref.defaultQuantity,
      category: ref.category,
      store: effectiveStore,
      estimatedPrice: resolved.price,
      productRefId: ref.id,
      syncToReference: false,
    })
    setName('')
    setQuantity('1')
    setPriceText('')
    setManualCategory(null)
    setManualStore(undefined)
    setShowDetails(false)
  }

  return (
    <div className="w-full min-w-0 max-w-full bg-white/55 backdrop-blur-2xl border-t border-white/75 shadow-[0_-8px_28px_-10px_rgba(15,23,42,0.10)] pt-2 pb-2">
      {/* Horizontal Scrollable Frequent Items 1-Tap Chips */}
      {frequentChips.length > 0 && !isExpanded && (
        <div className="w-full min-w-0 px-3 pb-2">
          <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[11px] font-bold uppercase tracking-wide text-stone-400 shrink-0 pr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Sering
            </span>
            {frequentChips.map((chip) => (
              <button
                key={chip.normalizedName}
                type="button"
                data-testid="frequent-chip"
                onClick={() => handleChipClick(chip)}
                className="glass-pill min-h-11 px-3 rounded-full hover:border-emerald-400 flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus
                  className="w-3.5 h-3.5 text-emerald-600 shrink-0"
                  strokeWidth={2.5}
                />
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  {chip.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Expanded Auto-Category, Dynamic Store Picker, Reference Matches & Qty/Price */}
      {isExpanded && (
        <div className="w-full min-w-0 px-3 pb-2.5 space-y-2 animate-liquid-panel">
          {refMatches.length > 0 && (
            <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold uppercase text-emerald-700 shrink-0 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Ref:
              </span>
              {refMatches.map((ref) => {
                const resolved = getReferencePriceForStore(
                  ref,
                  effectiveStore,
                  stores,
                )
                const storeLabel = findStore(stores, resolved.store)?.shortLabel
                return (
                  <button
                    key={ref.id}
                    type="button"
                    onClick={() => handleRefSuggestionClick(ref)}
                    className="min-h-9 px-2.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <span>{ref.name}</span>
                    {resolved.price > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        {storeLabel ? `${storeLabel} · ` : ''}
                        {formatRupiah(resolved.price)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* Dynamic Store Selector (Optional / Nanti di Keranjang) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-stone-400 shrink-0">
              Toko:
            </span>
            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setManualStore(null)}
                className={`min-h-8 px-2.5 rounded-full text-xs font-bold border shrink-0 transition-all cursor-pointer ${
                  effectiveStore === null
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-stone-200 text-stone-500'
                }`}
              >
                Nanti
              </button>
              {stores.map((s) => {
                const isSelected = effectiveStore === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`store-pill-${s.id}`}
                    onClick={() => setManualStore(s.id)}
                    className="min-h-8 px-2.5 rounded-full text-xs font-bold border shrink-0 transition-all cursor-pointer"
                    style={
                      isSelected
                        ? getSolidPillStyle(s.color)
                        : getTintedPillStyle(s.color)
                    }
                  >
                    {s.shortLabel}
                  </button>
                )
              })}
            </div>
            <button
              type="button"
              aria-label="Tutup opsi tambah"
              onClick={() => {
                setShowDetails(false)
                setName('')
                setManualCategory(null)
                setManualStore(undefined)
              }}
              className="min-w-8 min-h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-200/60 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dynamic Category Pills */}
          <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[11px] font-semibold text-stone-400 shrink-0 pr-0.5">
              {manualCategory ? 'Kategori:' : 'Auto:'}
            </span>
            {categories.map((cat) => {
              const isSelected = effectiveCategory === cat.id
              return (
                <button
                  key={cat.id}
                  type="button"
                  data-testid={`cat-pill-${cat.id}`}
                  aria-pressed={isSelected}
                  onClick={() =>
                    setManualCategory((prev) =>
                      prev === cat.id ? null : cat.id,
                    )
                  }
                  className="min-h-8 px-3 rounded-full text-xs font-semibold border transition-all shrink-0 cursor-pointer"
                  style={
                    isSelected
                      ? getSolidPillStyle(cat.color)
                      : getTintedPillStyle(cat.color)
                  }
                >
                  {cat.shortLabel}
                </button>
              )
            })}
          </div>

          {/* Quantity Presets + Custom Qty & Price */}
          <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {QUANTITY_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setQuantity(preset)}
                className={`min-h-8 px-2.5 rounded-lg text-xs font-semibold border shrink-0 transition-colors cursor-pointer ${
                  quantity === preset
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-2.5 min-h-10 focus-within:border-emerald-500">
              <span className="text-[11px] font-semibold text-stone-400">
                Jumlah
              </span>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1 kg"
                className="w-full text-sm font-medium text-slate-900 bg-transparent outline-none"
              />
            </label>
            <label className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-2.5 min-h-10 focus-within:border-emerald-500">
              <span className="text-[11px] font-semibold text-stone-400">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={priceText}
                onChange={(e) =>
                  setPriceText(e.target.value.replace(/[^\d]/g, ''))
                }
                placeholder="Harga (auto ref)"
                className="w-full text-sm font-medium text-slate-900 bg-transparent outline-none tabular-nums"
              />
            </label>
          </div>
        </div>
      )}

      {/* Thumb-Zone Primary Input Row */}
      <form onSubmit={handleSubmit} className="px-3 flex items-center gap-2">
        <div className="flex-1 min-w-0 min-h-12 bg-white rounded-2xl border border-stone-300/90 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/15 flex items-center pl-3.5 pr-1 shadow-2xs transition-all">
          <input
            ref={inputRef}
            type="text"
            data-testid="add-item-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Catat yang perlu dibeli..."
            enterKeyHint="done"
            className="flex-1 min-w-0 bg-transparent text-[15px] font-medium text-slate-900 placeholder:text-stone-400 outline-none"
          />
          <button
            type="button"
            aria-label="Atur toko, jumlah, harga, dan kategori"
            onClick={() => setShowDetails((prev) => !prev)}
            className={`min-w-10 min-h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
              showDetails
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        <button
          type="submit"
          data-testid="add-item-submit"
          aria-label="Tambahkan item"
          className="min-h-12 min-w-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.95] text-white flex items-center justify-center shadow-sm shadow-emerald-600/30 transition-all shrink-0 cursor-pointer"
        >
          <Plus className="w-6 h-6" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  )
}
