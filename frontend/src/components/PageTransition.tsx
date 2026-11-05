// Parallax page transitions with depth blur.
//
// Going forward, the new page slides in from the right and sharpens into focus while the old page
// drifts left at a third of the speed, blurs and dims, like it's falling out of focus behind.
// Going back reverses it: the page you're leaving slides off to the right, blurring as it goes,
// and the page underneath comes forward and sharpens. Between bottom tabs the direction follows
// the tab order (a tab to the right = forward).
//
// How it works: just before React swaps the page, we take a static copy (DOM clone) of the old page
// and animate it underneath (or on top of) the new one. The copy is plain HTML, so it can't run any
// code or navigate by accident. Users who turn on "reduce motion" get no animation.
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { TAB_PATHS as TABS } from '../lib/tabs'

const DURATION = 520
const EASING = 'cubic-bezier(0.32, 0.72, 0, 1)' // fast start, long soft landing
const PARALLAX = '-30%' // how far the back layer moves while the front layer moves 100%
const BLUR = 14 // px of blur on the page going out of focus
const SEAM_W = 120 // width of the soft blur band where the two pages meet

type Kind = 'forward' | 'back'

export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navType = useNavigationType()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const seamRef = useRef<HTMLDivElement>(null)
  const shownPath = useRef(location.pathname)
  const snapshot = useRef<{ forPath: string; node: HTMLElement; scroll: number } | null>(null)

  // Runs during render, while the old page is still on screen: copy it.
  if (location.pathname !== shownPath.current && pageRef.current && snapshot.current?.forPath !== location.pathname) {
    const node = pageRef.current.cloneNode(true) as HTMLElement
    node.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'))
    node.querySelectorAll('[autofocus]').forEach((el) => el.removeAttribute('autofocus'))
    node.setAttribute('aria-hidden', 'true')
    node.setAttribute('inert', '')
    // The copy drops its backdrop blurs (see index.css): it's about to be blurred as a whole anyway,
    // and skipping dozens of live glass effects keeps the animation smooth.
    node.classList.add('pt-snapshot')
    snapshot.current = { forPath: location.pathname, node, scroll: window.scrollY }
  }

  useLayoutEffect(() => {
    const from = shownPath.current
    shownPath.current = location.pathname
    const snap = snapshot.current
    snapshot.current = null
    if (from === location.pathname) return

    // New page starts at the top.
    window.scrollTo(0, 0)

    const page = pageRef.current
    const overlay = overlayRef.current
    const wrapper = wrapperRef.current
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!snap || !page || !overlay || !wrapper || reduceMotion || typeof page.animate !== 'function') return

    const kind: Kind =
      TABS.includes(from) && TABS.includes(location.pathname)
        ? TABS.indexOf(location.pathname) > TABS.indexOf(from)
          ? 'forward'
          : 'back'
        : navType === 'POP'
          ? 'back'
          : 'forward'

    // Show the copy of the old page, scrolled to where the user was.
    overlay.replaceChildren(snap.node)
    overlay.style.display = 'flex'
    overlay.style.height = `${Math.max(0, window.innerHeight - wrapper.getBoundingClientRect().top)}px`
    overlay.style.zIndex = kind === 'back' ? '20' : '0'
    overlay.scrollTop = snap.scroll

    const timing: KeyframeAnimationOptions = { duration: DURATION, easing: EASING }

    // The seam: a soft vertical band of blur that rides along the edge where the two pages meet,
    // so the exiting page's edge melts into the blur instead of ending in a hard line.
    const seam = seamRef.current
    let seamAnim: Animation | null = null
    if (seam) {
      const w = wrapper.offsetWidth
      seam.style.display = 'block'
      seam.style.height = overlay.style.height
      const startX = kind === 'forward' ? w - SEAM_W / 2 : -SEAM_W / 2
      const endX = kind === 'forward' ? -SEAM_W / 2 : w - SEAM_W / 2
      seamAnim = seam.animate(
        [
          { transform: `translateX(${startX}px)`, opacity: 1 },
          { offset: 0.75, opacity: 1 },
          { transform: `translateX(${endX}px)`, opacity: 0 },
        ],
        timing,
      )
    }
    let pageAnim: Animation
    let oldAnim: Animation
    if (kind === 'forward') {
      // New page: slides in over the top, already sharp by the time it's half way.
      pageAnim = page.animate(
        [
          { transform: 'translateX(100%)', filter: 'blur(3px)' },
          { offset: 0.45, filter: 'blur(0px)' },
          { transform: 'translateX(0)', filter: 'blur(0px)' },
        ],
        timing,
      )
      // Old page: drifts behind, falls out of focus and dims.
      oldAnim = overlay.animate(
        [
          { transform: 'translateX(0) scale(1)', filter: 'blur(0px) brightness(1)', opacity: 1 },
          { transform: `translateX(${PARALLAX}) scale(0.96)`, filter: `blur(${BLUR}px) brightness(0.6)`, opacity: 0.85 },
        ],
        timing,
      )
    } else {
      // Page underneath: comes forward and sharpens.
      pageAnim = page.animate(
        [
          { transform: `translateX(${PARALLAX}) scale(0.96)`, filter: `blur(${BLUR / 2}px) brightness(0.6)` },
          { offset: 0.4, filter: 'blur(0px) brightness(0.85)' },
          { transform: 'translateX(0) scale(1)', filter: 'blur(0px) brightness(1)' },
        ],
        timing,
      )
      // Page you're leaving: slides off the right, blurring on its way out.
      oldAnim = overlay.animate(
        [
          { transform: 'translateX(0)', filter: 'blur(0px)' },
          { offset: 0.5, filter: `blur(${BLUR / 2}px)` },
          { transform: 'translateX(100%)', filter: `blur(${BLUR}px)` },
        ],
        timing,
      )
    }

    const cleanup = () => {
      overlay.style.display = 'none'
      overlay.replaceChildren()
      if (seam) seam.style.display = 'none'
    }
    oldAnim.onfinish = cleanup
    return () => {
      pageAnim.cancel()
      oldAnim.cancel()
      seamAnim?.cancel()
      cleanup()
    }
  }, [location.pathname, navType])

  return (
    <div ref={wrapperRef} className="relative flex flex-1 flex-col overflow-x-clip bg-black">
      {/* Static copy of the previous page while it animates away */}
      <div
        ref={overlayRef}
        className="pointer-events-none absolute inset-x-0 top-0 flex-col overflow-hidden bg-slate-50 will-change-transform"
        style={{ display: 'none' }}
      />
      <div ref={pageRef} className="relative z-10 flex flex-1 flex-col bg-slate-50">
        {children}
      </div>
      {/* Blur band along the seam between the two pages (see above) */}
      <div
        ref={seamRef}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 z-30 will-change-transform"
        style={{
          display: 'none',
          width: SEAM_W,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          maskImage: 'linear-gradient(to right, transparent, black 35%, black 65%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 35%, black 65%, transparent)',
        }}
      />
    </div>
  )
}
