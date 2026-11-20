// Floating bottom navigation in a "liquid glass" style.
// - A clear, frosted pill: strong blur behind it, bright rim highlights on the edges, no dark fill.
// - The active tab sits on a darker smoked-glass pill (the pointer).
// - Liquid slide: the pointer moves like a drop of liquid. Its leading edge shoots ahead, the
//   trailing edge follows more slowly (so it stretches and thins out), and a small droplet lags
//   behind and is pulled back in. A "gooey" SVG filter melts the droplet and pointer together.
// - An orange dot on "Orders" while an order is in progress.
//
// It lives outside the page transitions (see AppFrame), so it stays still while pages slide.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ClipboardList, Flame, HelpCircle, UserRound } from 'lucide-react'
import { useOrders } from '../hooks/queries'
import { isActiveOrder } from '../lib/format'

const TABS = [
  { to: '/', label: 'Order', icon: Flame },
  { to: '/orders', label: 'Orders', icon: ClipboardList },
  { to: '/help', label: 'Help', icon: HelpCircle },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

// Sizes (px). Change these to resize the bar and pointer.
const BAR_H = 58 // bar height
const INSET = 5 // gap between the pointer and the bar's edge
const POINTER_H = BAR_H - INSET * 2
const DROPLET = 18 // droplet diameter

// Liquid motion (spring stiffness / damping). Higher stiffness = faster; lower damping = more wobble.
const LEAD = { k: 260, c: 22 } // leading edge: quick
const TRAIL = { k: 95, c: 15 } // trailing edge: slower, so the pointer stretches
const DROP = { k: 90, c: 13 } // droplet: slowest, lags behind and gets pulled back in

type Spring = { x: number; v: number }

function stepSpring(s: Spring, target: number, p: { k: number; c: number }, dt: number) {
  const a = p.k * (target - s.x) - p.c * s.v
  s.v += a * dt
  s.x += s.v * dt
}

export function FloatingNav() {
  const { pathname } = useLocation()
  const orders = useOrders()
  const hasActiveOrder = orders.data?.some((o) => isActiveOrder(o.status)) ?? false
  const activeIndex = TABS.findIndex((t) => t.to === pathname)

  const barRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const layerRef = useRef<HTMLDivElement>(null)
  const blobRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const sim = useRef({
    l: { x: NaN, v: 0 } as Spring,
    r: { x: NaN, v: 0 } as Spring,
    d: { x: NaN, v: 0 } as Spring,
    tl: 0,
    tr: 0,
    dir: 1,
    restW: 0,
    frame: 0,
    last: 0,
  })

  useLayoutEffect(() => {
    const s = sim.current

    const draw = () => {
      const w = Math.max(POINTER_H, s.r.x - s.l.x)
      // Keep the "volume": the longer it stretches, the thinner it gets.
      const h = POINTER_H * Math.min(1, Math.max(0.72, Math.pow(s.restW / w, 0.35)))
      const top = INSET + (POINTER_H - h) / 2
      for (const el of [blobRef.current, shineRef.current]) {
        if (!el) continue
        el.style.width = `${w}px`
        el.style.height = `${h}px`
        el.style.transform = `translate(${s.l.x}px, ${top}px)`
      }
      if (dropRef.current) {
        dropRef.current.style.transform = `translate(${s.d.x - DROPLET / 2}px, ${INSET + (POINTER_H - DROPLET) / 2}px)`
      }
    }

    const settled = () =>
      [s.l, s.r, s.d].every((sp) => Math.abs(sp.v) < 3) &&
      Math.abs(s.l.x - s.tl) < 0.3 &&
      Math.abs(s.r.x - s.tr) < 0.3 &&
      Math.abs(s.d.x - (s.tl + s.tr) / 2) < 0.5

    const snap = () => {
      s.l = { x: s.tl, v: 0 }
      s.r = { x: s.tr, v: 0 }
      s.d = { x: (s.tl + s.tr) / 2, v: 0 }
      draw()
    }

    const measure = (animate: boolean) => {
      const tab = tabRefs.current[activeIndex]
      if (!tab) return
      const prevCentre = (s.tl + s.tr) / 2
      s.tl = tab.offsetLeft + 2
      s.tr = tab.offsetLeft + tab.offsetWidth - 2
      s.restW = s.tr - s.tl
      s.dir = (s.tl + s.tr) / 2 >= prevCentre ? 1 : -1
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (!animate || Number.isNaN(s.l.x) || reduce) return snap()
      if (s.frame) return // already moving; it flows on to the new target

      s.last = performance.now()
      const step = (now: number) => {
        const dt = Math.min(0.032, (now - s.last) / 1000)
        s.last = now
        const right = s.dir > 0
        stepSpring(s.r, s.tr, right ? LEAD : TRAIL, dt)
        stepSpring(s.l, s.tl, right ? TRAIL : LEAD, dt)
        // The droplet chases the trailing end, then the centre once the pointer has arrived.
        const trailingEnd = right ? s.l.x + DROPLET / 2 : s.r.x - DROPLET / 2
        const arrived = Math.abs(s.l.x - s.tl) + Math.abs(s.r.x - s.tr) < 6
        stepSpring(s.d, arrived ? (s.tl + s.tr) / 2 : trailingEnd, DROP, dt)
        if (settled()) {
          s.frame = 0
          snap()
          return
        }
        draw()
        s.frame = requestAnimationFrame(step)
      }
      s.frame = requestAnimationFrame(step)
    }

    if (layerRef.current) layerRef.current.style.visibility = activeIndex >= 0 ? 'visible' : 'hidden'
    measure(true)

    // Re-place the pointer if the bar changes size (e.g. phone rotated), without animating.
    let lastWidth = barRef.current?.offsetWidth ?? 0
    const ro = new ResizeObserver(() => {
      const width = barRef.current?.offsetWidth ?? 0
      if (width === lastWidth) return
      lastWidth = width
      cancelAnimationFrame(s.frame)
      s.frame = 0
      measure(false)
    })
    if (barRef.current) ro.observe(barRef.current)
    return () => ro.disconnect()
  }, [activeIndex])

  useEffect(() => () => cancelAnimationFrame(sim.current.frame), [])

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-4 pb-[max(env(safe-area-inset-bottom),0.625rem)]">
      {/* Gooey filter: blur the shapes, then sharpen the edges again so nearby shapes melt into one */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <filter id="gasgo-goo" x="-20%" y="-60%" width="140%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" />
        </filter>
      </svg>

      <nav
        ref={barRef}
        aria-label="Main"
        style={{ height: BAR_H, padding: `0 ${INSET}px` }}
        className={[
          'pointer-events-auto relative isolate flex items-stretch rounded-full',
          // Liquid glass: clear tint, strong blur + saturation, bright rim highlights
          'border border-white/45 bg-gradient-to-b from-white/25 via-white/[0.08] to-white/20',
          'backdrop-blur-md backdrop-saturate-[1.8] backdrop-brightness-110',
          'shadow-[inset_0_1.5px_1px_rgba(255,255,255,0.75),inset_0_-1.5px_1px_rgba(255,255,255,0.35),inset_0_0_14px_rgba(255,255,255,0.18),0_10px_30px_-8px_rgba(0,0,0,0.45)]',
        ].join(' ')}
      >
        {/* Glossy sheen across the top half */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-[3px] -z-10 h-1/2 rounded-full bg-gradient-to-b from-white/30 to-transparent"
        />

        {/* Liquid pointer: solid shapes melted by the goo filter, then faded to smoked glass */}
        <div
          ref={layerRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ clipPath: `inset(0 round ${BAR_H / 2}px)` }}
        >
          <div className="absolute inset-0 opacity-40" style={{ filter: 'url(#gasgo-goo)' }}>
            <div ref={blobRef} className="absolute top-0 left-0 rounded-full bg-black will-change-transform" />
            <div
              ref={dropRef}
              className="absolute top-0 left-0 rounded-full bg-black will-change-transform"
              style={{ width: DROPLET, height: DROPLET }}
            />
          </div>
          {/* Soft highlight on the pointer's rim */}
          <div
            ref={shineRef}
            className="absolute top-0 left-0 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.22),inset_0_-5px_10px_rgba(0,0,0,0.18)] will-change-transform"
          />
        </div>

        {TABS.map((t, i) => {
          const active = i === activeIndex
          const Icon = t.icon
          return (
            <NavLink
              key={t.to}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              to={t.to}
              end
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 text-white [filter:drop-shadow(0_1px_1.5px_rgba(0,0,0,0.45))]"
            >
              <span className={`relative transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${active ? 'scale-110' : ''}`}>
                <Icon className="h-5 w-5 text-white" strokeWidth={active ? 2.4 : 2.1} />
                {t.to === '/orders' && hasActiveOrder && (
                  <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-brand-500 ring-1 ring-white/80" aria-label="Order in progress" />
                )}
              </span>
              <span className="text-[11px] leading-tight font-semibold text-white">
                {t.label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
