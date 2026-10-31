// Shared pieces for the dark glass screens (Home, My orders, Help, Profile, Location).
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import heroCylinder from '../assets/hero-cylinder.jpg'
import { NAV_CLEARANCE } from '../lib/tabs'

/** Smoked-glass card. */
export const GLASS = 'motion-item rounded-2xl border border-white/20 bg-white/10 shadow-lg shadow-black/20 backdrop-blur-xl backdrop-saturate-150'

/**
 * Same look without the blur. Use it for a card that contains a GlassSelect dropdown:
 * a blurred card stops the dropdown inside it from blurring what's behind.
 */
export const GLASS_FLAT = 'motion-item rounded-2xl border border-white/20 bg-white/[0.12] shadow-lg shadow-black/20'

/** Text input on dark glass. */
export const GLASS_INPUT =
  'w-full rounded-xl border border-white/25 bg-white/10 px-3 py-2.5 text-white outline-none placeholder:text-white/35 focus:border-brand-400 focus:bg-white/15 focus:ring-4 focus:ring-brand-500/25'

/**
 * A full screen with the blurred cylinder photo behind it. The photo stays in place while the
 * content scrolls. Pass `title` for a sticky glass header (and `back` for a back arrow).
 * `nav={false}` for screens without the floating nav bar.
 *
 * Content scrolling under the header or behind the nav bar melts into a soft, progressive blur
 * (EdgeBlur) instead of being cut off by a hard edge.
 */
export function GlassPage({
  title,
  right,
  back,
  nav = true,
  children,
}: {
  title?: string
  right?: ReactNode
  back?: boolean | string
  nav?: boolean
  children: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="relative flex min-h-full flex-col bg-slate-900 text-white">
      <div aria-hidden className="pointer-events-none sticky top-0 -mb-[100dvh] h-[100dvh] overflow-hidden">
        <img src={heroCylinder} alt="" className="h-full w-full scale-110 object-cover object-[50%_30%] blur-[3px]" />
        <div className="absolute inset-0 bg-[linear-gradient(165deg,rgba(0,0,0,0.82)_0%,rgba(30,4,2,0.78)_45%,rgba(0,0,0,0.94)_100%)]" />
      </div>
      {title && (
        <>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-black/30 px-4 backdrop-blur-xl">
            {back && (
              <button
                aria-label="Go back"
                className="-ml-2 rounded-full p-2 hover:bg-white/10"
                onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
            {right}
          </header>
          <EdgeBlur side="top" />
        </>
      )}
      {!title && <EdgeBlur side="top" below={false} />}
      <div className="relative flex flex-1 flex-col" style={nav ? { paddingBottom: NAV_CLEARANCE } : undefined}>
        {children}
      </div>
      {nav && <EdgeBlur side="bottom" />}
    </div>
  )
}

/**
 * Progressive blur band: content passing under it fades into blur gradually, so a page's edge
 * melts away instead of ending in a hard line. Three stacked layers, each blurrier and masked
 * closer to the edge.
 */
export function EdgeBlur({ side, below = true }: { side: 'top' | 'bottom'; below?: boolean }) {
  const top = side === 'top'
  const dir = top ? 'to bottom' : 'to top'
  const layers = [
    { blur: 2, stop: 100 },
    { blur: 6, stop: 65 },
    { blur: 14, stop: 35 },
  ]
  return (
    <div
      aria-hidden
      className={`pointer-events-none sticky z-20 ${top ? (below ? 'top-14 -mb-12 h-12' : 'top-0 -mb-10 h-10') : '-mt-28 h-28'}`}
      style={top ? undefined : { bottom: 0 }}
    >
      {layers.map((l) => (
        <div
          key={l.blur}
          className="absolute inset-0"
          style={{
            backdropFilter: `blur(${l.blur}px)`,
            WebkitBackdropFilter: `blur(${l.blur}px)`,
            maskImage: `linear-gradient(${dir}, black 0%, transparent ${l.stop}%)`,
            WebkitMaskImage: `linear-gradient(${dir}, black 0%, transparent ${l.stop}%)`,
          }}
        />
      ))}
      {/* A light tint so the blurred band also darkens slightly towards the edge */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(${dir}, rgba(0,0,0,0.35), transparent)` }} />
    </div>
  )
}

/** Error message on dark glass. */
export function GlassError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-400/70 bg-[#3a0806]/90 p-3 text-sm font-medium text-white shadow-lg shadow-black/40 backdrop-blur-md"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button className="mt-1 font-semibold underline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  )
}

/** Empty-list message on glass. */
export function GlassEmpty({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className={`${GLASS} flex flex-col items-center px-6 py-10 text-center`}>
      <div className="mb-3 rounded-full border border-white/20 bg-white/10 p-4 text-brand-300">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 text-sm text-white/60">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Loading row that reads on dark glass. */
export function GlassSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-white/70" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
      <span>{label}</span>
    </div>
  )
}
