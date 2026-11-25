import { useCallback, useEffect, useRef, useState } from 'react'

export function useWakeLock() {
  const isSupported =
    typeof navigator !== 'undefined' &&
    'wakeLock' in navigator &&
    Boolean(navigator.wakeLock)

  const [isActive, setIsActive] = useState(false)
  const desiredRef = useRef(false)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  const acquire = useCallback(async () => {
    if (!isSupported) return false
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setIsActive(true)
      sentinel.addEventListener('release', () => {
        sentinelRef.current = null
        if (!desiredRef.current) {
          setIsActive(false)
        }
      })
      return true
    } catch {
      desiredRef.current = false
      setIsActive(false)
      return false
    }
  }, [isSupported])

  const release = useCallback(async () => {
    desiredRef.current = false
    setIsActive(false)
    const current = sentinelRef.current
    sentinelRef.current = null
    if (current && !current.released) {
      try {
        await current.release()
      } catch {
        // Ignore release errors
      }
    }
  }, [])

  const toggle = useCallback(async () => {
    if (!isSupported) return
    if (desiredRef.current) {
      await release()
    } else {
      desiredRef.current = true
      await acquire()
    }
  }, [acquire, isSupported, release])

  useEffect(() => {
    if (!isSupported) return
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        desiredRef.current &&
        !sentinelRef.current
      ) {
        void acquire()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void release()
    }
  }, [acquire, isSupported, release])

  return { isSupported, isActive, toggle }
}
