import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ALL_COLLECTION_KEYS,
  createSyncClient,
  fetchHouseholdCollections,
  getOrCreateClientId,
  isValidSyncConfig,
  loadPendingKeys,
  loadSyncConfig,
  normalizeHouseholdCode,
  pushHouseholdCollection,
  savePendingKeys,
  saveSyncConfig,
  subscribeHouseholdRealtime,
  type CollectionKey,
  type HouseholdCollectionRow,
  type SyncConfig,
  type SyncStatus,
} from '../lib/supabaseSync'

interface UseSupabaseSyncOptions {
  getPayload: (key: CollectionKey) => unknown
  applyRemotePayload: (key: CollectionKey, payload: unknown) => void
  onRemoteNotice?: (message: string) => void
}

const COLLECTION_LABEL: Record<CollectionKey, string> = {
  items: 'Keranjang',
  product_refs: 'Daftar Produk',
  monthly_purchases: 'Catatan Bulanan',
  stores: 'Tempat Belanja',
  categories: 'Kategori',
  templates: 'Paket Masak',
  frequent: 'Item Sering',
}

export function useSupabaseSync({
  getPayload,
  applyRemotePayload,
  onRemoteNotice,
}: UseSupabaseSyncOptions) {
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() =>
    loadSyncConfig(),
  )
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => {
    const cfg = loadSyncConfig()
    if (!isValidSyncConfig(cfg)) return 'unconfigured'
    return typeof navigator !== 'undefined' && !navigator.onLine
      ? 'offline'
      : 'connecting'
  })
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [pendingKeys, setPendingKeys] = useState<CollectionKey[]>(() =>
    loadPendingKeys(),
  )

  const clientIdRef = useRef<string>(getOrCreateClientId())
  const clientRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const debounceTimersRef = useRef<Partial<Record<CollectionKey, number>>>({})

  // Always point to latest callbacks without tearing down Realtime channel
  const getPayloadRef = useRef(getPayload)
  const applyRemoteRef = useRef(applyRemotePayload)
  const onRemoteNoticeRef = useRef(onRemoteNotice)
  const configRef = useRef(syncConfig)
  const pendingRef = useRef(pendingKeys)

  useEffect(() => {
    getPayloadRef.current = getPayload
  }, [getPayload])

  useEffect(() => {
    applyRemoteRef.current = applyRemotePayload
  }, [applyRemotePayload])

  useEffect(() => {
    onRemoteNoticeRef.current = onRemoteNotice
  }, [onRemoteNotice])

  useEffect(() => {
    configRef.current = syncConfig
  }, [syncConfig])

  useEffect(() => {
    pendingRef.current = pendingKeys
    savePendingKeys(pendingKeys)
  }, [pendingKeys])

  const addPendingKey = useCallback((key: CollectionKey) => {
    setPendingKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
  }, [])

  const removePendingKey = useCallback((key: CollectionKey) => {
    setPendingKeys((prev) => prev.filter((k) => k !== key))
  }, [])

  const pushKeyNow = useCallback(
    async (key: CollectionKey): Promise<boolean> => {
      const client = clientRef.current
      const cfg = configRef.current
      if (!client || !isValidSyncConfig(cfg)) return false

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        addPendingKey(key)
        setSyncStatus('offline')
        return false
      }

      const code = normalizeHouseholdCode(cfg.householdCode)
      const payload = getPayloadRef.current(key)
      const { error } = await pushHouseholdCollection(
        client,
        code,
        key,
        payload,
        clientIdRef.current,
      )

      if (error) {
        addPendingKey(key)
        setSyncError(error)
        setSyncStatus(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'offline'
            : 'error',
        )
        return false
      }

      removePendingKey(key)
      setSyncError(null)
      setLastSyncedAt(Date.now())
      setSyncStatus('connected')
      return true
    },
    [addPendingKey, removePendingKey],
  )

  /**
   * Called by useMarketStore whenever a local collection changes.
   * Debounces network writes so rapid typing/taps only send one clean upsert.
   */
  const schedulePush = useCallback(
    (key: CollectionKey) => {
      const cfg = configRef.current
      if (!isValidSyncConfig(cfg)) return

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        addPendingKey(key)
        setSyncStatus('offline')
        return
      }

      const prevTimer = debounceTimersRef.current[key]
      if (prevTimer) window.clearTimeout(prevTimer)

      debounceTimersRef.current[key] = window.setTimeout(() => {
        delete debounceTimersRef.current[key]
        void pushKeyNow(key)
      }, 320)
    },
    [addPendingKey, pushKeyNow],
  )

  const flushPending = useCallback(async () => {
    const keys = [...pendingRef.current]
    if (keys.length === 0) return
    setSyncStatus('syncing')
    for (const key of keys) {
      await pushKeyNow(key)
    }
  }, [pushKeyNow])

  const pushAllToCloud = useCallback(async (): Promise<boolean> => {
    const client = clientRef.current
    const cfg = configRef.current
    if (!client || !isValidSyncConfig(cfg)) return false
    setSyncStatus('syncing')
    let allOk = true
    for (const key of ALL_COLLECTION_KEYS) {
      const ok = await pushKeyNow(key)
      if (!ok) allOk = false
    }
    return allOk
  }, [pushKeyNow])

  const pullAllFromCloud = useCallback(async (): Promise<boolean> => {
    const client = clientRef.current
    const cfg = configRef.current
    if (!client || !isValidSyncConfig(cfg)) return false

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline')
      return false
    }

    setSyncStatus('syncing')
    const code = normalizeHouseholdCode(cfg.householdCode)
    const { data, error } = await fetchHouseholdCollections(client, code)
    if (error) {
      setSyncError(error)
      setSyncStatus('error')
      return false
    }

    for (const row of data) {
      applyRemoteRef.current(row.collection_key, row.payload)
    }
    setSyncError(null)
    setLastSyncedAt(Date.now())
    setSyncStatus('connected')
    return true
  }, [])

  const syncNow = useCallback(async () => {
    if (!isValidSyncConfig(configRef.current)) return
    if (pendingRef.current.length > 0) {
      await flushPending()
    }
    await pullAllFromCloud()
  }, [flushPending, pullAllFromCloud])

  // Manage Supabase client lifecycle, initial hydration & Realtime subscription
  useEffect(() => {
    // Cleanup previous channel
    if (channelRef.current && clientRef.current) {
      void clientRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
    clientRef.current = null

    if (!isValidSyncConfig(syncConfig)) {
      return
    }

    const code = normalizeHouseholdCode(syncConfig.householdCode)
    const client = createSyncClient(syncConfig)
    clientRef.current = client
    let cancelled = false

    const startSync = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline')
        return
      }

      setSyncStatus('connecting')
      setSyncError(null)

      // 1. Flush any offline pending local changes first
      if (pendingRef.current.length > 0) {
        for (const key of [...pendingRef.current]) {
          if (cancelled) return
          await pushKeyNow(key)
        }
      }

      // 2. Fetch existing room state from Supabase
      const { data, error } = await fetchHouseholdCollections(client, code)
      if (cancelled) return

      if (error) {
        setSyncError(error)
        setSyncStatus('error')
        return
      }

      if (data.length === 0) {
        // Brand-new household room: seed cloud with this device's current data
        for (const key of ALL_COLLECTION_KEYS) {
          if (cancelled) return
          await pushHouseholdCollection(
            client,
            code,
            key,
            getPayloadRef.current(key),
            clientIdRef.current,
          )
        }
      } else {
        // Existing household room: pull remote collections into this device
        for (const row of data) {
          applyRemoteRef.current(row.collection_key, row.payload)
        }
      }

      if (cancelled) return
      setLastSyncedAt(Date.now())

      // 3. Subscribe to Supabase Realtime updates from partner's phone
      const channel = subscribeHouseholdRealtime(
        client,
        code,
        clientIdRef.current,
        (row: HouseholdCollectionRow) => {
          applyRemoteRef.current(row.collection_key, row.payload)
          setLastSyncedAt(Date.now())
          onRemoteNoticeRef.current?.(
            `${COLLECTION_LABEL[row.collection_key] ?? 'Data'} diperbarui real-time`,
          )
        },
        (state) => {
          if (cancelled) return
          if (state === 'SUBSCRIBED') {
            setSyncStatus('connected')
            setSyncError(null)
          } else if (state === 'CHANNEL_ERROR') {
            setSyncStatus(
              typeof navigator !== 'undefined' && !navigator.onLine
                ? 'offline'
                : 'error',
            )
          }
        },
      )
      channelRef.current = channel
    }

    void startSync()

    const handleOnline = () => {
      if (cancelled) return
      void startSync()
    }
    const handleOffline = () => {
      if (cancelled) return
      setSyncStatus('offline')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      for (const timer of Object.values(debounceTimersRef.current)) {
        if (timer) window.clearTimeout(timer)
      }
      debounceTimersRef.current = {}
      if (channelRef.current) {
        void client.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [pushKeyNow, syncConfig])

  const updateSyncConfig = useCallback((next: SyncConfig) => {
    const normalized: SyncConfig = {
      enabled: next.enabled,
      supabaseUrl: next.supabaseUrl.trim(),
      supabaseAnonKey: next.supabaseAnonKey.trim(),
      householdCode: normalizeHouseholdCode(next.householdCode),
    }
    saveSyncConfig(normalized)
    setSyncConfig(normalized)
  }, [])

  const disconnectSync = useCallback(() => {
    const disabled: SyncConfig = {
      ...configRef.current,
      enabled: false,
    }
    saveSyncConfig(disabled)
    setSyncConfig(disabled)
    setPendingKeys([])
    setSyncError(null)
    setSyncStatus('unconfigured')
  }, [])

  const effectiveSyncStatus: SyncStatus = isValidSyncConfig(syncConfig)
    ? syncStatus
    : 'unconfigured'

  return {
    syncConfig,
    syncStatus: effectiveSyncStatus,
    syncError: isValidSyncConfig(syncConfig) ? syncError : null,
    lastSyncedAt,
    pendingCount: pendingKeys.length,
    schedulePush,
    updateSyncConfig,
    disconnectSync,
    syncNow,
    pushAllToCloud,
    pullAllFromCloud,
  }
}
