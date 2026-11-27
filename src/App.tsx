import { ShoppingBasket } from 'lucide-react'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { BottomNav, type AppTab } from './components/BottomNav'
import { Header } from './components/Header'
import { ProductCatalogView } from './components/ProductCatalogView'
import { PwaUpdateBanner } from './components/PwaUpdateBanner'
import { ToastHost } from './components/ToastHost'
import { useMarketStore } from './hooks/useMarketStore'
import { useVisualViewport } from './hooks/useVisualViewport'
import { useWakeLock } from './hooks/useWakeLock'
import { formatRupiah } from './lib/format'
import {
  formatMonthLabel,
  formatPurchaseChip,
  getCurrentMonthKey,
  getTodayDateKey,
  resolvePurchaseDateKey,
} from './lib/noteParser'
import {
  formatCartShareText,
  formatMonthlyShareText,
  shareOrCopyText,
} from './lib/share'
import { findStore } from './lib/stores'
import { emitToast } from './lib/toastBus'
import type {
  AddItemInput,
  MarketItem,
  MealTemplate,
  MonthlyPurchaseEntry,
  ProductReference,
  StoreSource,
} from './types/market'

const PinLockScreen = lazy(() =>
  import('./components/PinLockScreen').then((m) => ({
    default: m.PinLockScreen,
  })),
)
const loadCartView = () =>
  import('./components/CartView').then((m) => ({ default: m.CartView }))
const loadBottomQuickAdd = () =>
  import('./components/BottomQuickAdd').then((m) => ({
    default: m.BottomQuickAdd,
  }))
const loadTemplatesView = () =>
  import('./components/TemplatesView').then((m) => ({
    default: m.TemplatesView,
  }))
const loadBudgetView = () =>
  import('./components/BudgetView').then((m) => ({ default: m.BudgetView }))

const CartView = lazy(loadCartView)
const BottomQuickAdd = lazy(loadBottomQuickAdd)
const TemplatesView = lazy(loadTemplatesView)
const BudgetView = lazy(loadBudgetView)

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
const PinSettingsModal = lazy(() =>
  import('./components/PinSettingsModal').then((m) => ({
    default: m.PinSettingsModal,
  })),
)
const LiquidDatePickerModal = lazy(() =>
  import('./components/LiquidDatePickerModal').then((m) => ({
    default: m.LiquidDatePickerModal,
  })),
)

const LAST_TAB_STORAGE_KEY = 'belanjasayang:last-tab:v1'

function isValidAppTab(value: string | null): value is AppTab {
  return (
    value === 'keranjang' ||
    value === 'referensi' ||
    value === 'paket' ||
    value === 'anggaran'
  )
}

function resolveInitialTab(hasActiveCartItems: boolean): AppTab {
  try {
    const tabParam = new URLSearchParams(window.location.search).get('tab')
    if (isValidAppTab(tabParam)) {
      return tabParam
    }
  } catch {
    // Ignore URL parse errors
  }
  if (hasActiveCartItems) return 'keranjang'
  try {
    const saved = window.localStorage.getItem(LAST_TAB_STORAGE_KEY)
    if (isValidAppTab(saved)) {
      return saved
    }
  } catch {
    // Ignore storage access errors
  }
  return 'referensi'
}

export function App() {
  const showToast = useCallback(
    (message: string, undoAction?: { label: string; onAction: () => void }) => {
      emitToast(message, undoAction)
    },
    [],
  )

  const store = useMarketStore(undefined, emitToast)
  const wakeLock = useWakeLock()

  const [activeTab, setActiveTab] = useState<AppTab>(() =>
    resolveInitialTab(store.activeItems.length > 0),
  )
  const tabScrollYRef = useRef<Partial<Record<AppTab, number>>>({})

  const selectTab = useCallback(
    (nextTab: AppTab) => {
      if (nextTab === activeTab) return
      if (typeof window !== 'undefined') {
        tabScrollYRef.current[activeTab] = window.scrollY
      }
      setActiveTab(nextTab)
    },
    [activeTab],
  )

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const targetY = tabScrollYRef.current[activeTab] ?? 0
    window.scrollTo(0, targetY)
  }, [activeTab])

  const vp = useVisualViewport(!store.isLocked && activeTab === 'keranjang')
  const [quickAddFocused, setQuickAddFocused] = useState(false)
  const quickAddContainerRef = useRef<HTMLDivElement | null>(null)
  const quickAddBlurTimerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (quickAddBlurTimerRef.current) {
        window.clearTimeout(quickAddBlurTimerRef.current)
      }
    }
  }, [])

  // Remember the user's last active tab across reloads
  useEffect(() => {
    try {
      window.localStorage.setItem(LAST_TAB_STORAGE_KEY, activeTab)
    } catch {
      // Ignore storage access errors
    }
  }, [activeTab])

  // Warm up secondary tab chunks during browser idle time for 0ms tab switches
  useEffect(() => {
    if (store.isLocked) return
    const prefetch = () => {
      void loadCartView()
      void loadBottomQuickAdd()
      void loadTemplatesView()
      void loadBudgetView()
    }
    const win = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(prefetch, { timeout: 2200 })
      return () => win.cancelIdleCallback?.(id)
    }
    const timer = window.setTimeout(prefetch, 1400)
    return () => window.clearTimeout(timer)
  }, [store.isLocked])

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
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [activeDateFilter, setActiveDateFilter] = useState<string | null>(null)

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
  const { toggleProductInCart, setMonthlyBudget } = store
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

  const handleSaveBudget = useCallback(
    (amount: number | null) => {
      setMonthlyBudget(amount)
      showToast(
        amount && amount > 0
          ? `Target budget ${formatRupiah(amount)} tersimpan`
          : 'Target budget dihapus',
      )
    },
    [setMonthlyBudget, showToast],
  )

  const handleShareCart = useCallback(() => {
    const text = formatCartShareText(store.activeItems, store.stores)
    if (!text) return
    void shareOrCopyText({
      title: 'Daftar Belanja — BelanjaSayang',
      text,
    }).then((outcome) => {
      if (outcome === 'copied') {
        showToast('Daftar belanja disalin — siap tempel ke WhatsApp')
      } else if (outcome === 'shared') {
        showToast('Daftar belanja dibagikan')
      }
    })
  }, [showToast, store.activeItems, store.stores])

  const handleShareMonthly = useCallback(() => {
    const text = formatMonthlyShareText(
      store.selectedMonth,
      store.productRefs,
      store.currentMonthEntries,
      store.stores,
      store.monthlyTotalSpend,
      store.monthlySpendByStore,
    )
    if (!text) return
    void shareOrCopyText({
      title: `Rekap ${formatMonthLabel(store.selectedMonth)} — BelanjaSayang`,
      text,
    }).then((outcome) => {
      if (outcome === 'copied') {
        showToast('Rekap bulanan disalin — siap tempel ke WhatsApp')
      } else if (outcome === 'shared') {
        showToast('Rekap bulanan dibagikan')
      }
    })
  }, [
    showToast,
    store.currentMonthEntries,
    store.monthlySpendByStore,
    store.monthlyTotalSpend,
    store.productRefs,
    store.selectedMonth,
    store.stores,
  ])

  const editingRefHistory = useMemo(() => {
    if (!editingRef) return []
    return store.monthlyPurchases.filter(
      (e) => e.productRefId === editingRef.id,
    )
  }, [editingRef, store.monthlyPurchases])

  const handleGoToCatatan = useCallback(
    () => selectTab('referensi'),
    [selectTab],
  )
  const handleGoToPaket = useCallback(() => selectTab('paket'), [selectTab])

  // Precompute live monthly grocery spend per YYYY-MM for the Catatan -> Anggaran bridge
  const grocerySpendByMonth = useMemo(() => {
    const map: Record<string, number> = {}
    for (const entry of store.monthlyPurchases) {
      map[entry.monthKey] = (map[entry.monthKey] ?? 0) + (entry.price || 0)
    }
    return map
  }, [store.monthlyPurchases])
  const { setSelectedMonth } = store
  const handleChangeMonth = useCallback(
    (nextMonth: string) => {
      setSelectedMonth(nextMonth)
      setActiveDateFilter(null)
    },
    [setSelectedMonth],
  )
  const handleOpenDatePicker = useCallback(() => setDatePickerOpen(true), [])
  const handleClearDateFilter = useCallback(() => setActiveDateFilter(null), [])
  const lastShoppingTrip = useMemo(() => {
    if (store.monthlyPurchases.length === 0) return null
    let latestDate = ''
    for (const entry of store.monthlyPurchases) {
      const dk = resolvePurchaseDateKey(entry)
      if (dk > latestDate) latestDate = dk
    }
    if (!latestDate) return null
    let total = 0
    let count = 0
    for (const entry of store.monthlyPurchases) {
      if (resolvePurchaseDateKey(entry) === latestDate) {
        total += entry.price || 0
        count += 1
      }
    }
    return { dateKey: latestDate, total, count }
  }, [store.monthlyPurchases])

  const handleOpenCalendarForDate = useCallback(
    (dateKey: string) => {
      setSelectedMonth(dateKey.slice(0, 7))
      setActiveDateFilter(dateKey)
      selectTab('referensi')
      setDatePickerOpen(true)
    },
    [selectTab, setSelectedMonth],
  )

  const handleOpenCalendarForToday = useCallback(() => {
    setSelectedMonth(getCurrentMonthKey())
    setActiveDateFilter(getTodayDateKey())
    selectTab('referensi')
    setDatePickerOpen(true)
  }, [selectTab, setSelectedMonth])

  // On a brand-new browser/device with auto-live sync, wait briefly for cloud shared PIN check
  if (
    !store.pinConfig.hasCompletedOnboarding &&
    !store.sync.hasCompletedInitialCheck
  ) {
    return (
      <div className="liquid-shell w-full max-w-md mx-auto min-h-dvh shadow-2xl shadow-slate-900/12 flex flex-col items-center justify-center gap-3 px-6 text-center relative overflow-hidden">
        <div className="relative z-10 glass-card rounded-2xl px-7 py-6 flex flex-col items-center gap-3 animate-liquid-pop">
          <div className="w-14 h-14 rounded-3xl bg-emerald-600/95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/25 border border-white/40">
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
    const result = store.toggleBought(id)
    if (result?.bought) {
      const chip = formatPurchaseChip(result.purchaseEntry, store.stores)
      showToast(
        `${result.purchaseEntry.productName} (${chip}) tercatat di Catatan Bulanan`,
        {
          label: 'Ubah harga',
          onAction: () =>
            handleEditPurchase(result.productRef, result.purchaseEntry),
        },
      )
    }
  }

  const handleAssignCartStore = (
    itemId: string,
    nextStore: StoreSource | null,
  ) => {
    store.assignCartItemStore(itemId, nextStore)
    const label = findStore(store.stores, nextStore)?.shortLabel
    if (label) {
      showToast(`Toko diubah ke ${label}`)
    }
  }

  const handleApplyTemplate = (templateId: string) => {
    const tpl = store.templates.find((t) => t.id === templateId)
    const { addedCount, skippedCount } = store.applyTemplate(templateId)
    tabScrollYRef.current.keranjang = 0
    selectTab('keranjang')
    if (addedCount > 0) {
      showToast(
        `${addedCount} bahan ${tpl?.name ?? 'paket'} masuk keranjang${
          skippedCount > 0 ? ` (${skippedCount} sudah ada)` : ''
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

  const showQuickAddFloatingAboveKeyboard =
    activeTab === 'keranjang' && quickAddFocused && vp.keyboardOpen

  return (
    <div className="liquid-shell w-full max-w-md mx-auto min-h-dvh overflow-x-clip shadow-2xl shadow-slate-900/12 flex flex-col relative">
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
      />

      {/* In-App PWA Update Notification */}
      <PwaUpdateBanner />

      {/* Main Scrollable Content */}
      <main
        key={activeTab}
        className="relative z-10 flex-1 w-full min-w-0 px-3.5 pt-3 pb-6 space-y-3.5 animate-tab-fade"
      >
        {activeTab === 'keranjang' && (
          <Suspense fallback={null}>
            <CartView
              activeItems={store.activeItems}
              boughtItems={store.boughtItems}
              stores={store.stores}
              categories={store.categories}
              boughtEstimatedSpend={store.boughtEstimatedSpend}
              productRefCount={store.productRefs.length}
              templateCount={store.templates.length}
              lastShoppingTrip={lastShoppingTrip}
              syncStatus={store.sync.syncStatus}
              onlineDevices={store.sync.onlineDevices}
              onToggleBought={handleToggleBought}
              onAssignStore={handleAssignCartStore}
              onOpenManageStores={handleOpenManageStores}
              onEditItem={setEditingItem}
              onDeleteItem={handleDeleteCartItem}
              onClearBought={handleClearBought}
              onGoToCatatan={handleGoToCatatan}
              onGoToPaket={handleGoToPaket}
              onShareCart={handleShareCart}
              onOpenCalendarSummary={handleOpenCalendarForToday}
              onOpenLastTrip={handleOpenCalendarForDate}
            />
          </Suspense>
        )}

        {activeTab === 'referensi' && (
          <ProductCatalogView
            selectedMonth={store.selectedMonth}
            activeDateFilter={activeDateFilter}
            stores={store.stores}
            categories={store.categories}
            productRefs={store.productRefs}
            monthEntries={store.currentMonthEntries}
            monthlyTotalSpend={store.monthlyTotalSpend}
            previousMonthTotalSpend={store.previousMonthTotalSpend}
            monthlyBudget={store.monthlyBudget}
            monthlySpendByStore={store.monthlySpendByStore}
            activeItems={store.activeItems}
            onChangeMonth={handleChangeMonth}
            onOpenDatePicker={handleOpenDatePicker}
            onClearDateFilter={handleClearDateFilter}
            onSaveBudget={handleSaveBudget}
            onShareMonthly={handleShareMonthly}
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
                  target
                    ? `Paket "${target.name}" dihapus`
                    : 'Paket masak dihapus',
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

        {activeTab === 'anggaran' && (
          <Suspense fallback={null}>
            <BudgetView
              selectedMonth={store.selectedMonth}
              pillars={store.budgetPillars}
              modes={store.budgetModes}
              budgetMonths={store.budgetMonths}
              grocerySpendByMonth={grocerySpendByMonth}
              onChangeMonth={handleChangeMonth}
              onSeedPreset={(mKey) => {
                store.seedBudgetMonthWithPreset(mKey)
                showToast(`Pedoman anggaran ${formatMonthLabel(mKey)} diterapkan`)
              }}
              onCopyFromPrevious={(src, target) => {
                const ok = store.copyBudgetMonthFromPrevious(src, target)
                if (ok) {
                  showToast(`Rencana ${formatMonthLabel(src)} disalin ke ${formatMonthLabel(target)}`)
                }
              }}
              onDeleteMonth={(mKey) => {
                store.deleteBudgetMonth(mKey)
                showToast(`Anggaran ${formatMonthLabel(mKey)} dihapus`)
              }}
              onTogglePayFirst={store.toggleBudgetPayFirst}
              onToggleEfficiency={store.toggleBudgetEfficiency}
              onUpdateIncome={(mKey, patch) => {
                store.updateBudgetIncome(mKey, patch)
                showToast('Pemasukan & target tabungan diperbarui')
              }}
              onToggleBillPaid={store.toggleBudgetBillPaid}
              onStepCounter={store.stepBudgetCounter}
              onQuickSpend={store.addBudgetQuickSpend}
              onToggleSweep={store.toggleBudgetSweep}
              onSaveRealisasi={(mKey, itemId, patch) => {
                store.updateBudgetItemRealisasi(mKey, itemId, patch)
                showToast('Realisasi pengeluaran disimpan')
              }}
              onUpsertEnvelope={(mKey, input) => {
                store.upsertBudgetEnvelope(mKey, input)
                showToast(`Pos "${input.name}" tersimpan`)
              }}
              onDeleteEnvelope={(mKey, itemId) => {
                store.deleteBudgetEnvelope(mKey, itemId)
                showToast('Pos pengeluaran dihapus')
              }}
              onSavePillar={(input) => {
                const saved = store.upsertBudgetPillar(input)
                if (saved) showToast(`Pilar "${saved.name}" tersimpan`)
              }}
              onDeletePillar={(id) => {
                const ok = store.deleteBudgetPillar(id)
                if (ok) showToast('Pilar dihapus')
              }}
              onSaveMode={(input) => {
                const saved = store.upsertBudgetMode(input)
                if (saved) showToast(`Mode "${saved.label}" tersimpan`)
              }}
              onDeleteMode={(id) => {
                const ok = store.deleteBudgetMode(id)
                if (ok) showToast('Mode tracking dihapus')
              }}
              onGoToCatatan={handleGoToCatatan}
            />
          </Suspense>
        )}
      </main>

      {/* Zero-Rerender Isolated Liquid Toast Host (with Undo / Quick Price Edit Support) */}
      <ToastHost />

      {/* Unified Sticky Bottom Area */}
      <div
        ref={quickAddContainerRef}
        onFocusCapture={(e) => {
          if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement
          ) {
            if (quickAddBlurTimerRef.current) {
              window.clearTimeout(quickAddBlurTimerRef.current)
            }
            setQuickAddFocused(true)
          }
        }}
        onBlurCapture={() => {
          if (quickAddBlurTimerRef.current) {
            window.clearTimeout(quickAddBlurTimerRef.current)
          }
          quickAddBlurTimerRef.current = window.setTimeout(() => {
            const activeEl = document.activeElement
            if (!quickAddContainerRef.current?.contains(activeEl)) {
              setQuickAddFocused(false)
            }
          }, 120)
        }}
        style={
          showQuickAddFloatingAboveKeyboard && vp.keyboardBottomOffset > 0
            ? {
                transform: `translateY(-${vp.keyboardBottomOffset}px)`,
              }
            : undefined
        }
        className="sticky bottom-0 z-30 w-full min-w-0 max-w-full"
      >
        {activeTab === 'keranjang' && (
          <Suspense fallback={null}>
            <BottomQuickAdd
              stores={store.stores}
              categories={store.categories}
              frequentChips={store.topFrequentChips}
              productRefs={store.productRefs}
              defaultStore={null}
              resolveDetectedCategory={store.resolveDetectedCategory}
              onAddItem={handleAddItem}
            />
          </Suspense>
        )}
        {!showQuickAddFloatingAboveKeyboard && (
          <BottomNav
            activeTab={activeTab}
            activeItemCount={store.activeItems.length}
            refCount={store.productRefs.length}
            templateCount={store.templates.length}
            onChangeTab={selectTab}
          />
        )}
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
            monthKey={store.selectedMonth}
            monthLabel={formatMonthLabel(store.selectedMonth)}
            onClose={() => setPurchaseModalOpen(false)}
            onAdd={(s, price, qtyNote, purchasedDate) => {
              if (!purchaseModalRef) return
              const added = store.addPurchaseEntry({
                monthKey: store.selectedMonth,
                purchasedDate,
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
            onUpdate={(entryId, s, price, qtyNote, purchasedDate) => {
              store.updatePurchaseEntry(entryId, {
                store: s,
                price,
                qtyNote,
                purchasedDate,
              })
              showToast('Catatan pembelian diperbarui')
            }}
            onDelete={(entryId) => {
              const target = store.monthlyPurchases.find(
                (e) => e.id === entryId,
              )
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
            productHistory={editingRefHistory}
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
            budgetSchemaNeedsUpgrade={store.sync.budgetSchemaNeedsUpgrade}
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
            onExportBackup={store.exportBackupSnapshot}
            onRestoreBackup={(snapshot) => {
              store.restoreBackupSnapshot(snapshot)
              showToast('Backup JSON berhasil dipulihkan')
            }}
          />
        )}

        {datePickerOpen && (
          <LiquidDatePickerModal
            key={`${store.selectedMonth}-${activeDateFilter ?? 'all'}`}
            isOpen={datePickerOpen}
            selectedMonth={store.selectedMonth}
            activeDateFilter={activeDateFilter}
            allPurchases={store.monthlyPurchases}
            stores={store.stores}
            onClose={() => setDatePickerOpen(false)}
            onSelectMonthOnly={(monthKey) => {
              store.setSelectedMonth(monthKey)
              setActiveDateFilter(null)
            }}
            onSelectDateFilter={(monthKey, dateKey) => {
              store.setSelectedMonth(monthKey)
              setActiveDateFilter(dateKey)
            }}
            onInspectPurchase={(entry) => {
              const ref =
                store.productRefs.find((r) => r.id === entry.productRefId) ??
                store.findProductRefByName(entry.productName)
              if (ref) {
                handleEditPurchase(ref, entry)
              }
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
