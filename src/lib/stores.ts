import type { CSSProperties } from 'react'
import type {
  CategoryConfig,
  ProductReference,
  StoreConfig,
  StoreSource,
} from '../types/market'

export const COLOR_PALETTE = [
  '#059669', // Emerald
  '#4F46E5', // Indigo
  '#EA580C', // Orange
  '#0284C7', // Sky
  '#D97706', // Amber
  '#E11D48', // Rose
  '#7C3AED', // Violet
  '#0D9488', // Teal
  '#DB2777', // Pink
  '#64748B', // Slate
]

export const DEFAULT_STORES: StoreConfig[] = [
  {
    id: 'hypermart',
    name: 'Hypermart',
    shortLabel: 'Hypermart',
    code: 'H',
    color: '#4F46E5',
  },
  {
    id: 'pasar',
    name: 'Pasar',
    shortLabel: 'Pasar',
    code: 'P',
    color: '#059669',
  },
  {
    id: 'minimarket',
    name: 'Alfamart / Indomaret',
    shortLabel: 'Alfa/Indo',
    code: 'In',
    color: '#EA580C',
  },
]

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  {
    id: 'Sayur & Buah',
    name: 'Sayur & Buah',
    shortLabel: 'Sayur',
    color: '#059669',
  },
  {
    id: 'Daging & Ikan',
    name: 'Daging & Ikan',
    shortLabel: 'Daging',
    color: '#E11D48',
  },
  {
    id: 'Bumbu & Rempah',
    name: 'Bumbu & Rempah',
    shortLabel: 'Bumbu',
    color: '#D97706',
  },
  {
    id: 'Sembako',
    name: 'Sembako',
    shortLabel: 'Sembako',
    color: '#0284C7',
  },
  {
    id: 'Lainnya',
    name: 'Lainnya',
    shortLabel: 'Lainnya',
    color: '#78716C',
  },
]

export function getTintedPillStyle(hex: string): CSSProperties {
  return {
    backgroundColor: `${hex}14`,
    borderColor: `${hex}40`,
    color: hex,
  }
}

export function getSolidPillStyle(hex: string): CSSProperties {
  return {
    backgroundColor: hex,
    borderColor: hex,
    color: '#FFFFFF',
  }
}

export function findStore(
  stores: StoreConfig[],
  storeId: string | null | undefined,
): StoreConfig | undefined {
  if (!storeId) return undefined
  return stores.find((s) => s.id === storeId)
}

export function findCategory(
  categories: CategoryConfig[],
  categoryId: string | null | undefined,
): CategoryConfig {
  if (categoryId) {
    const found = categories.find(
      (c) => c.id === categoryId || c.name === categoryId,
    )
    if (found) return found
  }
  return (
    categories.find((c) => c.id === 'Lainnya') ??
    categories[categories.length - 1] ??
    DEFAULT_CATEGORIES[4]
  )
}

export function getCheapestStore(
  ref: ProductReference,
  stores: StoreConfig[] = DEFAULT_STORES,
): { store: StoreSource; price: number } | null {
  let best: { store: StoreSource; price: number } | null = null
  for (const s of stores) {
    const entry = ref.prices[s.id]
    if (entry && entry.price > 0) {
      if (!best || entry.price < best.price) {
        best = { store: s.id, price: entry.price }
      }
    }
  }
  return best
}

export function getReferencePriceForStore(
  ref: ProductReference,
  store?: StoreSource | null,
  stores: StoreConfig[] = DEFAULT_STORES,
): { store: StoreSource; price: number } {
  if (store && ref.prices[store]?.price && ref.prices[store]!.price > 0) {
    return { store, price: ref.prices[store]!.price }
  }
  if (
    ref.preferredStore &&
    ref.prices[ref.preferredStore]?.price &&
    ref.prices[ref.preferredStore]!.price > 0
  ) {
    return {
      store: ref.preferredStore,
      price: ref.prices[ref.preferredStore]!.price,
    }
  }
  const cheapest = getCheapestStore(ref, stores)
  if (cheapest) return cheapest
  return {
    store: store ?? ref.preferredStore ?? stores[0]?.id ?? 'pasar',
    price: 0,
  }
}

const idCollator = new Intl.Collator('id', { sensitivity: 'base' })

export function sortByNameAZ<T extends { name: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => idCollator.compare(a.name, b.name))
}

export function formatShortDate(ts: number): string {
  if (!ts || ts < 100000) return 'Harga awal'
  try {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}
