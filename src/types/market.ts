export type MarketCategory = string

export type StoreSource = string

export interface StoreConfig {
  id: string
  name: string
  shortLabel: string
  code: string // Shorthand code used in notes, e.g., 'H', 'P', 'In', 'S'
  color: string // Hex color e.g. '#4F46E5'
  updatedAt?: number
}

export interface CategoryConfig {
  id: string
  name: string
  shortLabel: string
  color: string // Hex color e.g. '#059669'
  updatedAt?: number
}

export interface StorePriceEntry {
  price: number
  updatedAt: number
}

export interface ProductReference {
  id: string
  name: string
  normalizedName: string
  defaultQuantity: string
  category: MarketCategory
  preferredStore: StoreSource
  prices: Record<string, StorePriceEntry | undefined>
  notes?: string
  updatedAt: number
}

/**
 * A single purchase occurrence inside a month's expense note
 * (e.g., "H13" -> Hypermart Rp 13.000, "P10" -> Pasar Rp 10.000, "In21" -> Indomaret Rp 21.000).
 */
export interface MonthlyPurchaseEntry {
  id: string
  monthKey: string // YYYY-MM, e.g. '2026-11'
  productRefId: string
  productName: string
  store: StoreSource
  price: number // Rp (0 means price not filled yet, e.g. "H")
  qtyNote?: string // e.g. "2" for "2H29", or "sania 2L"
  purchasedAt: number
  updatedAt?: number
}

export interface MarketItem {
  id: string
  name: string
  quantity: string
  category: MarketCategory
  estimatedPrice: number
  /** null means store has not been chosen yet on the weekly cart */
  store: StoreSource | null
  productRefId?: string
  linkedPurchaseId?: string
  isBought: boolean
  createdAt: number
  updatedAt?: number
}

export interface FrequentItem {
  name: string
  normalizedName: string
  quantity: string
  category: MarketCategory
  estimatedPrice: number
  store: StoreSource | null
  count: number
  lastUsedAt: number
}

export interface MealTemplateItem {
  id: string
  name: string
  quantity: string
  category: MarketCategory
  estimatedPrice: number
  store: StoreSource | null
}

export interface MealTemplate {
  id: string
  name: string
  emoji: string
  description: string
  items: MealTemplateItem[]
  isDefault?: boolean
  createdAt: number
  updatedAt?: number
}

export interface PinConfig {
  hasCompletedOnboarding: boolean
  pinEnabled: boolean
  pinHash: string | null
}

export interface AddItemInput {
  name: string
  quantity?: string
  category?: MarketCategory
  estimatedPrice?: number
  store?: StoreSource | null
  productRefId?: string
  syncToReference?: boolean
}

export interface UpdateItemInput {
  name?: string
  quantity?: string
  category?: MarketCategory
  estimatedPrice?: number
  store?: StoreSource | null
  syncToReference?: boolean
}

export interface UpsertProductRefInput {
  id?: string
  name: string
  defaultQuantity: string
  category: MarketCategory
  preferredStore: StoreSource
  prices: Record<string, number>
  notes?: string
}

export interface AddPurchaseEntryInput {
  monthKey: string
  productRefId: string
  store: StoreSource
  price: number
  qtyNote?: string
}

export interface UpdatePurchaseEntryInput {
  store?: StoreSource
  price?: number
  qtyNote?: string
}

export interface UpsertTemplateInput {
  id?: string
  name: string
  emoji: string
  description: string
  items: Array<Omit<MealTemplateItem, 'id'> & { id?: string }>
}
