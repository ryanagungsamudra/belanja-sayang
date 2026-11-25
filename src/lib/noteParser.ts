import type {
  MonthlyPurchaseEntry,
  ProductReference,
  StoreConfig,
  StoreSource,
} from '../types/market'
import { detectCategory } from './categories'
import { generateId, normalizeItemName } from './format'
import { DEFAULT_STORES, findStore, sortByNameAZ } from './stores'

export function getCurrentMonthKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yStr, mStr] = monthKey.split('-')
  const y = Number(yStr) || new Date().getFullYear()
  const m = (Number(mStr) || 1) - 1
  const d = new Date(y, m + deltaMonths, 1)
  return getCurrentMonthKey(d)
}

export function formatMonthLabel(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-')
  const y = Number(yStr)
  const m = (Number(mStr) || 1) - 1
  try {
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(y, m, 1))
  } catch {
    return monthKey
  }
}

export function formatCompactPrice(price: number): string {
  if (!price || price <= 0) return '?'
  const thousands = price / 1000
  if (Number.isInteger(thousands)) {
    return String(thousands)
  }
  return thousands.toFixed(1).replace('.', ',')
}

export function getStoreCode(
  storeId: string | null | undefined,
  stores: StoreConfig[] = DEFAULT_STORES,
): string {
  const found = findStore(stores, storeId)
  if (found) return found.code
  if (storeId === 'hypermart') return 'H'
  if (storeId === 'pasar') return 'P'
  if (storeId === 'minimarket') return 'In'
  return storeId ? storeId.slice(0, 2).toUpperCase() : '?'
}

export function formatPurchaseChip(
  entry: Pick<MonthlyPurchaseEntry, 'store' | 'price' | 'qtyNote'>,
  stores: StoreConfig[] = DEFAULT_STORES,
): string {
  const code = getStoreCode(entry.store, stores)
  const priceStr = formatCompactPrice(entry.price)
  const numericQty = entry.qtyNote && /^\d+$/.test(entry.qtyNote.trim())
  if (numericQty) {
    return `${entry.qtyNote!.trim()}${code}${priceStr}`
  }
  const base = `${code}${priceStr}`
  if (entry.qtyNote && entry.qtyNote.trim()) {
    return `${base} · ${entry.qtyNote.trim()}`
  }
  return base
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildCodeMatchers(stores: StoreConfig[]): Array<{
  token: string
  storeId: string
}> {
  const entries: Array<{ token: string; storeId: string }> = []
  for (const s of stores) {
    if (s.code.trim()) {
      entries.push({ token: s.code.trim().toLowerCase(), storeId: s.id })
    }
    if (s.shortLabel.trim()) {
      entries.push({ token: s.shortLabel.trim().toLowerCase(), storeId: s.id })
    }
  }
  // Common Indonesian aliases for default minimarket store
  if (stores.some((s) => s.id === 'minimarket')) {
    entries.push(
      { token: 'indomaret', storeId: 'minimarket' },
      { token: 'alfamart', storeId: 'minimarket' },
      { token: 'indo', storeId: 'minimarket' },
      { token: 'alfa', storeId: 'minimarket' },
      { token: 'al', storeId: 'minimarket' },
      { token: 'a', storeId: 'minimarket' },
    )
  }
  // Longest first so "In" matches before "I"
  return entries.sort((a, b) => b.token.length - a.token.length)
}

/**
 * Parses a single shorthand token such as:
 * "H13", "H9,5", "P10", "In21", "2H29", "H", "21", "sania 2L H41",
 * plus any custom store codes added by the user (e.g., "S15" for Superindo).
 */
export function parseShorthandToken(
  rawToken: string,
  fallbackStore: StoreSource = 'hypermart',
  stores: StoreConfig[] = DEFAULT_STORES,
): { store: StoreSource; price: number; qtyNote?: string } | null {
  const cleaned = rawToken.trim()
  if (!cleaned) return null

  const matchers = buildCodeMatchers(stores)
  const codePattern = matchers.map((m) => escapeRegExp(m.token)).join('|')

  if (codePattern) {
    const storeRegex = new RegExp(
      `^(?:(.*?)\\s+)?(?:(\\d+)\\s*)?(${codePattern})\\s*(\\d+(?:[.,]\\d+)?)?$`,
      'i',
    )
    const match = cleaned.match(storeRegex)
    if (match) {
      const leadingText = match[1]?.trim()
      const leadingQty = match[2]?.trim()
      const codeRaw = match[3].toLowerCase()
      const priceRaw = match[4]

      const matchedStore =
        matchers.find((m) => m.token === codeRaw)?.storeId ?? fallbackStore

      let price = 0
      if (priceRaw) {
        const num = Number(priceRaw.replace(',', '.'))
        if (Number.isFinite(num) && num > 0) {
          price = num < 1000 ? Math.round(num * 1000) : Math.round(num)
        }
      }

      const qtyNote = leadingQty || leadingText || undefined
      return { store: matchedStore, price, qtyNote }
    }
  }

  // Fallback: plain number like "21" or "17,5" or "21000"
  const numOnly = cleaned.match(/^(\d+(?:[.,]\d+)?)$/)
  if (numOnly) {
    const num = Number(numOnly[1].replace(',', '.'))
    if (Number.isFinite(num) && num > 0) {
      const price = num < 1000 ? Math.round(num * 1000) : Math.round(num)
      return { store: fallbackStore, price }
    }
  }

  return null
}

function titleCaseProduct(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (!word) return word
      if (/^[A-Z0-9]{2,}$/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

export interface ParsedNoteLine {
  productName: string
  entries: Array<{ store: StoreSource; price: number; qtyNote?: string }>
}

export function parseMonthlyNoteText(
  rawText: string,
  stores: StoreConfig[] = DEFAULT_STORES,
): ParsedNoteLine[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const results: ParsedNoteLine[] = []
  const matchers = buildCodeMatchers(stores)
  const codePattern = matchers.map((m) => escapeRegExp(m.token)).join('|')

  const firstTokenRegex = new RegExp(
    `\\s+(?:(?:\\d+)?(?:${codePattern})(?:\\d+(?:[.,]\\d+)?)?(?=\\s*\\/|\\s*$)|(?:\\d+(?:[.,]\\d+)?)(?=\\s*\\/))`,
    'i',
  )

  for (const line of lines) {
    const idx = line.search(firstTokenRegex)
    if (idx <= 0) continue

    const namePart = titleCaseProduct(line.slice(0, idx))
    const restPart = line.slice(idx).trim()
    const rawTokens = restPart
      .split('/')
      .map((t) => t.trim())
      .filter(Boolean)

    const entries: ParsedNoteLine['entries'] = []
    let lastStore: StoreSource = stores[0]?.id ?? 'hypermart'

    for (const tok of rawTokens) {
      const parsed = parseShorthandToken(tok, lastStore, stores)
      if (parsed) {
        entries.push(parsed)
        lastStore = parsed.store
      }
    }

    if (namePart && entries.length > 0) {
      results.push({ productName: namePart, entries })
    }
  }

  return results
}

export function exportMonthlyNoteText(
  monthKey: string,
  productRefs: ProductReference[],
  monthEntries: MonthlyPurchaseEntry[],
  stores: StoreConfig[] = DEFAULT_STORES,
): string {
  const byRef = new Map<string, MonthlyPurchaseEntry[]>()
  for (const entry of monthEntries) {
    if (entry.monthKey !== monthKey) continue
    const list = byRef.get(entry.productRefId) ?? []
    list.push(entry)
    byRef.set(entry.productRefId, list)
  }

  const lines: string[] = [`Catatan Belanja ${formatMonthLabel(monthKey)}`]
  for (const ref of sortByNameAZ(productRefs)) {
    const list = byRef.get(ref.id)
    if (!list || list.length === 0) continue
    const chips = list.map((e) => formatPurchaseChip(e, stores)).join('/ ')
    lines.push(`${ref.name.toLowerCase()} ${chips}/`)
  }
  return lines.join('\n')
}

export const STARTER_WIFE_NOTE = `bahan sayuran wajib
bawang merah H13/ H7/ H9,5/
bawang putih H19/ H8/ H10,5
kaldu ayam masako P18/
lombok merah P10/ P10/
lombok besar P10/ P10
lombok ijo P5/
sosis champ ayam P18/
kemiri P10/
ketumbar P8/
santan kara P15/
telur H23/ H23/ H17/ H21/
sari roti H20/ In21/ H20/
kangkung H2,5/ H5/ H10/ P5
seledri H4/
minyak 2L H42/ sania 2L H41/
kecap H24/
saus delmonte chilli H7
saus delmonte tomat H
terasi udang ABC H8,5/
kecap ikan H13,5/
kentang P8/ H15
tempe P5/ P5
pisang P15/
sarden kingfish H14/ H14/ H14
telur puyuh H13/ H10
susu diamond H22/ H22/ H23
susu ultramilk H21/
desaku marinasi H17/
nescafe ice roast 2H29/
daun bawang H17/
jamur tiram H5/
jeruk santang H17/
Keju Procheese H14/ H14
garam dolphin H6/
ayam P35/
tomat P5/
saus tiram leekumkee 21/
mesis tulip H7/
spagheti carbonara 2H5/ 2H5
gulaku H17,5/`

export function buildSeedFromWifeNote(monthKey = getCurrentMonthKey()): {
  refs: ProductReference[]
  entries: MonthlyPurchaseEntry[]
} {
  const parsed = parseMonthlyNoteText(STARTER_WIFE_NOTE, DEFAULT_STORES)
  const refs: ProductReference[] = []
  const entries: MonthlyPurchaseEntry[] = []
  const baseTs = Date.now() - 1000 * 60 * 60 * 24

  parsed.forEach((line, lineIdx) => {
    const refId = `ref-seed-${lineIdx + 1}`
    const prices: ProductReference['prices'] = {}
    let lastStore: StoreSource = 'hypermart'

    line.entries.forEach((e, entryIdx) => {
      lastStore = e.store
      const ts = baseTs + (lineIdx * 10 + entryIdx) * 1000
      if (e.price > 0) {
        prices[e.store] = { price: e.price, updatedAt: ts }
      }
      entries.push({
        id: `log-seed-${lineIdx + 1}-${entryIdx + 1}`,
        monthKey,
        productRefId: refId,
        productName: line.productName,
        store: e.store,
        price: e.price,
        qtyNote: e.qtyNote,
        purchasedAt: ts,
      })
    })

    refs.push({
      id: refId,
      name: line.productName,
      normalizedName: normalizeItemName(line.productName),
      defaultQuantity: line.productName.toLowerCase().includes('2l')
        ? '2 liter'
        : '1',
      category: detectCategory(line.productName),
      preferredStore: lastStore,
      prices,
      updatedAt: baseTs + lineIdx * 1000,
    })
  })

  return { refs, entries }
}

export function createRefId(): string {
  return `ref-${generateId()}`
}
