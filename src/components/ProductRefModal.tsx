import { History, Store, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { GlassSheetModal } from './GlassSheetModal'
import { formatIdrInput, formatRupiah, parseIdrInput } from '../lib/format'
import { formatMonthLabel, formatPurchaseChip } from '../lib/noteParser'
import { getSolidPillStyle, getTintedPillStyle } from '../lib/stores'
import type {
  CategoryConfig,
  MarketCategory,
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
  StoreSource,
  UpsertProductRefInput,
} from '../types/market'

interface ProductRefModalProps {
  isOpen: boolean
  editingRef: ProductReference | null
  initialFocusStore?: StoreSource
  stores: StoreConfig[]
  categories: CategoryConfig[]
  productHistory?: MonthlyPurchaseEntry[]
  resolveDetectedCategory: (name: string) => MarketCategory
  onClose: () => void
  onSave: (input: UpsertProductRefInput) => void
  onDelete?: (id: string) => void
}

export function ProductRefModal({
  isOpen,
  editingRef,
  initialFocusStore,
  stores,
  categories,
  productHistory = [],
  resolveDetectedCategory,
  onClose,
  onSave,
  onDelete,
}: ProductRefModalProps) {
  const [name, setName] = useState(editingRef?.name ?? '')
  const [defaultQuantity, setDefaultQuantity] = useState(
    editingRef?.defaultQuantity ?? '1',
  )
  const [category, setCategory] = useState<MarketCategory>(
    editingRef?.category ?? categories[0]?.id ?? 'Lainnya',
  )
  const [manualCategory, setManualCategory] = useState(Boolean(editingRef))
  const [preferredStore, setPreferredStore] = useState<StoreSource>(
    editingRef?.preferredStore ??
      initialFocusStore ??
      stores[0]?.id ??
      'hypermart',
  )
  const [storePrices, setStorePrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const s of stores) {
      const p = editingRef?.prices[s.id]?.price
      map[s.id] = p && p > 0 ? formatIdrInput(p) : ''
    }
    return map
  })
  const [notes, setNotes] = useState(editingRef?.notes ?? '')

  // Group multi-month purchase history (newest 6 months) + calculate price trend
  const monthlyHistory = useMemo(() => {
    if (!editingRef || productHistory.length === 0) return []
    const byMonth = new Map<string, MonthlyPurchaseEntry[]>()
    for (const e of productHistory) {
      const list = byMonth.get(e.monthKey) ?? []
      list.push(e)
      byMonth.set(e.monthKey, list)
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([monthKey, entries]) => {
        const priced = entries.filter((e) => e.price > 0)
        const avgPrice =
          priced.length > 0
            ? Math.round(
                priced.reduce((sum, e) => sum + e.price, 0) / priced.length,
              )
            : 0
        return { monthKey, entries, avgPrice }
      })
  }, [editingRef, productHistory])

  const priceTrendPct = useMemo(() => {
    const pricedMonths = monthlyHistory.filter((m) => m.avgPrice > 0)
    if (pricedMonths.length < 2) return null
    const latest = pricedMonths[0].avgPrice
    const prev = pricedMonths[1].avgPrice
    if (prev <= 0) return null
    return Math.round(((latest - prev) / prev) * 100)
  }, [monthlyHistory])

  if (!isOpen) return null

  const effectiveCategory = manualCategory
    ? category
    : resolveDetectedCategory(name)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const numericPrices: Record<string, number> = {}
    for (const s of stores) {
      numericPrices[s.id] = parseIdrInput(storePrices[s.id] ?? '')
    }

    onSave({
      id: editingRef?.id,
      name: name.trim(),
      defaultQuantity: defaultQuantity.trim() || '1',
      category: effectiveCategory,
      preferredStore,
      prices: numericPrices,
      notes: notes.trim() || undefined,
    })
    onClose()
  }

  return (
    <GlassSheetModal
      ariaLabel={
        editingRef ? 'Edit Produk & Referensi Harga' : 'Tambah Produk Baru'
      }
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingRef ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <p className="text-xs text-stone-500">
                Atur kategori & harga referensi per toko
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
          className="flex-1 overflow-y-auto p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Nama Bahan / Produk
              </label>
              <input
                type="text"
                required
                data-testid="ref-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="mis. Minyak Goreng 2L"
                className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-[15px] font-semibold text-slate-900 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Satuan
              </label>
              <input
                type="text"
                data-testid="ref-qty-input"
                value={defaultQuantity}
                onChange={(e) => setDefaultQuantity(e.target.value)}
                placeholder="1 kg"
                className="w-full min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-medium text-slate-900 outline-none"
              />
            </div>
          </div>

          {/* Dynamic Store Price Inputs */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-2.5">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              Referensi Harga per Toko (Rp)
            </p>

            {stores.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-2.5 min-h-11 px-3 rounded-xl border bg-stone-50/70 focus-within:bg-white transition-colors"
                style={{ borderColor: `${s.color}40` }}
              >
                <span
                  className="text-xs font-bold w-28 shrink-0 truncate"
                  style={{ color: s.color }}
                >
                  {s.code} · {s.shortLabel}
                </span>
                <span className="text-xs font-semibold text-stone-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid={`ref-price-${s.id}`}
                  autoFocus={initialFocusStore === s.id}
                  value={storePrices[s.id] ?? ''}
                  onChange={(e) =>
                    setStorePrices((prev) => ({
                      ...prev,
                      [s.id]: formatIdrInput(e.target.value),
                    }))
                  }
                  placeholder="Belum dicatat"
                  className="flex-1 min-w-0 bg-transparent text-sm font-bold text-slate-900 outline-none tabular-nums"
                />
              </label>
            ))}
          </div>

          {/* Multi-Month Price History & Trend */}
          {monthlyHistory.length > 0 && (
            <div
              data-testid="product-price-history"
              className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide inline-flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Riwayat Harga ({monthlyHistory.length} bln)</span>
                </p>
                {priceTrendPct !== null && priceTrendPct !== 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10.5px] font-extrabold tabular-nums ${
                      priceTrendPct > 0
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {priceTrendPct > 0 ? `▲ +${priceTrendPct}%` : `▼ ${priceTrendPct}%`}
                  </span>
                )}
              </div>

              <div className="divide-y divide-stone-100">
                {monthlyHistory.map((row) => (
                  <div
                    key={row.monthKey}
                    className="py-1.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-stone-600 capitalize shrink-0">
                      {formatMonthLabel(row.monthKey)}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {row.entries.slice(-3).map((e) => (
                        <span
                          key={e.id}
                          className="px-1.5 py-0.5 rounded-md bg-stone-100 text-slate-700 text-[10.5px] font-bold tabular-nums"
                        >
                          {formatPurchaseChip(e, stores)}
                        </span>
                      ))}
                      {row.avgPrice > 0 && (
                        <span className="text-[11px] font-extrabold text-emerald-700 tabular-nums ml-0.5">
                          {formatRupiah(row.avgPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preferred Store */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Toko Utama (Default)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {stores.map((s) => {
                const active = preferredStore === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPreferredStore(s.id)}
                    className="min-h-10 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer"
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
            </div>
          </div>

          {/* Dynamic Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Kategori
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => {
                const selected = effectiveCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategory(cat.id)
                      setManualCategory(true)
                    }}
                    className="min-h-10 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    style={
                      selected
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

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="mis. Merk Sania / Lapak Bu Siti"
              className="w-full min-h-11 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-medium text-slate-900 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            {editingRef && onDelete && (
              <button
                type="button"
                aria-label={`Hapus ${editingRef.name}`}
                onClick={() => {
                  onDelete(editingRef.id)
                  onClose()
                }}
                className="min-h-12 min-w-12 px-3.5 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              data-testid="ref-save-btn"
              className="flex-1 min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              {editingRef ? 'Simpan Perubahan' : 'Simpan Produk Baru'}
            </button>
          </div>
        </form>
    </GlassSheetModal>
  )
}
