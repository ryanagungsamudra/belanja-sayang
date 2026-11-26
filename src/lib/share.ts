import { formatRupiah } from './format'
import {
  exportMonthlyNoteText,
  formatMonthLabel,
} from './noteParser'
import { sortByNameAZ } from './stores'
import type {
  MarketItem,
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
} from '../types/market'

/**
 * Formats the active weekly cart into a clean WhatsApp-friendly checklist grouped by store.
 */
export function formatCartShareText(
  activeItems: MarketItem[],
  stores: StoreConfig[],
): string {
  if (activeItems.length === 0) return ''

  const byStore = new Map<string, MarketItem[]>()
  const unassigned: MarketItem[] = []

  for (const item of sortByNameAZ(activeItems)) {
    if (!item.store) {
      unassigned.push(item)
      continue
    }
    const list = byStore.get(item.store) ?? []
    list.push(item)
    byStore.set(item.store, list)
  }

  const lines: string[] = ['*BelanjaSayang — Daftar Belanja*']
  let total = 0

  const appendGroup = (title: string, groupItems: MarketItem[]) => {
    if (groupItems.length === 0) return
    lines.push('', `*${title} (${groupItems.length})*`)
    for (const item of groupItems) {
      total += item.estimatedPrice || 0
      const qty =
        item.quantity && item.quantity !== '1' ? ` (${item.quantity})` : ''
      const price =
        item.estimatedPrice > 0 ? ` — ${formatRupiah(item.estimatedPrice)}` : ''
      lines.push(`• ${item.name}${qty}${price}`)
    }
  }

  for (const store of stores) {
    const list = byStore.get(store.id)
    if (list && list.length > 0) {
      appendGroup(store.name, list)
      byStore.delete(store.id)
    }
  }
  for (const [storeId, list] of byStore.entries()) {
    appendGroup(storeId, list)
  }
  appendGroup('Belum Pilih Toko', unassigned)

  if (total > 0) {
    lines.push('', `Estimasi Total: *${formatRupiah(total)}*`)
  }
  return lines.join('\n')
}

/**
 * Formats a WhatsApp-friendly monthly expense summary including per-store breakdown and item list.
 */
export function formatMonthlyShareText(
  monthKey: string,
  productRefs: ProductReference[],
  monthEntries: MonthlyPurchaseEntry[],
  stores: StoreConfig[],
  monthlyTotalSpend: number,
  monthlySpendByStore: Record<string, number>,
): string {
  const monthLabel = formatMonthLabel(monthKey)
  const lines: string[] = [
    `*Rekap BelanjaSayang — ${monthLabel}*`,
    `Total: *${formatRupiah(monthlyTotalSpend)}* (${monthEntries.length} pembelian)`,
  ]

  const storeLines = stores
    .map((s) => ({ store: s, spend: monthlySpendByStore[s.id] ?? 0 }))
    .filter((row) => row.spend > 0)
    .sort((a, b) => b.spend - a.spend)

  if (storeLines.length > 0) {
    lines.push('')
    for (const row of storeLines) {
      lines.push(`• ${row.store.name}: ${formatRupiah(row.spend)}`)
    }
  }

  const noteBody = exportMonthlyNoteText(
    monthKey,
    productRefs,
    monthEntries,
    stores,
  )
  const noteLines = noteBody.split('\n').slice(1)
  if (noteLines.length > 0) {
    lines.push('', '*Rincian:*', ...noteLines)
  }

  return lines.join('\n')
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/**
 * Uses the native Web Share Sheet (opens WhatsApp/Messages on iOS & Android)
 * and gracefully falls back to clipboard copy on desktop browsers.
 */
export async function shareOrCopyText(payload: {
  title: string
  text: string
}): Promise<ShareOutcome> {
  if (!payload.text.trim()) return 'failed'

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: payload.title,
        text: payload.text,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
      // Fall through to clipboard copy if share is blocked or unsupported
    }
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(payload.text)
      return 'copied'
    } catch {
      return 'failed'
    }
  }

  return 'failed'
}
