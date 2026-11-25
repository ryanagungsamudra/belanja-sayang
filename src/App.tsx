import {
  ArrowDownAZ,
  ArrowUpZA,
  CheckCircle2,
  ChefHat,
  NotebookPen,
  Plus,
  ShoppingBasket,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { BasketDrawer } from './components/BasketDrawer'
import { BottomNav, type AppTab } from './components/BottomNav'
import { BottomQuickAdd } from './components/BottomQuickAdd'
import { CategoryGroup } from './components/CategoryGroup'
import { EditItemModal } from './components/EditItemModal'
import { Header } from './components/Header'
import { ManageConfigModal } from './components/ManageConfigModal'
import { NoteImportModal } from './components/NoteImportModal'
import { PinLockScreen } from './components/PinLockScreen'
import { PinSettingsModal } from './components/PinSettingsModal'
import { ProductCatalogView } from './components/ProductCatalogView'
import { ProductRefModal } from './components/ProductRefModal'
import { PurchaseEntryModal } from './components/PurchaseEntryModal'
import { SyncModal } from './components/SyncModal'
import { TemplateEditorModal } from './components/TemplateEditorModal'
import { TemplatesView } from './components/TemplatesView'
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
  const [toast, setToast] = useState<string | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, 2400)
  }, [])

  const store = useMarketStore(undefined, showToast)
  const wakeLock = useWakeLock()

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

  if (store.isLocked) {
    return (
      <PinLockScreen
        mode={store.pinConfig.hasCompletedOnboarding ? 'unlock' : 'onboarding'}
        onSetPin={(pin) => {
          store.setPin(pin)
          showToast('PIN privasi aktif')
        }}
        onSkipPin={() => {
          store.disablePin()
        }}
        onVerifyPin={store.verifyAndUnlock}
      />
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
    const count = store.boughtItems.length
    store.clearBoughtItems()
    showToast(`${count} item dibersihkan (catatan bulanan tetap tersimpan)`)
  }

  const hasActiveItems = store.activeItems.length > 0
  const hasFilteredItems = filteredGroupedActive.length > 0
  const hasBoughtItems = store.boughtItems.length > 0

  return (
    <div className="w-full max-w-md mx-auto min-h-dvh overflow-x-clip bg-[#FAF9F6] shadow-xl shadow-stone-900/10 flex flex-col relative">
      {/* Compact Header */}
      <Header
        activeTab={activeTab}
        boughtCount={store.boughtCount}
        totalCount={store.totalCount}
        totalEstimatedSpend={store.totalEstimatedSpend}
        syncStatus={store.sync.syncStatus}
        pinEnabled={store.pinConfig.pinEnabled}
        wakeLockSupported={wakeLock.isSupported}
        wakeLockActive={wakeLock.isActive}
        onToggleWakeLock={() => {
          void wakeLock.toggle()
        }}
        onOpenSyncModal={() => setSyncModalOpen(true)}
        onOpenPinSettings={() => setPinSettingsOpen(true)}
        onOpenManageConfig={() => openManageConfig('stores')}
      />

      {/* Main Scrollable Content */}
      <main className="flex-1 w-full min-w-0 px-3.5 pt-3 pb-5 space-y-3.5">
        {activeTab === 'keranjang' && (
          <>
            {/* Dynamic Store Filter & A-Z / Z-A Toggle on Weekly Keranjang */}
            <div className="w-full min-w-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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
                className={`min-h-9 px-2.5 rounded-xl border text-[11px] font-extrabold shrink-0 inline-flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                  cartSortOrder === 'za'
                    ? 'bg-emerald-600 border-emerald-600 text-white'
                    : 'bg-white border-stone-300 text-slate-700 hover:border-emerald-400'
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
                className={`min-h-9 px-3 rounded-xl text-xs font-bold border shrink-0 transition-all cursor-pointer ${
                  storeFilter === 'all'
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-stone-200 text-stone-600'
                }`}
              >
                Semua ({store.activeItems.length})
              </button>

              {storeCounts.unassigned > 0 && (
                <button
                  type="button"
                  data-testid="cart-filter-unassigned"
                  onClick={() => setStoreFilter('unassigned')}
                  className={`min-h-9 px-3 rounded-xl text-xs font-bold border shrink-0 transition-all cursor-pointer ${
                    storeFilter === 'unassigned'
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
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
                    className="min-h-9 px-3 rounded-xl text-xs font-bold border shrink-0 transition-all cursor-pointer"
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
                className="min-h-9 px-2.5 rounded-xl border border-dashed border-stone-300 bg-white text-[11px] font-bold text-stone-500 hover:text-emerald-700 hover:border-emerald-400 shrink-0 inline-flex items-center gap-0.5 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Toko</span>
              </button>
            </div>

            {hasFilteredItems ? (
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
                    onOpenManageStores={() => openManageConfig('stores')}
                    onEditItem={(item) => setEditingItem(item)}
                    onDeleteItem={store.deleteItem}
                  />
                ))}
              </div>
            ) : hasActiveItems && storeFilter !== 'all' ? (
              <div className="bg-white rounded-3xl border border-stone-200/80 p-6 text-center space-y-2.5 shadow-xs">
                <p className="text-sm font-bold text-slate-800">
                  Belum ada item untuk filter ini
                </p>
                <p className="text-xs text-stone-500">
                  Ketuk pill <b>Pilih toko</b> pada item di keranjang untuk
                  menentukan tempat belinya.
                </p>
                <button
                  type="button"
                  onClick={() => setStoreFilter('all')}
                  className="min-h-10 px-4 rounded-xl bg-stone-100 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Lihat Semua Item
                </button>
              </div>
            ) : hasBoughtItems ? (
              <div className="bg-white rounded-3xl border border-emerald-200/80 p-6 text-center space-y-2.5 shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Belanja minggu ini sudah selesai!
                </h2>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Semua item yang dicentang otomatis masuk ke Catatan Bulanan.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border border-stone-200/80 p-5 text-center space-y-4 shadow-xs mt-1">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center">
                  <ShoppingBasket className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-slate-900">
                    Keranjang mingguan masih kosong
                  </h2>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Pilih 1 per 1 barang dari <b>Catatan Bulanan</b>, lalu atur
                    beli di toko mana langsung di keranjang.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('referensi')}
                    className="min-h-12 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200/70 text-slate-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <NotebookPen className="w-4 h-4 text-emerald-600" />
                    <span>Pilih dari Catatan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('paket')}
                    className="min-h-12 px-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ChefHat className="w-4 h-4" />
                    <span>Paket Masak</span>
                  </button>
                </div>
              </div>
            )}

            <BasketDrawer
              items={store.boughtItems}
              stores={store.stores}
              boughtEstimatedSpend={store.boughtEstimatedSpend}
              onToggleBought={handleToggleBought}
              onDeleteItem={store.deleteItem}
              onClearBought={handleClearBought}
            />
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
            monthlySpendByStore={store.monthlySpendByStore}
            activeItems={store.activeItems}
            onChangeMonth={store.setSelectedMonth}
            onOpenImportModal={() => setImportModalOpen(true)}
            onOpenManageConfig={openManageConfig}
            onAddNewRef={() => {
              setEditingRef(null)
              setRefFocusStore(undefined)
              setRefModalOpen(true)
            }}
            onEditRef={(ref, focusStore) => {
              setEditingRef(ref)
              setRefFocusStore(focusStore)
              setRefModalOpen(true)
            }}
            onAddPurchase={(ref) => {
              setPurchaseModalRef(ref)
              setEditingPurchase(null)
              setPurchaseModalOpen(true)
            }}
            onEditPurchase={(ref, entry) => {
              setPurchaseModalRef(ref)
              setEditingPurchase(entry)
              setPurchaseModalOpen(true)
            }}
            onToggleInCart={(ref) => {
              const res = store.toggleProductInCart(ref)
              showToast(
                res === 'added'
                  ? `${ref.name} masuk keranjang (pilih toko di Keranjang)`
                  : `${ref.name} dihapus dari keranjang`,
              )
            }}
          />
        )}

        {activeTab === 'paket' && (
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
              store.deleteTemplate(id)
              showToast('Paket masak dihapus')
            }}
          />
        )}
      </main>

      {/* Subtle Floating Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-44 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100%-2rem)] px-4 py-2.5 rounded-full bg-slate-900/92 text-white text-xs font-semibold shadow-lg animate-fade-in pointer-events-none whitespace-nowrap truncate"
        >
          {toast}
        </div>
      )}

      {/* Unified Sticky Bottom Area */}
      <div className="sticky bottom-0 z-30 w-full min-w-0 max-w-full">
        {activeTab === 'keranjang' && (
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
        )}
        <BottomNav
          activeTab={activeTab}
          activeItemCount={store.activeItems.length}
          refCount={store.productRefs.length}
          templateCount={store.templates.length}
          onChangeTab={setActiveTab}
        />
      </div>

      {/* Dynamic Manage Stores & Categories Modal */}
      <ManageConfigModal
        key={manageModalOpen ? `manage-${manageInitialTab}` : 'manage-closed'}
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

      {/* Quick Log / Edit Monthly Purchase Chip Modal */}
      <PurchaseEntryModal
        key={
          purchaseModalOpen
            ? `${purchaseModalRef?.id ?? 'none'}-${editingPurchase?.id ?? 'new'}`
            : 'purchase-closed'
        }
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
          store.deletePurchaseEntry(entryId)
          showToast('Catatan pembelian dihapus')
        }}
      />

      {/* Import / Export Text Note Modal */}
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

      {/* Product Reference Create / Edit Modal */}
      <ProductRefModal
        key={
          refModalOpen
            ? `${editingRef?.id ?? 'new'}-${refFocusStore ?? 'all'}`
            : 'ref-closed'
        }
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
          store.deleteProductRef(id)
          showToast('Produk dihapus dari catatan')
        }}
      />

      {/* Editable Paket Masak Modal */}
      <TemplateEditorModal
        key={
          tplModalOpen
            ? editingTemplate?.id || `new-${editingTemplate?.items.length ?? 0}`
            : 'tpl-closed'
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

      {/* Quick Edit Weekly Cart Item & Price Sync Modal */}
      <EditItemModal
        key={editingItem?.id ?? 'item-closed'}
        item={editingItem}
        matchedRef={
          editingItem
            ? store.findProductRefByName(editingItem.name)
            : undefined
        }
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

      {/* Supabase Real-Time Sync Modal */}
      <SyncModal
        key={syncModalOpen ? 'sync-open' : 'sync-closed'}
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
          showToast(ok ? 'Data HP terkirim ke cloud' : 'Gagal mengirim ke cloud')
          return ok
        }}
        onPullAll={async () => {
          const ok = await store.sync.pullAllFromCloud()
          showToast(
            ok ? 'Data terbaru diambil dari cloud' : 'Gagal mengambil dari cloud',
          )
          return ok
        }}
      />

      {/* Privacy & PIN Settings Modal */}
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
    </div>
  )
}

export default App
