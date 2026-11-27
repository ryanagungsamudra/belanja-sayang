import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  BUDGET_SWATCH_COLORS,
  computeBudgetMonthSummary,
  getBudgetItemAllocation,
} from '../lib/budget'
import { formatIdrInput, formatRupiah, parseIdrInput } from '../lib/format'
import {
  formatCompactRupiahShort,
  formatMonthLabel,
} from '../lib/noteParser'
import { getSolidPillStyle, getTintedPillStyle } from '../lib/stores'
import type {
  BudgetEnvelopeItem,
  BudgetMonthRecord,
  BudgetPillarConfig,
  BudgetTrackingBehavior,
  BudgetTrackingModeConfig,
} from '../types/market'
import { GlassSheetModal } from './GlassSheetModal'
import { LiquidSegmentedTabs } from './LiquidSegmentedTabs'

const BEHAVIOR_OPTIONS: Array<{
  id: BudgetTrackingBehavior
  label: string
}> = [
  { id: 'bill', label: 'Tagihan Lunas ✓' },
  { id: 'counter', label: 'Hitungan Unit (+1)' },
  { id: 'spend', label: 'Catat Nominal (+Rp)' },
  { id: 'sweep', label: 'Dana Sosial (Sweep)' },
]

const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const

// ---------------------------------------------------------------------------
// 1. Lightweight Daily Realisasi Modal (Track Mode Row Tap)
// ---------------------------------------------------------------------------

interface BudgetRealisasiModalProps {
  item: BudgetEnvelopeItem
  mode: BudgetTrackingModeConfig
  month: BudgetMonthRecord
  onClose: () => void
  onSave: (patch: {
    actual: number
    count?: number
    paid?: boolean
    note?: string
  }) => void
}

export function BudgetRealisasiModal({
  item,
  mode,
  month,
  onClose,
  onSave,
}: BudgetRealisasiModalProps) {
  const allocation = getBudgetItemAllocation(item, [mode], month)
  const isBill = mode.behavior === 'bill'
  const isCounter = mode.behavior === 'counter'

  const [actualText, setActualText] = useState(() =>
    formatIdrInput(item.actual ?? (isBill ? allocation : 0)),
  )
  const [paid, setPaid] = useState(Boolean(item.paid))
  const [countText, setCountText] = useState(String(item.count ?? 0))
  const [note, setNote] = useState(item.note ?? '')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (isCounter) {
      const cnt = Math.max(0, Math.round(Number(countText) || 0))
      onSave({
        actual: cnt * (item.unitPrice || 0),
        count: cnt,
        note,
      })
    } else {
      const actualVal = parseIdrInput(actualText)
      onSave({
        actual: actualVal,
        paid: isBill ? paid : item.paid,
        note,
      })
    }
    onClose()
  }

  return (
    <GlassSheetModal ariaLabel={`Realisasi ${item.name}`} onClose={onClose}>
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 truncate">
            {item.name}
          </h2>
          <p className="text-xs text-stone-500">
            Alokasi: {formatRupiah(allocation)}
          </p>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {isBill && (
          <div className="flex items-center justify-between glass-chip rounded-2xl px-3.5 py-2.5">
            <span className="text-xs font-bold text-slate-700">
              Status Pembayaran Bulan Ini
            </span>
            <button
              type="button"
              onClick={() => setPaid((p) => !p)}
              className={`min-h-9 px-3 rounded-xl text-xs font-extrabold border liquid-press cursor-pointer ${
                paid
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                  : 'bg-white border-stone-300 text-slate-700'
              }`}
            >
              {paid ? 'Lunas ✓' : 'Belum Dibayar'}
            </button>
          </div>
        )}

        {isCounter ? (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Jumlah Terpakai ({item.unitLabel || 'x'} @{' '}
              {formatRupiah(item.unitPrice || 0)})
            </label>
            <input
              type="number"
              min={0}
              autoFocus
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-base font-extrabold text-slate-900 outline-none tabular-nums"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Realisasi Dibayar (Rp)
            </label>
            <div className="flex items-center gap-2 min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
              <span className="text-xs font-extrabold text-stone-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                data-testid="budget-realisasi-input"
                value={actualText}
                onChange={(e) => setActualText(formatIdrInput(e.target.value))}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-base font-extrabold text-slate-900 outline-none tabular-nums"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
            Catatan (Opsional)
          </label>
          <input
            type="text"
            enterKeyHint="done"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. Bayar tgl 2 via transfer"
            className="w-full min-h-11 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-medium text-slate-900 outline-none"
          />
        </div>

        <button
          type="submit"
          data-testid="budget-realisasi-save-btn"
          className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm liquid-press cursor-pointer"
        >
          Simpan Realisasi
        </button>
      </form>
    </GlassSheetModal>
  )
}

// ---------------------------------------------------------------------------
// 2. Full Envelope Create / Edit Modal (Used in "Atur Plan" Mode)
// ---------------------------------------------------------------------------

interface BudgetEnvelopeModalProps {
  editingItem: BudgetEnvelopeItem | null
  pillars: BudgetPillarConfig[]
  modes: BudgetTrackingModeConfig[]
  onClose: () => void
  onOpenConfig: (tab: 'pillars' | 'modes') => void
  onSave: (input: {
    id?: string
    pillarId: string
    modeId: string
    name: string
    budget: number
    actual?: number
    targetCount?: number
    count?: number
    unitPrice?: number
    unitLabel?: string
    isRecurring?: boolean
    note?: string
  }) => void
  onDelete?: (itemId: string) => void
}

export function BudgetEnvelopeModal({
  editingItem,
  pillars,
  modes,
  onClose,
  onOpenConfig,
  onSave,
  onDelete,
}: BudgetEnvelopeModalProps) {
  const [name, setName] = useState(editingItem?.name ?? '')
  const [pillarId, setPillarId] = useState(
    editingItem?.pillarId ?? pillars[0]?.id ?? 'p1',
  )
  const [modeId, setModeId] = useState(
    editingItem?.modeId ?? modes[0]?.id ?? 'mode-bill',
  )
  const [budgetText, setBudgetText] = useState(() =>
    formatIdrInput(editingItem?.budget ?? 150000),
  )
  const [actualText, setActualText] = useState(() =>
    formatIdrInput(editingItem?.actual ?? 0),
  )
  const [unitPriceText, setUnitPriceText] = useState(() =>
    formatIdrInput(editingItem?.unitPrice ?? 25000),
  )
  const [targetCountText, setTargetCountText] = useState(
    String(editingItem?.targetCount ?? 4),
  )
  const [countText, setCountText] = useState(String(editingItem?.count ?? 0))
  const [unitLabel, setUnitLabel] = useState(editingItem?.unitLabel ?? 'x')
  const [isRecurring, setIsRecurring] = useState<boolean>(
    editingItem?.isRecurring !== false,
  )
  const [note, setNote] = useState(editingItem?.note ?? '')
  const [formError, setFormError] = useState('')

  const selectedMode = modes.find((m) => m.id === modeId) ?? modes[0]
  const isCounter = selectedMode?.behavior === 'counter'
  const isAuto = selectedMode?.behavior === 'auto'

  const selectableModes = editingItem
    ? modes
    : modes.filter((m) => m.behavior !== 'auto')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setFormError('Masukkan nama pos pengeluaran terlebih dahulu.')
      return
    }
    onSave({
      id: editingItem?.id,
      pillarId,
      modeId,
      name: name.trim(),
      budget: parseIdrInput(budgetText),
      actual: editingItem && !isAuto ? parseIdrInput(actualText) : undefined,
      targetCount: isCounter
        ? Math.max(1, Math.round(Number(targetCountText) || 1))
        : undefined,
      count:
        isCounter && editingItem
          ? Math.max(0, Math.round(Number(countText) || 0))
          : undefined,
      unitPrice: isCounter ? parseIdrInput(unitPriceText) : undefined,
      unitLabel: isCounter ? unitLabel.trim() || 'x' : undefined,
      isRecurring,
      note: note.trim() || undefined,
    })
    onClose()
  }

  return (
    <GlassSheetModal
      ariaLabel={editingItem ? `Edit ${editingItem.name}` : 'Tambah Pos Baru'}
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            {editingItem ? 'Edit Pos Pengeluaran' : 'Tambah Pos Pengeluaran Baru'}
          </h2>
          <p className="text-xs text-stone-500">
            Atur alokasi, pilar, dan mode tracking
          </p>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex-1 overflow-y-auto p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {formError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 animate-liquid-panel">
            {formError}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
            Nama Pos {!editingItem ? '(Add-On)' : ''}
          </label>
          <input
            type="text"
            data-testid="budget-env-name-input"
            value={name}
            onChange={(e) => {
              setFormError('')
              setName(e.target.value)
            }}
            placeholder="mis. Servis Motor / Vitamin / Cicilan"
            className="w-full min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-[15px] font-bold text-slate-900 outline-none"
          />
        </div>

        {/* 1-Tap Liquid Glass Pillar Chips (zero dropdown clipping!) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Pilar Anggaran
            </label>
            <button
              type="button"
              onClick={() => onOpenConfig('pillars')}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              + Atur Pilar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {pillars.map((p) => {
              const selected = pillarId === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPillarId(p.id)}
                  className="min-h-9 px-3 rounded-xl text-xs font-bold border liquid-press cursor-pointer"
                  style={
                    selected
                      ? getSolidPillStyle(p.color)
                      : getTintedPillStyle(p.color)
                  }
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>

        {/* 2-Column Mode Tracking Selector Tiles */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Mode Tracking
            </label>
            <button
              type="button"
              onClick={() => onOpenConfig('modes')}
              className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
            >
              + Atur Mode
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {selectableModes.map((m) => {
              const selected = modeId === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={Boolean(editingItem?.autoLink)}
                  onClick={() => {
                    setModeId(m.id)
                    if (m.behavior === 'counter' && m.unitLabel) {
                      setUnitLabel(m.unitLabel)
                    }
                  }}
                  className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                    selected
                      ? 'bg-emerald-50/90 border-emerald-500 ring-1 ring-emerald-500/30 text-emerald-900'
                      : 'bg-white border-stone-200 text-slate-700 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-extrabold truncate">
                      {m.label}
                    </span>
                    {selected && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500 truncate mt-0.5">
                    {m.desc}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Live IDR Money / Counter Fields */}
        {isCounter ? (
          <div className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">
                  Tarif @ (Rp)
                </label>
                <div className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
                  <span className="text-xs font-bold text-stone-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={unitPriceText}
                    onChange={(e) =>
                      setUnitPriceText(formatIdrInput(e.target.value))
                    }
                    placeholder="25.000"
                    className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-slate-900 outline-none tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">
                  Satuan
                </label>
                <input
                  type="text"
                  value={unitLabel}
                  onChange={(e) => setUnitLabel(e.target.value)}
                  placeholder="hari"
                  className="w-full min-h-11 px-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-xs font-bold text-slate-900 outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase">
                  Target / Bulan
                </label>
                <input
                  type="number"
                  min={1}
                  value={targetCountText}
                  onChange={(e) => setTargetCountText(e.target.value)}
                  className="w-full min-h-11 px-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-extrabold text-slate-900 outline-none tabular-nums"
                />
              </div>
              {editingItem && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase">
                    Sudah Terpakai
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={countText}
                    onChange={(e) => setCountText(e.target.value)}
                    className="w-full min-h-11 px-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-extrabold text-slate-900 outline-none tabular-nums"
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div
            className={`grid ${editingItem ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5`}
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase">
                Alokasi Bulanan (Rp)
              </label>
              <div className="flex items-center gap-1.5 min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
                <span className="text-xs font-bold text-stone-400">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  data-testid="budget-env-amount-input"
                  value={budgetText}
                  onChange={(e) =>
                    setBudgetText(formatIdrInput(e.target.value))
                  }
                  placeholder="150.000"
                  className="flex-1 min-w-0 bg-transparent text-base font-extrabold text-slate-900 outline-none tabular-nums"
                />
              </div>
            </div>

            {editingItem && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-500 uppercase">
                  {isAuto ? 'Auto Catatan' : 'Realisasi (Rp)'}
                </label>
                <div
                  className={`flex items-center gap-1.5 min-h-12 px-3 rounded-xl border ${
                    isAuto
                      ? 'bg-stone-50 border-stone-200 opacity-60'
                      : 'bg-white border-stone-300 focus-within:border-emerald-600'
                  }`}
                >
                  <span className="text-xs font-bold text-stone-400">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={isAuto}
                    value={actualText}
                    onChange={(e) =>
                      setActualText(formatIdrInput(e.target.value))
                    }
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent text-base font-extrabold text-slate-900 outline-none tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
            Frekuensi
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setIsRecurring(true)}
              className={`min-h-10 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                isRecurring
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-stone-200 text-slate-700'
              }`}
            >
              Rutin Tiap Bulan
            </button>
            <button
              type="button"
              onClick={() => setIsRecurring(false)}
              className={`min-h-10 px-3 rounded-xl text-xs font-extrabold border cursor-pointer ${
                !isRecurring
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-white border-stone-200 text-slate-700'
              }`}
            >
              Sekali Saja (Bln Ini)
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
            Catatan Singkat (Opsional)
          </label>
          <input
            type="text"
            enterKeyHint="done"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="mis. Rutin tanggal 1 / servis bulanan"
            className="w-full min-h-11 px-3.5 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-medium text-slate-900 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {editingItem && onDelete && (
            <button
              type="button"
              aria-label={`Hapus ${editingItem.name}`}
              onClick={() => {
                onDelete(editingItem.id)
                onClose()
              }}
              className="min-h-12 min-w-12 px-3.5 rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 cursor-pointer"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            type="submit"
            data-testid="budget-env-save-btn"
            className="flex-1 min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm liquid-press cursor-pointer"
          >
            {editingItem ? 'Simpan Perubahan' : 'Tambahkan ke Anggaran'}
          </button>
        </div>
      </form>
    </GlassSheetModal>
  )
}

// ---------------------------------------------------------------------------
// 3. Income & Savings Goal Adjustment Modal
// ---------------------------------------------------------------------------

interface BudgetIncomeModalProps {
  month: BudgetMonthRecord
  onClose: () => void
  onSave: (patch: {
    baseIncome: number
    extraIncome: number
    extraIncomeLabel?: string
    savingsRuleType: 'percent' | 'fixed'
    savingsRuleValue: number
    savingsStartingBalance: number
    savingsTargetYear: number
  }) => void
}

export function BudgetIncomeModal({
  month,
  onClose,
  onSave,
}: BudgetIncomeModalProps) {
  const [baseText, setBaseText] = useState(() =>
    formatIdrInput(month.baseIncome),
  )
  const [extraText, setExtraText] = useState(() =>
    formatIdrInput(month.extraIncome),
  )
  const [extraLabel, setExtraLabel] = useState(month.extraIncomeLabel ?? '')
  const [ruleType, setRuleType] = useState<'percent' | 'fixed'>(
    month.savingsRuleType ?? 'percent',
  )
  const [percentText, setPercentText] = useState(() =>
    String(
      month.savingsRuleType === 'fixed' ? 10 : (month.savingsRuleValue ?? 10),
    ),
  )
  const [fixedSavingsText, setFixedSavingsText] = useState(() =>
    formatIdrInput(
      month.savingsRuleType === 'fixed'
        ? (month.savingsRuleValue ?? 1000000)
        : 1000000,
    ),
  )
  const [startingBalanceText, setStartingBalanceText] = useState(() =>
    formatIdrInput(month.savingsStartingBalance ?? 0),
  )
  const [targetText, setTargetText] = useState(() =>
    formatIdrInput(month.savingsTargetYear),
  )

  const totalIncomePreview =
    parseIdrInput(baseText) + parseIdrInput(extraText)
  const previewRequiredSavings =
    ruleType === 'fixed'
      ? parseIdrInput(fixedSavingsText)
      : Math.round(
          (totalIncomePreview * Math.max(0, Number(percentText) || 0)) / 100,
        )

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSave({
      baseIncome: parseIdrInput(baseText),
      extraIncome: parseIdrInput(extraText),
      extraIncomeLabel: extraLabel.trim() || undefined,
      savingsRuleType: ruleType,
      savingsRuleValue:
        ruleType === 'fixed'
          ? parseIdrInput(fixedSavingsText)
          : Math.max(0, Math.min(100, Math.round(Number(percentText) || 0))),
      savingsStartingBalance: parseIdrInput(startingBalanceText),
      savingsTargetYear: parseIdrInput(targetText),
    })
    onClose()
  }

  return (
    <GlassSheetModal
      ariaLabel="Atur Pemasukan & Target Tabungan"
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Pemasukan &amp; Tabungan
            </h2>
            <p className="text-xs text-stone-500 capitalize">
              {formatMonthLabel(month.monthKey)}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
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
            Gaji / Pemasukan Pokok
          </label>
          <div className="flex items-center gap-2 min-h-12 px-3.5 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
            <span className="text-xs font-extrabold text-stone-400">Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={baseText}
              onChange={(e) => setBaseText(formatIdrInput(e.target.value))}
              placeholder="10.000.000"
              className="flex-1 min-w-0 bg-transparent text-base font-extrabold text-slate-900 outline-none tabular-nums"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Tambahan / Bonus
            </label>
            <div className="flex items-center gap-1.5 min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
              <span className="text-xs font-extrabold text-stone-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={extraText}
                onChange={(e) => setExtraText(formatIdrInput(e.target.value))}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-slate-900 outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Keterangan Bonus
            </label>
            <input
              type="text"
              value={extraLabel}
              onChange={(e) => setExtraLabel(e.target.value)}
              placeholder="mis. THR / Proyek"
              className="w-full min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus:border-emerald-600 text-sm font-semibold text-slate-900 outline-none"
            />
          </div>
        </div>

        {/* Configurable Savings Rule (% or Fixed Rp) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-slate-800">
              Aturan Wajib Tabungan
            </span>
            <span className="text-xs font-extrabold text-emerald-700 tabular-nums">
              {formatRupiah(previewRequiredSavings)}/bln
            </span>
          </div>

          <LiquidSegmentedTabs
            ariaLabel="Tipe Aturan Tabungan"
            size="sm"
            value={ruleType}
            onChange={setRuleType}
            options={[
              { id: 'percent', label: 'Persentase (%)' },
              { id: 'fixed', label: 'Nominal (Rp)' },
            ]}
          />

          {ruleType === 'percent' ? (
            <div className="flex items-center gap-1.5">
              {[10, 15, 20, 30].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercentText(String(pct))}
                  className={`min-h-9 px-2.5 rounded-xl text-xs font-extrabold border cursor-pointer ${
                    Number(percentText) === pct
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-stone-50 border-stone-200 text-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
              <div className="flex-1 min-w-0 min-h-9 px-2.5 rounded-xl bg-stone-50 border border-stone-200 focus-within:border-emerald-600 flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={percentText}
                  onChange={(e) => setPercentText(e.target.value)}
                  className="w-full min-w-0 bg-transparent text-xs font-extrabold text-slate-900 outline-none tabular-nums text-right"
                />
                <span className="text-xs font-bold text-stone-400">%</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus-within:border-emerald-600 focus-within:bg-white">
              <span className="text-xs font-bold text-stone-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={fixedSavingsText}
                onChange={(e) =>
                  setFixedSavingsText(formatIdrInput(e.target.value))
                }
                placeholder="1.000.000"
                className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-slate-900 outline-none tabular-nums"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Saldo Awal Tabungan
            </label>
            <div className="flex items-center gap-1.5 min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
              <span className="text-xs font-extrabold text-stone-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={startingBalanceText}
                onChange={(e) =>
                  setStartingBalanceText(formatIdrInput(e.target.value))
                }
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-slate-900 outline-none tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
              Target 1 Tahun
            </label>
            <div className="flex items-center gap-1.5 min-h-12 px-3 rounded-xl bg-white border border-stone-300 focus-within:border-emerald-600">
              <span className="text-xs font-extrabold text-stone-400">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={targetText}
                onChange={(e) => setTargetText(formatIdrInput(e.target.value))}
                placeholder="12.000.000"
                className="flex-1 min-w-0 bg-transparent text-sm font-extrabold text-slate-900 outline-none tabular-nums"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm liquid-press cursor-pointer"
        >
          Simpan Penyesuaian
        </button>
      </form>
    </GlassSheetModal>
  )
}

// ---------------------------------------------------------------------------
// 4. Configure Pillars & Custom Tracking Modes Modal
// ---------------------------------------------------------------------------

interface BudgetConfigModalProps {
  initialTab: 'pillars' | 'modes'
  pillars: BudgetPillarConfig[]
  modes: BudgetTrackingModeConfig[]
  onClose: () => void
  onSavePillar: (input: { id?: string; name: string; color: string }) => void
  onDeletePillar: (id: string) => void
  onSaveMode: (input: {
    id?: string
    label: string
    desc?: string
    behavior: BudgetTrackingBehavior
    stepAmount?: number
    unitLabel?: string
  }) => void
  onDeleteMode: (id: string) => void
}

export function BudgetConfigModal({
  initialTab,
  pillars,
  modes,
  onClose,
  onSavePillar,
  onDeletePillar,
  onSaveMode,
  onDeleteMode,
}: BudgetConfigModalProps) {
  const [tab, setTab] = useState<'pillars' | 'modes'>(initialTab)
  const [editingPillarId, setEditingPillarId] = useState<string | null>(null)
  const [pillarName, setPillarName] = useState('')
  const [pillarColor, setPillarColor] = useState<string>(
    BUDGET_SWATCH_COLORS[0],
  )

  const [editingModeId, setEditingModeId] = useState<string | null>(null)
  const [modeLabel, setModeLabel] = useState('')
  const [modeBehavior, setModeBehavior] =
    useState<BudgetTrackingBehavior>('spend')
  const [modeStepText, setModeStepText] = useState('25.000')
  const [modeUnitLabel, setModeUnitLabel] = useState('x')
  const [modeDesc, setModeDesc] = useState('')
  const [formError, setFormError] = useState('')

  const handleSavePillarForm = (e: FormEvent) => {
    e.preventDefault()
    if (!pillarName.trim()) {
      setFormError('Nama pilar wajib diisi.')
      return
    }
    onSavePillar({
      id: editingPillarId ?? undefined,
      name: pillarName.trim(),
      color: pillarColor,
    })
    setEditingPillarId(null)
    setPillarName('')
    setFormError('')
  }

  const handleSaveModeForm = (e: FormEvent) => {
    e.preventDefault()
    if (!modeLabel.trim()) {
      setFormError('Nama mode tracking wajib diisi.')
      return
    }
    onSaveMode({
      id: editingModeId ?? undefined,
      label: modeLabel.trim(),
      desc: modeDesc.trim() || undefined,
      behavior: modeBehavior,
      stepAmount:
        modeBehavior === 'spend' ? parseIdrInput(modeStepText) : undefined,
      unitLabel:
        modeBehavior === 'counter' ? modeUnitLabel.trim() || 'x' : undefined,
    })
    setEditingModeId(null)
    setModeLabel('')
    setModeDesc('')
    setFormError('')
  }

  return (
    <GlassSheetModal
      ariaLabel="Kelola Pilar dan Mode Tracking"
      maxHeightClass="max-h-[90dvh]"
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <SlidersHorizontal className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Kelola Pilar &amp; Mode
            </h2>
            <p className="text-xs text-stone-500">
              Sesuaikan struktur anggaran rumah tangga
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 pt-3 shrink-0">
        <LiquidSegmentedTabs
          ariaLabel="Pengaturan Anggaran"
          size="md"
          value={tab}
          onChange={(next) => {
            setTab(next)
            setFormError('')
          }}
          options={[
            { id: 'pillars', label: `Pilar (${pillars.length})` },
            { id: 'modes', label: `Mode Tracking (${modes.length})` },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {formError && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
            {formError}
          </div>
        )}

        {tab === 'pillars' ? (
          <>
            <div className="space-y-1.5">
              {pillars.map((p) => (
                <div
                  key={p.id}
                  className="glass-chip rounded-2xl px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-xs font-extrabold text-slate-800 truncate">
                      {p.name}
                    </span>
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPillarId(p.id)
                        setPillarName(p.name)
                        setPillarColor(p.color)
                        setFormError('')
                      }}
                      className="min-h-8 px-2.5 rounded-xl bg-stone-100 hover:bg-emerald-50 text-[11px] font-bold text-slate-600 hover:text-emerald-700 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Ubah</span>
                    </button>
                    {pillars.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Hapus pilar ${p.name}`}
                        onClick={() => onDeletePillar(p.id)}
                        className="min-h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSavePillarForm}
              noValidate
              className="bg-white rounded-2xl border border-stone-200 p-3.5 space-y-2.5"
            >
              <p className="text-xs font-extrabold text-slate-800">
                {editingPillarId ? 'Edit Pilar' : '+ Tambah Pilar Baru'}
              </p>
              <input
                type="text"
                value={pillarName}
                onChange={(e) => {
                  setFormError('')
                  setPillarName(e.target.value)
                }}
                placeholder="mis. 5. Cicilan & Pendidikan"
                className="w-full min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-xs font-bold outline-none"
              />
              <div className="flex items-center gap-2">
                {BUDGET_SWATCH_COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    aria-label={`Pilih warna ${col}`}
                    onClick={() => setPillarColor(col)}
                    className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                      pillarColor === col
                        ? 'ring-2 ring-offset-1 ring-slate-800 scale-110'
                        : 'opacity-75'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {editingPillarId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPillarId(null)
                      setPillarName('')
                    }}
                    className="px-3 min-h-10 rounded-xl bg-stone-100 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 min-h-10 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
                >
                  {editingPillarId ? 'Simpan Pilar' : 'Tambah Pilar'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              {modes.map((m) => (
                <div
                  key={m.id}
                  className="glass-chip rounded-2xl px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-800 truncate">
                      {m.label}
                    </p>
                    <p className="text-[10.5px] text-stone-500 truncate">
                      {m.desc}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingModeId(m.id)
                        setModeLabel(m.label)
                        setModeBehavior(m.behavior)
                        setModeStepText(
                          formatIdrInput(m.stepAmount || 25000),
                        )
                        setModeUnitLabel(m.unitLabel || 'x')
                        setModeDesc(m.desc)
                        setFormError('')
                      }}
                      className="min-h-8 px-2.5 rounded-xl bg-stone-100 hover:bg-emerald-50 text-[11px] font-bold text-slate-600 hover:text-emerald-700 cursor-pointer inline-flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Ubah</span>
                    </button>
                    {!m.isSystem && (
                      <button
                        type="button"
                        aria-label={`Hapus mode ${m.label}`}
                        onClick={() => onDeleteMode(m.id)}
                        className="min-h-8 w-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSaveModeForm}
              noValidate
              className="bg-white rounded-2xl border border-stone-200 p-3.5 space-y-2.5"
            >
              <p className="text-xs font-extrabold text-slate-800">
                {editingModeId
                  ? 'Edit Mode Tracking'
                  : '+ Tambah Mode Tracking Kustom'}
              </p>
              <input
                type="text"
                value={modeLabel}
                onChange={(e) => {
                  setFormError('')
                  setModeLabel(e.target.value)
                }}
                placeholder="mis. Jajan Harian (+25rb) / Cicilan ✓"
                className="w-full min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-xs font-bold outline-none"
              />

              {(!editingModeId ||
                !modes.find((x) => x.id === editingModeId)?.isSystem) && (
                <div className="space-y-1">
                  <span className="text-[10.5px] font-bold uppercase text-stone-400">
                    Mekanisme Dasar
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {BEHAVIOR_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setModeBehavior(opt.id)}
                        className={`min-h-9 px-2 rounded-xl text-[11px] font-bold border cursor-pointer ${
                          modeBehavior === opt.id
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-stone-50 border-stone-200 text-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modeBehavior === 'spend' && (
                <div className="space-y-1">
                  <span className="text-[10.5px] font-bold uppercase text-stone-400">
                    Nominal Tombol Cepat (+Rp)
                  </span>
                  <div className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus-within:border-emerald-600 focus-within:bg-white">
                    <span className="text-xs font-bold text-stone-400">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={modeStepText}
                      onChange={(e) =>
                        setModeStepText(formatIdrInput(e.target.value))
                      }
                      placeholder="25.000"
                      className="flex-1 min-w-0 bg-transparent text-xs font-extrabold text-slate-900 outline-none tabular-nums"
                    />
                  </div>
                </div>
              )}

              {modeBehavior === 'counter' && (
                <div className="space-y-1">
                  <span className="text-[10.5px] font-bold uppercase text-stone-400">
                    Satuan Default
                  </span>
                  <input
                    type="text"
                    value={modeUnitLabel}
                    onChange={(e) => setModeUnitLabel(e.target.value)}
                    placeholder="mis. hari / galon / sesi"
                    className="w-full min-h-10 px-3 rounded-xl bg-stone-50 border border-stone-200 text-xs font-bold outline-none"
                  />
                </div>
              )}

              <input
                type="text"
                value={modeDesc}
                onChange={(e) => setModeDesc(e.target.value)}
                placeholder="Deskripsi singkat mode (opsional)"
                className="w-full min-h-10 px-3 rounded-xl bg-stone-50 border border-stone-200 text-xs outline-none"
              />

              <div className="flex gap-2">
                {editingModeId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingModeId(null)
                      setModeLabel('')
                      setModeDesc('')
                    }}
                    className="px-3 min-h-10 rounded-xl bg-stone-100 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    Batal
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 min-h-10 rounded-xl bg-emerald-600 text-white text-xs font-extrabold cursor-pointer"
                >
                  {editingModeId ? 'Simpan Mode' : 'Tambah Mode'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </GlassSheetModal>
  )
}

// ---------------------------------------------------------------------------
// 5. Monthly & Annual Cashflow Overview Sheet (Triggered by Month Pill)
// ---------------------------------------------------------------------------

interface BudgetAnnualModalProps {
  selectedMonth: string
  budgetMonths: BudgetMonthRecord[]
  modes: BudgetTrackingModeConfig[]
  grocerySpendByMonth: Record<string, number>
  privacyMasked: boolean
  onClose: () => void
  onSelectMonth: (monthKey: string) => void
}

export function BudgetAnnualModal({
  selectedMonth,
  budgetMonths,
  modes,
  grocerySpendByMonth,
  privacyMasked,
  onClose,
  onSelectMonth,
}: BudgetAnnualModalProps) {
  const [viewYear, setViewYear] = useState<number>(
    () => Number(selectedMonth.slice(0, 4)) || 2026,
  )

  const monthByKey = useMemo(() => {
    const map = new Map<string, BudgetMonthRecord>()
    for (const m of budgetMonths) map.set(m.monthKey, m)
    return map
  }, [budgetMonths])

  const yearTotals = useMemo(() => {
    let income = 0
    let spent = 0
    let savings = 0
    let startingBalance = 0
    let targetGoal = 12000000
    const prefix = `${viewYear}-`
    for (const m of budgetMonths) {
      if (!m.monthKey.startsWith(prefix)) continue
      const sum = computeBudgetMonthSummary(
        m,
        modes,
        grocerySpendByMonth[m.monthKey] ?? 0,
      )
      income += sum.totalIncome
      spent += sum.totalSpent
      savings += sum.realizedMonthlySavings
      if ((m.savingsStartingBalance ?? 0) > startingBalance) {
        startingBalance = m.savingsStartingBalance ?? 0
      }
      if (m.savingsTargetYear > 0) targetGoal = m.savingsTargetYear
    }
    const totalColdFund = startingBalance + savings
    return {
      income,
      spent,
      savings: totalColdFund,
      targetGoal,
      pct:
        targetGoal > 0
          ? Math.min(100, Math.round((totalColdFund / targetGoal) * 100))
          : 0,
    }
  }, [budgetMonths, grocerySpendByMonth, modes, viewYear])

  const fmtVal = (n: number) =>
    privacyMasked ? 'Rp ••••••' : formatRupiah(n)

  return (
    <GlassSheetModal
      ariaLabel="Ringkasan Anggaran Bulanan & Tahunan"
      maxHeightClass="max-h-[90dvh]"
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CalendarDays className="w-4.5 h-4.5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Ringkasan Bulanan &amp; Tahunan
            </h2>
            <p className="text-xs text-stone-500">
              Pilih bulan untuk kelola atau bandingkan arus kas
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Year Selector */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Tahun sebelumnya"
            onClick={() => setViewYear((y) => y - 1)}
            className="glass-chip w-9 h-9 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-extrabold text-slate-900 tabular-nums">
            Tahun {viewYear}
          </span>
          <button
            type="button"
            aria-label="Tahun berikutnya"
            onClick={() => setViewYear((y) => y + 1)}
            className="glass-chip w-9 h-9 rounded-xl text-slate-700 flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Cumulative Annual Cold Fund Card */}
        <div className="glass-chip rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-600">
              Akumulasi Tabungan {viewYear}
            </span>
            <span className="font-extrabold text-emerald-700 tabular-nums">
              {fmtVal(yearTotals.savings)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-900/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${yearTotals.pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 tabular-nums">
            <span>Target: {fmtVal(yearTotals.targetGoal)}</span>
            <span>{yearTotals.pct}% tercapai</span>
          </div>
        </div>

        {/* 12-Month Grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTHS_SHORT_ID.map((label, idx) => {
            const ym = `${viewYear}-${String(idx + 1).padStart(2, '0')}`
            const rec = monthByKey.get(ym)
            const summary = rec
              ? computeBudgetMonthSummary(
                  rec,
                  modes,
                  grocerySpendByMonth[ym] ?? 0,
                )
              : null
            const isSelected = selectedMonth === ym

            return (
              <button
                key={ym}
                type="button"
                onClick={() => {
                  onSelectMonth(ym)
                  onClose()
                }}
                className={`rounded-2xl p-2.5 text-center liquid-press cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                    : rec
                      ? 'glass-chip text-slate-900 hover:bg-emerald-50/80'
                      : 'bg-white/50 text-slate-400 border border-white/75 hover:bg-white/80'
                }`}
              >
                <div className="text-xs font-extrabold">{label}</div>
                <div
                  className={`text-[10px] font-bold tabular-nums mt-0.5 ${
                    isSelected
                      ? 'text-emerald-100'
                      : rec
                        ? 'text-slate-600'
                        : 'text-slate-300'
                  }`}
                >
                  {summary
                    ? privacyMasked
                      ? '•••'
                      : formatCompactRupiahShort(summary.totalSpent) || '0'
                    : '—'}
                </div>
                {summary && summary.realizedMonthlySavings > 0 && (
                  <div
                    className={`text-[9px] font-extrabold tabular-nums mt-0.5 ${
                      isSelected ? 'text-white' : 'text-emerald-700'
                    }`}
                  >
                    +
                    {privacyMasked
                      ? '•••'
                      : formatCompactRupiahShort(
                          summary.realizedMonthlySavings,
                        )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </GlassSheetModal>
  )
}

export function BudgetDeleteMonthModal({
  monthKey,
  itemCount,
  onClose,
  onConfirm,
}: {
  monthKey: string
  itemCount: number
  onClose: () => void
  onConfirm: () => void
}) {
  const [confirmInput, setConfirmInput] = useState('')
  const confirmKeyword = 'HAPUS'
  const isConfirmed = confirmInput.trim().toUpperCase() === confirmKeyword
  const monthLabel = formatMonthLabel(monthKey)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isConfirmed) return
    onConfirm()
    onClose()
  }

  return (
    <GlassSheetModal
      ariaLabel={`Hapus anggaran ${monthLabel}`}
      onClose={onClose}
    >
      <div className="px-5 pt-2 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-rose-500/14 border border-rose-300/60 text-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-slate-900 truncate">
              Hapus Anggaran Bulan Ini?
            </h2>
            <p className="text-xs font-semibold text-stone-500 capitalize truncate">
              {monthLabel} · {itemCount} pos pengeluaran
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={onClose}
          className="min-w-10 min-h-10 rounded-xl flex items-center justify-center text-stone-500 hover:bg-stone-100 shrink-0 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-5 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="rounded-2xl p-3.5 bg-rose-50/75 border border-rose-200/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] text-xs text-slate-700 leading-relaxed">
          Seluruh rencana anggaran dan{' '}
          <strong className="text-slate-900">{itemCount} pos pengeluaran</strong>{' '}
          untuk{' '}
          <strong className="text-slate-900 capitalize">{monthLabel}</strong>{' '}
          akan dihapus permanen. Catatan belanja di tab Catatan tidak ikut
          terhapus.
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirm-delete-month-input"
            className="block text-xs font-bold text-slate-700"
          >
            Untuk konfirmasi, ketik{' '}
            <code className="px-1.5 py-0.5 rounded-md bg-rose-500/12 border border-rose-300/60 text-rose-700 font-extrabold tracking-wide select-all">
              {confirmKeyword}
            </code>{' '}
            di bawah ini:
          </label>
          <div className="relative flex items-center">
            <input
              id="confirm-delete-month-input"
              type="text"
              enterKeyHint="done"
              data-testid="confirm-delete-month-input"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={`Ketik ${confirmKeyword}`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className={`w-full min-h-12 px-3.5 pr-20 rounded-2xl bg-white/90 border text-sm font-extrabold tracking-wider uppercase text-slate-900 placeholder:font-medium placeholder:tracking-normal placeholder:normal-case placeholder:text-stone-400 outline-none shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] transition-colors ${
                isConfirmed
                  ? 'border-rose-500 ring-2 ring-rose-500/20'
                  : 'border-stone-300/90 focus:border-rose-400 focus:ring-2 focus:ring-rose-400/15'
              }`}
            />
            {isConfirmed && (
              <span className="absolute right-2.5 px-2 py-0.5 rounded-lg bg-emerald-500/14 border border-emerald-300/60 text-[10.5px] font-extrabold text-emerald-700 inline-flex items-center gap-1">
                <Check className="w-3 h-3" />
                Siap
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="min-h-12 px-4 rounded-2xl bg-white/70 hover:bg-white/90 backdrop-blur-md text-xs font-extrabold text-slate-700 border border-white/95 shadow-[0_6px_18px_-6px_rgba(15,23,42,0.14),0_0_0_0.5px_rgba(15,23,42,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.98)] inline-flex items-center justify-center liquid-press cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={!isConfirmed}
            data-testid="confirm-delete-budget-month"
            className={`min-h-12 px-4 rounded-2xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 backdrop-blur-md transition-all liquid-press ${
              isConfirmed
                ? 'bg-gradient-to-b from-rose-500/88 to-rose-600/92 hover:from-rose-500 hover:to-rose-600 text-white border border-white/45 shadow-[0_10px_24px_-6px_rgba(225,29,72,0.42),inset_0_1.5px_1px_rgba(255,255,255,0.55),inset_0_-1.5px_3px_rgba(136,19,55,0.22)] cursor-pointer'
                : 'bg-rose-500/14 text-rose-500/60 border border-rose-300/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>Hapus Permanen</span>
          </button>
        </div>
      </form>
    </GlassSheetModal>
  )
}
