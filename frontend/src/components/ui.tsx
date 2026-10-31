// Small reusable building blocks used across all screens.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import type { OrderStatus } from '../types'
import { STATUS_LABEL, statusTone } from '../lib/format'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'mpesa'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 bg-brand-button text-white hover:brightness-110 disabled:bg-none disabled:bg-brand-200',
  secondary: 'bg-white text-ink border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
  mpesa: 'bg-mpesa text-white hover:bg-green-700 disabled:bg-green-200',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  full?: boolean
}

export function Button({ variant = 'primary', loading, full, className = '', children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${full ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`motion-item rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500" role="status">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200" role="alert">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
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

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-brand-50 p-4 text-brand-600">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1 text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** Top bar with an optional back arrow. */
export function PageHeader({ title, back, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      {back && (
        <button
          aria-label="Go back"
          className="-ml-2 rounded-full p-2 hover:bg-slate-100"
          onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}
      <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
      {right}
    </header>
  )
}

const TONE: Record<ReturnType<typeof statusTone>, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  progress: 'bg-brand-100 text-brand-700',
  success: 'bg-green-100 text-green-700',
  danger: 'bg-red-100 text-red-700',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[statusTone(status)]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

/** Fixed bottom area for the main action on a screen. */
export function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="pb-safe sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 pt-3">{children}</div>
  )
}

export function Stepper({ value, onChange, max = 10 }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      <button
        aria-label="Decrease"
        className="h-9 w-9 rounded-full border border-slate-300 text-lg font-semibold disabled:opacity-30"
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <span className="w-7 text-center font-semibold tabular-nums">{value}</span>
      <button
        aria-label="Increase"
        className="h-9 w-9 rounded-full bg-brand-600 bg-brand-button text-lg font-semibold text-white disabled:opacity-30"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}
