// Landing page: the cylinder photo fills the screen and the text sits on frosted-glass panels.
import { Link, Navigate } from 'react-router-dom'
import { Clock, MapPin, Smartphone } from 'lucide-react'
import heroCylinder from '../assets/hero-cylinder.jpg'
import logo from '../assets/logo.svg'
import { useScrollParallax } from '../hooks/useScrollParallax'
import { useAuth } from '../store/auth'

export default function Welcome() {
  const user = useAuth((s) => s.user)
  const bgRef = useScrollParallax<HTMLDivElement>(0.45)
  if (user) return <Navigate to={user.role === 'dealer' ? '/dealer' : '/'} replace />

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-700 text-white">
      {/* Background photo */}
      <div ref={bgRef} className="absolute inset-0 will-change-transform" aria-hidden>
        <img src={heroCylinder} alt="" className="h-full w-full scale-105 object-cover object-[50%_30%]" />
      </div>
      {/* Darken the lower part so the glass panels and white text stay readable */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.15)_40%,rgba(0,0,0,0.85)_100%)]" aria-hidden />

      <div className="relative flex flex-1 flex-col px-5 pt-6 pb-8">
        {/* Brand pill */}
        <div className="motion-item flex w-fit items-center gap-2.5 rounded-2xl border border-white/30 bg-white/15 py-2 pr-4 pl-2 shadow-lg backdrop-blur-md">
          <img src={logo} alt="" className="h-9 w-9 rounded-xl" />
          <span className="text-xl font-bold tracking-tight">Gasgo</span>
        </div>

        {/* Main glass panel */}
        <div className="motion-item relative mt-auto overflow-hidden rounded-3xl border border-white/20 bg-black/55 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl backdrop-saturate-150">
          {/* Branding Gradient strip */}
          <span aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5" /> Now serving Juja, Kiambu County
          </p>
          <h1 className="mt-4 text-3xl leading-tight font-bold tracking-tight text-balance">Cooking gas to your door in Juja</h1>
          <p className="mt-2 text-white/80">Order a refill or a new cylinder, pay with M-Pesa, or pick up from a dealer near you.</p>

          <ul className="mt-6 space-y-3.5">
            <Feature icon={<MapPin />} title="Drop a pin" text="We find dealers near you with gas in stock." />
            <Feature icon={<Smartphone />} title="Pay with M-Pesa" text="Confirm with your PIN, no cash needed." />
            <Feature icon={<Clock />} title="Track every step" text="From the dealer to your doorstep." />
          </ul>

          <Link
            to="/login"
            className="mt-7 block w-full rounded-2xl bg-brand-600 bg-brand-button py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-brand-900/30 transition hover:brightness-110"
          >
            Get started
          </Link>
          <p className="mt-3 text-center text-xs text-white/70">Log in or sign up with your phone number.</p>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </span>
      <div>
        <p className="leading-tight font-semibold">{title}</p>
        <p className="text-sm text-white/75">{text}</p>
      </div>
    </li>
  )
}
