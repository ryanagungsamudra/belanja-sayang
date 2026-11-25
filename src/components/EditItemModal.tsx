import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatRupiah } from '../lib/format'
import {
  findStore,
  getSolidPillStyle,
  getTintedPillStyle,
} from '../lib/stores'
import type {
  CategoryConfig,
  MarketCategory,
  MarketItem,
  ProductReference,
  StoreConfig,
  StoreSource,
  UpdateItemInput,
} from '../types/market'

interface EditItemModalProps {
  item: MarketItem | null
  matchedRef?: ProductReference
  stores: StoreConfig[]
  categories: CategoryConfig[]
  onClose: () => void
  onSave: (id: string, patch: UpdateItemInput) => void
}

export function EditItemModal({
  item,
  matchedRef,
  stores,
  categories,
  onClose,
  onSave,
}: EditItemModalProps) {
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity ?? '1')
  const [category, setCategory] = useState<MarketCategory>(
    item?.category ?? categories[0]?.id ?? 'Lainnya',
  )
  const [store, setStore] = useState<StoreSource | null>(item?.store ?? null)
  const [priceText, setPriceText] = useState(
    item && item.estimatedPrice > 0 ? String(item.estimatedPrice) : '',
  )
  const [syncToReference, setSyncToReference] = useState(true)

  if (!item) return null

  const handleSelectStore = (nextStore: StoreSource | null) => {
    setStore(nextStore)
    if (nextStore) {
      const refPrice = matchedRef?.prices[nextStore]?.price
      if (refPrice && refPrice > 0) {
        setPriceText(String(refPrice))
      }
    }
  }

  const activeStoreCfg = findStore(stores, store)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave(item.id, {
      name: name.trim(),
      quantity: quantity.trim() || '1',
      category,
      store,
      estimatedPrice: Number(priceText.replace(/[^\d]/g, '')) || 0,
      syncToReference,
    })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ubah Item & Harga"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] bg-[#FAF9F6] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
      >
        <div className="px-5 pt-4 pb-3 bg-white border-b border-stone-200/80 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Ubah Item & Pilih Toko
            </h2>
            <p className="text-xs text-stone-500">
              Atur tempat belanja, kategori & harga terbaru
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="min-w-12 min-h-12 rounded-2xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Nama Barang
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-[15px] font-semibold text-slate-900 outline-none"
            />
          </div>

          {/* Dynamic Store Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Tempat Beli
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectStore(null)}
                className={`min-h-11 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  store === null
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                Belum pilih
              </button>
              {stores.map((s) => {
                const isSelected = store === s.id
                const savedPrice = matchedRef?.prices[s.id]?.price
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectStore(s.id)}
                    className="min-h-11 px-3 py-1 rounded-xl border text-left flex flex-col justify-center transition-all cursor-pointer"
                    style={
                      isSelected
                        ? getSolidPillStyle(s.color)
                        : getTintedPillStyle(s.color)
                    }
                  >
                    <span className="text-xs font-bold leading-tight">
                      {s.code} · {s.shortLabel}
                    </span>
                    {savedPrice && savedPrice > 0 && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums ${
                          isSelected ? 'text-white/90' : 'opacity-75'
                        }`}
                      >
                        {formatRupiah(savedPrice)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Jumlah
              </label>
              <input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1 kg"
                className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-[15px] font-medium text-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Harga (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={priceText}
                onChange={(e) =>
                  setPriceText(e.target.value.replace(/[^\d]/g, ''))
                }
                placeholder="0"
                className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-[15px] font-bold text-slate-900 outline-none tabular-nums"
              />
            </div>
          </div>

          {activeStoreCfg && (
            <label className="flex items-center gap-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl px-3.5 py-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={syncToReference}
                onChange={(e) => setSyncToReference(e.target.checked)}
                className="w-5 h-5 accent-emerald-600 rounded"
              />
              <span className="text-xs font-semibold text-emerald-900">
                Simpan harga ke Referensi ({activeStoreCfg.name})
              </span>
            </label>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Kategori
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const isSelected = category === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className="min-h-10 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    style={
                      isSelected
                        ? getSolidPillStyle(cat.color)
                        : getTintedPillStyle(cat.color)
                    }
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            Simpan Perubahan
          </button>
        </form>
      </div>
    </div>
  )
}
