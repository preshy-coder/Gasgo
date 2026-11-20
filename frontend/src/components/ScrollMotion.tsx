// Scroll motion for every page.
//
// Any element with the class `motion-item` (all glass cards and light cards have it):
// - comes in from below: fades up and sharpens from a blur, one after another (staggered)
//   when a page opens or new items appear;
// - as you scroll it off the top of the screen, it blurs, shrinks slightly and fades;
// - scrolling back, it comes back into focus.
// The look of each state is in index.css (.motion-item[data-motion=...]).
// Nothing happens for users who turn on "reduce motion".
import { useEffect } from 'react'

const STAGGER_MS = 30
const MAX_STAGGER = 6

export function ScrollMotion() {
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    let batch: HTMLElement[] = [] // items revealed in the same frame, for staggering
    let batchFrame = 0

    const reveal = (el: HTMLElement) => {
      batch.push(el)
      if (batchFrame) return
      batchFrame = requestAnimationFrame(() => {
        // Top-to-bottom order, each a little later than the one before.
        batch.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
        batch.forEach((item, i) => {
          const first = item.dataset.motion === 'below' && !item.dataset.seen
          item.style.transitionDelay = first ? `${Math.min(i, MAX_STAGGER) * STAGGER_MS}ms` : '0ms'
          item.dataset.motion = 'in'
          item.dataset.seen = '1'
        })
        batch = []
        batchFrame = 0
      })
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement
          if (e.isIntersecting && e.intersectionRatio >= 0.15) {
            if (el.dataset.motion !== 'in') reveal(el)
          } else if (el.dataset.motion === 'in' || !el.dataset.seen) {
            el.style.transitionDelay = '0ms'
            // Above the screen = scrolled past (blur away upwards); below = not reached yet.
            el.dataset.motion = e.boundingClientRect.top < (e.rootBounds?.top ?? 0) ? 'above' : 'below'
          }
        }
      },
      // Items start blurring a little before they reach the very top (under the header).
      { threshold: [0, 0.15, 0.5], rootMargin: '-56px 0px -16px 0px' },
    )

    // Tracked per run of this effect (React may start it twice in development).
    const tracked = new WeakSet<Element>()
    const track = (el: Element) => {
      if (!(el instanceof HTMLElement) || tracked.has(el)) return
      if (el.closest('[inert]')) return // ignore the page copies used by page transitions
      tracked.add(el)
      if (!el.dataset.seen) el.dataset.motion = 'below'
      io.observe(el)
    }
    const scan = (root: ParentNode) => {
      if (root instanceof Element && root.classList.contains('motion-item')) track(root)
      root.querySelectorAll?.('.motion-item').forEach(track)
    }

    scan(document)
    const mo = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => n instanceof Element && scan(n))
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      io.disconnect()
      cancelAnimationFrame(batchFrame)
    }
  }, [])

  return null
}
