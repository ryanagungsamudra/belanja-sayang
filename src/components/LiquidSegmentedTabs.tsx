import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export interface LiquidTabOption<T extends string> {
  id: T
  label: string
  icon?: ReactNode
  testId?: string
}

interface LiquidSegmentedTabsProps<T extends string> {
  options: LiquidTabOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  className?: string
  ariaLabel?: string
}

/**
 * Reusable iOS 26/27 Liquid Glass segmented tab switcher with:
 * - Tap-to-glide OR press-and-drag thumb sliding
 * - Crystal-clear overhanging liquid droplet with spring physics
 * - Velocity stretch-squish + subtle optical magnification + rim chromatic dispersion
 */
export function LiquidSegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  size = 'sm',
  className = '',
  ariaLabel = 'Pilih tab',
}: LiquidSegmentedTabsProps<T>) {
  const count = Math.max(1, options.length)
  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.id === value),
  )

  const trackRef = useRef<HTMLDivElement>(null)
  const dropletRef = useRef<HTMLDivElement>(null)
  const scalerRef = useRef<HTMLDivElement>(null)
  const mirrorMainRef = useRef<HTMLDivElement>(null)
  const mirrorCyanRef = useRef<HTMLDivElement>(null)
  const mirrorWarmRef = useRef<HTMLDivElement>(null)
  const rimGroupRef = useRef<HTMLDivElement>(null)
  const baseVisualRefs = useRef<Array<HTMLSpanElement | null>>([])

  const posRef = useRef<number>(activeIdx)
  const velRef = useRef<number>(0)
  const targetRef = useRef<number>(activeIdx)
  const isPointerDownRef = useRef<boolean>(false)
  const isDraggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const lastXRef = useRef<number>(0)
  const dragVelRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const valueRef = useRef<T>(value)
  const optionsRef = useRef(options)

  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    optionsRef.current = options
  }, [options])

  const applyFrame = useCallback(
    (pos: number, speed: number, lifted: boolean) => {
      const clampedSpeed = Math.min(Math.abs(speed), 1.5)
      const isMoving = lifted || clampedSpeed > 0.04

      const stretchX = (lifted ? 1.08 : 1) + clampedSpeed * 0.18
      const squishY = (lifted ? 1.06 : 1) - clampedSpeed * 0.07

      if (dropletRef.current) {
        dropletRef.current.style.transform = `translateX(${(pos * 100).toFixed(2)}%) scale(${stretchX.toFixed(3)}, ${squishY.toFixed(3)})`
      }

      baseVisualRefs.current.forEach((el, idx) => {
        if (!el) return
        const dist = Math.abs(pos - idx)
        const vis = Math.max(0, Math.min(1, (dist - 0.35) / 0.35))
        el.style.opacity = vis.toFixed(3)
      })

      const mag = lifted ? 1.09 : 1.03 + clampedSpeed * 0.04
      if (scalerRef.current) {
        scalerRef.current.style.transform = `scale(${(mag / stretchX).toFixed(3)}, ${(mag / squishY).toFixed(3)})`
      }

      const shiftPct = -(pos * 100)
      if (mirrorMainRef.current) {
        mirrorMainRef.current.style.transform = `translateX(${shiftPct.toFixed(3)}%)`
      }

      const chromaPx = isMoving ? Math.min(2.2, 1.1 + clampedSpeed * 1.2) : 0
      if (mirrorCyanRef.current) {
        mirrorCyanRef.current.style.transform = `translateX(calc(${shiftPct.toFixed(3)}% + ${chromaPx.toFixed(2)}px))`
      }
      if (mirrorWarmRef.current) {
        mirrorWarmRef.current.style.transform = `translateX(calc(${shiftPct.toFixed(3)}% - ${chromaPx.toFixed(2)}px))`
      }
      if (rimGroupRef.current) {
        rimGroupRef.current.style.opacity = isMoving
          ? String(Math.min(0.8, 0.4 + clampedSpeed * 0.38))
          : '0'
      }
    },
    [],
  )

  const startSpring = useCallback(
    (slotIdx: number, kick = 0) => {
      targetRef.current = slotIdx
      if (kick !== 0) velRef.current = kick
      setIsActive(true)

      if (rafRef.current !== null) return

      const step = () => {
        if (isDraggingRef.current) {
          rafRef.current = null
          return
        }
        const force = (targetRef.current - posRef.current) * 0.18
        velRef.current = (velRef.current + force) * 0.64
        posRef.current += velRef.current

        applyFrame(posRef.current, Math.abs(velRef.current) * 4, false)

        if (
          Math.abs(targetRef.current - posRef.current) < 0.002 &&
          Math.abs(velRef.current) < 0.002
        ) {
          posRef.current = targetRef.current
          velRef.current = 0
          applyFrame(posRef.current, 0, false)
          setIsActive(false)
          rafRef.current = null
        } else {
          rafRef.current = requestAnimationFrame(step)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    },
    [applyFrame],
  )

  useEffect(() => {
    if (
      !isDraggingRef.current &&
      targetRef.current !== activeIdx &&
      Math.abs(activeIdx - posRef.current) > 0.01
    ) {
      startSpring(activeIdx, (activeIdx - posRef.current) * 0.16)
    }
  }, [activeIdx, startSpring])

  useEffect(() => {
    applyFrame(activeIdx, 0, false)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pointerToSlot = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return targetRef.current
    const rect = track.getBoundingClientRect()
    const innerW = Math.max(1, rect.width - 6)
    const slotW = innerW / count
    const rel = clientX - rect.left - 3 - slotW / 2
    return Math.max(-0.08, Math.min(count - 1 + 0.08, rel / slotW))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    trackRef.current?.setPointerCapture(e.pointerId)
    isPointerDownRef.current = true
    isDraggingRef.current = false
    startXRef.current = e.clientX
    lastXRef.current = e.clientX
    dragVelRef.current = 0
    setIsActive(true)
    applyFrame(posRef.current, 0.12, true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    if (!isDraggingRef.current && Math.abs(e.clientX - startXRef.current) > 4) {
      isDraggingRef.current = true
    }
    if (!isDraggingRef.current) return

    const rect = trackRef.current?.getBoundingClientRect()
    const slotW = Math.max(1, ((rect?.width ?? 160) - 6) / count)
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX

    const nextPos = pointerToSlot(e.clientX)
    dragVelRef.current = dragVelRef.current * 0.58 + (dx / slotW) * 0.42
    posRef.current += (nextPos - posRef.current) * 0.72
    applyFrame(posRef.current, dragVelRef.current * 4.5, true)

    const nearest = Math.max(
      0,
      Math.min(count - 1, Math.round(posRef.current)),
    )
    const nextOpt = optionsRef.current[nearest]
    if (nextOpt && nextOpt.id !== valueRef.current) {
      onChange(nextOpt.id)
    }
  }

  const finishInteraction = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    const wasDrag = isDraggingRef.current
    isPointerDownRef.current = false
    isDraggingRef.current = false

    const finalIdx = Math.max(
      0,
      Math.min(count - 1, Math.round(pointerToSlot(e.clientX))),
    )
    const finalOpt = optionsRef.current[finalIdx]
    const kick = wasDrag
      ? dragVelRef.current * 0.85
      : (finalIdx - posRef.current) * 0.16

    if (finalOpt && finalOpt.id !== valueRef.current) {
      onChange(finalOpt.id)
    }
    startSpring(finalIdx, kick)
  }

  const heightCls = size === 'md' ? 'min-h-10 text-xs' : 'min-h-8 text-[11px]'

  const renderMirror = (tintClass: string, isChroma = false) => (
    <div
      className="h-full grid items-center"
      style={{
        width: `${count * 100}%`,
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
      }}
    >
      {options.map((opt) => (
        <span
          key={opt.id}
          className={`flex items-center justify-center gap-1.5 font-extrabold truncate px-1 ${
            isChroma
              ? tintClass
              : opt.id === value
                ? 'text-emerald-700'
                : 'text-slate-900'
          }`}
        >
          {opt.icon}
          <span className="truncate">{opt.label}</span>
        </span>
      ))}
    </div>
  )

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishInteraction}
      onPointerCancel={finishInteraction}
      className={`liquid-seg-track rounded-full p-[3px] grid cursor-grab active:cursor-grabbing ${className}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {/* Accessible Base Tab Buttons */}
      {options.map((opt, idx) => {
        const selected = opt.id === value
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={opt.label}
            data-testid={opt.testId}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onChange(opt.id)
              }
            }}
            className={`relative z-10 ${heightCls} rounded-full flex items-center justify-center font-bold cursor-pointer px-1.5`}
          >
            <span
              ref={(el) => {
                baseVisualRefs.current[idx] = el
              }}
              className="flex items-center justify-center gap-1.5 text-slate-600 pointer-events-none truncate"
            >
              {opt.icon}
              <span className="truncate">{opt.label}</span>
            </span>
          </button>
        )
      })}

      {/* Transparent Overhanging Liquid Glass Droplet */}
      <div
        ref={dropletRef}
        aria-hidden="true"
        className={`liquid-seg-droplet ${heightCls} ${
          isActive ? 'liquid-seg-droplet-active' : ''
        }`}
        style={{ width: `calc((100% - 6px) / ${count})` }}
      >
        <div ref={scalerRef} className="absolute inset-0 bg-transparent">
          <div
            ref={rimGroupRef}
            className="liquid-rim-dispersion transition-opacity duration-150"
            style={{ opacity: 0 }}
          >
            <div
              ref={mirrorCyanRef}
              className="w-full h-full mix-blend-multiply opacity-80"
            >
              {renderMirror('text-cyan-500', true)}
            </div>
            <div
              ref={mirrorWarmRef}
              className="absolute inset-0 w-full h-full mix-blend-multiply opacity-75"
            >
              {renderMirror('text-orange-500', true)}
            </div>
          </div>

          <div ref={mirrorMainRef} className="relative z-10 w-full h-full">
            {renderMirror('', false)}
          </div>
        </div>
        <div className="liquid-droplet-specular" />
      </div>
    </div>
  )
}
