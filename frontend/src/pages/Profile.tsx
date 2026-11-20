// Profile on dark glass, laid out like the login card: header, divider, menu rows.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, ClipboardList, HelpCircle, LogOut, MapPin, RefreshCw } from 'lucide-react'
import { api, errorMessage, USE_MOCK } from '../api'
import { resetMockDb } from '../api/mock'
import logo from '../assets/logo.svg'
import { GLASS, GLASS_INPUT, GlassPage } from '../components/glass'
import { Button } from '../components/ui'
import { useAddresses } from '../hooks/queries'
import { displayPhone } from '../lib/format'
import { useAuth } from '../store/auth'
import { useCart } from '../store/cart'

export default function Profile() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user, setUser, logout } = useAuth()
  const addresses = useAddresses()
  const [name, setName] = useState(user?.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const doLogout = () => {
    logout()
    useCart.getState().clear()
    qc.clear()
    navigate('/welcome', { replace: true })
  }

  const saveName = async () => {
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      setUser(await api.updateMe({ name: name.trim() }))
      setSaved(true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <GlassPage title="Profile">
      <div className="space-y-4 p-4">
        <div className={`${GLASS} relative overflow-hidden p-5`}>
          {/* Branding Gradient strip */}
          <span aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
          {/* Header */}
          <div className="flex items-center gap-4">
            <span className="rounded-full bg-white/10 p-1 ring-1 ring-white/30">
              <img src={logo} alt="" className="h-14 w-14 rounded-full" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold">{user?.name || 'Your profile'}</p>
              <p className="text-sm text-white/60">{user ? displayPhone(user.phone) : ''}</p>
            </div>
          </div>

          <hr className="my-5 border-white/20" />

          {/* Name */}
          <label className="mb-1.5 block px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase" htmlFor="pname">
            Name
          </label>
          <div className="flex gap-2">
            <input
              id="pname"
              className={`${GLASS_INPUT} min-w-0 flex-1`}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setSaved(false)
              }}
            />
            <Button loading={saving} disabled={name.trim().length < 2 || name.trim() === user?.name} onClick={saveName} className="disabled:bg-white/15 disabled:text-white/50">
              Save
            </Button>
          </div>
          {saved && <p className="mt-2 px-1 text-sm text-green-300">Saved</p>}
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-2 rounded-xl border border-red-300/40 bg-red-500/20 p-3 text-sm text-red-50">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <hr className="my-5 border-white/20" />

          {/* Menu */}
          <p className="mb-2 px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Menu</p>
          <nav className="space-y-1">
            <MenuRow to="/location" icon={<MapPin />} label="Saved locations" badge={addresses.data?.length} />
            <MenuRow to="/orders" icon={<ClipboardList />} label="My orders" />
            <MenuRow to="/help" icon={<HelpCircle />} label="Help & safety" />
          </nav>

          <hr className="my-5 border-white/20" />

          <button onClick={doLogout} className="flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-left font-medium text-red-300 hover:bg-red-500/15">
            <LogOut className="h-5 w-5" /> Log out
          </button>
          {USE_MOCK && (
            <button
              onClick={() => {
                resetMockDb()
                doLogout()
              }}
              className="mt-1 flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-left text-sm text-white/55 hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" /> Reset demo data
            </button>
          )}
        </div>
        <p className="text-center text-xs text-white/40">Gasgo v0.1.0</p>
      </div>
    </GlassPage>
  )
}

function MenuRow({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-white/30 hover:bg-white/15 [&>svg]:h-5 [&>svg]:w-5"
    >
      {icon}
      <span className="flex-1 font-medium">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold text-slate-900">{badge}</span>
      )}
      <ChevronRight className="!h-4 !w-4 text-white/50" />
    </Link>
  )
}
