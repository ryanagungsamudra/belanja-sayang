import type {
  CategoryConfig,
  FrequentItem,
  MarketItem,
  MealTemplate,
  MonthlyPurchaseEntry,
  PinConfig,
  ProductReference,
  StoreConfig,
} from '../types/market'
import { generateId, normalizeItemName } from './format'
import { buildSeedFromWifeNote } from './noteParser'
import { DEFAULT_CATEGORIES, DEFAULT_STORES } from './stores'

export interface MarketStorageAdapter {
  loadStores(): StoreConfig[]
  saveStores(stores: StoreConfig[]): void
  loadCategories(): CategoryConfig[]
  saveCategories(categories: CategoryConfig[]): void
  loadItems(): MarketItem[]
  saveItems(items: MarketItem[]): void
  loadFrequentItems(): FrequentItem[]
  saveFrequentItems(items: FrequentItem[]): void
  loadTemplates(): MealTemplate[]
  saveTemplates(templates: MealTemplate[]): void
  loadProductRefs(): ProductReference[]
  saveProductRefs(refs: ProductReference[]): void
  loadMonthlyPurchases(): MonthlyPurchaseEntry[]
  saveMonthlyPurchases(entries: MonthlyPurchaseEntry[]): void
  loadPinConfig(): PinConfig
  savePinConfig(config: PinConfig): void
}

const KEYS = {
  seedVersion: 'belanjasayang:seed-version',
  stores: 'belanjasayang:stores:v1',
  categories: 'belanjasayang:categories:v1',
  items: 'belanjasayang:items:v1',
  frequent: 'belanjasayang:frequent:v1',
  templates: 'belanjasayang:templates:v1',
  productRefs: 'belanjasayang:product-refs:v2',
  monthlyPurchases: 'belanjasayang:monthly-purchases:v1',
  pin: 'belanjasayang:pin:v1',
} as const

const CURRENT_SEED_VERSION = 'v4-clean-with-sync'

function ensureCleanSeedReset(): void {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(KEYS.seedVersion) === CURRENT_SEED_VERSION) {
      return
    }
    // Reset shopping & catalog data cleanly to the exact 40-item note while preserving PIN config
    window.localStorage.removeItem(KEYS.stores)
    window.localStorage.removeItem(KEYS.categories)
    window.localStorage.removeItem(KEYS.items)
    window.localStorage.removeItem(KEYS.frequent)
    window.localStorage.removeItem(KEYS.templates)
    window.localStorage.removeItem(KEYS.productRefs)
    window.localStorage.removeItem(KEYS.monthlyPurchases)
    window.localStorage.setItem(KEYS.seedVersion, CURRENT_SEED_VERSION)
  } catch {
    // Ignore storage access errors
  }
}

ensureCleanSeedReset()

export const DEFAULT_TEMPLATES: MealTemplate[] = [
  {
    id: 'tpl-sop-ayam',
    name: 'Sop Ayam',
    emoji: '🍲',
    description: 'Hangat & segar untuk makan keluarga di rumah',
    isDefault: true,
    createdAt: 1,
    items: [
      {
        id: 'tpl-sop-1',
        name: 'Ayam',
        quantity: '1 ekor',
        category: 'Daging & Ikan',
        estimatedPrice: 35000,
        store: null,
      },
      {
        id: 'tpl-sop-2',
        name: 'Kentang',
        quantity: '1/2 kg',
        category: 'Sayur & Buah',
        estimatedPrice: 8000,
        store: null,
      },
      {
        id: 'tpl-sop-3',
        name: 'Seledri',
        quantity: '1 ikat',
        category: 'Bumbu & Rempah',
        estimatedPrice: 4000,
        store: null,
      },
      {
        id: 'tpl-sop-4',
        name: 'Daun Bawang',
        quantity: '1 ikat',
        category: 'Bumbu & Rempah',
        estimatedPrice: 17000,
        store: null,
      },
      {
        id: 'tpl-sop-5',
        name: 'Bawang Putih',
        quantity: '1/4 kg',
        category: 'Bumbu & Rempah',
        estimatedPrice: 10500,
        store: null,
      },
      {
        id: 'tpl-sop-6',
        name: 'Bawang Merah',
        quantity: '1/4 kg',
        category: 'Bumbu & Rempah',
        estimatedPrice: 9500,
        store: null,
      },
    ],
  },
  {
    id: 'tpl-sambal-lalapan',
    name: 'Sambal & Lalapan',
    emoji: '🌶️',
    description: 'Pelengkap wajib makan siang pedas & segar',
    isDefault: true,
    createdAt: 2,
    items: [
      {
        id: 'tpl-sambal-1',
        name: 'Lombok Merah',
        quantity: '1/4 kg',
        category: 'Bumbu & Rempah',
        estimatedPrice: 10000,
        store: null,
      },
      {
        id: 'tpl-sambal-2',
        name: 'Lombok Besar',
        quantity: '1/4 kg',
        category: 'Bumbu & Rempah',
        estimatedPrice: 10000,
        store: null,
      },
      {
        id: 'tpl-sambal-3',
        name: 'Tomat',
        quantity: '1/2 kg',
        category: 'Sayur & Buah',
        estimatedPrice: 5000,
        store: null,
      },
      {
        id: 'tpl-sambal-4',
        name: 'Terasi Udang ABC',
        quantity: '1 pak',
        category: 'Bumbu & Rempah',
        estimatedPrice: 8500,
        store: null,
      },
      {
        id: 'tpl-sambal-5',
        name: 'Tempe',
        quantity: '1 papan',
        category: 'Sembako',
        estimatedPrice: 5000,
        store: null,
      },
    ],
  },
  {
    id: 'tpl-stok-mingguan',
    name: 'Stok Mingguan',
    emoji: '🛒',
    description: 'Belanja rutin mingguan untuk sarapan & dapur',
    isDefault: true,
    createdAt: 3,
    items: [
      {
        id: 'tpl-stok-1',
        name: 'Telur',
        quantity: '1 tray',
        category: 'Sembako',
        estimatedPrice: 21000,
        store: null,
      },
      {
        id: 'tpl-stok-2',
        name: 'Sari Roti',
        quantity: '1 bungkus',
        category: 'Sembako',
        estimatedPrice: 20000,
        store: null,
      },
      {
        id: 'tpl-stok-3',
        name: 'Susu Diamond',
        quantity: '1 liter',
        category: 'Sembako',
        estimatedPrice: 23000,
        store: null,
      },
      {
        id: 'tpl-stok-4',
        name: 'Kangkung',
        quantity: '1 ikat',
        category: 'Sayur & Buah',
        estimatedPrice: 5000,
        store: null,
      },
      {
        id: 'tpl-stok-5',
        name: 'Keju Procheese',
        quantity: '1 kotak',
        category: 'Sembako',
        estimatedPrice: 14000,
        store: null,
      },
    ],
  },
]

const STARTER_FREQUENT_SEED: Array<
  Omit<FrequentItem, 'normalizedName' | 'lastUsedAt'>
> = [
  {
    name: 'Telur',
    quantity: '1',
    category: 'Sembako',
    estimatedPrice: 21000,
    store: null,
    count: 6,
  },
  {
    name: 'Bawang Merah',
    quantity: '1',
    category: 'Bumbu & Rempah',
    estimatedPrice: 9500,
    store: null,
    count: 5,
  },
  {
    name: 'Bawang Putih',
    quantity: '1',
    category: 'Bumbu & Rempah',
    estimatedPrice: 10500,
    store: null,
    count: 5,
  },
  {
    name: 'Kangkung',
    quantity: '1',
    category: 'Sayur & Buah',
    estimatedPrice: 5000,
    store: null,
    count: 5,
  },
  {
    name: 'Sari Roti',
    quantity: '1',
    category: 'Sembako',
    estimatedPrice: 20000,
    store: null,
    count: 4,
  },
  {
    name: 'Susu Diamond',
    quantity: '1',
    category: 'Sembako',
    estimatedPrice: 23000,
    store: null,
    count: 4,
  },
  {
    name: 'Lombok Merah',
    quantity: '1',
    category: 'Bumbu & Rempah',
    estimatedPrice: 10000,
    store: null,
    count: 4,
  },
  {
    name: 'Tempe',
    quantity: '1',
    category: 'Sembako',
    estimatedPrice: 5000,
    store: null,
    count: 4,
  },
  {
    name: 'Minyak 2L',
    quantity: '2 liter',
    category: 'Sembako',
    estimatedPrice: 41000,
    store: null,
    count: 3,
  },
  {
    name: 'Ayam',
    quantity: '1',
    category: 'Daging & Ikan',
    estimatedPrice: 35000,
    store: null,
    count: 3,
  },
]

export const DEFAULT_FREQUENT_ITEMS: FrequentItem[] = STARTER_FREQUENT_SEED.map(
  (item, idx) => ({
    ...item,
    normalizedName: normalizeItemName(item.name),
    lastUsedAt: 100 - idx,
  }),
)

export const DEFAULT_PIN_CONFIG: PinConfig = {
  hasCompletedOnboarding: false,
  pinEnabled: false,
  pinHash: null,
}

let cachedInitialSeed: ReturnType<typeof buildSeedFromWifeNote> | null = null
function getInitialSeed() {
  if (!cachedInitialSeed) {
    cachedInitialSeed = buildSeedFromWifeNote()
  }
  return cachedInitialSeed
}

function safeRead<T>(key: string, fallback: () => T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback()
    return JSON.parse(raw) as T
  } catch {
    return fallback()
  }
}

function safeWrite(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota errors gracefully
  }
}

export const localStorageAdapter: MarketStorageAdapter = {
  loadStores() {
    const loaded = safeRead<StoreConfig[]>(KEYS.stores, () => DEFAULT_STORES)
    return loaded.length > 0 ? loaded : DEFAULT_STORES
  },
  saveStores(stores) {
    safeWrite(KEYS.stores, stores)
  },
  loadCategories() {
    const loaded = safeRead<CategoryConfig[]>(
      KEYS.categories,
      () => DEFAULT_CATEGORIES,
    )
    return loaded.length > 0 ? loaded : DEFAULT_CATEGORIES
  },
  saveCategories(categories) {
    safeWrite(KEYS.categories, categories)
  },
  loadItems() {
    const raw = safeRead<MarketItem[]>(KEYS.items, () => [])
    return raw.map((item) => ({
      ...item,
      store: item.store ?? null,
    }))
  },
  saveItems(items) {
    safeWrite(KEYS.items, items)
  },
  loadFrequentItems() {
    const raw = safeRead<FrequentItem[]>(
      KEYS.frequent,
      () => DEFAULT_FREQUENT_ITEMS,
    )
    return raw.map((item) => ({
      ...item,
      store: item.store ?? null,
    }))
  },
  saveFrequentItems(items) {
    safeWrite(KEYS.frequent, items)
  },
  loadTemplates() {
    const raw = safeRead<MealTemplate[]>(
      KEYS.templates,
      () => DEFAULT_TEMPLATES,
    )
    return raw.map((tpl) => ({
      ...tpl,
      items: tpl.items.map((item) => ({
        ...item,
        id: item.id ?? generateId(),
        store: item.store ?? null,
      })),
    }))
  },
  saveTemplates(templates) {
    safeWrite(KEYS.templates, templates)
  },
  loadProductRefs() {
    return safeRead<ProductReference[]>(
      KEYS.productRefs,
      () => getInitialSeed().refs,
    )
  },
  saveProductRefs(refs) {
    safeWrite(KEYS.productRefs, refs)
  },
  loadMonthlyPurchases() {
    return safeRead<MonthlyPurchaseEntry[]>(
      KEYS.monthlyPurchases,
      () => getInitialSeed().entries,
    )
  },
  saveMonthlyPurchases(entries) {
    safeWrite(KEYS.monthlyPurchases, entries)
  },
  loadPinConfig() {
    return safeRead<PinConfig>(KEYS.pin, () => DEFAULT_PIN_CONFIG)
  },
  savePinConfig(config) {
    safeWrite(KEYS.pin, config)
  },
}
