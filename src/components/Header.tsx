import {
  Cloud,
  CloudOff,
  Lock,
  LockOpen,
  RefreshCw,
  ShoppingBasket,
  SlidersHorizontal,
  Sun,
  SunMedium,
} from 'lucide-react'
import { formatRupiah } from '../lib/format'
import type { SyncStatus } from '../lib/supabaseSync'
import type { AppTab } from './BottomNav'

interface HeaderProps {
  activeTab: AppTab
  boughtCount: number
  totalCount: number
  totalEstimatedSpend: number
  syncStatus: SyncStatus
  pinEnabled: boolean
  wakeLockSupported: boolean
  wakeLockActive: boolean
  onToggleWakeLock: () => void
  onOpenSyncModal: () => void
  onOpenPinSettings: () => void
  onOpenManageConfig: () => void
}

export function Header({
  activeTab,
  boughtCount,
  totalCount,
  totalEstimatedSpend,
  syncStatus,
  pinEnabled,
  wakeLockSupported,
  wakeLockActive,
  onToggleWakeLock,
  onOpenSyncModal,
  onOpenPinSettings,
  onOpenManageConfig,
}: HeaderProps) {
  const progressPct =
    totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0
  const showCartBar = activeTab === 'keranjang'

  const renderSyncPill = () => {
    if (syncStatus === 'connected') {
      return (
        <button
          type="button"
          data-testid="header-sync-btn"
          onClick={onOpenSyncModal}
          aria-label="Sinkronisasi Real-Time Aktif"
          title="Sinkron Real-Time Aktif"
          className="min-h-10 px-2.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-[0.97] cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span>Live</span>
        </button>
      )
    }
    if (syncStatus === 'connecting' || syncStatus === 'syncing') {
      return (
        <button
          type="button"
          data-testid="header-sync-btn"
          onClick={onOpenSyncModal}
          aria-label="Sedang menyinkronkan"
          className="min-h-10 px-2.5 rounded-xl border bg-sky-50 border-sky-200 text-sky-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>Sync</span>
        </button>
      )
    }
    if (syncStatus === 'offline') {
      return (
        <button
          type="button"
          data-testid="header-sync-btn"
          onClick={onOpenSyncModal}
          aria-label="Mode Offline"
          className="min-h-10 px-2.5 rounded-xl border bg-amber-50 border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
          <span>Off</span>
        </button>
      )
    }
    if (syncStatus === 'error') {
      return (
        <button
          type="button"
          data-testid="header-sync-btn"
          onClick={onOpenSyncModal}
          aria-label="Gagal Sinkronisasi"
          className="min-h-10 px-2.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
        >
          <CloudOff className="w-3.5 h-3.5 shrink-0" />
          <span>Error</span>
        </button>
      )
    }
    return (
      <button
        type="button"
        data-testid="header-sync-btn"
        onClick={onOpenSyncModal}
        aria-label="Atur Sinkronisasi Real-Time"
        title="Hubungkan Sinkronisasi Real-Time"
        className="min-h-10 px-2.5 rounded-xl border bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-emerald-700 text-xs font-bold flex items-center gap-1 transition-colors active:scale-[0.97] cursor-pointer"
      >
        <Cloud className="w-3.5 h-3.5 shrink-0" />
        <span>Sync</span>
      </button>
    )
  }

  return (
    <header className="sticky top-0 z-20 bg-[#FAF9F6]/95 backdrop-blur-md border-b border-stone-200/75 px-3.5 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      {/* Compact Single-Row Top Bar */}
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shadow-emerald-600/25 shrink-0">
            <ShoppingBasket className="w-4 h-4" strokeWidth={2.3} />
          </div>
          <h1 className="text-[15px] font-extrabold tracking-tight text-slate-900 leading-none truncate">
            BelanjaSayang
          </h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Live Real-Time Sync Status Pill */}
          {renderSyncPill()}

          {/* Manage Stores & Categories Button */}
          <button
            type="button"
            data-testid="header-manage-config-btn"
            onClick={onOpenManageConfig}
            aria-label="Kelola Tempat Belanja dan Kategori"
            title="Kelola Toko & Kategori"
            className="min-h-10 min-w-10 rounded-xl border bg-white border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-slate-900 flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
          </button>

          {/* Privacy Lock Badge */}
          <button
            type="button"
            onClick={onOpenPinSettings}
            aria-label={
              pinEnabled
                ? 'Pengaturan PIN Privat (Aktif)'
                : 'Pengaturan PIN Privat (Nonaktif)'
            }
            title={pinEnabled ? 'PIN Privat Aktif' : 'Atur PIN Privat'}
            className={`min-h-10 min-w-10 rounded-xl border flex items-center justify-center transition-colors active:scale-[0.97] cursor-pointer ${
              pinEnabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'
            }`}
          >
            {pinEnabled ? (
              <Lock className="w-4 h-4 shrink-0" />
            ) : (
              <LockOpen className="w-4 h-4 shrink-0 text-stone-400" />
            )}
          </button>

          {/* Screen Wake Lock Toggle */}
          {wakeLockSupported && (
            <button
              type="button"
              onClick={onToggleWakeLock}
              aria-pressed={wakeLockActive}
              aria-label={
                wakeLockActive
                  ? 'Matikan mode layar tetap menyala'
                  : 'Aktifkan mode layar tetap menyala'
              }
              title={
                wakeLockActive
                  ? 'Layar tetap menyala (Aktif)'
                  : 'Jaga layar tetap menyala saat belanja'
              }
              className={`min-h-10 min-w-10 rounded-xl border flex items-center justify-center transition-all active:scale-[0.97] cursor-pointer ${
                wakeLockActive
                  ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {wakeLockActive ? (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <SunMedium className="w-4 h-4 text-stone-400 shrink-0" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Slim Weekly Cart Progress Strip (only on Keranjang tab) */}
      {showCartBar && (
        <div className="mt-2 bg-white rounded-xl border border-stone-200/80 px-3 py-1.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-500 font-medium">
              Keranjang{' '}
              <strong
                data-testid="bought-counter"
                className="text-slate-900 font-extrabold tabular-nums"
              >
                {boughtCount} / {totalCount} item
              </strong>
            </span>
            <span
              data-testid="total-budget"
              className="font-extrabold text-emerald-700 tabular-nums"
            >
              {formatRupiah(totalEstimatedSpend)}
            </span>
          </div>
          <div className="mt-1 h-1 w-full rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 transition-all duration-300 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </header>
  )
}
