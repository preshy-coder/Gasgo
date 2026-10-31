// Shared frame for the vendor (dealer) screens: dark glass page with the shop name,
// a log out button, and the Orders | Stock switch.
import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ClipboardList, LogOut, Package } from 'lucide-react'
import { GlassPage } from './glass'
import { useMyShop } from '../hooks/queries'
import { useAuth } from '../store/auth'

export function DealerShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const logout = useAuth((s) => s.logout)
  const shop = useMyShop()

  return (
    <GlassPage
      nav={false}
      title={shop.data?.name ?? 'Your shop'}
      right={
        <button
          aria-label="Log out"
          className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white"
          onClick={() => {
            logout()
            qc.clear()
            navigate('/welcome', { replace: true })
          }}
        >
          <LogOut className="h-5 w-5" />
        </button>
      }
    >
      <div className="px-4 pt-4">
        <nav aria-label="Vendor" className="grid grid-cols-2 gap-1 rounded-2xl border border-white/20 bg-white/10 p-1 backdrop-blur-xl">
          <DealerTab to="/dealer" icon={<ClipboardList className="h-4 w-4" />} label="Orders" />
          <DealerTab to="/dealer/stock" icon={<Package className="h-4 w-4" />} label="Stock" />
        </nav>
      </div>
      {children}
    </GlassPage>
  )
}

function DealerTab({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
          isActive ? 'border border-white/30 bg-white/20 text-white shadow-inner shadow-white/10' : 'border border-transparent text-white/60 hover:text-white'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  )
}
