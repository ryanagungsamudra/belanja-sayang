import { ChefHat, NotebookPen, ShoppingBasket } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export type AppTab = 'keranjang' | 'referensi' | 'paket'

const TAB_ORDER: AppTab[] = ['keranjang', 'referensi', 'paket']
const TAB_INDEX: Record<AppTab, number> = {
  keranjang: 0,
  referensi: 1,
  paket: 2,
}

interface BottomNavProps {
  activeTab: AppTab
  activeItemCount: number
  refCount: number
  templateCount: number
  onChangeTab: (tab: AppTab) => void
}

export function BottomNav({
  activeTab,
  activeItemCount,
  refCount,
  templateCount,
  onChangeTab,
}: BottomNavProps) {
  const dockRef = useRef<HTMLElement>(null)
  const dropletRef = useRef<HTMLDivElement>(null)
  const magScalerRef = useRef<HTMLDivElement>(null)
  const mirrorMainRef = useRef<HTMLDivElement>(null)
  const mirrorCyanRef = useRef<HTMLDivElement>(null)
  const mirrorWarmRef = useRef<HTMLDivElement>(null)
  const rimGroupRef = useRef<HTMLDivElement>(null)
  const baseVisualRefs = useRef<Array<HTMLDivElement | null>>([
    null,
    null,
    null,
  ])

  const posRef = useRef<number>(TAB_INDEX[activeTab])
  const velRef = useRef<number>(0)
  const targetRef = useRef<number>(TAB_INDEX[activeTab])
  const isPointerDownRef = useRef<boolean>(false)
  const isDraggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const lastXRef = useRef<number>(0)
  const dragVelRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const activeTabRef = useRef<AppTab>(activeTab)

  const [isDropletActive, setIsDropletActive] = useState(false)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  /**
   * Crystal-clear transparent Liquid Glass frame update:
   * - Smoothly fades the base icon's visual inner wrapper under the droplet
   *   so the transparent glass bubble NEVER shows double-vision while keeping
   *   every <button> 100% visible & accessible!
   * - Applies juicy spring liquid stretch-squish + 1.12x optical magnification +
   *   rim-only Fresnel cyan/orange RGB chromatic dispersion.
   */
  const applyOpticalFrame = useCallback(
    (pos: number, speed: number, lifted: boolean) => {
      const clampedSpeed = Math.min(Math.abs(speed), 1.6)
      const isMoving = lifted || clampedSpeed > 0.035

      const stretchX = (lifted ? 1.09 : 1) + clampedSpeed * 0.2
      const squishY = (lifted ? 1.05 : 1) - clampedSpeed * 0.08

      if (dropletRef.current) {
        dropletRef.current.style.transform = `translateX(${(pos * 100).toFixed(2)}%) scale(${stretchX.toFixed(3)}, ${squishY.toFixed(3)})`
      }

      // Fade ONLY the inner visual content of the base tab right under the clear droplet
      baseVisualRefs.current.forEach((inner, idx) => {
        if (!inner) return
        const dist = Math.abs(pos - idx)
        // 0 when directly under droplet center, smoothly fades back to 1 outside
        const vis = Math.max(0, Math.min(1, (dist - 0.35) / 0.35))
        inner.style.opacity = vis.toFixed(3)
      })

      // Optical magnification inside the crystal-clear center of the droplet
      const mag = lifted ? 1.12 : 1.05 + clampedSpeed * 0.05
      if (magScalerRef.current) {
        magScalerRef.current.style.transform = `scale(${(mag / stretchX).toFixed(3)}, ${(mag / squishY).toFixed(3)})`
      }

      const mirrorShiftPct = -(pos * 100)
      if (mirrorMainRef.current) {
        mirrorMainRef.current.style.transform = `translateX(${mirrorShiftPct.toFixed(3)}%)`
      }

      // Fresnel RGB chromatic aberration at the curved bevel rim
      const chromaPx = isMoving ? Math.min(2.8, 1.4 + clampedSpeed * 1.5) : 0
      if (mirrorCyanRef.current) {
        mirrorCyanRef.current.style.transform = `translateX(calc(${mirrorShiftPct.toFixed(3)}% + ${chromaPx.toFixed(2)}px))`
      }
      if (mirrorWarmRef.current) {
        mirrorWarmRef.current.style.transform = `translateX(calc(${mirrorShiftPct.toFixed(3)}% - ${chromaPx.toFixed(2)}px))`
      }
      if (rimGroupRef.current) {
        rimGroupRef.current.style.opacity = isMoving
          ? String(Math.min(0.85, 0.45 + clampedSpeed * 0.42))
          : '0'
      }
    },
    [],
  )

  const startSpring = useCallback(
    (slotIdx: number, initialKick = 0) => {
      targetRef.current = slotIdx
      if (initialKick !== 0) {
        velRef.current = initialKick
      }
      setIsDropletActive(true)

      if (rafRef.current !== null) return

      const step = () => {
        if (isDraggingRef.current) {
          rafRef.current = null
          return
        }
        // Juicy water-droplet spring parameters
        const stiffness = 0.165
        const damping = 0.63
        const force = (targetRef.current - posRef.current) * stiffness
        velRef.current = (velRef.current + force) * damping
        posRef.current += velRef.current

        const speed = Math.abs(velRef.current) * 4.2
        applyOpticalFrame(posRef.current, speed, false)

        if (
          Math.abs(targetRef.current - posRef.current) < 0.002 &&
          Math.abs(velRef.current) < 0.002
        ) {
          posRef.current = targetRef.current
          velRef.current = 0
          applyOpticalFrame(posRef.current, 0, false)
          setIsDropletActive(false)
          rafRef.current = null
        } else {
          rafRef.current = requestAnimationFrame(step)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    },
    [applyOpticalFrame],
  )

  useEffect(() => {
    const nextSlot = TAB_INDEX[activeTab]
    if (
      !isDraggingRef.current &&
      targetRef.current !== nextSlot &&
      Math.abs(nextSlot - posRef.current) > 0.01
    ) {
      const kick = (nextSlot - posRef.current) * 0.16
      startSpring(nextSlot, kick)
    }
  }, [activeTab, startSpring])

  useEffect(() => {
    applyOpticalFrame(TAB_INDEX[activeTabRef.current], 0, false)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [applyOpticalFrame])

  const pointerToSlot = (clientX: number): number => {
    const dock = dockRef.current
    if (!dock) return targetRef.current
    const rect = dock.getBoundingClientRect()
    const innerW = Math.max(1, rect.width - 12)
    const slotW = innerW / 3
    const rel = clientX - rect.left - 6 - slotW / 2
    return Math.max(-0.1, Math.min(2.1, rel / slotW))
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    dockRef.current?.setPointerCapture(e.pointerId)
    isPointerDownRef.current = true
    isDraggingRef.current = false
    startXRef.current = e.clientX
    lastXRef.current = e.clientX
    dragVelRef.current = 0
    setIsDropletActive(true)
    applyOpticalFrame(posRef.current, 0.14, true)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!isPointerDownRef.current) return
    if (!isDraggingRef.current && Math.abs(e.clientX - startXRef.current) > 5) {
      isDraggingRef.current = true
    }
    if (!isDraggingRef.current) return

    const dock = dockRef.current
    const slotW = Math.max(
      1,
      ((dock?.getBoundingClientRect().width ?? 300) - 12) / 3,
    )
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX

    const nextPos = pointerToSlot(e.clientX)
    dragVelRef.current = dragVelRef.current * 0.58 + (dx / slotW) * 0.42
    posRef.current += (nextPos - posRef.current) * 0.72
    applyOpticalFrame(posRef.current, dragVelRef.current * 4.8, true)

    const nearestIdx = Math.max(0, Math.min(2, Math.round(posRef.current)))
    const nextTab = TAB_ORDER[nearestIdx]
    if (nextTab !== activeTabRef.current) {
      onChangeTab(nextTab)
    }
  }

  const finishInteraction = (e: React.PointerEvent<HTMLElement>) => {
    if (!isPointerDownRef.current) return
    const wasDrag = isDraggingRef.current
    isPointerDownRef.current = false
    isDraggingRef.current = false

    const finalIdx = Math.max(
      0,
      Math.min(2, Math.round(pointerToSlot(e.clientX))),
    )
    const finalTab = TAB_ORDER[finalIdx]
    const kick = wasDrag
      ? dragVelRef.current * 0.9
      : (finalIdx - posRef.current) * 0.17

    if (finalTab !== activeTabRef.current) {
      onChangeTab(finalTab)
    }
    startSpring(finalIdx, kick)
  }

  const tabs: Array<{
    id: AppTab
    label: string
    badge?: number
    icon: typeof ShoppingBasket
  }> = [
    {
      id: 'keranjang',
      label: 'Keranjang',
      badge: activeItemCount > 0 ? activeItemCount : undefined,
      icon: ShoppingBasket,
    },
    {
      id: 'referensi',
      label: 'Catatan',
      badge: refCount,
      icon: NotebookPen,
    },
    {
      id: 'paket',
      label: 'Paket',
      badge: templateCount,
      icon: ChefHat,
    },
  ]

  const renderMirrorItems = (tintClass: string, isChroma = false) => (
    <div className="w-[300%] h-full grid grid-cols-3 items-center">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <div
            key={tab.id}
            className={`flex flex-col items-center justify-center gap-0.5 ${
              isChroma
                ? tintClass
                : isActive
                  ? 'text-emerald-700'
                  : 'text-slate-900'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon className="w-5 h-5" strokeWidth={2.35} />
              {tab.badge !== undefined && !isChroma && (
                <span className="ml-1 px-1.5 rounded-full text-[10px] font-extrabold tabular-nums bg-emerald-600 text-white shadow-2xs">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold leading-none">
              {tab.label}
            </span>
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="w-full min-w-0 px-3 pt-4 pb-[max(0.65rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-[#f2f6f3]/92 via-[#f2f6f3]/60 to-transparent pointer-events-none">
      <nav
        ref={dockRef}
        aria-label="Navigasi Utama"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        className="glass-dock pointer-events-auto rounded-full px-1.5 py-1 grid grid-cols-3 cursor-grab active:cursor-grabbing"
      >
        {/* Base Layer: Accessible Tab Buttons (inner visual fades smoothly under clear droplet) */}
        {tabs.map((tab, idx) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`nav-tab-${tab.id}`}
              aria-label={
                tab.badge !== undefined
                  ? `${tab.label} (${tab.badge})`
                  : tab.label
              }
              aria-current={isActive ? 'page' : undefined}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onChangeTab(tab.id)
                }
              }}
              className="relative z-10 min-h-12 rounded-full flex items-center justify-center cursor-pointer"
            >
              <div
                ref={(el) => {
                  baseVisualRefs.current[idx] = el
                }}
                className={`flex flex-col items-center justify-center gap-0.5 pointer-events-none ${
                  isActive ? 'text-emerald-700' : 'text-slate-800'
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.3 : 2} />
                  {tab.badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
                        tab.id === 'keranjang' || isActive
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900/12 text-slate-800'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-bold leading-none">
                  {tab.label}
                </span>
              </div>
            </button>
          )
        })}

        {/* Crystal-Clear Transparent Overhanging Liquid Glass Droplet */}
        <div
          ref={dropletRef}
          aria-hidden="true"
          data-testid="liquid-droplet"
          className={`liquid-droplet ${
            isDropletActive ? 'liquid-droplet-active' : ''
          }`}
        >
          {/* Transparent Optical Center (zero opaque white wall!) */}
          <div ref={magScalerRef} className="absolute inset-0 bg-transparent">
            {/* Rim-only Fresnel RGB Chromatic Dispersion Fringes */}
            <div
              ref={rimGroupRef}
              className="liquid-rim-dispersion transition-opacity duration-150"
              style={{ opacity: 0 }}
            >
              <div
                ref={mirrorCyanRef}
                className="w-full h-full mix-blend-multiply opacity-80"
              >
                {renderMirrorItems('text-cyan-500', true)}
              </div>
              <div
                ref={mirrorWarmRef}
                className="absolute inset-0 w-full h-full mix-blend-multiply opacity-75"
              >
                {renderMirrorItems('text-orange-500', true)}
              </div>
            </div>

            {/* Razor-Sharp Magnified Icon & Text Layer */}
            <div ref={mirrorMainRef} className="relative z-10 w-full h-full">
              {renderMirrorItems('', false)}
            </div>
          </div>

          {/* Top Dome Specular Meniscus & Bottom Caustic Glint */}
          <div className="liquid-droplet-specular" />
        </div>
      </nav>
    </div>
  )
}
