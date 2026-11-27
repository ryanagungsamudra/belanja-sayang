import { ChefHat, Plus, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { GlassSheetModal } from './GlassSheetModal'
import {
  formatIdrInput,
  formatRupiah,
  generateId,
  parseIdrInput,
} from '../lib/format'
import {
  getReferencePriceForStore,
  getSolidPillStyle,
  getTintedPillStyle,
} from '../lib/stores'
import type {
  CategoryConfig,
  MarketCategory,
  MealTemplate,
  MealTemplateItem,
  ProductReference,
  StoreConfig,
  StoreSource,
  UpsertTemplateInput,
} from '../types/market'

const EMOJI_CHOICES = ['🍲', '🌶️', '🍳', '🥗', '🍛', '🐟', '🥩', '🍜', '🧺']

interface TemplateEditorModalProps {
  isOpen: boolean
  editingTemplate: MealTemplate | null
  stores: StoreConfig[]
  categories: CategoryConfig[]
  productRefs: ProductReference[]
  resolveDetectedCategory: (name: string) => MarketCategory
  onClose: () => void
  onSave: (input: UpsertTemplateInput) => void
}

export function TemplateEditorModal({
  isOpen,
  editingTemplate,
  stores,
  categories,
  productRefs,
  resolveDetectedCategory,
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const [name, setName] = useState(editingTemplate?.name ?? '')
  const [emoji, setEmoji] = useState(editingTemplate?.emoji ?? '🍲')
  const [description, setDescription] = useState(
    editingTemplate?.description ?? '',
  )
  const [items, setItems] = useState<MealTemplateItem[]>(
    editingTemplate?.items.map((item) => ({ ...item })) ?? [],
  )

  const [newIngName, setNewIngName] = useState('')
  const [newIngQty, setNewIngQty] = useState('1')
  const [newIngPrice, setNewIngPrice] = useState('')
  const [newIngStore, setNewIngStore] = useState<string>('')
  const [showRefPicker, setShowRefPicker] = useState(false)
  const [refSearch, setRefSearch] = useState('')

  // productRefs is already sorted A-Z
  const matchingRefs = useMemo(() => {
    const q = refSearch.trim().toLowerCase()
    if (!q) return productRefs.slice(0, 10)
    return productRefs
      .filter((r) => r.name.toLowerCase().includes(q))
      .slice(0, 10)
  }, [productRefs, refSearch])

  if (!isOpen) return null

  const totalEstimate = items.reduce(
    (sum, item) => sum + (item.estimatedPrice || 0),
    0,
  )

  const handleUpdateIngredient = (
    id: string,
    patch: Partial<MealTemplateItem>,
  ) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  const handleRemoveIngredient = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleAddIngredient = () => {
    const trimmed = newIngName.trim()
    if (!trimmed) return
    const parsedPrice = parseIdrInput(newIngPrice)
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        name: trimmed,
        quantity: newIngQty.trim() || '1',
        category: resolveDetectedCategory(trimmed),
        estimatedPrice: parsedPrice,
        store: newIngStore || null,
      },
    ])
    setNewIngName('')
    setNewIngQty('1')
    setNewIngPrice('')
    setNewIngStore('')
  }

  const handlePickFromRef = (ref: ProductReference) => {
    const resolved = getReferencePriceForStore(ref, null, stores)
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        name: ref.name,
        quantity: ref.defaultQuantity,
        category: ref.category,
        estimatedPrice: resolved.price,
        store: null,
      },
    ])
    setShowRefPicker(false)
    setRefSearch('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || items.length === 0) return
    onSave({
      id: editingTemplate?.id,
      name: name.trim(),
      emoji,
      description: description.trim(),
      items,
    })
    onClose()
  }

  return (
    <GlassSheetModal
      ariaLabel={editingTemplate ? 'Edit Paket Masak' : 'Buat Paket Masak'}
      maxHeightClass="max-h-[90dvh]"
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {editingTemplate ? 'Edit Paket Masak' : 'Buat Paket Masak'}
              </h2>
              <p className="text-xs text-stone-500">
                {items.length} bahan · Estimasi {formatRupiah(totalEstimate)}
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
          className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {EMOJI_CHOICES.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`min-w-10 min-h-10 rounded-xl text-lg flex items-center justify-center border shrink-0 transition-all cursor-pointer ${
                    emoji === em
                      ? 'bg-emerald-50 border-emerald-500 scale-105'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              data-testid="tpl-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama paket (mis. Sop Ayam Kampung)"
              className="w-full min-h-12 px-3.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-[15px] font-bold text-slate-900 outline-none"
            />

            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Deskripsi singkat (opsional)"
              className="w-full min-h-11 px-3.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-700 outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Daftar Bahan ({items.length})
              </span>
              <button
                type="button"
                data-testid="tpl-pick-ref-toggle"
                onClick={() => setShowRefPicker((prev) => !prev)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
              >
                {showRefPicker ? 'Tutup Referensi' : '+ Pilih dari Catatan (A–Z)'}
              </button>
            </div>

            {showRefPicker && (
              <div className="bg-emerald-50/70 rounded-2xl border border-emerald-200 p-3 space-y-2 animate-liquid-panel">
                <div className="min-h-10 bg-white rounded-xl border border-emerald-200 px-3 flex items-center gap-2">
                  <Search className="w-4 h-4 text-emerald-600 shrink-0" />
                  <input
                    type="text"
                    value={refSearch}
                    onChange={(e) => setRefSearch(e.target.value)}
                    placeholder="Cari bahan..."
                    className="flex-1 min-w-0 bg-transparent text-xs font-medium text-slate-900 outline-none"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {matchingRefs.map((ref) => {
                    const resolved = getReferencePriceForStore(ref, null, stores)
                    return (
                      <button
                        key={ref.id}
                        type="button"
                        data-testid={`tpl-ref-chip-${ref.id}`}
                        onClick={() => handlePickFromRef(ref)}
                        className="min-h-9 px-2.5 rounded-xl bg-white border border-emerald-200 hover:border-emerald-500 text-xs font-semibold text-slate-800 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{ref.name}</span>
                        {resolved.price > 0 && (
                          <span className="text-[11px] text-emerald-700 font-bold">
                            {formatRupiah(resolved.price)}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  data-testid={`tpl-ingredient-row-${idx}`}
                  className="bg-white rounded-2xl border border-stone-200/90 p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.name}
                      aria-label={`Nama bahan ${idx + 1}`}
                      onChange={(e) =>
                        handleUpdateIngredient(item.id, {
                          name: e.target.value,
                        })
                      }
                      className="flex-1 min-w-0 min-h-10 px-2.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-sm font-semibold text-slate-900 outline-none"
                    />
                    <button
                      type="button"
                      aria-label={`Hapus bahan ${item.name}`}
                      onClick={() => handleRemoveIngredient(item.id)}
                      className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="text"
                      value={item.quantity}
                      aria-label="Jumlah bahan"
                      onChange={(e) =>
                        handleUpdateIngredient(item.id, {
                          quantity: e.target.value,
                        })
                      }
                      placeholder="Jumlah"
                      className="w-full min-w-0 min-h-10 px-2.5 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-slate-800 outline-none"
                    />

                    <div className="flex items-center gap-1 min-w-0 min-h-10 px-2 rounded-xl bg-stone-50 border border-stone-200">
                      <span className="text-[10px] font-bold text-stone-400">
                        Rp
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        aria-label="Harga bahan"
                        value={formatIdrInput(item.estimatedPrice)}
                        onChange={(e) =>
                          handleUpdateIngredient(item.id, {
                            estimatedPrice: parseIdrInput(e.target.value),
                          })
                        }
                        placeholder="0"
                        className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-900 outline-none tabular-nums"
                      />
                    </div>

                    <select
                      value={item.store ?? ''}
                      aria-label="Toko bahan"
                      onChange={(e) =>
                        handleUpdateIngredient(item.id, {
                          store: (e.target.value || null) as StoreSource | null,
                        })
                      }
                      className="w-full min-w-0 min-h-10 px-2 rounded-xl bg-stone-50 border border-stone-200 text-xs font-semibold text-slate-700 outline-none"
                    >
                      <option value="">Pilih nanti</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          handleUpdateIngredient(item.id, {
                            category: cat.id,
                          })
                        }
                        className="px-2 py-1 rounded-lg text-[10px] font-bold border shrink-0 cursor-pointer"
                        style={
                          item.category === cat.id
                            ? getSolidPillStyle(cat.color)
                            : getTintedPillStyle(cat.color)
                        }
                      >
                        {cat.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-stone-100/80 rounded-2xl border border-dashed border-stone-300 p-3 space-y-2">
              <p className="text-[11px] font-bold text-stone-600">
                Tambah Bahan Baru ke Paket
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="text"
                  data-testid="tpl-new-ing-name"
                  value={newIngName}
                  onChange={(e) => setNewIngName(e.target.value)}
                  placeholder="Nama bahan..."
                  className="col-span-2 w-full min-w-0 min-h-11 px-3 rounded-xl bg-white border border-stone-200 text-sm font-medium text-slate-900 outline-none"
                />
                <input
                  type="text"
                  data-testid="tpl-new-ing-qty"
                  value={newIngQty}
                  onChange={(e) => setNewIngQty(e.target.value)}
                  placeholder="1 kg"
                  className="w-full min-w-0 min-h-11 px-2.5 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-slate-900 outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 min-w-0 flex items-center gap-1 min-h-11 px-2.5 rounded-xl bg-white border border-stone-200">
                  <span className="text-[11px] font-bold text-stone-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    data-testid="tpl-new-ing-price"
                    value={newIngPrice}
                    onChange={(e) =>
                      setNewIngPrice(formatIdrInput(e.target.value))
                    }
                    placeholder="Estimasi"
                    className="w-full min-w-0 bg-transparent text-xs font-bold text-slate-900 outline-none tabular-nums"
                  />
                </div>
                <select
                  value={newIngStore}
                  onChange={(e) => setNewIngStore(e.target.value)}
                  className="min-w-0 min-h-11 px-2 rounded-xl bg-white border border-stone-200 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="">Toko nanti</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shortLabel}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="tpl-add-ing-btn"
                  onClick={handleAddIngredient}
                  className="min-h-11 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || items.length === 0}
            data-testid="tpl-save-btn"
            className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
          >
            {editingTemplate ? 'Simpan Perubahan Paket' : 'Buat Paket Masak'}
          </button>
        </form>
    </GlassSheetModal>
  )
}
