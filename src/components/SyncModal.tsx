import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  RefreshCw,
  Upload,
  Wifi,
  X,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  DEFAULT_HOUSEHOLD_CODE,
  getEnvSyncDefaults,
  normalizeHouseholdCode,
  type SyncConfig,
  type SyncStatus,
} from '../lib/supabaseSync'

const SETUP_SQL_SNIPPET = `create table if not exists public.household_collections (
  household_code text not null,
  collection_key text not null,
  payload jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text not null default '',
  primary key (household_code, collection_key)
);
alter table public.household_collections drop constraint if exists household_collections_collection_key_check;
alter table public.household_collections add constraint household_collections_collection_key_check
  check (collection_key in ('items','product_refs','monthly_purchases','stores','categories','templates','frequent','pin_config'));
alter table public.household_collections replica identity full;
alter table public.household_collections enable row level security;
drop policy if exists "Allow household sync by code" on public.household_collections;
create policy "Allow household sync by code"
  on public.household_collections for all to anon, authenticated
  using (length(household_code) >= 6) with check (length(household_code) >= 6);
alter publication supabase_realtime add table public.household_collections;`

interface SyncModalProps {
  isOpen: boolean
  syncConfig: SyncConfig
  syncStatus: SyncStatus
  syncError: string | null
  lastSyncedAt: number | null
  pendingCount: number
  onClose: () => void
  onSaveConfig: (config: SyncConfig) => void
  onDisconnect: () => void
  onSyncNow: () => Promise<void>
  onPushAll: () => Promise<boolean>
  onPullAll: () => Promise<boolean>
}

function formatSyncTime(ts: number | null): string {
  if (!ts) return 'Belum pernah'
  try {
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

export function SyncModal({
  isOpen,
  syncConfig,
  syncStatus,
  syncError,
  lastSyncedAt,
  pendingCount,
  onClose,
  onSaveConfig,
  onDisconnect,
  onSyncNow,
  onPushAll,
  onPullAll,
}: SyncModalProps) {
  const envDefaults = getEnvSyncDefaults()
  const [householdCode, setHouseholdCode] = useState(
    syncConfig.householdCode || DEFAULT_HOUSEHOLD_CODE,
  )
  const [supabaseUrl, setSupabaseUrl] = useState(syncConfig.supabaseUrl)
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(
    syncConfig.supabaseAnonKey,
  )
  const [showCredentials, setShowCredentials] = useState(
    !envDefaults.hasEnvCredentials && !syncConfig.supabaseUrl,
  )
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedSql, setCopiedSql] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')

  if (!isOpen) return null

  const normalizedCode = normalizeHouseholdCode(householdCode)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (normalizedCode.length < 6) {
      setFormError('Kode Keluarga minimal 6 karakter (huruf/angka).')
      return
    }
    if (!/^https?:\/\/.+/.test(supabaseUrl.trim())) {
      setFormError('Masukkan Supabase Project URL yang valid (https://...).')
      setShowCredentials(true)
      return
    }
    if (supabaseAnonKey.trim().length < 20) {
      setFormError('Masukkan Supabase Anon Key yang valid.')
      setShowCredentials(true)
      return
    }
    setFormError('')
    onSaveConfig({
      enabled: true,
      supabaseUrl: supabaseUrl.trim(),
      supabaseAnonKey: supabaseAnonKey.trim(),
      householdCode: normalizedCode,
    })
  }

  const handleCopyCode = async () => {
    if (!normalizedCode) return
    try {
      await navigator.clipboard.writeText(normalizedCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 1800)
    } catch {
      // Ignore clipboard failure
    }
  }

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL_SNIPPET)
      setCopiedSql(true)
      setTimeout(() => setCopiedSql(false), 2000)
    } catch {
      // Ignore clipboard failure
    }
  }

  const statusBanner = () => {
    switch (syncStatus) {
      case 'connected':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
          icon: <Wifi className="w-5 h-5 text-emerald-600 shrink-0" />,
          title: 'Sinkron Real-Time Aktif',
          desc: `Tersinkron ${formatSyncTime(lastSyncedAt)} · Perubahan langsung muncul di HP pasangan.`,
        }
      case 'connecting':
      case 'syncing':
        return {
          bg: 'bg-sky-50 border-sky-200 text-sky-900',
          icon: (
            <RefreshCw className="w-5 h-5 text-sky-600 shrink-0 animate-spin" />
          ),
          title: 'Menyinkronkan...',
          desc: 'Menghubungkan ke server Supabase Realtime.',
        }
      case 'offline':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-900',
          icon: <CloudOff className="w-5 h-5 text-amber-600 shrink-0" />,
          title: 'Mode Offline',
          desc:
            pendingCount > 0
              ? `${pendingCount} perubahan antre & otomatis terkirim saat online.`
              : 'Perubahan tersimpan aman di HP dan akan sinkron saat online.',
        }
      case 'error':
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-900',
          icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
          title: 'Gagal Sinkronisasi',
          desc:
            syncError ||
            'Periksa URL, Anon Key, dan pastikan SQL schema sudah dijalankan.',
        }
      default:
        return {
          bg: 'bg-stone-100/90 border-stone-200 text-slate-800',
          icon: <Cloud className="w-5 h-5 text-stone-500 shrink-0" />,
          title: 'Mode Offline Lokal',
          desc: 'Hubungkan Supabase gratis untuk sinkronisasi real-time antar HP suami & istri.',
        }
    }
  }

  const banner = statusBanner()

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[5px] animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sinkronisasi Real-Time Keluarga"
        onClick={(e) => e.stopPropagation()}
        className="glass-sheet w-full max-w-md max-h-[90dvh] rounded-t-3xl flex flex-col overflow-hidden animate-slide-up"
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 bg-white/55 border-b border-white/75 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Sinkron Real-Time
              </h2>
              <p className="text-xs text-stone-500">
                Supabase Realtime + Offline-First
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="min-w-11 min-h-11 rounded-2xl flex items-center justify-center text-stone-500 hover:bg-stone-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* Live Status Banner */}
          <div
            data-testid="sync-status-banner"
            className={`rounded-2xl border p-3.5 flex items-start gap-3 ${banner.bg}`}
          >
            <div className="mt-0.5">{banner.icon}</div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-bold leading-snug">{banner.title}</p>
              <p className="text-xs opacity-85 leading-relaxed break-words">
                {banner.desc}
              </p>
            </div>
          </div>

          {/* Active Sync Quick Actions */}
          {syncConfig.enabled && (
            <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase text-stone-400">
                    Kode Keluarga Aktif
                  </p>
                  <p className="text-sm font-extrabold text-slate-900 truncate font-mono">
                    {syncConfig.householdCode}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="min-h-10 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Disalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await onSyncNow()
                    setBusy(false)
                  }}
                  className="min-h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`}
                  />
                  <span>Sinkron Sekarang</span>
                </button>
                <button
                  type="button"
                  onClick={onDisconnect}
                  className="min-h-11 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold cursor-pointer"
                >
                  Putuskan Sync
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-100">
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await onPushAll()
                    setBusy(false)
                  }}
                  className="min-h-10 px-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Kirim HP → Cloud</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    await onPullAll()
                    setBusy(false)
                  }}
                  className="min-h-10 px-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Ambil Cloud → HP</span>
                </button>
              </div>
            </div>
          )}

          {/* Connection Form */}
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-stone-200/90 p-4 space-y-3"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-500 uppercase tracking-wide">
                Kode Keluarga (Sama di Kedua HP)
              </label>
              <input
                type="text"
                required
                data-testid="sync-household-code-input"
                value={householdCode}
                onChange={(e) => {
                  setFormError('')
                  setHouseholdCode(e.target.value)
                }}
                placeholder="mis. belanjasayang-2026"
                className="w-full min-h-11 px-3.5 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-sm font-bold text-slate-900 font-mono outline-none"
              />
              <p className="text-[11px] text-stone-400">
                Masukkan kode rahasia yang sama di HP kamu & HP istri (min. 6
                karakter).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCredentials((prev) => !prev)}
              className="text-xs font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                {showCredentials
                  ? 'Sembunyikan Kredensial Supabase'
                  : envDefaults.hasEnvCredentials
                    ? 'Kredensial Supabase dari .env (Ubah)'
                    : 'Masukkan URL & Anon Key Supabase'}
              </span>
            </button>

            {showCredentials && (
              <div className="space-y-2.5 pt-1 animate-liquid-panel">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    data-testid="sync-url-input"
                    value={supabaseUrl}
                    onChange={(e) => {
                      setFormError('')
                      setSupabaseUrl(e.target.value)
                    }}
                    placeholder="https://xxxxx.supabase.co"
                    className="w-full min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 font-mono outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-stone-500">
                    Supabase Anon / Publishable Key
                  </label>
                  <input
                    type="password"
                    data-testid="sync-key-input"
                    value={supabaseAnonKey}
                    onChange={(e) => {
                      setFormError('')
                      setSupabaseAnonKey(e.target.value)
                    }}
                    placeholder="eyJhbGciOi..."
                    className="w-full min-h-11 px-3 rounded-xl bg-stone-50 border border-stone-200 focus:border-emerald-600 focus:bg-white text-xs font-medium text-slate-900 font-mono outline-none"
                  />
                </div>
              </div>
            )}

            {formError && (
              <p className="text-xs font-semibold text-rose-600">{formError}</p>
            )}

            <button
              type="submit"
              data-testid="sync-connect-btn"
              className="w-full min-h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all cursor-pointer"
            >
              {syncConfig.enabled
                ? 'Simpan & Hubungkan Ulang'
                : 'Aktifkan Sinkron Real-Time'}
            </button>
          </form>

          {/* 1-Tap SQL Setup Helper */}
          <div className="bg-white rounded-2xl border border-stone-200/90 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800">
                Setup Cepat Supabase (1 Menit)
              </p>
              <button
                type="button"
                data-testid="copy-sql-btn"
                onClick={() => void handleCopySql()}
                className="min-h-8 px-2.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">SQL Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Salin SQL</span>
                  </>
                )}
              </button>
            </div>
            <ol className="text-[11px] text-stone-500 space-y-1 list-decimal list-inside leading-relaxed">
              <li>Buat project gratis di <b>supabase.com</b>.</li>
              <li>
                Buka <b>SQL Editor</b> → tempel & jalankan SQL dari tombol{' '}
                <b>Salin SQL</b> (atau file <code>supabase/schema.sql</code>).
              </li>
              <li>
                Salin <b>Project URL</b> & <b>Anon Key</b> (Settings → API) ke
                form di atas atau ke file <code>.env</code>.
              </li>
              <li>
                Masukkan <b>Kode Keluarga</b> yang sama di HP kamu & HP istri!
              </li>
              {!envDefaults.hasEnvCredentials && (
                <li className="text-amber-700 font-semibold">
                  Agar <b>auto-live otomatis</b> di browser/HP baru tanpa input
                  manual, tambahkan <code>VITE_SUPABASE_URL</code>,{' '}
                  <code>VITE_SUPABASE_ANON_KEY</code>, dan{' '}
                  <code>VITE_HOUSEHOLD_CODE</code> di Environment Variables
                  hosting (Vercel/Netlify) lalu <b>Redeploy</b>.
                </li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
