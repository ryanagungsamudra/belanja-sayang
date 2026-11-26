import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { detectCategory } from '../lib/categories'
import {
  generateId,
  hashPin,
  normalizeItemName,
  triggerHaptic,
} from '../lib/format'
import {
  createRefId,
  getCurrentMonthKey,
  parseMonthlyNoteText,
  shiftMonthKey,
} from '../lib/noteParser'
import {
  localStorageAdapter,
  type MarketStorageAdapter,
} from '../lib/storage'
import {
  getReferencePriceForStore,
  sortByNameAZ,
} from '../lib/stores'
import type { CollectionKey } from '../lib/supabaseSync'
import { useSupabaseSync } from './useSupabaseSync'
import type {
  AddItemInput,
  AddPurchaseEntryInput,
  CategoryConfig,
  FrequentItem,
  MarketCategory,
  MarketItem,
  MealTemplate,
  MonthlyPurchaseEntry,
  PinConfig,
  ProductReference,
  StoreConfig,
  StoreSource,
  UpdateItemInput,
  UpdatePurchaseEntryInput,
  UpsertProductRefInput,
  UpsertTemplateInput,
} from '../types/market'

function upsertFrequentList(
  prev: FrequentItem[],
  entry: {
    name: string
    quantity: string
    category: MarketCategory
    estimatedPrice: number
    store: StoreSource | null
  },
  incrementCount = true,
): FrequentItem[] {
  const normalized = normalizeItemName(entry.name)
  if (!normalized) return prev
  const now = Date.now()
  const existingIdx = prev.findIndex((f) => f.normalizedName === normalized)

  if (existingIdx >= 0) {
    const existing = prev[existingIdx]
    const updated: FrequentItem = {
      ...existing,
      name: entry.name.trim(),
      quantity: entry.quantity.trim() || existing.quantity || '1',
      category: entry.category,
      estimatedPrice:
        entry.estimatedPrice > 0 ? entry.estimatedPrice : existing.estimatedPrice,
      store: entry.store ?? existing.store,
      count: incrementCount ? existing.count + 1 : existing.count,
      lastUsedAt: now,
    }
    const next = [...prev]
    next[existingIdx] = updated
    return next
  }

  return [
    ...prev,
    {
      name: entry.name.trim(),
      normalizedName: normalized,
      quantity: entry.quantity.trim() || '1',
      category: entry.category,
      estimatedPrice: Math.max(0, Math.round(entry.estimatedPrice || 0)),
      store: entry.store,
      count: 1,
      lastUsedAt: now,
    },
  ]
}

function syncPriceIntoProductRefs(
  prev: ProductReference[],
  entry: {
    name: string
    quantity: string
    category: MarketCategory
    store: StoreSource | null
    price: number
    defaultStoreId: string
  },
): { nextRefs: ProductReference[]; refId: string } {
  const normalized = normalizeItemName(entry.name)
  const now = Date.now()
  const idx = prev.findIndex((r) => r.normalizedName === normalized)
  const targetStore = entry.store ?? entry.defaultStoreId

  if (idx >= 0) {
    const existing = prev[idx]
    const next = [...prev]
    next[idx] = {
      ...existing,
      category: entry.category,
      defaultQuantity: entry.quantity || existing.defaultQuantity,
      preferredStore: entry.store ?? existing.preferredStore,
      prices:
        entry.store && entry.price > 0
          ? {
              ...existing.prices,
              [entry.store]: { price: Math.round(entry.price), updatedAt: now },
            }
          : existing.prices,
      updatedAt: now,
    }
    return { nextRefs: next, refId: existing.id }
  }

  const newId = createRefId()
  const newRef: ProductReference = {
    id: newId,
    name: entry.name.trim(),
    normalizedName: normalized,
    defaultQuantity: entry.quantity || '1',
    category: entry.category,
    preferredStore: targetStore,
    prices:
      entry.store && entry.price > 0
        ? {
            [entry.store]: { price: Math.round(entry.price), updatedAt: now },
          }
        : {},
    updatedAt: now,
  }
  return { nextRefs: [newRef, ...prev], refId: newId }
}

export function useMarketStore(
  adapter: MarketStorageAdapter = localStorageAdapter,
  onRemoteSyncNotice?: (message: string) => void,
) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    getCurrentMonthKey(),
  )
  const [stores, setStores] = useState<StoreConfig[]>(() =>
    adapter.loadStores(),
  )
  const [categories, setCategories] = useState<CategoryConfig[]>(() =>
    adapter.loadCategories(),
  )
  const [items, setItems] = useState<MarketItem[]>(() => adapter.loadItems())
  const [frequentItems, setFrequentItems] = useState<FrequentItem[]>(() =>
    adapter.loadFrequentItems(),
  )
  const [templates, setTemplates] = useState<MealTemplate[]>(() =>
    adapter.loadTemplates(),
  )
  const [productRefs, setProductRefs] = useState<ProductReference[]>(() =>
    adapter.loadProductRefs(),
  )
  const [monthlyPurchases, setMonthlyPurchases] = useState<
    MonthlyPurchaseEntry[]
  >(() => adapter.loadMonthlyPurchases())
  const [pinConfig, setPinConfig] = useState<PinConfig>(() =>
    adapter.loadPinConfig(),
  )
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const cfg = adapter.loadPinConfig()
    return !cfg.hasCompletedOnboarding || (cfg.pinEnabled && Boolean(cfg.pinHash))
  })

  // Track mounted state & remote-application guard to avoid echoing remote updates back
  const hasMountedRef = useRef<Record<CollectionKey, boolean>>({
    stores: false,
    categories: false,
    items: false,
    frequent: false,
    templates: false,
    product_refs: false,
    monthly_purchases: false,
    pin_config: false,
  })
  const skipPushRef = useRef<Record<CollectionKey, boolean>>({
    stores: false,
    categories: false,
    items: false,
    frequent: false,
    templates: false,
    product_refs: false,
    monthly_purchases: false,
    pin_config: false,
  })

  const latestDataRef = useRef({
    stores,
    categories,
    items,
    frequent: frequentItems,
    templates,
    product_refs: productRefs,
    monthly_purchases: monthlyPurchases,
    pin_config: pinConfig,
  })

  useEffect(() => {
    latestDataRef.current = {
      stores,
      categories,
      items,
      frequent: frequentItems,
      templates,
      product_refs: productRefs,
      monthly_purchases: monthlyPurchases,
      pin_config: pinConfig,
    }
  }, [
    stores,
    categories,
    items,
    frequentItems,
    templates,
    productRefs,
    monthlyPurchases,
    pinConfig,
  ])

  const getPayload = useCallback((key: CollectionKey) => {
    return latestDataRef.current[key]
  }, [])

  const applyRemotePayload = useCallback(
    (key: CollectionKey, payload: unknown) => {
      if (key === 'pin_config') {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          return
        }
        const remotePin = payload as Partial<PinConfig>
        if (typeof remotePin.hasCompletedOnboarding !== 'boolean') return

        const normalized: PinConfig = {
          hasCompletedOnboarding: remotePin.hasCompletedOnboarding,
          pinEnabled: Boolean(remotePin.pinEnabled && remotePin.pinHash),
          pinHash: remotePin.pinHash ?? null,
        }
        const prevPin = latestDataRef.current.pin_config
        skipPushRef.current.pin_config = true
        setPinConfig(normalized)

        if (normalized.pinEnabled && normalized.pinHash) {
          // Lock this device if PIN was newly enabled, changed, or this is a fresh device
          if (!prevPin.pinEnabled || prevPin.pinHash !== normalized.pinHash) {
            setIsLocked(true)
          }
        } else if (normalized.hasCompletedOnboarding) {
          setIsLocked(false)
        }
        return
      }

      if (!Array.isArray(payload)) return
      skipPushRef.current[key] = true
      switch (key) {
        case 'stores':
          if (payload.length > 0) setStores(payload as StoreConfig[])
          break
        case 'categories':
          if (payload.length > 0) setCategories(payload as CategoryConfig[])
          break
        case 'items':
          setItems(payload as MarketItem[])
          break
        case 'frequent':
          setFrequentItems(payload as FrequentItem[])
          break
        case 'templates':
          setTemplates(payload as MealTemplate[])
          break
        case 'product_refs':
          setProductRefs(payload as ProductReference[])
          break
        case 'monthly_purchases':
          setMonthlyPurchases(payload as MonthlyPurchaseEntry[])
          break
      }
    },
    [],
  )

  const sync = useSupabaseSync({
    getPayload,
    applyRemotePayload,
    onRemoteNotice: onRemoteSyncNotice,
  })
  const { schedulePush, pushKeyImmediately } = sync

  useEffect(() => {
    if (!hasMountedRef.current.stores) {
      hasMountedRef.current.stores = true
      return
    }
    adapter.saveStores(stores)
    if (skipPushRef.current.stores) {
      skipPushRef.current.stores = false
      return
    }
    schedulePush('stores')
  }, [adapter, stores, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.categories) {
      hasMountedRef.current.categories = true
      return
    }
    adapter.saveCategories(categories)
    if (skipPushRef.current.categories) {
      skipPushRef.current.categories = false
      return
    }
    schedulePush('categories')
  }, [adapter, categories, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.items) {
      hasMountedRef.current.items = true
      return
    }
    adapter.saveItems(items)
    if (skipPushRef.current.items) {
      skipPushRef.current.items = false
      return
    }
    schedulePush('items')
  }, [adapter, items, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.frequent) {
      hasMountedRef.current.frequent = true
      return
    }
    adapter.saveFrequentItems(frequentItems)
    if (skipPushRef.current.frequent) {
      skipPushRef.current.frequent = false
      return
    }
    schedulePush('frequent')
  }, [adapter, frequentItems, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.templates) {
      hasMountedRef.current.templates = true
      return
    }
    adapter.saveTemplates(templates)
    if (skipPushRef.current.templates) {
      skipPushRef.current.templates = false
      return
    }
    schedulePush('templates')
  }, [adapter, templates, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.product_refs) {
      hasMountedRef.current.product_refs = true
      return
    }
    adapter.saveProductRefs(productRefs)
    if (skipPushRef.current.product_refs) {
      skipPushRef.current.product_refs = false
      return
    }
    schedulePush('product_refs')
  }, [adapter, productRefs, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.monthly_purchases) {
      hasMountedRef.current.monthly_purchases = true
      return
    }
    adapter.saveMonthlyPurchases(monthlyPurchases)
    if (skipPushRef.current.monthly_purchases) {
      skipPushRef.current.monthly_purchases = false
      return
    }
    schedulePush('monthly_purchases')
  }, [adapter, monthlyPurchases, schedulePush])

  useEffect(() => {
    if (!hasMountedRef.current.pin_config) {
      hasMountedRef.current.pin_config = true
      return
    }
    adapter.savePinConfig(pinConfig)
    if (skipPushRef.current.pin_config) {
      skipPushRef.current.pin_config = false
      return
    }
    schedulePush('pin_config')
  }, [adapter, pinConfig, schedulePush])

  const defaultStoreId = stores[0]?.id ?? 'hypermart'
  const fallbackCategoryId =
    categories.find((c) => c.id === 'Lainnya')?.id ??
    categories[categories.length - 1]?.id ??
    'Lainnya'

  // --- Dynamic Stores CRUD ---
  const upsertStore = useCallback(
    (input: {
      id?: string
      name: string
      shortLabel?: string
      code: string
      color: string
    }): StoreConfig | null => {
      const name = input.name.trim()
      const code = input.code.trim() || name.slice(0, 2).toUpperCase()
      if (!name) return null

      const shortLabel = input.shortLabel?.trim() || name
      const prevStores = latestDataRef.current.stores
      const existing = input.id
        ? prevStores.find((s) => s.id === input.id)
        : undefined
      const record: StoreConfig = {
        id: existing ? existing.id : `store-${generateId().slice(0, 8)}`,
        name,
        shortLabel,
        code,
        color: input.color || '#059669',
        updatedAt: Date.now(),
      }

      setStores((prev) => {
        const idx = prev.findIndex((s) => s.id === record.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = record
          return next
        }
        return [...prev, record]
      })

      triggerHaptic(12)
      return record
    },
    [],
  )

  const deleteStore = useCallback(
    (storeId: string): boolean => {
      if (stores.length <= 1) return false
      const remaining = stores.filter((s) => s.id !== storeId)
      const fallbackId = remaining[0]?.id ?? 'pasar'
      setStores(remaining)
      // Unassign store on active cart items that used the deleted store
      setItems((prev) =>
        prev.map((item) =>
          item.store === storeId ? { ...item, store: null } : item,
        ),
      )
      setProductRefs((prev) =>
        prev.map((ref) =>
          ref.preferredStore === storeId
            ? { ...ref, preferredStore: fallbackId }
            : ref,
        ),
      )
      triggerHaptic(12)
      return true
    },
    [stores],
  )

  // --- Dynamic Categories CRUD ---
  const upsertCategory = useCallback(
    (input: {
      id?: string
      name: string
      shortLabel?: string
      color: string
    }): CategoryConfig | null => {
      const name = input.name.trim()
      if (!name) return null
      const shortLabel = input.shortLabel?.trim() || name.split(' ')[0] || name
      const prevCats = latestDataRef.current.categories
      const existing = input.id
        ? prevCats.find((c) => c.id === input.id)
        : undefined
      const record: CategoryConfig = {
        id: existing ? existing.id : `cat-${generateId().slice(0, 8)}`,
        name,
        shortLabel,
        color: input.color || '#059669',
        updatedAt: Date.now(),
      }

      setCategories((prev) => {
        const idx = prev.findIndex((c) => c.id === record.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = record
          return next
        }
        return [...prev, record]
      })

      triggerHaptic(12)
      return record
    },
    [],
  )

  const deleteCategory = useCallback(
    (categoryId: string): boolean => {
      if (categories.length <= 1) return false
      const remaining = categories.filter((c) => c.id !== categoryId)
      const fallback =
        remaining.find((c) => c.id === 'Lainnya')?.id ?? remaining[0].id

      setCategories(remaining)
      setProductRefs((prev) =>
        prev.map((r) =>
          r.category === categoryId ? { ...r, category: fallback } : r,
        ),
      )
      setItems((prev) =>
        prev.map((i) =>
          i.category === categoryId ? { ...i, category: fallback } : i,
        ),
      )
      setTemplates((prev) =>
        prev.map((tpl) => ({
          ...tpl,
          items: tpl.items.map((ti) =>
            ti.category === categoryId ? { ...ti, category: fallback } : ti,
          ),
        })),
      )
      triggerHaptic(12)
      return true
    },
    [categories],
  )

  const findProductRefByName = useCallback(
    (name: string): ProductReference | undefined => {
      const norm = normalizeItemName(name)
      if (!norm) return undefined
      return productRefs.find((r) => r.normalizedName === norm)
    },
    [productRefs],
  )

  const resolveDetectedCategory = useCallback(
    (name: string): MarketCategory => {
      const detected = detectCategory(name)
      if (categories.some((c) => c.id === detected)) return detected
      return fallbackCategoryId
    },
    [categories, fallbackCategoryId],
  )

  const addItem = useCallback(
    (input: AddItemInput): MarketItem | null => {
      const trimmedName = input.name.trim()
      if (!trimmedName) return null

      const matchedRef = findProductRefByName(trimmedName)
      const store: StoreSource | null =
        input.store !== undefined ? input.store : null

      const refFallback = matchedRef
        ? getReferencePriceForStore(matchedRef, store, stores)
        : null

      const quantity =
        input.quantity?.trim() || matchedRef?.defaultQuantity || '1'
      const category =
        input.category ??
        matchedRef?.category ??
        resolveDetectedCategory(trimmedName)
      const estimatedPrice = Math.max(
        0,
        Math.round(
          input.estimatedPrice !== undefined && input.estimatedPrice > 0
            ? input.estimatedPrice
            : refFallback?.price ?? 0,
        ),
      )

      const now = Date.now()
      const newItem: MarketItem = {
        id: generateId(),
        name: trimmedName,
        quantity,
        category,
        estimatedPrice,
        store,
        productRefId: input.productRefId ?? matchedRef?.id,
        isBought: false,
        createdAt: now,
        updatedAt: now,
      }

      setItems((prev) => [newItem, ...prev])
      setFrequentItems((prev) =>
        upsertFrequentList(prev, {
          name: trimmedName,
          quantity,
          category,
          estimatedPrice,
          store,
        }),
      )

      if (input.syncToReference !== false && store && estimatedPrice > 0) {
        setProductRefs(
          (prev) =>
            syncPriceIntoProductRefs(prev, {
              name: trimmedName,
              quantity,
              category,
              store,
              price: estimatedPrice,
              defaultStoreId,
            }).nextRefs,
        )
      }

      triggerHaptic(10)
      return newItem
    },
    [defaultStoreId, findProductRefByName, resolveDetectedCategory, stores],
  )

  /**
   * 1-tap toggle from Monthly Reference list into Weekly Cart:
   * - Adds 1 single item with store = null (user picks which store later on the cart!)
   * - If already active in the cart, toggles it off instead of duplicating!
   */
  const toggleProductInCart = useCallback(
    (ref: ProductReference): 'added' | 'removed' => {
      const existing = items.find(
        (i) =>
          !i.isBought &&
          (i.productRefId === ref.id ||
            normalizeItemName(i.name) === ref.normalizedName),
      )
      if (existing) {
        setItems((prev) => prev.filter((i) => i.id !== existing.id))
        triggerHaptic(10)
        return 'removed'
      }

      const refPrice = getReferencePriceForStore(ref, null, stores).price
      addItem({
        name: ref.name,
        quantity: ref.defaultQuantity,
        category: ref.category,
        store: null, // User configures store on the Weekly Cart!
        estimatedPrice: refPrice,
        productRefId: ref.id,
        syncToReference: false,
      })
      return 'added'
    },
    [addItem, items, stores],
  )

  /**
   * Inline store selector directly on a Weekly Cart row:
   * updates the store and auto-fills that store's saved reference price if available.
   */
  const assignCartItemStore = useCallback(
    (itemId: string, storeId: StoreSource | null) => {
      const target = items.find((i) => i.id === itemId)
      if (!target) return

      const matchedRef =
        (target.productRefId
          ? productRefs.find((r) => r.id === target.productRefId)
          : undefined) ?? findProductRefByName(target.name)

      const refStorePrice =
        storeId && matchedRef?.prices[storeId]?.price
          ? matchedRef.prices[storeId]!.price
          : null

      const nextPrice =
        refStorePrice && refStorePrice > 0
          ? refStorePrice
          : target.estimatedPrice

      const now = Date.now()
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                store: storeId,
                estimatedPrice: nextPrice,
                updatedAt: now,
              }
            : item,
        ),
      )

      if (target.isBought && target.linkedPurchaseId && storeId) {
        setMonthlyPurchases((prev) =>
          prev.map((e) =>
            e.id === target.linkedPurchaseId
              ? { ...e, store: storeId, price: nextPrice, updatedAt: now }
              : e,
          ),
        )
      }
      triggerHaptic(8)
    },
    [findProductRefByName, items, productRefs],
  )

  const updateItem = useCallback(
    (id: string, patch: UpdateItemInput) => {
      const existing = latestDataRef.current.items.find((i) => i.id === id)
      if (!existing) return

      const now = Date.now()
      const u: MarketItem = {
        ...existing,
        name:
          patch.name !== undefined
            ? patch.name.trim() || existing.name
            : existing.name,
        quantity:
          patch.quantity !== undefined
            ? patch.quantity.trim() || '1'
            : existing.quantity,
        category: patch.category ?? existing.category,
        store: patch.store !== undefined ? patch.store : existing.store,
        estimatedPrice:
          patch.estimatedPrice !== undefined
            ? Math.max(0, Math.round(patch.estimatedPrice))
            : existing.estimatedPrice,
        updatedAt: now,
      }

      setItems((prev) => prev.map((item) => (item.id === id ? u : item)))

      setFrequentItems((prev) =>
        upsertFrequentList(
          prev,
          {
            name: u.name,
            quantity: u.quantity,
            category: u.category,
            estimatedPrice: u.estimatedPrice,
            store: u.store,
          },
          false,
        ),
      )

      if (u.isBought && u.linkedPurchaseId) {
        setMonthlyPurchases((prev) =>
          prev.map((entry) =>
            entry.id === u.linkedPurchaseId
              ? {
                  ...entry,
                  productName: u.name,
                  store: u.store ?? entry.store,
                  price: u.estimatedPrice,
                  updatedAt: now,
                }
              : entry,
          ),
        )
      }

      if (patch.syncToReference !== false && u.store && u.estimatedPrice > 0) {
        setProductRefs(
          (prev) =>
            syncPriceIntoProductRefs(prev, {
              name: u.name,
              quantity: u.quantity,
              category: u.category,
              store: u.store,
              price: u.estimatedPrice,
              defaultStoreId,
            }).nextRefs,
        )
      }
    },
    [defaultStoreId],
  )

  const toggleBought = useCallback(
    (id: string) => {
      triggerHaptic(15)
      const target = items.find((i) => i.id === id)
      if (!target) return

      if (!target.isBought) {
        const now = Date.now()
        const existingRef =
          (target.productRefId
            ? productRefs.find((r) => r.id === target.productRefId)
            : undefined) ?? findProductRefByName(target.name)

        const resolvedStore: StoreSource =
          target.store ?? existingRef?.preferredStore ?? defaultStoreId

        let resolvedRefId = existingRef?.id

        if (existingRef) {
          if (target.estimatedPrice > 0) {
            setProductRefs((prev) =>
              prev.map((r) =>
                r.id === existingRef.id
                  ? {
                      ...r,
                      preferredStore: resolvedStore,
                      prices: {
                        ...r.prices,
                        [resolvedStore]: {
                          price: target.estimatedPrice,
                          updatedAt: now,
                        },
                      },
                      updatedAt: now,
                    }
                  : r,
              ),
            )
          }
        } else {
          const createdId = createRefId()
          resolvedRefId = createdId
          const newRef: ProductReference = {
            id: createdId,
            name: target.name,
            normalizedName: normalizeItemName(target.name),
            defaultQuantity: target.quantity || '1',
            category: target.category,
            preferredStore: resolvedStore,
            prices:
              target.estimatedPrice > 0
                ? {
                    [resolvedStore]: {
                      price: target.estimatedPrice,
                      updatedAt: now,
                    },
                  }
                : {},
            updatedAt: now,
          }
          setProductRefs((prev) => [newRef, ...prev])
        }

        const purchaseId = `log-${generateId()}`
        const purchaseEntry: MonthlyPurchaseEntry = {
          id: purchaseId,
          monthKey: selectedMonth,
          productRefId: resolvedRefId!,
          productName: target.name,
          store: resolvedStore,
          price: target.estimatedPrice,
          purchasedAt: now,
        }

        setMonthlyPurchases((prev) => [...prev, purchaseEntry])
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  isBought: true,
                  store: resolvedStore,
                  productRefId: resolvedRefId,
                  linkedPurchaseId: purchaseId,
                  updatedAt: now,
                }
              : item,
          ),
        )
      } else {
        const now = Date.now()
        const linkedId = target.linkedPurchaseId
        if (linkedId) {
          setMonthlyPurchases((prev) => prev.filter((e) => e.id !== linkedId))
        }
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  isBought: false,
                  linkedPurchaseId: undefined,
                  updatedAt: now,
                }
              : item,
          ),
        )
      }
    },
    [defaultStoreId, findProductRefByName, items, productRefs, selectedMonth],
  )

  const deleteItem = useCallback((id: string) => {
    triggerHaptic(12)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearBoughtItems = useCallback(() => {
    triggerHaptic(20)
    setItems((prev) => prev.filter((item) => !item.isBought))
  }, [])

  // --- Monthly Purchase Log CRUD ---
  const addPurchaseEntry = useCallback(
    (input: AddPurchaseEntryInput): MonthlyPurchaseEntry | null => {
      const ref = productRefs.find((r) => r.id === input.productRefId)
      if (!ref) return null
      const now = Date.now()
      const roundedPrice = Math.max(0, Math.round(input.price))

      const entry: MonthlyPurchaseEntry = {
        id: `log-${generateId()}`,
        monthKey: input.monthKey,
        productRefId: ref.id,
        productName: ref.name,
        store: input.store,
        price: roundedPrice,
        qtyNote: input.qtyNote?.trim() || undefined,
        purchasedAt: now,
      }

      setMonthlyPurchases((prev) => [...prev, entry])

      if (roundedPrice > 0) {
        setProductRefs((prev) =>
          prev.map((r) =>
            r.id === ref.id
              ? {
                  ...r,
                  preferredStore: input.store,
                  prices: {
                    ...r.prices,
                    [input.store]: { price: roundedPrice, updatedAt: now },
                  },
                  updatedAt: now,
                }
              : r,
          ),
        )
      }
      triggerHaptic(10)
      return entry
    },
    [productRefs],
  )

  const updatePurchaseEntry = useCallback(
    (entryId: string, patch: UpdatePurchaseEntryInput) => {
      const existing = latestDataRef.current.monthly_purchases.find(
        (e) => e.id === entryId,
      )
      if (!existing) return
      const now = Date.now()
      const updated: MonthlyPurchaseEntry = {
        ...existing,
        store: patch.store ?? existing.store,
        price:
          patch.price !== undefined
            ? Math.max(0, Math.round(patch.price))
            : existing.price,
        qtyNote:
          patch.qtyNote !== undefined
            ? patch.qtyNote.trim() || undefined
            : existing.qtyNote,
        updatedAt: now,
      }

      setMonthlyPurchases((prev) =>
        prev.map((e) => (e.id === entryId ? updated : e)),
      )

      if (updated.price > 0) {
        setProductRefs((prev) =>
          prev.map((r) =>
            r.id === updated.productRefId
              ? {
                  ...r,
                  prices: {
                    ...r.prices,
                    [updated.store]: {
                      price: updated.price,
                      updatedAt: now,
                    },
                  },
                  updatedAt: now,
                }
              : r,
          ),
        )
      }
      triggerHaptic(10)
    },
    [],
  )

  const deletePurchaseEntry = useCallback((entryId: string) => {
    setMonthlyPurchases((prev) => prev.filter((e) => e.id !== entryId))
    triggerHaptic(12)
  }, [])

  const importNoteText = useCallback(
    (
      rawText: string,
      monthKey: string,
    ): { productsCount: number; entriesCount: number } => {
      const parsedLines = parseMonthlyNoteText(rawText, stores)
      if (parsedLines.length === 0) {
        return { productsCount: 0, entriesCount: 0 }
      }

      const now = Date.now()
      let nextRefs = [...productRefs]
      const newEntries: MonthlyPurchaseEntry[] = []

      parsedLines.forEach((line, lineIdx) => {
        const norm = normalizeItemName(line.productName)
        let ref = nextRefs.find((r) => r.normalizedName === norm)
        const lastEntry = line.entries[line.entries.length - 1]

        if (!ref) {
          ref = {
            id: createRefId(),
            name: line.productName,
            normalizedName: norm,
            defaultQuantity: line.productName.toLowerCase().includes('2l')
              ? '2 liter'
              : '1',
            category: resolveDetectedCategory(line.productName),
            preferredStore: lastEntry?.store ?? defaultStoreId,
            prices: {},
            updatedAt: now,
          }
          nextRefs = [ref, ...nextRefs]
        }

        const updatedPrices = { ...ref.prices }
        line.entries.forEach((e, entryIdx) => {
          const ts = now + lineIdx * 20 + entryIdx
          if (e.price > 0) {
            updatedPrices[e.store] = { price: e.price, updatedAt: ts }
          }
          newEntries.push({
            id: `log-${generateId()}`,
            monthKey,
            productRefId: ref!.id,
            productName: ref!.name,
            store: e.store,
            price: e.price,
            qtyNote: e.qtyNote,
            purchasedAt: ts,
          })
        })

        nextRefs = nextRefs.map((r) =>
          r.id === ref!.id
            ? {
                ...r,
                preferredStore: lastEntry?.store ?? r.preferredStore,
                prices: updatedPrices,
                updatedAt: now,
              }
            : r,
        )
      })

      setProductRefs(nextRefs)
      setMonthlyPurchases((prev) => [...prev, ...newEntries])
      triggerHaptic(18)
      return {
        productsCount: parsedLines.length,
        entriesCount: newEntries.length,
      }
    },
    [defaultStoreId, productRefs, resolveDetectedCategory, stores],
  )

  // --- Product Reference CRUD ---
  const upsertProductRef = useCallback(
    (input: UpsertProductRefInput): ProductReference | null => {
      const trimmed = input.name.trim()
      if (!trimmed) return null
      const norm = normalizeItemName(trimmed)
      const now = Date.now()

      const prevRefs = latestDataRef.current.product_refs
      const existing = input.id
        ? prevRefs.find((r) => r.id === input.id)
        : prevRefs.find((r) => r.normalizedName === norm)

      const nextPrices: ProductReference['prices'] = {}
      for (const [storeId, val] of Object.entries(input.prices)) {
        if (val !== undefined && val > 0) {
          const rounded = Math.round(val)
          const prevPrice = existing?.prices[storeId]?.price
          nextPrices[storeId] = {
            price: rounded,
            updatedAt:
              prevPrice === rounded && existing?.prices[storeId]?.updatedAt
                ? existing.prices[storeId]!.updatedAt
                : now,
          }
        }
      }

      const record: ProductReference = {
        id: existing?.id ?? input.id ?? createRefId(),
        name: trimmed,
        normalizedName: norm,
        defaultQuantity: input.defaultQuantity.trim() || '1',
        category: input.category,
        preferredStore: input.preferredStore,
        prices: nextPrices,
        notes: input.notes?.trim() || undefined,
        updatedAt: now,
      }

      setProductRefs((prev) => {
        const idx = prev.findIndex((r) => r.id === record.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = record
          return next
        }
        return [record, ...prev]
      })

      triggerHaptic(12)
      return record
    },
    [],
  )

  const deleteProductRef = useCallback((refId: string) => {
    setProductRefs((prev) => prev.filter((r) => r.id !== refId))
    setMonthlyPurchases((prev) => prev.filter((e) => e.productRefId !== refId))
    triggerHaptic(12)
  }, [])

  // --- Undo Restore Helpers ---
  const restoreItems = useCallback((restored: MarketItem[]) => {
    if (restored.length === 0) return
    const now = Date.now()
    setItems((prev) => {
      const existingIds = new Set(prev.map((i) => i.id))
      const toAdd = restored
        .filter((i) => !existingIds.has(i.id))
        .map((i) => ({ ...i, updatedAt: now }))
      return [...toAdd, ...prev]
    })
    triggerHaptic(10)
  }, [])

  const restorePurchaseEntry = useCallback((entry: MonthlyPurchaseEntry) => {
    setMonthlyPurchases((prev) =>
      prev.some((e) => e.id === entry.id)
        ? prev
        : [...prev, { ...entry, updatedAt: Date.now() }],
    )
    triggerHaptic(10)
  }, [])

  const restoreProductRefWithEntries = useCallback(
    (ref: ProductReference, entries: MonthlyPurchaseEntry[]) => {
      const now = Date.now()
      setProductRefs((prev) =>
        prev.some((r) => r.id === ref.id)
          ? prev
          : [{ ...ref, updatedAt: now }, ...prev],
      )
      if (entries.length > 0) {
        setMonthlyPurchases((prev) => {
          const existingIds = new Set(prev.map((e) => e.id))
          const toAdd = entries
            .filter((e) => !existingIds.has(e.id))
            .map((e) => ({ ...e, updatedAt: now }))
          return [...prev, ...toAdd]
        })
      }
      triggerHaptic(10)
    },
    [],
  )

  const restoreTemplate = useCallback((tpl: MealTemplate) => {
    setTemplates((prev) =>
      prev.some((t) => t.id === tpl.id)
        ? prev
        : [{ ...tpl, updatedAt: Date.now() }, ...prev],
    )
    triggerHaptic(10)
  }, [])

  // --- Editable Paket Masak (Templates) ---
  const applyTemplate = useCallback(
    (templateId: string): { addedCount: number; skippedCount: number } => {
      const template = templates.find((t) => t.id === templateId)
      if (!template) return { addedCount: 0, skippedCount: 0 }

      const activeNames = new Set(
        items.filter((i) => !i.isBought).map((i) => normalizeItemName(i.name)),
      )

      const now = Date.now()
      const toAdd: MarketItem[] = []
      let skippedCount = 0

      template.items.forEach((tplItem, idx) => {
        const norm = normalizeItemName(tplItem.name)
        if (activeNames.has(norm)) {
          skippedCount += 1
          return
        }
        activeNames.add(norm)
        const matchedRef = findProductRefByName(tplItem.name)
        const refPrice = matchedRef
          ? getReferencePriceForStore(matchedRef, tplItem.store, stores)
          : null

        const finalPrice =
          tplItem.estimatedPrice > 0
            ? Math.round(tplItem.estimatedPrice)
            : refPrice?.price ?? 0

        toAdd.push({
          id: generateId(),
          name: tplItem.name.trim(),
          quantity: tplItem.quantity.trim() || '1',
          category: tplItem.category,
          estimatedPrice: Math.max(0, finalPrice),
          store: tplItem.store ?? null,
          productRefId: matchedRef?.id,
          isBought: false,
          createdAt: now + idx,
        })
      })

      if (toAdd.length > 0) {
        setItems((prev) => [...toAdd, ...prev])
        setFrequentItems((prev) => {
          let next = prev
          for (const added of toAdd) {
            next = upsertFrequentList(next, {
              name: added.name,
              quantity: added.quantity,
              category: added.category,
              estimatedPrice: added.estimatedPrice,
              store: added.store,
            })
          }
          return next
        })
        triggerHaptic(18)
      }

      return { addedCount: toAdd.length, skippedCount }
    },
    [findProductRefByName, items, stores, templates],
  )

  const upsertTemplate = useCallback(
    (input: UpsertTemplateInput): MealTemplate | null => {
      const trimmed = input.name.trim()
      const cleanItems = input.items
        .map((i) => ({
          id: i.id ?? generateId(),
          name: i.name.trim(),
          quantity: i.quantity.trim() || '1',
          category: i.category,
          estimatedPrice: Math.max(0, Math.round(i.estimatedPrice || 0)),
          store: i.store ?? null,
        }))
        .filter((i) => i.name.length > 0)

      if (!trimmed || cleanItems.length === 0) return null

      const now = Date.now()
      const prevTemplates = latestDataRef.current.templates
      const existing = input.id
        ? prevTemplates.find((t) => t.id === input.id)
        : undefined
      const record: MealTemplate = {
        id: existing ? existing.id : `tpl-${generateId()}`,
        name: trimmed,
        emoji: input.emoji || '🍲',
        description:
          input.description.trim() || `Paket masak (${cleanItems.length} bahan)`,
        items: cleanItems,
        isDefault: existing ? existing.isDefault : false,
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now,
      }

      setTemplates((prev) => {
        const idx = prev.findIndex((t) => t.id === record.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = record
          return next
        }
        return [record, ...prev]
      })

      triggerHaptic(15)
      return record
    },
    [],
  )

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId))
  }, [])

  // --- PIN management ---
  const setPin = useCallback(
    (pin: string) => {
      const config: PinConfig = {
        hasCompletedOnboarding: true,
        pinEnabled: true,
        pinHash: hashPin(pin),
      }
      adapter.savePinConfig(config)
      skipPushRef.current.pin_config = true
      setPinConfig(config)
      setIsLocked(false)
      pushKeyImmediately('pin_config', config)
    },
    [adapter, pushKeyImmediately],
  )

  const disablePin = useCallback(() => {
    const config: PinConfig = {
      hasCompletedOnboarding: true,
      pinEnabled: false,
      pinHash: null,
    }
    adapter.savePinConfig(config)
    skipPushRef.current.pin_config = true
    setPinConfig(config)
    setIsLocked(false)
    pushKeyImmediately('pin_config', config)
  }, [adapter, pushKeyImmediately])

  const verifyAndUnlock = useCallback(
    (pin: string): boolean => {
      if (!pinConfig.pinEnabled || !pinConfig.pinHash) {
        setIsLocked(false)
        return true
      }
      const ok = hashPin(pin) === pinConfig.pinHash
      if (ok) {
        triggerHaptic(15)
        setIsLocked(false)
      } else {
        triggerHaptic(40)
      }
      return ok
    },
    [pinConfig],
  )

  const lockNow = useCallback(() => {
    if (pinConfig.pinEnabled && pinConfig.pinHash) {
      setIsLocked(true)
    }
  }, [pinConfig])

  // --- Derived data (A–Z sorted!) ---
  const sortedProductRefs = useMemo(
    () => sortByNameAZ(productRefs),
    [productRefs],
  )

  const activeItems = useMemo(
    () => sortByNameAZ(items.filter((item) => !item.isBought)),
    [items],
  )

  const boughtItems = useMemo(
    () => sortByNameAZ(items.filter((item) => item.isBought)),
    [items],
  )

  const topFrequentChips = useMemo(() => {
    const activeNames = new Set(
      activeItems.map((i) => normalizeItemName(i.name)),
    )
    return [...frequentItems]
      .filter((f) => !activeNames.has(f.normalizedName))
      .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt)
      .slice(0, 10)
  }, [activeItems, frequentItems])

  const currentMonthEntries = useMemo(
    () => monthlyPurchases.filter((e) => e.monthKey === selectedMonth),
    [monthlyPurchases, selectedMonth],
  )

  const monthlySpendByStore = useMemo(() => {
    const sums: Record<string, number> = {}
    for (const s of stores) sums[s.id] = 0
    for (const e of currentMonthEntries) {
      sums[e.store] = (sums[e.store] ?? 0) + (e.price || 0)
    }
    return sums
  }, [currentMonthEntries, stores])

  const monthlyTotalSpend = useMemo(
    () => currentMonthEntries.reduce((sum, e) => sum + (e.price || 0), 0),
    [currentMonthEntries],
  )

  const previousMonthKey = useMemo(
    () => shiftMonthKey(selectedMonth, -1),
    [selectedMonth],
  )

  const previousMonthTotalSpend = useMemo(
    () =>
      monthlyPurchases.reduce(
        (sum, e) => (e.monthKey === previousMonthKey ? sum + (e.price || 0) : sum),
        0,
      ),
    [monthlyPurchases, previousMonthKey],
  )

  const totalCount = items.length
  const boughtCount = boughtItems.length

  const totalEstimatedSpend = useMemo(
    () => items.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0),
    [items],
  )

  const boughtEstimatedSpend = useMemo(
    () => boughtItems.reduce((sum, item) => sum + (item.estimatedPrice || 0), 0),
    [boughtItems],
  )

  return {
    selectedMonth,
    setSelectedMonth,
    stores,
    categories,
    items,
    activeItems,
    boughtItems,
    topFrequentChips,
    templates,
    productRefs: sortedProductRefs,
    monthlyPurchases,
    currentMonthEntries,
    monthlySpendByStore,
    monthlyTotalSpend,
    previousMonthTotalSpend,
    pinConfig,
    isLocked,
    totalCount,
    boughtCount,
    totalEstimatedSpend,
    boughtEstimatedSpend,
    upsertStore,
    deleteStore,
    upsertCategory,
    deleteCategory,
    findProductRefByName,
    resolveDetectedCategory,
    addItem,
    toggleProductInCart,
    assignCartItemStore,
    updateItem,
    toggleBought,
    deleteItem,
    clearBoughtItems,
    addPurchaseEntry,
    updatePurchaseEntry,
    deletePurchaseEntry,
    importNoteText,
    upsertProductRef,
    deleteProductRef,
    restoreItems,
    restorePurchaseEntry,
    restoreProductRefWithEntries,
    restoreTemplate,
    applyTemplate,
    upsertTemplate,
    deleteTemplate,
    setPin,
    disablePin,
    verifyAndUnlock,
    lockNow,
    sync,
  }
}
