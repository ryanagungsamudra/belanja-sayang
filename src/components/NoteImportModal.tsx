import { Check, Copy, FileText, Upload, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  exportMonthlyNoteText,
  formatMonthLabel,
  parseMonthlyNoteText,
} from '../lib/noteParser'
import type {
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
} from '../types/market'

interface NoteImportModalProps {
  isOpen: boolean
  monthKey: string
  stores: StoreConfig[]
  productRefs: ProductReference[]
  monthEntries: MonthlyPurchaseEntry[]
  onClose: () => void
  onImport: (rawText: string) => void
}

export function NoteImportModal({
  isOpen,
  monthKey,
  stores,
  productRefs,
  monthEntries,
  onClose,
  onImport,
}: NoteImportModalProps) {
  const [rawText, setRawText] = useState('')
  const [copied, setCopied] = useState(false)

  const preview = useMemo(() => {
    const lines = parseMonthlyNoteText(rawText, stores)
    const entriesCount = lines.reduce((sum, l) => sum + l.entries.length, 0)
    return { productsCount: lines.length, entriesCount }
  }, [rawText, stores])

  if (!isOpen) return null

  const handleCopyCurrent = async () => {
    const text = exportMonthlyNoteText(
      monthKey,
      productRefs,
      monthEntries,
      stores,
    )
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setRawText(text)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (preview.entriesCount === 0) return
    onImport(rawText)
    setRawText('')
    onClose()
  }

  const codeHints = stores.map((s) => `${s.code}=${s.shortLabel}`).join(', ')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Impor & Salin Catatan Teks"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[88dvh] bg-[#FAF9F6] rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up"
      >
        <div className="px-5 pt-4 pb-3 bg-white border-b border-stone-200/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Impor / Salin Catatan
              </h2>
              <p className="text-xs text-stone-500">
                {formatMonthLabel(monthKey)}
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
          <button
            type="button"
            data-testid="copy-note-btn"
            onClick={() => void handleCopyCurrent()}
            className="w-full min-h-12 px-4 rounded-2xl bg-white border border-stone-200 hover:border-emerald-400 text-slate-800 text-xs font-bold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">
                  Catatan bulan ini disalin!
                </span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-emerald-600" />
                <span>
                  Salin Catatan {formatMonthLabel(monthKey)} ke Clipboard
                </span>
              </>
            )}
          </button>

          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Tempel Catatan Belanja (WhatsApp / Notes)
            </label>
            <textarea
              rows={7}
              data-testid="import-note-textarea"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Contoh:\nbawang merah H13/ H7/ H9,5/\nsari roti H20/ In21/\nkemiri P10/`}
              className="w-full p-3.5 rounded-2xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-medium text-slate-900 placeholder:text-stone-400 outline-none resize-none leading-relaxed"
            />
            <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
              <span className="text-stone-500">Kode: {codeHints}</span>
              {preview.entriesCount > 0 && (
                <span className="font-bold text-emerald-700">
                  Terbaca {preview.productsCount} produk ({preview.entriesCount}{' '}
                  beli)
                </span>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={preview.entriesCount === 0}
            data-testid="import-note-submit"
            className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>
              Impor ke {formatMonthLabel(monthKey)}
              {preview.entriesCount > 0
                ? ` (${preview.entriesCount} catatan)`
                : ''}
            </span>
          </button>
        </form>
      </div>
    </div>
  )
}
