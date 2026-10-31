import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Download, WifiOff, X } from 'lucide-react'
import { useAuth } from '../store/auth'
import { USE_MOCK } from '../api'
import { TAB_PATHS } from '../lib/tabs'
import { FloatingNav } from './FloatingNav'
import { PageTransition } from './PageTransition'
import { ScrollMotion } from './ScrollMotion'

/** Centers the app in a phone-width column on large screens. */
export function AppFrame() {
  const { pathname } = useLocation()
  const user = useAuth((s) => s.user)
  const showNav = user?.role === 'customer' && TAB_PATHS.includes(pathname)
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-slate-50 shadow-xl shadow-slate-300/40">
      <OfflineBanner />
      <ScrollMotion />
      {USE_MOCK && (
        <div className="bg-amber-100 px-4 py-1 text-center text-xs font-medium text-amber-900">
          Demo mode: using fake data (no real payments)
        </div>
      )}
      <PageTransition>
        <Outlet />
      </PageTransition>
      {/* Outside the page transition so it stays still while pages slide */}
      {showNav && <FloatingNav />}
    </div>
  )
}

/** Sends logged-out users to the welcome screen, and dealers to the dealer area. */
export function RequireAuth({ role }: { role: 'customer' | 'dealer' }) {
  const { access, user } = useAuth()
  const location = useLocation()
  if (!access || !user) return <Navigate to="/welcome" replace state={{ from: location.pathname }} />
  if (role === 'customer' && user.role === 'dealer') return <Navigate to="/dealer" replace />
  if (role === 'dealer' && user.role !== 'dealer') return <Navigate to="/" replace />
  return <Outlet />
}

/** Customer screens with the bottom tab bar. */
export function TabLayout() {
  return (
    <div className="flex flex-1 flex-col bg-slate-900">
      {/* The floating nav bar itself is rendered in AppFrame; GlassPage leaves room for it */}
      <main className="flex flex-1 flex-col [&>*]:flex-1">
        <Outlet />
      </main>
      <div className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md">
        <InstallPrompt />
      </div>
    </div>
  )
}

function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (online) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-slate-800 px-4 py-2 text-sm text-white" role="status">
      <WifiOff className="h-4 w-4" /> You're offline. We'll reconnect automatically.
    </div>
  )
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

/** "Add Gasgo to your home screen" banner (Android/Chrome; iPhone users use Share → Add to Home Screen). */
function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])
  if (!event || hidden) return null
  return (
    <div className="mx-4 mb-3 flex items-center gap-3 rounded-xl bg-ink p-3 text-sm text-white">
      <Download className="h-5 w-5 shrink-0" />
      <span className="flex-1">Add Gasgo to your home screen for faster ordering.</span>
      <button
        className="rounded-lg bg-brand-500 px-3 py-1.5 font-semibold"
        onClick={async () => {
          await event.prompt()
          setEvent(null)
        }}
      >
        Install
      </button>
      <button aria-label="Dismiss" onClick={() => setHidden(true)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
