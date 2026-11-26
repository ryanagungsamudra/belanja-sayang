import { Pencil, Plus, SlidersHorizontal, Store, Tag, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { COLOR_PALETTE, getTintedPillStyle } from '../lib/stores'
import type { CategoryConfig, StoreConfig } from '../types/market'
import { LiquidSegmentedTabs } from './LiquidSegmentedTabs'

interface ManageConfigModalProps {
  isOpen: boolean
  initialTab?: 'stores' | 'categories'
  stores: StoreConfig[]
  categories: CategoryConfig[]
  onClose: () => void
  onSaveStore: (input: {
    id?: string
    name: string
    shortLabel?: string
    code: string
    color: string
  }) => void
  onDeleteStore: (id: string) => void
  onSaveCategory: (input: {
    id?: string
    name: string
    shortLabel?: string
    color: string
  }) => void
  onDeleteCategory: (id: string) => void
}

export function ManageConfigModal({
  isOpen,
  initialTab = 'stores',
  stores,
  categories,
  onClose,
  onSaveStore,
  onDeleteStore,
  onSaveCategory,
  onDeleteCategory,
}: ManageConfigModalProps) {
  const [tab, setTab] = useState<'stores' | 'categories'>(initialTab)

  // Store form state
  const [editingStoreId, setEditingStoreId] = useState<string | undefined>(
    undefined,
  )
  const [storeName, setStoreName] = useState('')
  const [storeCode, setStoreCode] = useState('')
  const [storeColor, setStoreColor] = useState(COLOR_PALETTE[0])

  // Category form state
  const [editingCatId, setEditingCatId] = useState<string | undefined>(
    undefined,
  )
  const [catName, setCatName] = useState('')
  const [catShort, setCatShort] = useState('')
  const [catColor, setCatColor] = useState(COLOR_PALETTE[3])

  if (!isOpen) return null

  const resetStoreForm = () => {
    setEditingStoreId(undefined)
    setStoreName('')
    setStoreCode('')
    setStoreColor(COLOR_PALETTE[0])
  }

  const resetCatForm = () => {
    setEditingCatId(undefined)
    setCatName('')
    setCatShort('')
    setCatColor(COLOR_PALETTE[3])
  }

  const handleStoreSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!storeName.trim()) return
    onSaveStore({
      id: editingStoreId,
      name: storeName.trim(),
      shortLabel: storeName.trim(),
      code: storeCode.trim() || storeName.trim().slice(0, 2).toUpperCase(),
      color: storeColor,
    })
    resetStoreForm()
  }

  const handleCategorySubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!catName.trim()) return
    onSaveCategory({
      id: editingCatId,
      name: catName.trim(),
      shortLabel: catShort.trim() || catName.trim().split(' ')[0],
      color: catColor,
    })
    resetCatForm()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Kelola Toko dan Kategori"
        onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full max-w-md max-h-[88dvh] rounded-t-3xl flex flex-col overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 bg-white/60 backdrop-blur-md border-b border-white/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Kelola Toko & Kategori
              </h2>
              <p className="text-xs text-stone-500">
                Tambah atau ubah tempat belanja & kategori sesukamu
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="min-w-11 min-h-11 rounded-2xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Liquid Glass Segmented Tab Switcher */}
        <div className="px-4 pt-3 shrink-0">
          <LiquidSegmentedTabs
            ariaLabel="Pilih Pengaturan"
            size="md"
            value={tab}
            onChange={setTab}
            options={[
              {
                id: 'stores',
                label: `Toko (${stores.length})`,
                icon: <Store className="w-3.5 h-3.5 shrink-0" />,
                testId: 'manage-tab-stores',
              },
              {
                id: 'categories',
                label: `Kategori (${categories.length})`,
                icon: <Tag className="w-3.5 h-3.5 shrink-0" />,
                testId: 'manage-tab-categories',
              },
            ]}
          />
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {tab === 'stores' ? (
            <>
              {/* Existing Stores List */}
              <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 overflow-hidden">
                {stores.map((s) => (
                  <div
                    key={s.id}
                    data-testid={`manage-store-row-${s.id}`}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="px-2 py-0.5 rounded-lg text-xs font-extrabold border shrink-0"
                        style={getTintedPillStyle(s.color)}
                      >
                        {s.code}
                      </span>
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit toko ${s.name}`}
                        onClick={() => {
                          setEditingStoreId(s.id)
                          setStoreName(s.name)
                          setStoreCode(s.code)
                          setStoreColor(s.color)
                        }}
                        className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-400 hover:text-slate-800 hover:bg-stone-100 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={stores.length <= 1}
                        aria-label={`Hapus toko ${s.name}`}
                        onClick={() => onDeleteStore(s.id)}
                        className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add / Edit Store Form */}
              <form
                onSubmit={handleStoreSubmit}
                className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {editingStoreId
                      ? 'Edit Tempat Belanja'
                      : 'Tambah Tempat Belanja Baru'}
                  </p>
                  {editingStoreId && (
                    <button
                      type="button"
                      onClick={resetStoreForm}
                      className="text-xs font-bold text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    data-testid="new-store-name-input"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="mis. Superindo"
                    className="col-span-2 min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-sm font-semibold text-slate-900 outline-none"
                  />
                  <input
                    type="text"
                    maxLength={4}
                    data-testid="new-store-code-input"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value)}
                    placeholder="Kode (S)"
                    className="min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-sm font-bold text-slate-900 outline-none"
                  />
                </div>

                {/* Color Picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Pilih warna ${hex}`}
                      onClick={() => setStoreColor(hex)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        storeColor === hex
                          ? 'scale-115 ring-2 ring-offset-2 ring-slate-900'
                          : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  data-testid="save-store-btn"
                  className="w-full min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingStoreId ? 'Simpan Perubahan Toko' : 'Tambah Toko'}
                  </span>
                </button>
              </form>
            </>
          ) : (
            <>
              {/* Existing Categories List */}
              <div className="bg-white rounded-2xl border border-stone-200/80 divide-y divide-stone-100 overflow-hidden">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    data-testid={`manage-cat-row-${cat.id}`}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {cat.name}
                        </p>
                        <p className="text-[11px] text-stone-400">
                          Label singkat: {cat.shortLabel}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit kategori ${cat.name}`}
                        data-testid={`edit-cat-btn-${cat.id}`}
                        onClick={() => {
                          setEditingCatId(cat.id)
                          setCatName(cat.name)
                          setCatShort(cat.shortLabel)
                          setCatColor(cat.color)
                        }}
                        className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-400 hover:text-slate-800 hover:bg-stone-100 cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={categories.length <= 1}
                        aria-label={`Hapus kategori ${cat.name}`}
                        onClick={() => onDeleteCategory(cat.id)}
                        className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add / Edit Category Form */}
              <form
                onSubmit={handleCategorySubmit}
                className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    {editingCatId ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                  </p>
                  {editingCatId && (
                    <button
                      type="button"
                      onClick={resetCatForm}
                      className="text-xs font-bold text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      Batal
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    data-testid="new-cat-name-input"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="mis. Jajanan & Minuman"
                    className="col-span-2 min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-sm font-semibold text-slate-900 outline-none"
                  />
                  <input
                    type="text"
                    data-testid="new-cat-short-input"
                    value={catShort}
                    onChange={(e) => setCatShort(e.target.value)}
                    placeholder="Singkat"
                    className="min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-sm font-semibold text-slate-900 outline-none"
                  />
                </div>

                {/* Color Picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PALETTE.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Pilih warna ${hex}`}
                      onClick={() => setCatColor(hex)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer ${
                        catColor === hex
                          ? 'scale-115 ring-2 ring-offset-2 ring-slate-900'
                          : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  data-testid="save-cat-btn"
                  className="w-full min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {editingCatId
                      ? 'Simpan Perubahan Kategori'
                      : 'Tambah Kategori'}
                  </span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
