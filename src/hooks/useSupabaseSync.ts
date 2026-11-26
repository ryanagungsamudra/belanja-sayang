import type { RealtimeChannel } from '@supabase/realtime-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deepEqual,
  mergeCollectionArrays,
  type MergeableRecord,
} from '../lib/syncMerge'
import {
  ALL_COLLECTION_KEYS,
  BUDGET_COLLECTION_KEYS,
  createSyncConnection,
  disposeSyncConnection,
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
  type SyncConnection,
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
  budget_pillars: 'Pilar Anggaran',
  budget_modes: 'Mode Anggaran',
  budget_months: 'Anggaran Bulanan',
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
  const [budgetSchemaNeedsUpgrade, setBudgetSchemaNeedsUpgrade] =
    useState<boolean>(false)

  const clientIdRef = useRef<string>(getOrCreateClientId())
  const clientRef = useRef<SyncConnection | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const channelSubscribedRef = useRef<boolean>(false)
  const isHydratedRef = useRef<boolean>(false)
  const lastSyncedPayloadsRef = useRef<Partial<Record<CollectionKey, unknown>>>(
    {},
  )
  const syncInFlightRef = useRef<Promise<void> | null>(null)
  const lastPullAtRef = useRef<number>(0)
  const debounceTimersRef = useRef<Partial<Record<CollectionKey, number>>>({})
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef<number>(0)
  const presenceDropTimerRef = useRef<number | null>(null)
  const onlineDevicesRef = useRef<number>(1)

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
        const isBudgetConstraintError =
          BUDGET_COLLECTION_KEYS.includes(key) &&
          (error.includes('collection_key_check') ||
            error.includes('check constraint'))
        addPendingKey(key)
        if (isBudgetConstraintError) {
          // Keep core grocery sync Live while nudging user to run the 1-line SQL upgrade for budget sync
          setBudgetSchemaNeedsUpgrade(true)
          return false
        }
        setSyncError(error)
        setSyncStatus(
          typeof navigator !== 'undefined' && !navigator.onLine
            ? 'offline'
            : 'error',
        )
        return false
      }

      if (BUDGET_COLLECTION_KEYS.includes(key)) {
        setBudgetSchemaNeedsUpgrade(false)
      }

      lastSyncedPayloadsRef.current[key] = payload
      removePendingKey(key)
      setSyncError(null)
      setLastSyncedAt(Date.now())
      setSyncStatus('connected')
      return true
    },
    [addPendingKey, removePendingKey],
  )

  /**
   * Reconciles an incoming remote collection with local state using 3-way
   * item-level merge so simultaneous edits on two phones never overwrite each other.
   * Short-circuits when remote already equals local to prevent redundant re-renders
   * and synchronous localStorage writes on boot & wake-up.
   */
  const reconcileRemoteRow = useCallback(
    (key: CollectionKey, remotePayload: unknown, allowMerge: boolean) => {
      const local = getPayloadRef.current(key)

      if (key === 'pin_config' || !Array.isArray(remotePayload)) {
        lastSyncedPayloadsRef.current[key] = remotePayload
        if (!deepEqual(local, remotePayload)) {
          applyRemoteRef.current(key, remotePayload)
        }
        return
      }

      const base = lastSyncedPayloadsRef.current[key]

      if (allowMerge && Array.isArray(base) && Array.isArray(local)) {
        const { merged, localNeedsPush } = mergeCollectionArrays(
          base as MergeableRecord[],
          local as MergeableRecord[],
          remotePayload as MergeableRecord[],
        )
        lastSyncedPayloadsRef.current[key] = remotePayload
        if (!deepEqual(local, merged)) {
          applyRemoteRef.current(key, merged)
        }
        if (localNeedsPush) {
          void pushKeyNow(key, merged)
        }
        return
      }

      lastSyncedPayloadsRef.current[key] = remotePayload
      if (!deepEqual(local, remotePayload)) {
        applyRemoteRef.current(key, remotePayload)
      }
    },
    [pushKeyNow],
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

      // Queue local edits safely if hydration hasn't finished yet (never drop edits!)
      if (!isHydratedRef.current) {
        addPendingKey(key)
        return
      }

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
      reconcileRemoteRow(row.collection_key, row.payload, true)
    }
    const now = Date.now()
    lastPullAtRef.current = now
    setSyncError(null)
    setLastSyncedAt(now)
    setSyncStatus('connected')
    return true
  }, [reconcileRemoteRow])

  const syncNow = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isValidSyncConfig(configRef.current)) return
      if (syncInFlightRef.current) return syncInFlightRef.current

      const run = (async () => {
        if (!options?.silent) {
          setSyncStatus('syncing')
        }
        if (pendingRef.current.length > 0) {
          await flushPending()
        }
        await pullAllFromCloud()
      })()

      syncInFlightRef.current = run
      try {
        await run
      } finally {
        syncInFlightRef.current = null
      }
    },
    [flushPending, pullAllFromCloud],
  )

  // Manage Supabase connection lifecycle, auto-live hydration, Realtime & mobile wake resync
  useEffect(() => {
    if (channelRef.current && clientRef.current?.realtime) {
      void clientRef.current.realtime.removeChannel(channelRef.current)
      channelRef.current = null
    }
    disposeSyncConnection(clientRef.current)
    channelSubscribedRef.current = false
    clientRef.current = null
    isHydratedRef.current = false

    if (!isValidSyncConfig(syncConfig)) {
      return
    }

    const code = normalizeHouseholdCode(syncConfig.householdCode)
    const conn = createSyncConnection(syncConfig)
    clientRef.current = conn
    let cancelled = false

    const subscribeChannel = async () => {
      if (cancelled) return
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      if (presenceDropTimerRef.current) {
        window.clearTimeout(presenceDropTimerRef.current)
        presenceDropTimerRef.current = null
      }
      if (channelRef.current && conn.realtime) {
        void conn.realtime.removeChannel(channelRef.current)
        channelRef.current = null
      }
      channelSubscribedRef.current = false

      try {
        const channel = await subscribeHouseholdRealtime(
          conn,
          code,
          clientIdRef.current,
          (row: HouseholdCollectionRow) => {
            reconcileRemoteRow(row.collection_key, row.payload, true)
            setLastSyncedAt(Date.now())
            onRemoteNoticeRef.current?.(
              `${COLLECTION_LABEL[row.collection_key] ?? 'Data'} diperbarui pasangan`,
            )
          },
          (state) => {
            if (cancelled) return
            if (state === 'SUBSCRIBED') {
              channelSubscribedRef.current = true
              reconnectAttemptRef.current = 0
              setSyncStatus('connected')
              setSyncError(null)
            } else if (state === 'CHANNEL_ERROR' || state === 'CLOSED') {
              channelSubscribedRef.current = false
              if (typeof navigator !== 'undefined' && !navigator.onLine) {
                setSyncStatus('offline')
              } else {
                if (state === 'CHANNEL_ERROR') setSyncStatus('error')
                // Exponential backoff (3s -> 6s -> 12s -> 24s -> 30s cap) to save phone battery on weak signal
                if (!reconnectTimerRef.current) {
                  const attempt = reconnectAttemptRef.current
                  const delayMs = Math.min(30_000, 3_000 * 2 ** attempt)
                  reconnectAttemptRef.current = Math.min(attempt + 1, 4)
                  reconnectTimerRef.current = window.setTimeout(() => {
                    reconnectTimerRef.current = null
                    if (!cancelled && navigator.onLine) {
                      void subscribeChannel()
                    }
                  }, delayMs)
                }
              }
            }
          },
          (count) => {
            if (cancelled) return
            const nextCount = Math.max(1, count)
            if (presenceDropTimerRef.current) {
              window.clearTimeout(presenceDropTimerRef.current)
              presenceDropTimerRef.current = null
            }
            if (nextCount >= onlineDevicesRef.current) {
              // Immediately reflect partner joining so Live · 2 feels instant
              onlineDevicesRef.current = nextCount
              setOnlineDevices(nextCount)
            } else {
              // Debounce drops by 2.5s so brief partner socket hiccups never flicker Live · 2 / banner
              presenceDropTimerRef.current = window.setTimeout(() => {
                presenceDropTimerRef.current = null
                if (!cancelled) {
                  onlineDevicesRef.current = nextCount
                  setOnlineDevices(nextCount)
                }
              }, 2500)
            }
          },
        )
        if (cancelled) {
          if (conn.realtime) void conn.realtime.removeChannel(channel)
          return
        }
        channelRef.current = channel
      } catch (err) {
        if (!cancelled) {
          setSyncError(
            err instanceof Error ? err.message : 'Gagal menghubungkan Realtime',
          )
          setSyncStatus('error')
        }
      }
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
      const { data, error } = await fetchHouseholdCollections(conn, code)
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
          const payload = getPayloadRef.current(key)
          await pushHouseholdCollection(
            conn,
            code,
            key,
            payload,
            clientIdRef.current,
          )
          lastSyncedPayloadsRef.current[key] = payload
        }
      } else {
        // Existing household room: pull & reconcile remote collections into this device
        for (const row of data) {
          reconcileRemoteRow(
            row.collection_key,
            row.payload,
            Boolean(lastSyncedPayloadsRef.current[row.collection_key]),
          )
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
              conn,
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
      const now = Date.now()
      lastPullAtRef.current = now
      setHasCompletedInitialCheck(true)
      setLastSyncedAt(now)

      // 3. Subscribe to Supabase Realtime + Presence (dynamically imported chunk)
      void subscribeChannel()
    }

    void startSync()

    const handleOnline = () => {
      if (cancelled) return
      reconnectAttemptRef.current = 0
      void startSync()
    }
    const handleOffline = () => {
      if (cancelled) return
      channelSubscribedRef.current = false
      setSyncStatus('offline')
    }
    // Mobile PWA wake-up: silent deduplicated pull (never flashes Live -> Sync -> Live!) + Realtime re-subscribe if socket slept
    const handleVisibilityOrFocus = () => {
      if (cancelled) return
      if (document.visibilityState === 'visible' && navigator.onLine) {
        reconnectAttemptRef.current = 0
        const recentlyPulled = Date.now() - lastPullAtRef.current < 4000
        if (!recentlyPulled || !channelSubscribedRef.current) {
          void syncNow({ silent: channelSubscribedRef.current })
        }
        if (!channelSubscribedRef.current) {
          void subscribeChannel()
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
      if (presenceDropTimerRef.current) {
        window.clearTimeout(presenceDropTimerRef.current)
        presenceDropTimerRef.current = null
      }
      for (const timer of Object.values(debounceTimersRef.current)) {
        if (timer) window.clearTimeout(timer)
      }
      debounceTimersRef.current = {}
      if (channelRef.current && conn.realtime) {
        void conn.realtime.removeChannel(channelRef.current)
        channelRef.current = null
      }
      disposeSyncConnection(conn)
    }
  }, [pushKeyNow, reconcileRemoteRow, syncConfig, syncNow])

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
    if (presenceDropTimerRef.current) {
      window.clearTimeout(presenceDropTimerRef.current)
      presenceDropTimerRef.current = null
    }
    onlineDevicesRef.current = 1
    setOnlineDevices(1)
  }, [])

  const effectiveSyncStatus: SyncStatus = isValidSyncConfig(syncConfig)
    ? syncStatus
    : 'unconfigured'

  return {
    syncConfig,
    syncStatus: effectiveSyncStatus,
    syncError: isValidSyncConfig(syncConfig) ? syncError : null,
    budgetSchemaNeedsUpgrade,
    lastSyncedAt,
    onlineDevices:
      effectiveSyncStatus === 'connected' || effectiveSyncStatus === 'syncing'
        ? onlineDevices
        : 1,
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
