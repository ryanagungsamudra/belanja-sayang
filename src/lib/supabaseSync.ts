import type { RealtimeChannel, RealtimeClient } from '@supabase/realtime-js'
import { generateId } from './format'

export type CollectionKey =
  | 'items'
  | 'product_refs'
  | 'monthly_purchases'
  | 'stores'
  | 'categories'
  | 'templates'
  | 'frequent'
  | 'pin_config'

export const ALL_COLLECTION_KEYS: CollectionKey[] = [
  'stores',
  'categories',
  'product_refs',
  'monthly_purchases',
  'items',
  'templates',
  'frequent',
  'pin_config',
]

export type SyncStatus =
  | 'unconfigured'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'offline'
  | 'error'

export interface SyncConfig {
  enabled: boolean
  manuallyDisconnected?: boolean
  supabaseUrl: string
  supabaseAnonKey: string
  householdCode: string
}

export interface HouseholdCollectionRow {
  household_code: string
  collection_key: CollectionKey
  payload: unknown
  updated_at: string
  updated_by: string
}

export interface SyncConnection {
  restUrl: string
  realtimeUrl: string
  anonKey: string
  realtime: RealtimeClient | null
}

const SYNC_CONFIG_KEY = 'belanjasayang:sync-config:v1'
const CLIENT_ID_KEY = 'belanjasayang:client-id:v1'
const PENDING_KEYS_STORAGE = 'belanjasayang:sync-pending:v1'
export const DEFAULT_HOUSEHOLD_CODE = 'belanjasayang-rumah'

export function getEnvSyncDefaults(): {
  supabaseUrl: string
  supabaseAnonKey: string
  householdCode: string
  hasEnvCredentials: boolean
} {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  const hasEnvCredentials = Boolean(supabaseUrl && supabaseAnonKey)
  const rawCode = (import.meta.env.VITE_HOUSEHOLD_CODE ?? '').trim()
  const householdCode = normalizeHouseholdCode(
    rawCode || (hasEnvCredentials ? DEFAULT_HOUSEHOLD_CODE : ''),
  )
  return {
    supabaseUrl,
    supabaseAnonKey,
    householdCode,
    hasEnvCredentials,
  }
}

export function getOrCreateClientId(): string {
  try {
    const existing = window.localStorage.getItem(CLIENT_ID_KEY)
    if (existing) return existing
    const created = `dev-${generateId().slice(0, 12)}`
    window.localStorage.setItem(CLIENT_ID_KEY, created)
    return created
  } catch {
    return `dev-${generateId().slice(0, 12)}`
  }
}

export function loadSyncConfig(): SyncConfig {
  const env = getEnvSyncDefaults()
  const envReady = Boolean(
    env.hasEnvCredentials && env.householdCode.trim().length >= 6,
  )

  try {
    const raw = window.localStorage.getItem(SYNC_CONFIG_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncConfig>
      const url = parsed.supabaseUrl?.trim() || env.supabaseUrl
      const anonKey = parsed.supabaseAnonKey?.trim() || env.supabaseAnonKey
      const code = parsed.householdCode?.trim() || env.householdCode

      // Auto-enable when env credentials are provided unless user explicitly disconnected
      const autoEnable =
        parsed.manuallyDisconnected === true
          ? false
          : parsed.enabled || envReady

      return {
        enabled: autoEnable && Boolean(url && anonKey && code.length >= 6),
        manuallyDisconnected: parsed.manuallyDisconnected,
        supabaseUrl: url,
        supabaseAnonKey: anonKey,
        householdCode: code,
      }
    }
  } catch {
    // Ignore parse error
  }

  return {
    enabled: envReady,
    supabaseUrl: env.supabaseUrl,
    supabaseAnonKey: env.supabaseAnonKey,
    householdCode: env.householdCode,
  }
}

export function saveSyncConfig(config: SyncConfig): void {
  try {
    window.localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
  } catch {
    // Ignore storage error
  }
}

export function loadPendingKeys(): CollectionKey[] {
  try {
    const raw = window.localStorage.getItem(PENDING_KEYS_STORAGE)
    if (!raw) return []
    return JSON.parse(raw) as CollectionKey[]
  } catch {
    return []
  }
}

export function savePendingKeys(keys: CollectionKey[]): void {
  try {
    window.localStorage.setItem(PENDING_KEYS_STORAGE, JSON.stringify(keys))
  } catch {
    // Ignore storage error
  }
}

export function isValidSyncConfig(config: SyncConfig): boolean {
  return (
    config.enabled &&
    /^https?:\/\/.+/.test(config.supabaseUrl.trim()) &&
    config.supabaseAnonKey.trim().length > 10 &&
    config.householdCode.trim().length >= 6
  )
}

export function normalizeHouseholdCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
}

export function createSyncConnection(config: SyncConfig): SyncConnection {
  const baseUrl = config.supabaseUrl.trim().replace(/\/+$/, '')
  return {
    restUrl: `${baseUrl}/rest/v1/household_collections`,
    realtimeUrl: `${baseUrl.replace(/^http/i, 'ws')}/realtime/v1`,
    anonKey: config.supabaseAnonKey.trim(),
    realtime: null,
  }
}

export function disposeSyncConnection(conn: SyncConnection | null): void {
  if (!conn?.realtime) return
  try {
    conn.realtime.disconnect()
  } catch {
    // Ignore disconnect errors during teardown
  }
  conn.realtime = null
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message || body.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

function createTimeoutSignal(ms = 10_000): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms)
  }
  return undefined
}

export async function fetchHouseholdCollections(
  conn: SyncConnection,
  householdCode: string,
): Promise<{ data: HouseholdCollectionRow[]; error: string | null }> {
  try {
    const query = `select=household_code,collection_key,payload,updated_at,updated_by&household_code=eq.${encodeURIComponent(householdCode)}`
    const res = await fetch(`${conn.restUrl}?${query}`, {
      method: 'GET',
      signal: createTimeoutSignal(10_000),
      headers: {
        apikey: conn.anonKey,
        Authorization: `Bearer ${conn.anonKey}`,
        'x-household-code': householdCode,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      return { data: [], error: await parseErrorMessage(res) }
    }
    const data = (await res.json()) as HouseholdCollectionRow[]
    return {
      data: Array.isArray(data) ? data : [],
      error: null,
    }
  } catch (err) {
    return {
      data: [],
      error:
        err instanceof Error && err.name === 'TimeoutError'
          ? 'Koneksi ke server lambat (timeout)'
          : err instanceof Error
            ? err.message
            : 'Gagal mengambil data',
    }
  }
}

export async function pushHouseholdCollection(
  conn: SyncConnection,
  householdCode: string,
  collectionKey: CollectionKey,
  payload: unknown,
  clientId: string,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(
      `${conn.restUrl}?on_conflict=household_code,collection_key`,
      {
        method: 'POST',
        signal: createTimeoutSignal(10_000),
        headers: {
          apikey: conn.anonKey,
          Authorization: `Bearer ${conn.anonKey}`,
          'x-household-code': householdCode,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          household_code: householdCode,
          collection_key: collectionKey,
          payload,
          updated_at: new Date().toISOString(),
          updated_by: clientId,
        }),
      },
    )
    if (!res.ok) {
      return { error: await parseErrorMessage(res) }
    }
    return { error: null }
  } catch (err) {
    return {
      error:
        err instanceof Error && err.name === 'TimeoutError'
          ? 'Gagal kirim data (koneksi timeout)'
          : err instanceof Error
            ? err.message
            : 'Gagal mengirim data',
    }
  }
}

/**
 * Dynamically imports @supabase/realtime-js so initial render & HTTP hydration
 * stay ultra-lightweight while still providing full WebSocket live sync + presence.
 */
export async function subscribeHouseholdRealtime(
  conn: SyncConnection,
  householdCode: string,
  clientId: string,
  onRemoteRow: (row: HouseholdCollectionRow) => void,
  onChannelState: (state: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR') => void,
  onPresenceCount: (onlineCount: number) => void,
): Promise<RealtimeChannel> {
  if (!conn.realtime) {
    const { RealtimeClient } = await import('@supabase/realtime-js')
    const rt = new RealtimeClient(conn.realtimeUrl, {
      params: {
        apikey: conn.anonKey,
        eventsPerSecond: 15,
      },
      headers: {
        apikey: conn.anonKey,
        Authorization: `Bearer ${conn.anonKey}`,
      },
    })
    rt.setAuth(conn.anonKey)
    conn.realtime = rt
  }

  const channel = conn.realtime
    .channel(`household:${householdCode}`, {
      config: {
        presence: {
          key: clientId,
        },
      },
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_collections',
        filter: `household_code=eq.${householdCode}`,
      },
      (payload) => {
        const nextRow = payload.new as HouseholdCollectionRow | undefined
        if (!nextRow || !nextRow.collection_key) return
        // Ignore our own writes echoed back from Supabase Realtime
        if (nextRow.updated_by === clientId) return
        onRemoteRow(nextRow)
      },
    )
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const uniqueDevices = Object.keys(state).length
      onPresenceCount(Math.max(1, uniqueDevices))
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        onChannelState('SUBSCRIBED')
        try {
          await channel.track({
            clientId,
            onlineAt: new Date().toISOString(),
          })
        } catch {
          // Presence tracking is best-effort
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        onChannelState('CHANNEL_ERROR')
      } else if (status === 'CLOSED') {
        onChannelState('CLOSED')
      }
    })

  return channel
}
