// Dropdown menu with a frosted-glass (glassmorphism) panel.
// Usage:
//   <GlassSelect label="Gas brand" value={brand} onChange={setBrand}
//     options={[{ value: 'K-Gas', label: 'K-Gas' }]} placeholder="Choose your brand" />
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'

export interface GlassOption<T extends string> {
  value: T
  label: string
  description?: string
  icon?: ReactNode
}

interface Props<T extends string> {
  label: string
  value: T | null
  options: GlassOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  /** 'light' = frosted white glass (light pages); 'dark' = smoked glass with white text (photo backgrounds). */
  tone?: 'light' | 'dark'
  /** Show a search box at the top of the list (for long lists such as gas brands). */
  searchable?: boolean
  searchPlaceholder?: string
}

const TONES = {
  light: {
    label: 'text-slate-600',
    button: 'border-white/70 bg-white/60 hover:bg-white/75',
    buttonOpen: 'border-brand-400 bg-white/80 ring-4 ring-brand-500/15',
    text: 'text-ink',
    placeholder: 'text-slate-400',
    sub: 'text-slate-500',
    chevron: 'text-slate-500',
    panel: 'border-white/70 bg-white/70 shadow-slate-900/25 ring-slate-900/5',
    active: 'bg-white/90 shadow-sm',
    optionSub: 'text-slate-600',
    check: 'text-brand-600',
  },
  dark: {
    label: 'text-white/60',
    button: 'border-white/25 bg-white/10 hover:bg-white/15',
    buttonOpen: 'border-brand-400 bg-white/15 ring-4 ring-brand-500/25',
    text: 'text-white',
    placeholder: 'text-white/50',
    sub: 'text-white/60',
    chevron: 'text-white/70',
    panel: 'border-white/25 bg-slate-900/75 shadow-black/50 ring-white/5',
    active: 'bg-white/15 shadow-inner shadow-white/10',
    optionSub: 'text-white/60',
    check: 'text-brand-300',
  },
}

export function GlassSelect<T extends string>({
  label,
  value,
  options: allOptions,
  onChange,
  placeholder = 'Select…',
  tone = 'light',
  searchable = false,
  searchPlaceholder = 'Search…',
}: Props<T>) {
  const t = TONES[tone]
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const options = q ? allOptions.filter((o) => o.label.toLowerCase().replace(/[\s-]/g, '').includes(q.replace(/[\s-]/g, ''))) : allOptions
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const closing = useRef(false)
  const id = useId()
  const selected = allOptions.find((o) => o.value === value)
  const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Parallax open: the glass panel unrolls downwards while the options slide in on their own layer.
  // Options lower down start further away and travel further, so they move at different speeds.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!open || !list || reduceMotion() || typeof list.animate !== 'function') return
    closing.current = false
    const ease = 'cubic-bezier(0.22, 0.8, 0.24, 1)'
    const anims = [
      list.animate(
        [
          {
            opacity: 0,
            transform: 'translateY(-8px)',
            clipPath: 'inset(0 0 100% 0 round 16px)',
          },
          {
            opacity: 1,
            transform: 'none',
            clipPath: 'inset(0 0 0% 0 round 16px)',
          },
        ],
        { duration: 380, easing: ease },
      ),
      // The stagger is capped so long lists (e.g. 30 brands) still finish quickly.
      ...Array.from(list.children).map((li, n) =>
        li.animate(
          [
            { opacity: 0, transform: `translateY(${-(16 + Math.min(n, 6) * 7)}px)` },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: 420 + Math.min(n, 6) * 45,
            delay: 30 + Math.min(n, 6) * 22,
            easing: ease,
            fill: 'backwards',
          },
        ),
      ),
    ]
    return () => anims.forEach((a) => a.cancel())
  }, [open])

  // Parallax close: options slide up quickly, the panel rolls up a little slower behind them.
  const close = () => {
    const list = listRef.current
    if (!open || closing.current) return
    if (!list || reduceMotion() || typeof list.animate !== 'function') {
      setQuery('')
      return setOpen(false)
    }
    closing.current = true
    const ease = 'cubic-bezier(0.4, 0, 0.6, 1)'
    Array.from(list.children).forEach((li, i) =>
      li.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: `translateY(${-(10 + i * 4)}px)` },
        ],
        {
          duration: 160,
          easing: ease,
          fill: 'forwards',
        },
      ),
    )
    list
      .animate(
        [
          {
            opacity: 1,
            transform: 'none',
            clipPath: 'inset(0 0 0% 0 round 16px)',
          },
          {
            opacity: 0,
            transform: 'translateY(-6px)',
            clipPath: 'inset(0 0 100% 0 round 16px)',
          },
        ],
        { duration: 240, easing: ease, fill: 'forwards' },
      )
      .finished.then(
        () => {
          closing.current = false
          setOpen(false)
          setQuery('')
        },
        () => undefined,
      )
  }

  // Close when tapping outside.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  })

  const choose = (v: T) => {
    onChange(v)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if ((e.key === 'Enter' || (e.key === ' ' && !(e.target instanceof HTMLInputElement))) && open) {
      e.preventDefault()
      if (options[active]) choose(options[active].value)
    }
  }

  return (
    <div ref={root} className={`relative ${open ? 'z-40' : ''}`} onKeyDown={onKeyDown}>
      <span id={`${id}-label`} className={`mb-1.5 block text-xs font-semibold tracking-wide uppercase ${t.label}`}>
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={() => {
          setActive(
            Math.max(
              0,
              options.findIndex((o) => o.value === value),
            ),
          )
          if (open) close()
          else setOpen(true)
        }}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-sm backdrop-blur-xl transition ${
          open ? t.buttonOpen : t.button
        }`}
      >
        {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-semibold ${selected ? t.text : t.placeholder}`}>{selected?.label ?? placeholder}</span>
          {selected?.description && <span className={`block truncate text-xs ${t.sub}`}>{selected.description}</span>}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${t.chevron} ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 left-0 z-40 mt-2">
          {/* The search box sits over the top of the list (outside its scroll area), so options never slide under it. */}
          {searchable && (
            <div className={`absolute inset-x-px top-px z-10 rounded-t-2xl px-1.5 pt-1.5 pb-1 ${tone === 'dark' ? 'bg-slate-900' : 'bg-white'}`}>
              <label
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${tone === 'dark' ? 'border-white/20 bg-black/30' : 'border-slate-200 bg-white'}`}
              >
                <Search className={`h-4 w-4 shrink-0 ${t.chevron}`} />
                <input
                  autoFocus
                  aria-label={searchPlaceholder}
                  placeholder={searchPlaceholder}
                  className={`w-full min-w-0 bg-transparent text-sm outline-none ${t.text} ${tone === 'dark' ? 'placeholder:text-white/40' : 'placeholder:text-slate-400'}`}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                    listRef.current?.scrollTo({ top: 0 })
                  }}
                />
              </label>
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className={`max-h-80 overflow-auto rounded-2xl border p-1.5 shadow-2xl ring-1 backdrop-blur-xl backdrop-saturate-150 ${searchable ? `pt-14 ${t.panel.replace(/bg-\S+/, tone === 'dark' ? 'bg-slate-900/95' : 'bg-white/95')}` : t.panel}`}
          >
            {searchable && options.length === 0 && (
              <li role="presentation" className={`px-3 py-4 text-center text-sm ${t.optionSub}`}>
                No match for “{query.trim()}”
              </li>
            )}
            {options.map((o, i) => {
              const isSel = o.value === value
              return (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={isSel}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(o.value)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${i === active ? t.active : ''}`}
                >
                  {o.icon && <span className="shrink-0">{o.icon}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={`block font-medium ${t.text}`}>{o.label}</span>
                    {o.description && <span className={`block text-xs ${t.optionSub}`}>{o.description}</span>}
                  </span>
                  {isSel && <Check className={`h-4 w-4 shrink-0 ${t.check}`} />}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
