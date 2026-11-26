import {
  ArrowDownAZ,
  ArrowUpZA,
  CheckCircle2,
  ChefHat,
  NotebookPen,
  Plus,
  ShoppingBasket,
} from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { BottomNav, type AppTab } from './components/BottomNav'
import { Header } from './components/Header'
import { ProductCatalogView } from './components/ProductCatalogView'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import { ToastHost } from './components/ToastHost'
import { emitToast } from './lib/toastBus'

const PinLockScreen = lazy(() =>
  import('./components/PinLockScreen').then((m) => ({
    default: m.PinLockScreen,
  })),
)
const loadBasketDrawer = () =>
  import('./components/BasketDrawer').then((m) => ({ default: m.BasketDrawer }))
const loadBottomQuickAdd = () =>
  import('./components/BottomQuickAdd').then((m) => ({
    default: m.BottomQuickAdd,
  }))
const loadCategoryGroup = () =>
  import('./components/CategoryGroup').then((m) => ({
    default: m.CategoryGroup,
  }))
const loadTemplatesView = () =>
  import('./components/TemplatesView').then((m) => ({
    default: m.TemplatesView,
  }))

const BasketDrawer = lazy(loadBasketDrawer)
const BottomQuickAdd = lazy(loadBottomQuickAdd)
const CategoryGroup = lazy(loadCategoryGroup)
const EditItemModal = lazy(() =>
  import('./components/EditItemModal').then((m) => ({
    default: m.EditItemModal,
  })),
)
const ManageConfigModal = lazy(() =>
  import('./components/ManageConfigModal').then((m) => ({
    default: m.ManageConfigModal,
  })),
)
const NoteImportModal = lazy(() =>
  import('./components/NoteImportModal').then((m) => ({
    default: m.NoteImportModal,
  })),
)
const ProductRefModal = lazy(() =>
  import('./components/ProductRefModal').then((m) => ({
    default: m.ProductRefModal,
  })),
)
const PurchaseEntryModal = lazy(() =>
  import('./components/PurchaseEntryModal').then((m) => ({
    default: m.PurchaseEntryModal,
  })),
)
const SyncModal = lazy(() =>
  import('./components/SyncModal').then((m) => ({ default: m.SyncModal })),
)
const TemplateEditorModal = lazy(() =>
  import('./components/TemplateEditorModal').then((m) => ({
    default: m.TemplateEditorModal,
  })),
)
const TemplatesView = lazy(loadTemplatesView)
const PinSettingsModal = lazy(() =>
  import('./components/PinSettingsModal').then((m) => ({
    default: m.PinSettingsModal,
  })),
)
import { useMarketStore } from './hooks/useMarketStore'
import { useWakeLock } from './hooks/useWakeLock'
import { formatMonthLabel, formatPurchaseChip } from './lib/noteParser'
import {
  findCategory,
  findStore,
  getSolidPillStyle,
  getTintedPillStyle,
  sortByNameAZ,
} from './lib/stores'
import type {
  AddItemInput,
  CategoryConfig,
  MarketItem,
  MealTemplate,
  MonthlyPurchaseEntry,
  ProductReference,
  StoreSource,
} from './types/market'

type CartStoreFilter = 'all' | 'unassigned' | StoreSource

export function App() {
  const showToast = useCallback(
    (message: string, undoAction?: { label: string; onAction: () => void }) => {
      emitToast(message, undoAction)
    },
    [],
  )

  const store = useMarketStore(undefined, emitToast)
  const wakeLock = useWakeLock()

  // Warm up secondary tab chunks during browser idle time for 0ms tab switches
  useEffect(() => {
    if (store.isLocked) return
    const prefetch = () => {
      void loadBottomQuickAdd()
      void loadCategoryGroup()
      void loadTemplatesView()
      void loadBasketDrawer()
    }
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(prefetch, { timeout: 2200 })
      return () => win.cancelIdleCallback?.(id)
    }
    const timer = window.setTimeout(prefetch, 1400)
    return () => window.clearTimeout(timer)
  }, [store.isLocked])

  const [activeTab, setActiveTab] = useState<AppTab>('referensi')
  const [storeFilter, setStoreFilter] = useState<CartStoreFilter>('all')
  const [cartSortOrder, setCartSortOrder] = useState<'az' | 'za'>('az')

  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [pinSettingsOpen, setPinSettingsOpen] = useState(false)
  const [manageModalOpen, setManageModalOpen] = useState(false)
  const [manageInitialTab, setManageInitialTab] = useState<
    'stores' | 'categories'
  >('stores')

  const [editingItem, setEditingItem] = useState<MarketItem | null>(null)

  const [refModalOpen, setRefModalOpen] = useState(false)
  const [editingRef, setEditingRef] = useState<ProductReference | null>(null)
  const [refFocusStore, setRefFocusStore] = useState<StoreSource | undefined>(
    undefined,
  )

  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false)
  const [purchaseModalRef, setPurchaseModalRef] =
    useState<ProductReference | null>(null)
  const [editingPurchase, setEditingPurchase] =
    useState<MonthlyPurchaseEntry | null>(null)

  const [importModalOpen, setImportModalOpen] = useState(false)

  const [tplModalOpen, setTplModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MealTemplate | null>(
    null,
  )

  const openManageConfig = useCallback((tab: 'stores' | 'categories') => {
    setManageInitialTab(tab)
    setManageModalOpen(true)
  }, [])

  const handleOpenSyncModal = useCallback(() => setSyncModalOpen(true), [])
  const handleOpenPinSettings = useCallback(() => setPinSettingsOpen(true), [])
  const handleOpenManageStores = useCallback(
    () => openManageConfig('stores'),
    [openManageConfig],
  )
  const handleToggleWakeLock = useCallback(() => {
    void wakeLock.toggle()
  }, [wakeLock])
  const handleOpenImportModal = useCallback(() => setImportModalOpen(true), [])
  const handleAddNewRef = useCallback(() => {
    setEditingRef(null)
    setRefFocusStore(undefined)
    setRefModalOpen(true)
  }, [])
  const handleEditRef = useCallback(
    (ref: ProductReference, focusStore?: StoreSource) => {
      setEditingRef(ref)
      setRefFocusStore(focusStore)
      setRefModalOpen(true)
    },
    [],
  )
  const handleAddPurchase = useCallback((ref: ProductReference) => {
    setPurchaseModalRef(ref)
    setEditingPurchase(null)
    setPurchaseModalOpen(true)
  }, [])
  const handleEditPurchase = useCallback(
    (ref: ProductReference, entry: MonthlyPurchaseEntry) => {
      setPurchaseModalRef(ref)
      setEditingPurchase(entry)
      setPurchaseModalOpen(true)
    },
    [],
  )
  const { toggleProductInCart } = store
  const handleToggleInCart = useCallback(
    (ref: ProductReference) => {
      const res = toggleProductInCart(ref)
      showToast(
        res === 'added'
          ? `${ref.name} masuk keranjang (pilih toko di Keranjang)`
          : `${ref.name} dihapus dari keranjang`,
      )
    },
    [showToast, toggleProductInCart],
  )

  // Group active Weekly Keranjang items by dynamic CategoryConfig (items sorted A-Z!)
  const filteredGroupedActive = useMemo(() => {
    const filtered = store.activeItems.filter((item) => {
      if (storeFilter === 'all') return true
      if (storeFilter === 'unassigned') return item.store === null
      return item.store === storeFilter
    })

    const grouped = new Map<string, { config: CategoryConfig; items: MarketItem[] }>()
    for (const cat of store.categories) {
      grouped.set(cat.id, { config: cat, items: [] })
    }

    for (const item of filtered) {
      const catCfg = findCategory(store.categories, item.category)
      const bucket = grouped.get(catCfg.id)
      if (bucket) {
        bucket.items.push(item)
      } else {
        grouped.set(catCfg.id, { config: catCfg, items: [item] })
      }
    }

    return Array.from(grouped.values())
      .filter((g) => g.items.length > 0)
      .map((g) => {
        const sorted = sortByNameAZ(g.items)
        return {
          ...g,
          items: cartSortOrder === 'az' ? sorted : sorted.reverse(),
        }
      })
  }, [cartSortOrder, store.activeItems, store.categories, storeFilter])

  const storeCounts = useMemo(() => {
    const counts: Record<string, number> = { unassigned: 0 }
    for (const s of store.stores) counts[s.id] = 0
    for (const item of store.activeItems) {
      if (!item.store) {
        counts.unassigned += 1
      } else {
        counts[item.store] = (counts[item.store] ?? 0) + 1
      }
    }
    return counts
  }, [store.activeItems, store.stores])

  // On a brand-new browser/device with auto-live sync, wait briefly for cloud shared PIN check
  if (
    !store.pinConfig.hasCompletedOnboarding &&
    !store.sync.hasCompletedInitialCheck
  ) {
    return (
      <div className="liquid-shell w-full max-w-md mx-auto min-h-dvh shadow-2xl shadow-slate-900/12 flex flex-col items-center justify-center gap-3 px-6 text-center relative overflow-hidden">
        <div className="liquid-blob liquid-blob-1 w-64 h-64 -top-14 -left-16" />
        <div className="liquid-blob liquid-blob-2 w-72 h-72 top-44 -right-24" />
        <div className="liquid-blob liquid-blob-3 w-64 h-64 bottom-20 -left-16" />
        <div className="relative z-10 glass-card rounded-3xl px-7 py-6 flex flex-col items-center gap-3 animate-liquid-pop">
          <div className="w-14 h-14 rounded-3xl bg-emerald-600/95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 border border-white/40 animate-pulse">
            <ShoppingBasket className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Menghubungkan BelanjaSayang...
          </p>
          <p className="text-xs text-slate-500">
            Memeriksa data & kunci PIN keluarga
          </p>
        </div>
      </div>
    )
  }

  if (store.isLocked) {
    return (
      <Suspense fallback={null}>
        <PinLockScreen
          mode={
            store.pinConfig.hasCompletedOnboarding ? 'unlock' : 'onboarding'
          }
          onSetPin={(pin) => {
            store.setPin(pin)
            showToast('PIN privasi aktif di semua perangkat')
          }}
          onSkipPin={() => {
            store.disablePin()
          }}
          onVerifyPin={store.verifyAndUnlock}
        />
      </Suspense>
    )
  }

  const handleAddItem = (input: AddItemInput) => {
    const added = store.addItem(input)
    if (added) {
      const storeLabel = findStore(store.stores, added.store)?.shortLabel
      showToast(
        `${added.name}${storeLabel ? ` (${storeLabel})` : ''} masuk keranjang`,
      )
    }
  }

  const handleToggleBought = (id: string) => {
    const target = store.items.find((i) => i.id === id)
    store.toggleBought(id)
    if (target && !target.isBought) {
      const resolvedStore =
        target.store ??
        store.findProductRefByName(target.name)?.preferredStore ??
        store.stores[0]?.id ??
        'hypermart'
      const chip = formatPurchaseChip(
        { store: resolvedStore, price: target.estimatedPrice },
        store.stores,
      )
      showToast(`${target.name} (${chip}) tercatat di Catatan Bulanan`)
    }
  }

  const handleApplyTemplate = (templateId: string) => {
    const tpl = store.templates.find((t) => t.id === templateId)
    const { addedCount, skippedCount } = store.applyTemplate(templateId)
    setActiveTab('keranjang')
    setStoreFilter('all')
    if (addedCount > 0) {
      showToast(
        `${addedCount} bahan ${tpl?.name ?? 'paket'} masuk keranjang${skippedCount > 0 ? ` (${skippedCount} sudah ada)` : ''
        }`,
      )
    } else {
      showToast('Semua bahan paket sudah ada di keranjang')
    }
  }

  const handleOpenSaveActiveTemplate = () => {
    setEditingTemplate({
      id: '',
      name: '',
      emoji: '🧺',
      description: `Paket belanja (${store.activeItems.length} bahan)`,
      createdAt: Date.now(),
      items: store.activeItems.map((i) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity,
        category: i.category,
        estimatedPrice: i.estimatedPrice,
        store: i.store,
      })),
    })
    setTplModalOpen(true)
  }

  const handleClearBought = () => {
    const snapshot = [...store.boughtItems]
    if (snapshot.length === 0) return
    store.clearBoughtItems()
    showToast(`${snapshot.length} item dibersihkan`, {
      label: 'Urungkan',
      onAction: () => {
        store.restoreItems(snapshot)
        showToast(`${snapshot.length} item dikembalikan`)
      },
    })
  }

  const handleDeleteCartItem = (id: string) => {
    const target = store.items.find((i) => i.id === id)
    store.deleteItem(id)
    if (target) {
      showToast(`"${target.name}" dihapus dari keranjang`, {
        label: 'Urungkan',
        onAction: () => {
          store.restoreItems([target])
          showToast(`"${target.name}" dikembalikan`)
        },
      })
    }
  }

  const hasActiveItems = store.activeItems.length > 0
  const hasFilteredItems = filteredGroupedActive.length > 0
  const hasBoughtItems = store.boughtItems.length > 0

  return (
    <div className="liquid-shell w-full max-w-md mx-auto min-h-dvh overflow-x-clip shadow-2xl shadow-slate-900/12 flex flex-col relative">
      {/* Ambient Morphing Liquid Orbs behind the glass */}
      <div className="liquid-blob liquid-blob-1 w-64 h-64 -top-14 -left-16" />
      <div className="liquid-blob liquid-blob-2 w-72 h-72 top-44 -right-24" />
      <div className="liquid-blob liquid-blob-3 w-64 h-64 bottom-20 -left-16" />

      {/* Compact Frosted Header */}
      <Header
        activeTab={activeTab}
        boughtCount={store.boughtCount}
        totalCount={store.totalCount}
        totalEstimatedSpend={store.totalEstimatedSpend}
        syncStatus={store.sync.syncStatus}
        onlineDevices={store.sync.onlineDevices}
        pinEnabled={store.pinConfig.pinEnabled}
        wakeLockSupported={wakeLock.isSupported}
        wakeLockActive={wakeLock.isActive}
        onToggleWakeLock={handleToggleWakeLock}
        onOpenSyncModal={handleOpenSyncModal}
        onOpenPinSettings={handleOpenPinSettings}
        onOpenManageConfig={handleOpenManageStores}
      />

      {/* In-App PWA Update Notification */}
      <PwaUpdateBanner />

      {/* Main Scrollable Content */}
      <main
        key={activeTab}
        className="relative z-10 flex-1 w-full min-w-0 px-3.5 pt-3 pb-6 space-y-3.5 animate-liquid-enter"
      >
        {activeTab === 'keranjang' && (
          <>
            {/* Live Partner Collaboration Banner when 2+ devices are online */}
            {store.sync.syncStatus === 'connected' &&
              store.sync.onlineDevices > 1 && (
                <div className="glass-chip px-3.5 py-2.5 rounded-2xl text-emerald-800 text-[11px] font-bold flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="live-dot" />
                    Belanja bareng aktif ({store.sync.onlineDevices} HP terhubung)
                  </span>
                  <span className="text-emerald-600 shrink-0">Real-time</span>
                </div>
              )}

            {/* Dynamic Store Filter & A-Z / Z-A Toggle on Weekly Keranjang */}
            <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                data-testid="cart-sort-order-toggle"
                aria-label={
                  cartSortOrder === 'az'
                    ? 'Urutan A sampai Z, ketuk untuk balik ke Z sampai A'
                    : 'Urutan Z sampai A, ketuk untuk balik ke A sampai Z'
                }
                onClick={() =>
                  setCartSortOrder((prev) => (prev === 'az' ? 'za' : 'az'))
                }
                className={`min-h-9 px-2.5 rounded-xl border text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1 liquid-press cursor-pointer ${cartSortOrder === 'za'
                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                    : 'glass-chip text-slate-700 hover:border-emerald-400'
                  }`}
              >
                {cartSortOrder === 'az' ? (
                  <>
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    <span>A–Z</span>
                  </>
                ) : (
                  <>
                    <ArrowUpZA className="w-3.5 h-3.5" />
                    <span>Z–A</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="cart-filter-all"
                onClick={() => setStoreFilter('all')}
                className={`min-h-9 px-3 rounded-xl text-xs font-bold border shrink-0 liquid-press cursor-pointer ${storeFilter === 'all'
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'glass-chip text-slate-600'
                  }`}
              >
                Semua ({store.activeItems.length})
              </button>

              {storeCounts.unassigned > 0 && (
                <button
                  type="button"
                  data-testid="cart-filter-unassigned"
                  onClick={() => setStoreFilter('unassigned')}
                  className={`min-h-9 px-3 rounded-xl text-xs font-bold border shrink-0 liquid-press cursor-pointer ${storeFilter === 'unassigned'
                      ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                      : 'bg-amber-50/85 border-amber-200 text-amber-800'
                    }`}
                >
                  Belum pilih ({storeCounts.unassigned})
                </button>
              )}

              {store.stores.map((s) => {
                const isSelected = storeFilter === s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid={`cart-filter-${s.id}`}
                    onClick={() => setStoreFilter(s.id)}
                    className="min-h-9 px-3 rounded-xl text-xs font-bold border shrink-0 liquid-press cursor-pointer"
                    style={
                      isSelected
                        ? getSolidPillStyle(s.color)
                        : getTintedPillStyle(s.color)
                    }
                  >
                    {s.shortLabel} ({storeCounts[s.id] ?? 0})
                  </button>
                )
              })}

              <button
                type="button"
                data-testid="cart-add-store-pill"
                onClick={() => openManageConfig('stores')}
                className="min-h-9 px-2.5 rounded-xl border border-dashed border-slate-300/80 bg-white/60 text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:border-emerald-400 shrink-0 inline-flex items-center gap-0.5 liquid-press cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Toko</span>
              </button>
            </div>

            {hasFilteredItems ? (
              <Suspense fallback={null}>
                <div className="space-y-4">
                  {filteredGroupedActive.map((group) => (
                    <CategoryGroup
                      key={group.config.id}
                      categoryConfig={group.config}
                      items={group.items}
                      stores={store.stores}
                      onToggleBought={handleToggleBought}
                      onAssignStore={(itemId, nextStore) => {
                        store.assignCartItemStore(itemId, nextStore)
                        const label = findStore(
                          store.stores,
                          nextStore,
                        )?.shortLabel
                        if (label) {
                          showToast(`Toko diubah ke ${label}`)
                        }
                      }}
                      onOpenManageStores={handleOpenManageStores}
                      onEditItem={(item) => setEditingItem(item)}
                      onDeleteItem={handleDeleteCartItem}
                    />
                  ))}
                </div>
              </Suspense>
            ) : hasActiveItems && storeFilter !== 'all' ? (
              <div className="glass-card rounded-3xl p-6 text-center space-y-2.5 animate-liquid-enter">
                <p className="text-sm font-bold text-slate-800">
                  Belum ada item untuk filter ini
                </p>
                <p className="text-xs text-slate-500">
                  Ketuk pill <b>Pilih toko</b> pada item di keranjang untuk
                  menentukan tempat belinya.
                </p>
                <button
                  type="button"
                  onClick={() => setStoreFilter('all')}
                  className="glass-chip min-h-10 px-4 rounded-xl text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Lihat Semua Item
                </button>
              </div>
            ) : hasBoughtItems ? (
              <div className="glass-card rounded-3xl p-6 text-center space-y-2.5 animate-liquid-enter">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50/90 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200/70">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Belanja minggu ini sudah selesai!
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Semua item yang dicentang otomatis masuk ke Catatan Bulanan.
                </p>
              </div>
            ) : (
              <div className="glass-card rounded-3xl p-5 text-center space-y-4 mt-1 animate-liquid-enter">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50/90 text-emerald-600 mx-auto flex items-center justify-center border border-emerald-200/70">
                  <ShoppingBasket className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900">
                    Keranjang mingguan masih kosong
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Pilih 1 per 1 barang dari <b>Catatan Bulanan</b>, lalu atur
                    beli di toko mana langsung di keranjang.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('referensi')}
                    className="glass-chip min-h-12 px-3 rounded-2xl text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <NotebookPen className="w-4 h-4 text-emerald-600" />
                    <span>Pilih dari Catatan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('paket')}
                    className="min-h-12 px-3 rounded-2xl bg-emerald-50/85 hover:bg-emerald-100/90 border border-emerald-200/90 text-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 liquid-press cursor-pointer"
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>Paket Masak</span>
                  </button>
                </div>
              </div>
            )}

            {store.boughtItems.length > 0 && (
              <Suspense fallback={null}>
                <BasketDrawer
                  items={store.boughtItems}
                  stores={store.stores}
                  boughtEstimatedSpend={store.boughtEstimatedSpend}
                  onToggleBought={handleToggleBought}
                  onDeleteItem={handleDeleteCartItem}
                  onClearBought={handleClearBought}
                />
              </Suspense>
            )}
          </>
        )}

        {activeTab === 'referensi' && (
          <ProductCatalogView
            selectedMonth={store.selectedMonth}
            stores={store.stores}
            categories={store.categories}
            productRefs={store.productRefs}
            monthEntries={store.currentMonthEntries}
            monthlyTotalSpend={store.monthlyTotalSpend}
            previousMonthTotalSpend={store.previousMonthTotalSpend}
            monthlySpendByStore={store.monthlySpendByStore}
            activeItems={store.activeItems}
            onChangeMonth={store.setSelectedMonth}
            onOpenImportModal={handleOpenImportModal}
            onOpenManageConfig={openManageConfig}
            onAddNewRef={handleAddNewRef}
            onEditRef={handleEditRef}
            onAddPurchase={handleAddPurchase}
            onEditPurchase={handleEditPurchase}
            onToggleInCart={handleToggleInCart}
          />
        )}

        {activeTab === 'paket' && (
          <Suspense fallback={null}>
            <TemplatesView
              templates={store.templates}
              stores={store.stores}
              activeItems={store.activeItems}
              onCreateNew={() => {
                setEditingTemplate(null)
                setTplModalOpen(true)
              }}
              onEditTemplate={(tpl) => {
                setEditingTemplate(tpl)
                setTplModalOpen(true)
              }}
              onSaveFromActive={handleOpenSaveActiveTemplate}
              onApplyTemplate={handleApplyTemplate}
              onDeleteTemplate={(id) => {
                const target = store.templates.find((t) => t.id === id)
                store.deleteTemplate(id)
                showToast(
                  target ? `Paket "${target.name}" dihapus` : 'Paket masak dihapus',
                  target
                    ? {
                        label: 'Urungkan',
                        onAction: () => {
                          store.restoreTemplate(target)
                          showToast(`Paket "${target.name}" dikembalikan`)
                        },
                      }
                    : undefined,
                )
              }}
            />
          </Suspense>
        )}
      </main>

      {/* Zero-Rerender Isolated Liquid Toast Host (with Undo Support) */}
      <ToastHost />

      {/* Unified Sticky Bottom Area */}
      <div className="sticky bottom-0 z-30 w-full min-w-0 max-w-full">
        {activeTab === 'keranjang' && (
          <Suspense fallback={null}>
            <BottomQuickAdd
              stores={store.stores}
              categories={store.categories}
              frequentChips={store.topFrequentChips}
              productRefs={store.productRefs}
              defaultStore={
                storeFilter === 'all' || storeFilter === 'unassigned'
                  ? null
                  : storeFilter
              }
              resolveDetectedCategory={store.resolveDetectedCategory}
              onAddItem={handleAddItem}
            />
          </Suspense>
        )}
        <BottomNav
          activeTab={activeTab}
          activeItemCount={store.activeItems.length}
          refCount={store.productRefs.length}
          templateCount={store.templates.length}
          onChangeTab={setActiveTab}
        />
      </div>

      {/* Lazily Mounted Modals (0 KB parsed until opened, still 100% precached offline!) */}
      <Suspense fallback={null}>
        {manageModalOpen && (
          <ManageConfigModal
            key={`manage-${manageInitialTab}`}
            isOpen={manageModalOpen}
            initialTab={manageInitialTab}
            stores={store.stores}
            categories={store.categories}
            onClose={() => setManageModalOpen(false)}
            onSaveStore={(input) => {
              const saved = store.upsertStore(input)
              if (saved) showToast(`Toko "${saved.name}" tersimpan`)
            }}
            onDeleteStore={(id) => {
              const ok = store.deleteStore(id)
              if (ok) showToast('Toko dihapus')
            }}
            onSaveCategory={(input) => {
              const saved = store.upsertCategory(input)
              if (saved) showToast(`Kategori "${saved.name}" tersimpan`)
            }}
            onDeleteCategory={(id) => {
              const ok = store.deleteCategory(id)
              if (ok) showToast('Kategori dihapus')
            }}
          />
        )}

        {purchaseModalOpen && (
          <PurchaseEntryModal
            key={`${purchaseModalRef?.id ?? 'none'}-${editingPurchase?.id ?? 'new'}`}
            isOpen={purchaseModalOpen}
            productRef={purchaseModalRef}
            editingEntry={editingPurchase}
            stores={store.stores}
            monthLabel={formatMonthLabel(store.selectedMonth)}
            onClose={() => setPurchaseModalOpen(false)}
            onAdd={(s, price, qtyNote) => {
              if (!purchaseModalRef) return
              const added = store.addPurchaseEntry({
                monthKey: store.selectedMonth,
                productRefId: purchaseModalRef.id,
                store: s,
                price,
                qtyNote,
              })
              if (added) {
                showToast(
                  `${purchaseModalRef.name} ${formatPurchaseChip(added, store.stores)} tercatat`,
                )
              }
            }}
            onUpdate={(entryId, s, price, qtyNote) => {
              store.updatePurchaseEntry(entryId, { store: s, price, qtyNote })
              showToast('Catatan pembelian diperbarui')
            }}
            onDelete={(entryId) => {
              const target = store.monthlyPurchases.find((e) => e.id === entryId)
              store.deletePurchaseEntry(entryId)
              showToast(
                'Catatan pembelian dihapus',
                target
                  ? {
                      label: 'Urungkan',
                      onAction: () => {
                        store.restorePurchaseEntry(target)
                        showToast('Catatan pembelian dikembalikan')
                      },
                    }
                  : undefined,
              )
            }}
          />
        )}

        {importModalOpen && (
          <NoteImportModal
            isOpen={importModalOpen}
            monthKey={store.selectedMonth}
            stores={store.stores}
            productRefs={store.productRefs}
            monthEntries={store.currentMonthEntries}
            onClose={() => setImportModalOpen(false)}
            onImport={(rawText) => {
              const { productsCount, entriesCount } = store.importNoteText(
                rawText,
                store.selectedMonth,
              )
              showToast(
                `${entriesCount} pembelian (${productsCount} produk) berhasil diimpor`,
              )
            }}
          />
        )}

        {refModalOpen && (
          <ProductRefModal
            key={`${editingRef?.id ?? 'new'}-${refFocusStore ?? 'all'}`}
            isOpen={refModalOpen}
            editingRef={editingRef}
            initialFocusStore={refFocusStore}
            stores={store.stores}
            categories={store.categories}
            resolveDetectedCategory={store.resolveDetectedCategory}
            onClose={() => setRefModalOpen(false)}
            onSave={(input) => {
              const saved = store.upsertProductRef(input)
              if (saved) {
                showToast(`Produk ${saved.name} tersimpan`)
              }
            }}
            onDelete={(id) => {
              const targetRef = store.productRefs.find((r) => r.id === id)
              const linkedEntries = store.monthlyPurchases.filter(
                (e) => e.productRefId === id,
              )
              store.deleteProductRef(id)
              showToast(
                targetRef
                  ? `"${targetRef.name}" dihapus dari catatan`
                  : 'Produk dihapus dari catatan',
                targetRef
                  ? {
                      label: 'Urungkan',
                      onAction: () => {
                        store.restoreProductRefWithEntries(
                          targetRef,
                          linkedEntries,
                        )
                        showToast(`"${targetRef.name}" dikembalikan`)
                      },
                    }
                  : undefined,
              )
            }}
          />
        )}

        {tplModalOpen && (
          <TemplateEditorModal
            key={
              editingTemplate?.id || `new-${editingTemplate?.items.length ?? 0}`
            }
            isOpen={tplModalOpen}
            editingTemplate={editingTemplate}
            stores={store.stores}
            categories={store.categories}
            productRefs={store.productRefs}
            resolveDetectedCategory={store.resolveDetectedCategory}
            onClose={() => setTplModalOpen(false)}
            onSave={(input) => {
              const saved = store.upsertTemplate({
                ...input,
                id: input.id || undefined,
              })
              if (saved) {
                showToast(`Paket "${saved.name}" tersimpan`)
              }
            }}
          />
        )}

        {editingItem && (
          <EditItemModal
            key={editingItem.id}
            item={editingItem}
            matchedRef={store.findProductRefByName(editingItem.name)}
            stores={store.stores}
            categories={store.categories}
            onClose={() => setEditingItem(null)}
            onSave={(id, patch) => {
              store.updateItem(id, patch)
              showToast(
                patch.syncToReference && patch.store
                  ? 'Item & harga referensi diperbarui'
                  : 'Item diperbarui',
              )
            }}
          />
        )}

        {syncModalOpen && (
          <SyncModal
            key="sync-open"
            isOpen={syncModalOpen}
            syncConfig={store.sync.syncConfig}
            syncStatus={store.sync.syncStatus}
            syncError={store.sync.syncError}
            lastSyncedAt={store.sync.lastSyncedAt}
            pendingCount={store.sync.pendingCount}
            onClose={() => setSyncModalOpen(false)}
            onSaveConfig={(cfg) => {
              store.sync.updateSyncConfig(cfg)
              showToast('Menghubungkan sinkronisasi real-time...')
            }}
            onDisconnect={() => {
              store.sync.disconnectSync()
              showToast('Sinkronisasi dimatikan (mode lokal)')
            }}
            onSyncNow={async () => {
              await store.sync.syncNow()
              showToast('Sinkronisasi selesai')
            }}
            onPushAll={async () => {
              const ok = await store.sync.pushAllToCloud()
              showToast(
                ok ? 'Data HP terkirim ke cloud' : 'Gagal mengirim ke cloud',
              )
              return ok
            }}
            onPullAll={async () => {
              const ok = await store.sync.pullAllFromCloud()
              showToast(
                ok
                  ? 'Data terbaru diambil dari cloud'
                  : 'Gagal mengambil dari cloud',
              )
              return ok
            }}
          />
        )}

        {pinSettingsOpen && (
          <PinSettingsModal
            isOpen={pinSettingsOpen}
            pinEnabled={store.pinConfig.pinEnabled}
            onClose={() => setPinSettingsOpen(false)}
            onSetPin={(pin) => {
              store.setPin(pin)
              showToast('PIN privasi disimpan')
            }}
            onDisablePin={() => {
              store.disablePin()
              showToast('Kunci PIN dimatikan')
            }}
            onLockNow={store.lockNow}
          />
        )}
      </Suspense>
    </div>
  )
}

export default App
