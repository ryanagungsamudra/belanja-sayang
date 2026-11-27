import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Smoothly counts a numeric balance using requestAnimationFrame (`easeOutQuart`).
 * Resets from 0 on mount and whenever `resetKey` changes; otherwise interpolates
 * smoothly from the previous displayed value when `target` updates.
 */
export function useCountUp(
  target: number,
  durationMs = 620,
  resetKey = '',
): number {
  const [state, setState] = useState(() => ({
    key: resetKey,
    value: prefersReducedMotion() ? target : 0,
  }))
  const currentRef = useRef(0)
  const stateKeyMismatchRef = useRef(resetKey)

  useEffect(() => {
    if (
      prefersReducedMotion() ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      currentRef.current = target
      const id = window.setTimeout(() => {
        setState({ key: resetKey, value: target })
      }, 0)
      return () => window.clearTimeout(id)
    }

    const from = stateKeyMismatchRef.current !== resetKey ? 0 : currentRef.current
    stateKeyMismatchRef.current = resetKey

    let rafId = 0
    let startTime: number | null = null

    const step = (now: number) => {
      if (startTime === null) startTime = now
      const rawT = Math.min(1, (now - startTime) / durationMs)
      // Rapid initial count that settles crisply onto final digits
      const eased = 1 - Math.pow(1 - rawT, 4)
      const next = Math.round(from + (target - from) * eased)
      currentRef.current = next
      setState({ key: resetKey, value: next })

      if (rawT < 1) {
        rafId = requestAnimationFrame(step)
      } else {
        currentRef.current = target
      }
    }

    rafId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafId)
  }, [durationMs, resetKey, target])

  if (prefersReducedMotion()) return target
  return state.key === resetKey ? state.value : 0
}
