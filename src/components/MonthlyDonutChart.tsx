import { memo, useEffect, useState } from 'react'
import { useCountUp } from '../hooks/useCountUp'
import { formatRupiah } from '../lib/format'

export interface DonutSegment {
  id: string
  label: string
  shortLabel: string
  value: number
  color: string
  bgClass: string
}

interface MonthlyDonutChartProps {
  segments: DonutSegment[]
  total: number
  purchaseCount: number
  activeSegmentId: string | null
  onSelectSegment: (id: string) => void
}

function formatCompactTotal(amount: number): string {
  if (amount >= 1_000_000) {
    const jt = amount / 1_000_000
    return `Rp ${jt.toFixed(jt >= 10 ? 1 : 2).replace('.', ',')}jt`
  }
  if (amount >= 100_000) {
    return `Rp ${Math.round(amount / 1000)}rb`
  }
  return formatRupiah(amount)
}

export const MonthlyDonutChart = memo(function MonthlyDonutChart({
  segments,
  total,
  purchaseCount,
  activeSegmentId,
  onSelectSegment,
}: MonthlyDonutChartProps) {
  const size = 112
  const strokeWidth = 13
  const center = size / 2
  const radius = center - strokeWidth / 2 - 2
  const circumference = 2 * Math.PI * radius

  const nonZeroSegments = segments.filter((s) => s.value > 0)
  const gapPx = nonZeroSegments.length > 1 ? 3.5 : 0
  const chartSignature = nonZeroSegments
    .map((s) => `${s.id}:${s.value}`)
    .join('|')

  const [sweep, setSweep] = useState<{ sig: string; progress: number }>(() => ({
    sig: chartSignature,
    progress:
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 1
        : 0,
  }))

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (
      reduced ||
      typeof requestAnimationFrame === 'undefined' ||
      nonZeroSegments.length === 0
    ) {
      const id = window.setTimeout(() => {
        setSweep({ sig: chartSignature, progress: 1 })
      }, 0)
      return () => window.clearTimeout(id)
    }

    let rafId = 0
    let startTime: number | null = null
    const durationMs = 660

    const tick = (now: number) => {
      if (startTime === null) startTime = now
      const rawT = Math.min(1, (now - startTime) / durationMs)
      const eased = 1 - Math.pow(1 - rawT, 4)
      setSweep({ sig: chartSignature, progress: eased })
      if (rawT < 1) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [chartSignature, nonZeroSegments.length])

  const sweepProgress = sweep.sig === chartSignature ? sweep.progress : 0
  const drawnCircumference = sweepProgress * circumference

  const arcs = nonZeroSegments.reduce<
    Array<
      DonutSegment & {
        pct: number
        visibleLen: number
        startOffset: number
        endOffset: number
      }
    >
  >((acc, seg) => {
    const startOffset = acc.length > 0 ? acc[acc.length - 1].endOffset : 0
    const pct = total > 0 ? seg.value / total : 0
    const rawLen = pct * circumference
    const visibleLen = Math.max(0, rawLen - gapPx)
    acc.push({
      ...seg,
      pct,
      visibleLen,
      startOffset,
      endOffset: startOffset + rawLen,
    })
    return acc
  }, [])

  const activeSegment = activeSegmentId
    ? segments.find((s) => s.id === activeSegmentId)
    : null
  const animatedSegmentValue = useCountUp(
    activeSegment ? activeSegment.value : total,
    460,
    chartSignature,
  )
  const displayCenterValue = activeSegment
    ? animatedSegmentValue
    : Math.round(total * sweepProgress)
  const targetSegmentPct =
    activeSegment && total > 0
      ? Math.round((activeSegment.value / total) * 100)
      : 0
  const displayCenterPct = Math.round(targetSegmentPct * sweepProgress)

  return (
    <div
      data-testid="monthly-donut-chart"
      className="flex items-center gap-3"
    >
      {/* Circular Donut SVG */}
      <div className="relative w-[112px] h-[112px] shrink-0">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full -rotate-90"
          role="img"
          aria-label={`Diagram pengeluaran bulanan total ${formatRupiah(total)}`}
        >
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#F1EFEA"
            strokeWidth={strokeWidth}
          />

          {/* Data arcs — sweep smoothly clockwise from 12 o'clock */}
          {arcs.map((arc) => {
            const isDimmed =
              activeSegmentId !== null && activeSegmentId !== arc.id
            const isSelected = activeSegmentId === arc.id
            const drawnLen = Math.max(
              0,
              Math.min(arc.visibleLen, drawnCircumference - arc.startOffset),
            )
            const hasVisibleArc = drawnLen > 0.4
            const dashArray = hasVisibleArc
              ? `${drawnLen} ${circumference - drawnLen}`
              : `0 ${circumference}`
            return (
              <circle
                key={arc.id}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={isSelected ? strokeWidth + 2.5 : strokeWidth}
                strokeDasharray={dashArray}
                strokeDashoffset={-arc.startOffset}
                strokeLinecap="round"
                opacity={!hasVisibleArc ? 0 : isDimmed ? 0.25 : 1}
                onClick={() => onSelectSegment(arc.id)}
                className="transition-[stroke-width,opacity,filter] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] cursor-pointer"
                style={
                  isSelected
                    ? { filter: `drop-shadow(0 0 6px ${arc.color}66)` }
                    : undefined
                }
              />
            )
          })}
        </svg>

        {/* Center Summary Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wide leading-none">
            {activeSegment ? activeSegment.shortLabel : 'Total'}
          </span>
          <span
            data-testid="monthly-total-spend"
            className="text-[15px] font-extrabold text-slate-900 tabular-nums leading-tight mt-0.5"
          >
            {formatCompactTotal(displayCenterValue)}
          </span>
          <span className="text-[10px] font-semibold text-slate-600 tabular-nums leading-none mt-0.5">
            {activeSegment && total > 0
              ? `${displayCenterPct}%`
              : `${purchaseCount}x beli`}
          </span>
        </div>
      </div>

      {/* Compact Interactive Legend */}
      <div className="flex-1 min-w-0 space-y-1">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
          const animatedSegValue =
            seg.value > 0 ? Math.round(seg.value * sweepProgress) : 0
          const animatedSegPct =
            pct > 0 ? Math.round(pct * sweepProgress) : 0
          const isSelected = activeSegmentId === seg.id
          const isDimmed =
            activeSegmentId !== null && activeSegmentId !== seg.id
          return (
            <button
              key={seg.id}
              type="button"
              data-testid={`donut-legend-${seg.id}`}
              onClick={() => onSelectSegment(seg.id)}
              className={`w-full min-h-8 px-2 py-1 rounded-xl flex items-center justify-between gap-1.5 text-left liquid-press cursor-pointer ${
                isSelected
                  ? 'bg-white/85 ring-1 ring-white shadow-xs'
                  : 'hover:bg-white/55'
              } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-[12px] font-bold text-slate-800 whitespace-nowrap">
                  {seg.shortLabel}
                </span>
                <span className="text-[11px] font-semibold text-slate-600 tabular-nums shrink-0">
                  {animatedSegPct}%
                </span>
              </div>
              <span className="text-[12px] font-extrabold text-slate-900 tabular-nums shrink-0">
                {formatRupiah(animatedSegValue)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
})
