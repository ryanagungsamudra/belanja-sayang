import { ReceiptText, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { formatRupiah } from '../lib/format'
import { formatPurchaseChip, parseShorthandToken } from '../lib/noteParser'
import {
  findStore,
  getSolidPillStyle,
  getTintedPillStyle,
} from '../lib/stores'
import type {
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
  StoreSource,
} from '../types/market'

interface PurchaseEntryModalProps {
  isOpen: boolean
  productRef: ProductReference | null
  editingEntry: MonthlyPurchaseEntry | null
  stores: StoreConfig[]
  monthLabel: string
  onClose: () => void
  onAdd: (store: StoreSource, price: number, qtyNote?: string) => void
  onUpdate: (
    entryId: string,
    store: StoreSource,
    price: number,
    qtyNote?: string,
  ) => void
  onDelete: (entryId: string) => void
}

export function PurchaseEntryModal({
  isOpen,
  productRef,
  editingEntry,
  stores,
  monthLabel,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
}: PurchaseEntryModalProps) {
  const initialStore: StoreSource =
    editingEntry?.store ??
    productRef?.preferredStore ??
    stores[0]?.id ??
    'hypermart'
  const initialPrice =
    editingEntry !== null
      ? editingEntry.price
      : productRef?.prices[initialStore]?.price ?? 0

  const [shorthand, setShorthand] = useState('')
  const [store, setStore] = useState<StoreSource>(initialStore)
  const [priceText, setPriceText] = useState(
    initialPrice > 0 ? String(initialPrice) : '',
  )
  const [qtyNote, setQtyNote] = useState(editingEntry?.qtyNote ?? '')

  if (!isOpen || !productRef) return null

  const handleShorthandChange = (val: string) => {
    setShorthand(val)
    const parsed = parseShorthandToken(val, store, stores)
    if (parsed) {
      setStore(parsed.store)
      setPriceText(parsed.price > 0 ? String(parsed.price) : '')
      if (parsed.qtyNote !== undefined) {
        setQtyNote(parsed.qtyNote)
      }
    }
  }

  const handleStorePick = (nextStore: StoreSource) => {
    setStore(nextStore)
    if (!editingEntry && !shorthand) {
      const refPrice = productRef.prices[nextStore]?.price
      if (refPrice && refPrice > 0) {
        setPriceText(String(refPrice))
      }
    }
  }

  const numericPrice = Number(priceText.replace(/[^\d]/g, '')) || 0
  const previewChip = formatPurchaseChip(
    {
      store,
      price: numericPrice,
      qtyNote: qtyNote.trim() || undefined,
    },
    stores,
  )
  const activeStoreCfg = findStore(stores, store)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (editingEntry) {
      onUpdate(
        editingEntry.id,
        store,
        numericPrice,
        qtyNote.trim() || undefined,
      )
    } else {
      onAdd(store, numericPrice, qtyNote.trim() || undefined)
    }
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
        aria-label={
          editingEntry ? 'Edit Catatan Belanja' : 'Catat Pembelian Baru'
        }
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#FAF9F6] rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up"
      >
        <div className="px-5 pt-4 pb-3 bg-white border-b border-stone-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {productRef.name}
              </h2>
              <p className="text-xs text-stone-500">
                {editingEntry ? 'Edit pembelian' : 'Catat beli baru'} ·{' '}
                {monthLabel}
              </p>
            </div>
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
          className="p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          {/* Fast Shorthand Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Ketik Cepat (Opsional)
              </label>
              <span
                data-testid="purchase-preview-chip"
                className="px-2 py-0.5 rounded-lg text-xs font-extrabold border"
                style={getTintedPillStyle(activeStoreCfg?.color ?? '#64748B')}
              >
                {previewChip}
              </span>
            </div>
            <input
              type="text"
              data-testid="purchase-shorthand-input"
              value={shorthand}
              onChange={(e) => handleShorthandChange(e.target.value)}
              placeholder="mis. H13, H9,5, P10, In21, 2H29"
              className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-[15px] font-bold text-slate-900 placeholder:font-normal placeholder:text-stone-400 outline-none"
            />
          </div>

          {/* Dynamic Store Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Tempat Beli
            </label>
            <div className="flex flex-wrap gap-1.5">
              {stores.map((s) => {
                const active = store === s.id
                const refPrice = productRef.prices[s.id]?.price
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`purchase-store-${s.id}`}
                    onClick={() => handleStorePick(s.id)}
                    className="min-h-12 px-3 py-1 rounded-xl border flex flex-col justify-center transition-all cursor-pointer"
                    style={
                      active
                        ? getSolidPillStyle(s.color)
                        : getTintedPillStyle(s.color)
                    }
                  >
                    <span className="text-xs font-bold">
                      {s.shortLabel} ({s.code})
                    </span>
                    {refPrice && refPrice > 0 && (
                      <span
                        className={`text-[10px] font-semibold tabular-nums ${
                          active ? 'text-white/90' : 'opacity-75'
                        }`}
                      >
                        {formatRupiah(refPrice)}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Price (Rp) + Optional Qty/Brand Note */}
          <div className="grid grid-cols-5 gap-2.5">
            <div className="col-span-3 space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Harga (Rp)
              </label>
              <div className="flex items-center gap-1.5 min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
                <span className="text-xs font-bold text-stone-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="purchase-price-input"
                  value={priceText}
                  onChange={(e) =>
                    setPriceText(e.target.value.replace(/[^\d]/g, ''))
                  }
                  placeholder="13000"
                  className="w-full min-w-0 bg-transparent text-base font-bold text-slate-900 outline-none tabular-nums"
                />
              </div>
            </div>

            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Qty / Merk
              </label>
              <input
                type="text"
                data-testid="purchase-qty-input"
                value={qtyNote}
                onChange={(e) => setQtyNote(e.target.value)}
                placeholder="mis. 2 / Sania"
                className="w-full min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-semibold text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editingEntry && (
              <button
                type="button"
                data-testid="purchase-delete-btn"
                onClick={() => {
                  onDelete(editingEntry.id)
                  onClose()
                }}
                aria-label="Hapus catatan ini"
                className="min-h-12 min-w-12 px-3.5 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center cursor-pointer shrink-0"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              data-testid="purchase-save-btn"
              className="flex-1 min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              {editingEntry ? 'Simpan Perubahan' : 'Catat ke Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
