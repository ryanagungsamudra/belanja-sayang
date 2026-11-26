import {
  createClient,
  type RealtimeChannel,
  type SupabaseClient,
} from '@supabase/supabase-js'
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

const SYNC_CONFIG_KEY = 'belanjasayang:sync-config:v1'
const CLIENT_ID_KEY = 'belanjasayang:client-id:v1'
const PENDING_KEYS_STORAGE = 'belanjasayang:sync-pending:v1'

export function getEnvSyncDefaults(): {
  supabaseUrl: string
  supabaseAnonKey: string
  householdCode: string
  hasEnvCredentials: boolean
} {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
  const householdCode = (import.meta.env.VITE_HOUSEHOLD_CODE ?? '').trim()
  return {
    supabaseUrl,
    supabaseAnonKey,
    householdCode,
    hasEnvCredentials: Boolean(supabaseUrl && supabaseAnonKey),
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

export function createSyncClient(config: SyncConfig): SupabaseClient {
  return createClient(config.supabaseUrl.trim(), config.supabaseAnonKey.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      params: {
        eventsPerSecond: 15,
      },
    },
  })
}

export async function fetchHouseholdCollections(
  client: SupabaseClient,
  householdCode: string,
): Promise<{ data: HouseholdCollectionRow[]; error: string | null }> {
  const { data, error } = await client
    .from('household_collections')
    .select('household_code, collection_key, payload, updated_at, updated_by')
    .eq('household_code', householdCode)

  if (error) {
    return { data: [], error: error.message }
  }
  return {
    data: (data ?? []) as HouseholdCollectionRow[],
    error: null,
  }
}

export async function pushHouseholdCollection(
  client: SupabaseClient,
  householdCode: string,
  collectionKey: CollectionKey,
  payload: unknown,
  clientId: string,
): Promise<{ error: string | null }> {
  const { error } = await client.from('household_collections').upsert(
    {
      household_code: householdCode,
      collection_key: collectionKey,
      payload,
      updated_at: new Date().toISOString(),
      updated_by: clientId,
    },
    { onConflict: 'household_code,collection_key' },
  )

  return { error: error ? error.message : null }
}

export function subscribeHouseholdRealtime(
  client: SupabaseClient,
  householdCode: string,
  clientId: string,
  onRemoteRow: (row: HouseholdCollectionRow) => void,
  onChannelState: (state: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR') => void,
  onPresenceCount: (onlineCount: number) => void,
): RealtimeChannel {
  const channel = client
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
