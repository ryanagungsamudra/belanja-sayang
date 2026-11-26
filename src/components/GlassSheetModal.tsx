import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface GlassSheetModalProps {
  ariaLabel: string
  onClose: () => void
  maxHeightClass?: string
  children: ReactNode
}

let openModalCount = 0

/**
 * Shared Liquid Glass bottom sheet modal with:
 * - Portal to document.body so ancestor transforms/animations never trap `fixed` positioning
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

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    openModalCount += 1
    const prevBodyOverflow = document.body.style.overflow
    const prevHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      openModalCount = Math.max(0, openModalCount - 1)
      if (openModalCount === 0) {
        document.body.style.overflow = prevBodyOverflow
        document.documentElement.style.overflow = prevHtmlOverflow
      }
    }
  }, [])

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

  const modalNode = (
    <div
      className="fixed inset-0 h-dvh z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-[5px] animate-fade-in overscroll-contain"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        style={
          dragY > 0
            ? {
                transform: `translateY(${dragY}px)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1)',
              }
            : undefined
        }
        className={`glass-sheet w-full max-w-md ${maxHeightClass} rounded-t-3xl flex flex-col overflow-hidden animate-slide-up overscroll-contain`}
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
