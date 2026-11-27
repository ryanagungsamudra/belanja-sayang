import {
  BookmarkPlus,
  ChefHat,
  Pencil,
  Plus,
  ShoppingBasket,
  Trash2,
} from 'lucide-react'
import { formatRupiah } from '../lib/format'
import { findStore, getTintedPillStyle } from '../lib/stores'
import type { MarketItem, MealTemplate, StoreConfig } from '../types/market'

interface TemplatesViewProps {
  templates: MealTemplate[]
  stores: StoreConfig[]
  activeItems: MarketItem[]
  onCreateNew: () => void
  onEditTemplate: (tpl: MealTemplate) => void
  onSaveFromActive: () => void
  onApplyTemplate: (templateId: string) => void
  onDeleteTemplate: (templateId: string) => void
}

export function TemplatesView({
  templates,
  stores,
  activeItems,
  onCreateNew,
  onEditTemplate,
  onSaveFromActive,
  onApplyTemplate,
  onDeleteTemplate,
}: TemplatesViewProps) {
  return (
    <div className="space-y-3.5">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-slate-900">Paket Masak</h2>
          <p className="text-xs text-slate-600">
            Ubah bahan, harga &amp; toko, lalu masukkan ke keranjang
          </p>
        </div>
        <button
          type="button"
          data-testid="create-template-btn"
          onClick={onCreateNew}
          className="min-h-11 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shrink-0 liquid-press cursor-pointer"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Paket</span>
        </button>
      </div>

      {activeItems.length > 0 && (
        <button
          type="button"
          data-testid="save-active-as-template-btn"
          onClick={onSaveFromActive}
          className="surface-card w-full min-h-12 px-3.5 py-2.5 rounded-2xl hover:border-emerald-300 text-slate-800 text-xs font-bold flex items-center justify-between gap-2.5 transition-colors liquid-press cursor-pointer"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/70 flex items-center justify-center shrink-0">
              <BookmarkPlus className="w-4 h-4" />
            </span>
            <span className="truncate">
              Simpan Keranjang Aktif ({activeItems.length} item) sebagai Paket
            </span>
          </span>
          <Plus className="w-4 h-4 text-emerald-700 shrink-0" />
        </button>
      )}

      <div className="space-y-2.5">
        {templates.map((tpl) => {
          const tplTotal = tpl.items.reduce(
            (sum, i) => sum + (i.estimatedPrice || 0),
            0,
          )
          return (
            <article
              key={tpl.id}
              data-testid={`template-card-${tpl.id}`}
              className="surface-card rounded-2xl p-4 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-emerald-50/75 border border-emerald-200/60 text-emerald-700 text-xl flex items-center justify-center shrink-0">
                    {tpl.emoji || <ChefHat className="w-5 h-5" />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-bold text-slate-900 truncate">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-slate-600 tabular-nums">
                      {tpl.items.length} bahan
                      {tplTotal > 0 ? ` · ~${formatRupiah(tplTotal)}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center shrink-0">
                  <button
                    type="button"
                    data-testid={`edit-template-${tpl.id}`}
                    aria-label={`Edit paket ${tpl.name}`}
                    onClick={() => onEditTemplate(tpl)}
                    className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Hapus paket ${tpl.name}`}
                    onClick={() => onDeleteTemplate(tpl.id)}
                    className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {tpl.items.map((item) => {
                  const sCfg = findStore(stores, item.store)
                  return (
                    <span
                      key={item.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                    >
                      <span>{item.name}</span>
                      {sCfg && (
                        <span
                          className="text-[10px] font-bold px-1 rounded border"
                          style={getTintedPillStyle(sCfg.color)}
                        >
                          {sCfg.code}
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => onEditTemplate(tpl)}
                  className="glass-chip min-h-11 px-3 rounded-xl text-slate-700 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  data-testid={`apply-template-${tpl.id}`}
                  onClick={() => onApplyTemplate(tpl.id)}
                  className="flex-1 min-h-11 rounded-xl bg-emerald-600/95 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/25 border border-white/30 liquid-press cursor-pointer"
                >
                  <ShoppingBasket className="w-4 h-4" />
                  <span>Masukkan ke Keranjang</span>
                </button>
              </div>
            </article>
          )
        })}

        {templates.length === 0 && (
          <div className="surface-card rounded-2xl p-6 text-center space-y-3 animate-liquid-enter">
            <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
              <ChefHat className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">
              Belum ada paket masak
            </p>
            <button
              type="button"
              onClick={onCreateNew}
              className="min-h-11 px-4 rounded-xl bg-emerald-600/95 text-white text-xs font-bold liquid-press cursor-pointer"
            >
              + Buat Paket Pertama
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
