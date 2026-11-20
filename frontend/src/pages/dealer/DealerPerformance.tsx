// Vendor performance: sales over the last 7 / 30 / 90 days, from orders the customer confirmed.
import { useMemo, useState } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { errorMessage } from '../../api'
import { DealerShell } from '../../components/DealerShell'
import { GLASS, GlassEmpty, GlassError, GlassSpinner } from '../../components/glass'
import { usePerformance } from '../../hooks/queries'
import { formatKes } from '../../lib/format'
import type { DealerPerformance } from '../../types'

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

export default function DealerPerformancePage() {
  const [days, setDays] = useState(30)
  const perf = usePerformance(days)
  const p = perf.data

  return (
    <DealerShell>
      <div className="flex-1 space-y-3 p-4">
        <div className="flex gap-2" role="group" aria-label="Period">
          {PERIODS.map((x) => (
            <button
              key={x.days}
              aria-pressed={days === x.days}
              onClick={() => setDays(x.days)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                days === x.days
                  ? 'border-transparent bg-brand-600 bg-brand-button text-white shadow-md shadow-black/30'
                  : 'border-white/20 bg-white/10 text-white/70 hover:text-white'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {perf.isPending && <GlassSpinner />}
        {perf.isError && <GlassError message={errorMessage(perf.error)} onRetry={() => perf.refetch()} />}
        {p && p.orders === 0 && (
          <GlassEmpty
            icon={<TrendingUp className="h-6 w-6" />}
            title="No sales in this period yet"
            text="Sales show up here once customers confirm they received their gas."
          />
        )}
        {p && p.orders > 0 && <Report p={p} />}
      </div>
    </DealerShell>
  )
}

function Report({ p }: { p: DealerPerformance }) {
  const change = p.previous_sales_kes > 0 ? Math.round(((p.sales_kes - p.previous_sales_kes) / p.previous_sales_kes) * 100) : null
  const avg = Math.round(p.sales_kes / p.orders)
  const parts = [
    { label: 'Gas', value: p.gas_kes },
    { label: 'Equipment', value: p.accessories_kes },
    { label: 'Delivery fees', value: p.delivery_fees_kes },
  ]
  const topMax = Math.max(...p.top_items.map((t) => t.sales_kes), 1)

  return (
    <>
      {/* Headline */}
      <section className={`${GLASS} relative overflow-hidden p-4`}>
        <span aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
        <p className="text-sm text-white/65">Your sales · last {p.days} days</p>
        <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{formatKes(p.sales_kes)}</p>
        {change !== null && (
          <p className={`mt-1 flex items-center gap-1 text-sm font-medium ${change >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {change >= 0 ? 'Up' : 'Down'} {Math.abs(change)}% <span className="font-normal text-white/55">vs the {p.days} days before</span>
          </p>
        )}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Tile value={String(p.orders)} label="Orders" />
          <Tile value={String(p.cylinders)} label="Cylinders" />
          <Tile value={formatKes(avg)} label="Avg order" />
        </div>
      </section>

      {/* Sales over time */}
      <section className={`${GLASS} p-4`}>
        <SalesChart p={p} />
      </section>

      {/* Where the money came from */}
      <section className={`${GLASS} p-4`}>
        <h3 className="font-semibold">Where your sales came from</h3>
        <dl className="mt-2 space-y-1.5 text-sm">
          {parts.map((x) => (
            <div key={x.label} className="flex justify-between">
              <dt className="text-white/70">{x.label}</dt>
              <dd className="tabular-nums">
                {formatKes(x.value)} <span className="text-white/45">· {Math.round((x.value / p.sales_kes) * 100)}%</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Best sellers */}
      <section className={`${GLASS} p-4`}>
        <h3 className="font-semibold">Best sellers</h3>
        <ul className="mt-3 space-y-3">
          {p.top_items.map((t) => (
            <li key={t.name}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{t.name}</span>
                <span className="shrink-0 tabular-nums">{formatKes(t.sales_kes)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-white/10">
                  <div className="h-1.5 rounded-full bg-[#F16001]" style={{ width: `${(t.sales_kes / topMax) * 100}%` }} />
                </div>
                <span className="w-14 shrink-0 text-right text-xs text-white/55 tabular-nums">{t.quantity} sold</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 text-xs text-white/50">Counts orders the customer confirmed they received. Gasgo’s service fee is not included.</p>
    </>
  )
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/5 px-2 py-2.5 text-center">
      <p className="truncate text-base font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-white/55">{label}</p>
    </div>
  )
}

const short = (n: number) => (n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${+(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n))
const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
  })

/** Bar chart of sales per day (7 / 30 days) or per week (90 days). Tap or hover a bar for details. */
function SalesChart({ p }: { p: DealerPerformance }) {
  const weekly = p.days > 31
  const buckets = useMemo(() => {
    if (!weekly)
      return p.daily.map((d) => ({
        label: dayLabel(d.date),
        range: dayLabel(d.date),
        sales: d.sales_kes,
        orders: d.orders,
      }))
    const out: {
      label: string
      range: string
      sales: number
      orders: number
    }[] = []
    for (let i = 0; i < p.daily.length; i += 7) {
      const chunk = p.daily.slice(i, i + 7)
      out.push({
        label: dayLabel(chunk[0].date),
        range: `${dayLabel(chunk[0].date)} – ${dayLabel(chunk[chunk.length - 1].date)}`,
        sales: chunk.reduce((s, d) => s + d.sales_kes, 0),
        orders: chunk.reduce((s, d) => s + d.orders, 0),
      })
    }
    return out
  }, [p.daily, weekly])
  const [active, setActive] = useState<number | null>(null)
  const [table, setTable] = useState(false)

  // Layout (SVG units; the SVG scales to the card width).
  const W = 320
  const H = 170
  const left = 34
  const bottom = 20
  const top = 8
  const plotW = W - left
  const plotH = H - top - bottom
  const max = Math.max(...buckets.map((b) => b.sales), 1)
  const step = niceStep(max / 3)
  const yMax = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step)
  const slot = plotW / buckets.length
  const gap = buckets.length > 20 ? 2 : 4
  const barW = Math.max(2, slot - gap)
  const y = (v: number) => top + plotH - (v / yMax) * plotH
  const labelEvery = Math.ceil(buckets.length / 5)
  const a = active !== null ? buckets[active] : null

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold">{weekly ? 'Sales per week' : 'Sales per day'}</h3>
        <button className="text-xs font-semibold text-brand-300" onClick={() => setTable(!table)}>
          {table ? 'Show chart' : 'Show as table'}
        </button>
      </div>

      {table ? (
        <div className="mt-2 max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-white/55">
              <tr>
                <th className="py-1 font-medium">{weekly ? 'Week' : 'Day'}</th>
                <th className="py-1 text-right font-medium">Orders</th>
                <th className="py-1 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...buckets].reverse().map((b) => (
                <tr key={b.range} className="border-t border-white/10">
                  <td className="py-1.5">{b.range}</td>
                  <td className="py-1.5 text-right">{b.orders}</td>
                  <td className="py-1.5 text-right">{formatKes(b.sales)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* Readout for the bar being touched (keeps a fixed height so the chart doesn't jump). */}
          <p className="mt-1 h-5 text-sm text-white/70" aria-live="polite">
            {a ? (
              <>
                <span className="text-white">{a.range}</span> · {formatKes(a.sales)} · {a.orders} order
                {a.orders === 1 ? '' : 's'}
              </>
            ) : (
              <span className="text-white/45">Tap a bar for details</span>
            )}
          </p>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="mt-1 w-full touch-none select-none"
            role="img"
            aria-label={`Bar chart of sales per ${weekly ? 'week' : 'day'}, highest ${formatKes(max)}`}
            onPointerLeave={() => setActive(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : '2 3'} />
                <text x={left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="rgba(255,255,255,0.55)">
                  {short(t)}
                </text>
              </g>
            ))}
            {buckets.map((b, i) => {
              const x = left + i * slot + (slot - barW) / 2
              const h = Math.max(0, y(0) - y(b.sales))
              const r = Math.min(4, barW / 2, h)
              return (
                <g key={b.range}>
                  {h > 0 && (
                    <path
                      d={`M${x},${y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`}
                      fill="#F16001"
                      opacity={active === null || active === i ? 1 : 0.45}
                    />
                  )}
                  {i % labelEvery === 0 && (
                    <text
                      x={Math.min(left + i * slot + slot / 2, W - 2)}
                      y={H - 5}
                      textAnchor={left + i * slot + slot / 2 > W - 24 ? 'end' : 'middle'}
                      fontSize={10}
                      fill="rgba(255,255,255,0.55)"
                    >
                      {b.label}
                    </text>
                  )}
                  {/* Hit area: the whole column, bigger than the bar. */}
                  <rect
                    x={left + i * slot}
                    y={top}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                  />
                </g>
              )
            })}
          </svg>
        </>
      )}
    </div>
  )
}

/** A round axis step (1, 2, 2.5 or 5 × a power of ten). */
function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)))
  const n = raw / pow
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow
}
