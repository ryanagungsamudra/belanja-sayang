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

export function MonthlyDonutChart({
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

  const arcs = nonZeroSegments.reduce<
    Array<
      DonutSegment & {
        pct: number
        dashArray: string
        dashOffset: number
        endOffset: number
      }
    >
  >((acc, seg) => {
    const startOffset = acc.length > 0 ? acc[acc.length - 1].endOffset : 0
    const pct = total > 0 ? seg.value / total : 0
    const rawLen = pct * circumference
    const visibleLen = Math.max(0, rawLen - gapPx)
    const dashArray = `${visibleLen} ${circumference - visibleLen}`
    acc.push({
      ...seg,
      pct,
      dashArray,
      dashOffset: -startOffset,
      endOffset: startOffset + rawLen,
    })
    return acc
  }, [])

  const activeSegment = activeSegmentId
    ? segments.find((s) => s.id === activeSegmentId)
    : null

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

          {/* Data arcs */}
          {arcs.map((arc) => {
            const isDimmed =
              activeSegmentId !== null && activeSegmentId !== arc.id
            const isSelected = activeSegmentId === arc.id
            return (
              <circle
                key={arc.id}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={isSelected ? strokeWidth + 2.5 : strokeWidth}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                strokeLinecap="round"
                opacity={isDimmed ? 0.25 : 1}
                onClick={() => onSelectSegment(arc.id)}
                className="transition-all duration-500 ease-[cubic-bezier(0.34,1.35,0.64,1)] cursor-pointer"
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
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide leading-none">
            {activeSegment ? activeSegment.shortLabel : 'Total'}
          </span>
          <span
            data-testid="monthly-total-spend"
            className="text-[15px] font-extrabold text-slate-900 tabular-nums leading-tight mt-0.5"
          >
            {formatCompactTotal(activeSegment ? activeSegment.value : total)}
          </span>
          <span className="text-[10px] font-semibold text-stone-400 tabular-nums leading-none mt-0.5">
            {activeSegment && total > 0
              ? `${Math.round((activeSegment.value / total) * 100)}%`
              : `${purchaseCount}x beli`}
          </span>
        </div>
      </div>

      {/* Compact Interactive Legend */}
      <div className="flex-1 min-w-0 space-y-1">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0
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
                <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">
                  {seg.shortLabel}
                </span>
                <span className="text-[10px] font-semibold text-stone-400 tabular-nums shrink-0">
                  {pct}%
                </span>
              </div>
              <span className="text-[12px] font-extrabold text-slate-900 tabular-nums shrink-0">
                {formatRupiah(seg.value)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
