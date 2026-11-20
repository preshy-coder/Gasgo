// Landing page: the cylinder photo fills the screen and the text sits on frosted-glass panels.
import { Link, Navigate } from 'react-router-dom'
import { ChevronRight, Clock, Flame, MapPin, Smartphone, Store } from 'lucide-react'
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
        <div className="motion-item relative mt-auto overflow-hidden rounded-3xl border border-white/20 bg-black/55 p-5 shadow-2xl shadow-black/30 backdrop-blur-xl backdrop-saturate-150">
          {/* Branding Gradient strip */}
          <span aria-hidden className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5" /> Delivery &amp; pickup across Kenya
          </p>
          <h1 className="mt-3 text-[28px] leading-tight font-bold tracking-tight text-balance">Cooking gas, delivered to your door</h1>
          <p className="mt-2 text-white/80">Order a refill or a new cylinder and pay with M-Pesa. Gas shops: get orders from customers near you.</p>

          <ul className="mt-5 grid grid-cols-3 gap-2">
            <Feature icon={<MapPin />} title="Drop a pin" />
            <Feature icon={<Smartphone />} title="Pay with M-Pesa" />
            <Feature icon={<Clock />} title="Track it live" />
          </ul>

          {/* Two ways in: customers (clients) and gas shops (vendors) */}
          <p className="mt-6 mb-2.5 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Join Gasgo</p>
          <div className="grid grid-cols-2 gap-3">
            <JoinOption
              to="/login?as=client"
              primary
              icon={<Flame />}
              title="I need gas"
              text="Join as a client"
            />
            <JoinOption to="/login?as=vendor" icon={<Store />} title="I sell gas" text="Join as a vendor" />
          </div>
          <p className="mt-4 text-center text-sm text-white/70">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-white underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-1 py-2.5 text-center">
      <span className="text-brand-300 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
      <span className="text-[11px] leading-tight font-semibold text-white/85">{title}</span>
    </li>
  )
}

function JoinOption({ to, icon, title, text, primary }: { to: string; icon: React.ReactNode; title: string; text: string; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`group flex flex-col gap-3 rounded-2xl p-4 transition [&_svg]:h-5 [&_svg]:w-5 ${
        primary
          ? 'bg-brand-600 bg-brand-button text-white shadow-lg shadow-black/40 hover:brightness-110'
          : 'border border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/15'
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${primary ? 'bg-white/20' : 'border border-white/20 bg-white/10 text-brand-300'}`}>
        {icon}
      </span>
      <span>
        <span className="block text-base leading-tight font-bold">{title}</span>
        <span className={`mt-0.5 flex items-center gap-0.5 text-xs ${primary ? 'text-white/85' : 'text-white/65'}`}>
          {text}
          <ChevronRight className="!h-3.5 !w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  )
}
