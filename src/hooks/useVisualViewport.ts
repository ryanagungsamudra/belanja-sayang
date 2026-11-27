import { useEffect, useRef, useState } from 'react'

export interface VisualViewportState {
  /** Visual viewport top offset relative to the layout viewport (px). */
  top: number
  /** Current unobstructed visual viewport height (px), or null during SSR. */
  height: number | null
  /** True when the on-screen virtual keyboard is open. */
  keyboardOpen: boolean
  /**
   * Distance in px from the layout viewport bottom to the visual viewport bottom.
   * Non-zero on iOS Safari/PWA when the keyboard overlays a fixed/sticky bottom bar;
   * 0 on Android Chrome when `interactive-widget=resizes-content` resizes layout height natively.
   */
  keyboardBottomOffset: number
}

function readViewportState(baselineHeight: number): VisualViewportState {
  if (typeof window === 'undefined') {
    return { top: 0, height: null, keyboardOpen: false, keyboardBottomOffset: 0 }
  }
  const vv = window.visualViewport
  const top = vv ? Math.max(0, Math.round(vv.offsetTop)) : 0
  const height = Math.round(vv ? vv.height : window.innerHeight)
  const effectiveBaseline = Math.max(baselineHeight, window.innerHeight, height)
  const keyboardOpen = effectiveBaseline - height > 110
  const keyboardBottomOffset = keyboardOpen
    ? Math.max(0, Math.round(window.innerHeight - (height + top)))
    : 0
  return { top, height, keyboardOpen, keyboardBottomOffset }
}

/**
 * Tracks `window.visualViewport` in real time so fixed bottom sheets and
 * sticky quick-add bars sit cleanly above the iOS & Android virtual keyboard.
 */
export function useVisualViewport(active = true): VisualViewportState {
  const baselineHeightRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0,
  )
  const lastWidthRef = useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0,
  )

  const [state, setState] = useState<VisualViewportState>(() =>
    readViewportState(typeof window !== 'undefined' ? window.innerHeight : 0),
  )

  useEffect(() => {
    if (!active || typeof window === 'undefined') return

    let rafId = 0
    let settleTimer = 0

    const syncNow = () => {
      const vv = window.visualViewport
      const currentWidth = Math.round(vv ? vv.width : window.innerWidth)
      const currentHeight = Math.round(vv ? vv.height : window.innerHeight)

      // Reset baseline height when device orientation / viewport width changes
      if (Math.abs(currentWidth - lastWidthRef.current) > 40) {
        lastWidthRef.current = currentWidth
        baselineHeightRef.current = Math.max(window.innerHeight, currentHeight)
      } else if (Math.abs(window.innerHeight - currentHeight) < 60) {
        // Track natural max height when keyboard is closed (e.g. Safari URL bar collapse)
        baselineHeightRef.current = Math.max(
          baselineHeightRef.current,
          window.innerHeight,
          currentHeight,
        )
      }

      const next = readViewportState(baselineHeightRef.current)
      setState((prev) =>
        prev.top === next.top &&
        prev.height === next.height &&
        prev.keyboardOpen === next.keyboardOpen &&
        prev.keyboardBottomOffset === next.keyboardBottomOffset
          ? prev
          : next,
      )
    }

    const scheduleSync = () => {
      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(syncNow)
    }

    const scheduleSettledSync = () => {
      scheduleSync()
      if (settleTimer) window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(syncNow, 160)
    }

    syncNow()
    const vv = window.visualViewport
    vv?.addEventListener('resize', scheduleSync)
    vv?.addEventListener('scroll', scheduleSync)
    window.addEventListener('resize', scheduleSync)
    window.addEventListener('focusin', scheduleSettledSync)
    window.addEventListener('focusout', scheduleSettledSync)

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      if (settleTimer) window.clearTimeout(settleTimer)
      vv?.removeEventListener('resize', scheduleSync)
      vv?.removeEventListener('scroll', scheduleSync)
      window.removeEventListener('resize', scheduleSync)
      window.removeEventListener('focusin', scheduleSettledSync)
      window.removeEventListener('focusout', scheduleSettledSync)
    }
  }, [active])

  return state
}
