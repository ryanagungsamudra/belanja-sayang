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
  pin_config: 'Kunci PIN',
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
  const [onlineDevices, setOnlineDevices] = useState<number>(1)
  const [hasCompletedInitialCheck, setHasCompletedInitialCheck] =
    useState<boolean>(() => {
      const cfg = loadSyncConfig()
      if (!isValidSyncConfig(cfg)) return true
      return typeof navigator !== 'undefined' && !navigator.onLine
    })
  const [pendingKeys, setPendingKeys] = useState<CollectionKey[]>(() =>
    loadPendingKeys(),
  )

  const clientIdRef = useRef<string>(getOrCreateClientId())
  const clientRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const channelSubscribedRef = useRef<boolean>(false)
  const isHydratedRef = useRef<boolean>(false)
  const debounceTimersRef = useRef<Partial<Record<CollectionKey, number>>>({})
  const reconnectTimerRef = useRef<number | null>(null)

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
    async (
      key: CollectionKey,
      payloadOverride?: unknown,
    ): Promise<boolean> => {
      const client = clientRef.current
      const cfg = configRef.current
      if (!isValidSyncConfig(cfg)) return false

      if (!client || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        addPendingKey(key)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setSyncStatus('offline')
        }
        return false
      }

      const code = normalizeHouseholdCode(cfg.householdCode)
      const payload =
        payloadOverride !== undefined
          ? payloadOverride
          : getPayloadRef.current(key)
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
   * Immediately pushes a critical user-initiated change (such as setting or
   * disabling the global household PIN) with 0ms debounce, queuing it safely
   * into pendingKeys if offline or still connecting so it is never dropped.
   */
  const pushKeyImmediately = useCallback(
    (key: CollectionKey, payloadOverride?: unknown) => {
      const cfg = configRef.current
      if (!isValidSyncConfig(cfg)) return

      const prevTimer = debounceTimersRef.current[key]
      if (prevTimer) {
        window.clearTimeout(prevTimer)
        delete debounceTimersRef.current[key]
      }

      if (
        !clientRef.current ||
        (typeof navigator !== 'undefined' && !navigator.onLine)
      ) {
        addPendingKey(key)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setSyncStatus('offline')
        }
        return
      }

      void pushKeyNow(key, payloadOverride)
    },
    [addPendingKey, pushKeyNow],
  )

  /**
   * Called by useMarketStore whenever a local collection changes.
   * Never pushes before initial cloud hydration completes (protects cloud data
   * when opening a brand-new phone/browser).
   * Uses a fast 90ms debounce for Weekly Cart (`items`) for snappy live collaboration.
   */
  const schedulePush = useCallback(
    (key: CollectionKey) => {
      const cfg = configRef.current
      if (!isValidSyncConfig(cfg)) return

      // Guard: never overwrite cloud during initial mount/StrictMode before hydration
      if (!isHydratedRef.current) return

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        addPendingKey(key)
        setSyncStatus('offline')
        return
      }

      const prevTimer = debounceTimersRef.current[key]
      if (prevTimer) window.clearTimeout(prevTimer)

      const delayMs = key === 'items' ? 90 : 280
      debounceTimersRef.current[key] = window.setTimeout(() => {
        delete debounceTimersRef.current[key]
        void pushKeyNow(key)
      }, delayMs)
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
    setSyncStatus('syncing')
    if (pendingRef.current.length > 0) {
      await flushPending()
    }
    await pullAllFromCloud()
  }, [flushPending, pullAllFromCloud])

  // Manage Supabase client lifecycle, auto-live hydration, Realtime & mobile wake resync
  useEffect(() => {
    if (channelRef.current && clientRef.current) {
      void clientRef.current.removeChannel(channelRef.current)
      channelRef.current = null
    }
    channelSubscribedRef.current = false
    clientRef.current = null
    isHydratedRef.current = false

    if (!isValidSyncConfig(syncConfig)) {
      return
    }

    const code = normalizeHouseholdCode(syncConfig.householdCode)
    const client = createSyncClient(syncConfig)
    clientRef.current = client
    let cancelled = false

    const subscribeChannel = () => {
      if (cancelled) return
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (channelRef.current) {
        void client.removeChannel(channelRef.current)
        channelRef.current = null
      }
      channelSubscribedRef.current = false

      const channel = subscribeHouseholdRealtime(
        client,
        code,
        clientIdRef.current,
        (row: HouseholdCollectionRow) => {
          applyRemoteRef.current(row.collection_key, row.payload)
          setLastSyncedAt(Date.now())
          onRemoteNoticeRef.current?.(
            `${COLLECTION_LABEL[row.collection_key] ?? 'Data'} diperbarui pasangan`,
          )
        },
        (state) => {
          if (cancelled) return
          if (state === 'SUBSCRIBED') {
            channelSubscribedRef.current = true
            setSyncStatus('connected')
            setSyncError(null)
          } else if (state === 'CHANNEL_ERROR' || state === 'CLOSED') {
            channelSubscribedRef.current = false
            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              setSyncStatus('offline')
            } else {
              if (state === 'CHANNEL_ERROR') setSyncStatus('error')
              // Auto-reconnect Realtime WebSocket after short delay
              if (!reconnectTimerRef.current) {
                reconnectTimerRef.current = window.setTimeout(() => {
                  reconnectTimerRef.current = null
                  if (!cancelled && navigator.onLine) {
                    subscribeChannel()
                  }
                }, 3500)
              }
            }
          }
        },
        (count) => {
          if (!cancelled) setOnlineDevices(count)
        },
      )
      channelRef.current = channel
    }

    const startSync = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncStatus('offline')
        setHasCompletedInitialCheck(true)
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

      // 2. Pull latest cloud state BEFORE enabling local pushes
      const { data, error } = await fetchHouseholdCollections(client, code)
      if (cancelled) return

      if (error) {
        setSyncError(error)
        setSyncStatus('error')
        setHasCompletedInitialCheck(true)
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

        // Backfill shared pin_config if cloud room existed before global PIN sync
        // and this device already has an active PIN configured locally
        const hasRemotePin = data.some(
          (row) => row.collection_key === 'pin_config',
        )
        if (!hasRemotePin) {
          const localPin = getPayloadRef.current('pin_config') as
            | {
                hasCompletedOnboarding?: boolean
                pinEnabled?: boolean
                pinHash?: string | null
              }
            | undefined
          if (localPin?.pinEnabled && localPin?.pinHash) {
            await pushHouseholdCollection(
              client,
              code,
              'pin_config',
              localPin,
              clientIdRef.current,
            )
          }
        }
      }

      if (cancelled) return
      isHydratedRef.current = true
      setHasCompletedInitialCheck(true)
      setLastSyncedAt(Date.now())

      // 3. Subscribe to Supabase Realtime + Presence (collaborator count)
      subscribeChannel()
    }

    void startSync()

    const handleOnline = () => {
      if (cancelled) return
      void startSync()
    }
    const handleOffline = () => {
      if (cancelled) return
      channelSubscribedRef.current = false
      setSyncStatus('offline')
    }
    // Mobile PWA wake-up: re-pull latest data AND re-subscribe Realtime if socket slept
    const handleVisibilityOrFocus = () => {
      if (cancelled) return
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void syncNow()
        if (!channelSubscribedRef.current) {
          subscribeChannel()
        }
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    return () => {
      cancelled = true
      isHydratedRef.current = false
      channelSubscribedRef.current = false
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      for (const timer of Object.values(debounceTimersRef.current)) {
        if (timer) window.clearTimeout(timer)
      }
      debounceTimersRef.current = {}
      if (channelRef.current) {
        void client.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [pushKeyNow, syncConfig, syncNow])

  const updateSyncConfig = useCallback((next: SyncConfig) => {
    const normalized: SyncConfig = {
      enabled: next.enabled,
      manuallyDisconnected: false,
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
      manuallyDisconnected: true,
    }
    saveSyncConfig(disabled)
    setSyncConfig(disabled)
    setPendingKeys([])
    setSyncError(null)
    setOnlineDevices(1)
  }, [])

  const effectiveSyncStatus: SyncStatus = isValidSyncConfig(syncConfig)
    ? syncStatus
    : 'unconfigured'

  return {
    syncConfig,
    syncStatus: effectiveSyncStatus,
    syncError: isValidSyncConfig(syncConfig) ? syncError : null,
    lastSyncedAt,
    onlineDevices: effectiveSyncStatus === 'connected' ? onlineDevices : 1,
    hasCompletedInitialCheck:
      !isValidSyncConfig(syncConfig) || hasCompletedInitialCheck,
    pendingCount: pendingKeys.length,
    schedulePush,
    pushKeyImmediately,
    updateSyncConfig,
    disconnectSync,
    syncNow,
    pushAllToCloud,
    pullAllFromCloud,
  }
}
