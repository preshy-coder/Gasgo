// Moves an element at a fraction of the scroll speed (e.g. a background photo behind content).
// speed 0.4 = the element moves 40% as fast as the page, so it seems further away.
import { useEffect, useRef } from 'react'

export function useScrollParallax<T extends HTMLElement>(speed = 0.4) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const update = () => {
      frame = 0
      if (ref.current) ref.current.style.transform = `translate3d(0, ${window.scrollY * speed}px, 0)`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [speed])
  return ref
}
