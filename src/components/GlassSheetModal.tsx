import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVisualViewport } from '../hooks/useVisualViewport'

interface GlassSheetModalProps {
  ariaLabel: string
  onClose: () => void
  maxHeightClass?: string
  children: ReactNode
}

let openModalCount = 0
let modalHistorySeq = 0
const modalHistoryStack: string[] = []

function isFormControl(el: Element | null): el is HTMLElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  )
}

/**
 * Shared Liquid Glass bottom sheet modal with:
 * - Portal to document.body so ancestor transforms/animations never trap `fixed` positioning
 * - Real-time `visualViewport` tracking so sheets lift cleanly above the iOS & Android keyboard
 * - Background scroll locking while open
 * - Escape key dismissal
 * - Top drag-handle swipe-down-to-dismiss physics
 * - Accessible modal dialog semantics
 */
export function GlassSheetModal({
  ariaLabel,
  onClose,
  maxHeightClass = 'max-h-[88dvh]',
  children,
}: GlassSheetModalProps) {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startYRef = useRef<number | null>(null)
  const onCloseRef = useRef(onClose)
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const focusTimerRef = useRef<number | null>(null)
  const vp = useVisualViewport()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const scheduleFocusScroll = useCallback((target: Element | null) => {
    if (!isFormControl(target)) return
    if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current)
    focusTimerRef.current = window.setTimeout(() => {
      if (document.body.contains(target)) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }, 180)
  }, [])

  useEffect(() => {
    openModalCount += 1
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    // If an input used autoFocus on open, ensure it scrolls cleanly once the keyboard settles
    if (sheetRef.current?.contains(document.activeElement)) {
      scheduleFocusScroll(document.activeElement)
    }

    // Push a lightweight history entry so mobile Back button / edge-swipe closes the modal instead of exiting the PWA
    const modalHistoryId = `bs-modal-${++modalHistorySeq}`
    let closedByPopstate = false
    modalHistoryStack.push(modalHistoryId)

    const hasHistory =
      typeof window !== 'undefined' &&
      typeof window.history?.pushState === 'function'
    if (hasHistory) {
      const prevState =
        window.history.state && typeof window.history.state === 'object'
          ? (window.history.state as Record<string, unknown>)
          : {}
      window.history.pushState(
        { ...prevState, __bsModalId: modalHistoryId },
        '',
      )
    }

    const handlePopState = () => {
      const isTop =
        modalHistoryStack[modalHistoryStack.length - 1] === modalHistoryId
      const currentId = (
        window.history.state as { __bsModalId?: string } | null
      )?.__bsModalId
      if (isTop && currentId !== modalHistoryId) {
        closedByPopstate = true
        modalHistoryStack.pop()
        onCloseRef.current()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('keydown', handleKeyDown)

      const stackIdx = modalHistoryStack.lastIndexOf(modalHistoryId)
      if (stackIdx >= 0) {
        modalHistoryStack.splice(stackIdx, 1)
      }
      if (hasHistory && !closedByPopstate) {
        // Defer one tick so React StrictMode's simulated unmount doesn't pop the remounted entry
        window.setTimeout(() => {
          const currentId = (
            window.history.state as { __bsModalId?: string } | null
          )?.__bsModalId
          if (
            !modalHistoryStack.includes(modalHistoryId) &&
            currentId === modalHistoryId
          ) {
            window.history.back()
          }
        }, 0)
      }

      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.style.overflow = prevBodyOverflow
        document.documentElement.style.overflow = prevHtmlOverflow
      }
    }
  }, [scheduleFocusScroll])

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    startYRef.current = e.clientY
    setIsDragging(true)
  }

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (startYRef.current === null) return
    const delta = Math.max(0, e.clientY - startYRef.current)
    setDragY(delta)
  }

  const handleDragEnd = () => {
    if (startYRef.current === null) return
    startYRef.current = null
    setIsDragging(false)
    if (dragY > 75) {
      onClose()
    } else {
      setDragY(0)
    }
  }

  const pctMatch = maxHeightClass.match(/max-h-\[(\d+)dvh\]/)
  const maxPct = pctMatch ? Number(pctMatch[1]) : 88
  const dynamicMaxHeight =
    vp.height !== null
      ? `${
          vp.keyboardOpen
            ? Math.max(220, Math.floor(vp.height - 12))
            : Math.floor((vp.height * maxPct) / 100)
        }px`
      : undefined

  const sheetStyle: React.CSSProperties | undefined =
    dragY > 0 || dynamicMaxHeight
      ? {
          ...(dynamicMaxHeight ? { maxHeight: dynamicMaxHeight } : {}),
          ...(dragY > 0
            ? {
                transform: `translateY(${dragY}px)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)',
              }
            : {}),
        }
      : undefined

  const modalNode = (
    <div
      className={
        vp.height !== null
          ? 'fixed inset-x-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[5px] animate-fade-in overscroll-contain'
          : 'fixed inset-0 h-dvh z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[5px] animate-fade-in overscroll-contain'
      }
      style={
        vp.height !== null
          ? { top: `${vp.top}px`, height: `${vp.height}px` }
          : undefined
      }
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        data-keyboard-open={vp.keyboardOpen ? 'true' : undefined}
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={(e) => scheduleFocusScroll(e.target as Element)}
        style={sheetStyle}
        className={`glass-sheet w-full max-w-md ${vp.height === null ? maxHeightClass : ''} rounded-t-3xl flex flex-col overflow-hidden animate-slide-up overscroll-contain`}
      >
        {/* Swipe-down liquid grabber pill */}
        <div
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          aria-hidden="true"
          className="w-full pt-2.5 pb-1 flex justify-center bg-white/55 cursor-grab active:cursor-grabbing touch-none shrink-0"
        >
          <span className="w-10 h-1 rounded-full bg-slate-900/18" />
        </div>
        {children}
      </div>
    </div>
  )

  return typeof document !== 'undefined'
    ? createPortal(modalNode, document.body)
    : modalNode
}
