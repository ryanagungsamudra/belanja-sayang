import {
  Cloud,
  CloudOff,
  Lock,
  LockOpen,
  RefreshCw,
  ShoppingBasket,
  Sun,
  SunMedium,
} from 'lucide-react'
import { memo } from 'react'
import { formatRupiah } from '../lib/format'
import type { SyncStatus } from '../lib/supabaseSync'
import type { AppTab } from './BottomNav'

interface HeaderProps {
  activeTab: AppTab
  boughtCount: number
  totalCount: number
  totalEstimatedSpend: number
  syncStatus: SyncStatus
  onlineDevices: number
  pinEnabled: boolean
  wakeLockSupported: boolean
  wakeLockActive: boolean
  onToggleWakeLock: () => void
  onOpenSyncModal: () => void
  onOpenPinSettings: () => void
}

export const Header = memo(function Header({
  activeTab,
  boughtCount,
  totalCount,
  totalEstimatedSpend,
  syncStatus,
  onlineDevices,
  pinEnabled,
  wakeLockSupported,
  wakeLockActive,
  onToggleWakeLock,
  onOpenSyncModal,
  onOpenPinSettings,
}: HeaderProps) {
  const progressPct =
    totalCount > 0 ? Math.round((boughtCount / totalCount) * 100) : 0
  const showCartBar = activeTab === 'keranjang' && totalCount > 0

  const renderSyncPill = () => {
    if (syncStatus === 'connected') {
      return (
        <button
          type="button"
          data-testid="header-sync-btn"
          onClick={onOpenSyncModal}
          aria-label={
            onlineDevices > 1
              ? `Sinkron Real-Time Aktif (${onlineDevices} perangkat online)`
              : 'Sinkronisasi Real-Time Aktif'
          }
          title={
            onlineDevices > 1
              ? `${onlineDevices} HP sedang online bersama`
              : 'Sinkron Real-Time Aktif'
          }
          className="glass-chip min-h-10 px-2.5 rounded-2xl text-emerald-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap tabular-nums"
        >
          <span className="live-dot" />
          <span>{onlineDevices > 1 ? `Live · ${onlineDevices}` : 'Live'}</span>
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
          className="glass-chip min-h-10 px-2.5 rounded-2xl text-sky-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
          className="glass-chip min-h-10 px-2.5 rounded-2xl text-amber-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
          className="glass-chip min-h-10 px-2.5 rounded-2xl text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
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
        className="glass-chip min-h-10 px-2.5 rounded-2xl text-slate-700 hover:text-emerald-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
      >
        <Cloud className="w-3.5 h-3.5 shrink-0" />
        <span>Sync</span>
      </button>
    )
  }

  return (
    <header className="glass-header sticky top-0 z-20 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
      {/* Compact Single-Row Top Bar (sibling above .glass-header::before frost layer) */}
      <div className="relative z-10 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-600/95 text-white flex items-center justify-center shadow-md shadow-emerald-600/25 border border-white/40 shrink-0">
            <ShoppingBasket className="w-4 h-4" strokeWidth={2.3} />
          </div>
          <h1 className="text-[15px] font-extrabold tracking-tight text-slate-900 leading-none truncate">
            BelanjaSayang
          </h1>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Live Real-Time Sync Status Pill */}
          {renderSyncPill()}

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
            className={`glass-chip min-h-10 min-w-10 rounded-2xl flex items-center justify-center cursor-pointer ${
              pinEnabled ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {pinEnabled ? (
              <Lock className="w-4 h-4 shrink-0" />
            ) : (
              <LockOpen className="w-4 h-4 shrink-0 text-slate-400" />
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
              className={`glass-chip min-h-10 min-w-10 rounded-2xl flex items-center justify-center cursor-pointer ${
                wakeLockActive ? 'text-amber-600' : 'text-slate-500'
              }`}
            >
              {wakeLockActive ? (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <SunMedium className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Slim Liquid Progress Strip (only on Keranjang tab when items exist) */}
      {showCartBar && (
        <div className="relative z-10 glass-chip mt-2 rounded-2xl px-3 py-1.5 animate-liquid-panel">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-600 font-medium">
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
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-900/8 overflow-hidden">
            {progressPct > 0 && (
              <div
                className="liquid-progress h-full rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            )}
          </div>
        </div>
      )}
    </header>
  )
})
