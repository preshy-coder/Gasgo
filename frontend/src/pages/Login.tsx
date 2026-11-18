// Phone number → SMS code → (new users) name → (vendors) shop details. No passwords.
// Opened from the landing page as /login?as=client or /login?as=vendor.
// Design: a dark frosted-glass "window" card over the cylinder photo, with the three steps shown as a menu.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Check, KeyRound, Loader2, Smartphone, Store, UserRound } from 'lucide-react'
import { api, errorMessage, USE_MOCK } from '../api'
import { MOCK_DEALER_PHONE, MOCK_OTP } from '../api/mock'
import heroCylinder from '../assets/hero-cylinder.jpg'
import logo from '../assets/logo.svg'
import { MapPicker } from '../components/MapPicker'
import { displayPhone, normalizePhone } from '../lib/format'
import type { LatLng } from '../lib/location'
import { OUTSIDE_AREA_MESSAGE, SERVICE_AREA, isInServiceArea } from '../lib/serviceArea'
import { useScrollParallax } from '../hooks/useScrollParallax'
import { useAuth } from '../store/auth'

type Step = 'phone' | 'code' | 'name' | 'shop'

const CLIENT_STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: 'phone', label: 'Phone number', icon: <Smartphone /> },
  { id: 'code', label: 'Verification code', icon: <KeyRound /> },
  { id: 'name', label: 'Your name', icon: <UserRound /> },
]
const VENDOR_STEPS = [...CLIENT_STEPS, { id: 'shop' as Step, label: 'Shop details', icon: <Store /> }]

const HOURS = ['Mon–Sun 7:00–21:00', 'Mon–Sat 7:00–20:00', '24 hours']
const RADII = [3, 5, 8, 10]

const INPUT =
  'w-full rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-lg text-white outline-none placeholder:text-white/35 focus:border-brand-400 focus:bg-white/15 focus:ring-4 focus:ring-brand-500/25'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSession = useAuth((s) => s.setSession)
  const setUser = useAuth((s) => s.setUser)
  const bgRef = useScrollParallax<HTMLDivElement>(0.45)
  const isVendor = useSearchParams()[0].get('as') === 'vendor'
  const STEPS = isVendor ? VENDOR_STEPS : CLIENT_STEPS

  const [step, setStep] = useState<Step>('phone')
  const [phoneInput, setPhoneInput] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  // Vendor shop details
  const [shopName, setShopName] = useState('')
  const [shopPos, setShopPos] = useState<LatLng>(SERVICE_AREA.center)
  const [shopAddress, setShopAddress] = useState('')
  const [shopLandmark, setShopLandmark] = useState('')
  const [hours, setHours] = useState(HOURS[0])
  const [radius, setRadius] = useState(5)
  const onShopAddress = useCallback((a: string) => setShopAddress(a), [])

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const finish = (role: string) => {
    const from = (location.state as { from?: string } | null)?.from
    navigate(role === 'dealer' ? '/dealer' : from && from !== '/welcome' ? from : '/', { replace: true })
  }

  const sendCode = async () => {
    setError('')
    const normalized = normalizePhone(phoneInput)
    if (!normalized) return setError('Enter a valid Safaricom or Airtel number, e.g. 0712 345 678.')
    setBusy(true)
    try {
      const res = await api.requestOtp(normalized)
      setPhone(normalized)
      // Demo mode (no SMS yet): the server sends the code back and we fill it in quietly.
      if (res?.demo_code) setCode(res.demo_code)
      setStep('code')
      setResendIn(60)
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const verify = async () => {
    setError('')
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code.')
    setBusy(true)
    try {
      const res = await api.verifyOtp(phone, code)
      setSession(res.access, res.refresh, res.user)
      if (res.is_new_user || !res.user.name) setStep('name')
      // Joining as a vendor with an account that has no shop yet: go on to the shop details.
      else if (isVendor && res.user.role !== 'dealer') setStep('shop')
      else finish(res.user.role)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saveName = async () => {
    setError('')
    if (name.trim().length < 2) return setError('Please enter your name.')
    setBusy(true)
    try {
      const user = await api.updateMe({ name: name.trim() })
      setUser(user)
      if (isVendor && user.role !== 'dealer') setStep('shop')
      else finish(user.role)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saveShop = async () => {
    setError('')
    if (shopName.trim().length < 2) return setError('Enter the name of your shop.')
    if (!isInServiceArea(shopPos)) return setError(OUTSIDE_AREA_MESSAGE)
    if (shopAddress.trim().length < 3) return setError('Enter the shop’s address, e.g. estate and road.')
    setBusy(true)
    try {
      const res = await api.registerVendor({
        shop_name: shopName.trim(),
        address: shopAddress.trim(),
        landmark_notes: shopLandmark.trim(),
        lat: Number(shopPos.lat.toFixed(6)),
        lng: Number(shopPos.lng.toFixed(6)),
        opening_hours: hours,
        delivery_radius_km: radius,
      })
      setUser(res.user)
      // New shops go straight to the Stock screen to add the gas types they sell.
      navigate('/dealer/stock?new=1', { replace: true })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step)
  const back = () => {
    setError('')
    if (step === 'code') setStep('phone')
    else navigate('/welcome')
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-slate-900">
      {/* Background: the same cylinder photo as the landing page, darkened so the glass card stands out */}
      <div ref={bgRef} className="absolute inset-0 will-change-transform" aria-hidden>
        <img src={heroCylinder} alt="" className="h-full w-full scale-110 object-cover object-[50%_30%] blur-[2px]" />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(150deg,rgba(0,0,0,0.88)_0%,rgba(40,5,2,0.75)_50%,rgba(0,0,0,0.94)_100%)]" aria-hidden />

      <div className="relative flex flex-1 items-start justify-center px-4 py-6">
        <form
          noValidate
          className="motion-item w-full max-w-sm overflow-hidden rounded-[28px] border border-white/25 bg-black/30 text-white shadow-2xl shadow-black/50 backdrop-blur-2xl backdrop-saturate-150"
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 'phone') sendCode()
            else if (step === 'code') verify()
            else if (step === 'name') saveName()
            else saveShop()
          }}
        >
          {/* Window bar */}
          {/* Branding Gradient strip across the top of the card */}
          <span aria-hidden className="bg-brand-gradient block h-1" />

          <div className="px-5 pt-5 pb-4">
            {/* Profile-style header */}
            <div className="flex items-center gap-4">
              <span className="rounded-full bg-white/10 p-1 ring-1 ring-white/30">
                <img src={logo} alt="" className="h-14 w-14 rounded-full" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {step === 'name' ? 'Welcome!' : step === 'shop' ? 'Your shop' : isVendor ? 'Gasgo for vendors' : 'Gasgo'}
                </h1>
                <p className="truncate text-sm text-white/60">
                  {step === 'phone' && (isVendor ? 'Register your gas shop' : 'Log in or sign up')}
                  {step === 'code' && `Code sent to ${displayPhone(phone)}`}
                  {step === 'name' && (isVendor ? 'Your name as the shop owner' : 'One last thing')}
                  {step === 'shop' && 'Where customers will find you'}
                </p>
              </div>
            </div>

            <hr className="my-5 border-white/20" />

            {/* Steps, styled like a menu: the current one sits in a glass pill */}
            <p className="mb-2 px-3 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">{isVendor ? 'Join as a vendor' : 'Sign in'}</p>
            <ol className="space-y-1">
              {STEPS.map((s, i) => {
                const current = i === stepIndex
                const done = i < stepIndex
                return (
                  <li
                    key={s.id}
                    aria-current={current ? 'step' : undefined}
                    className={`flex items-center gap-3.5 rounded-xl px-3 py-2.5 transition-colors [&>svg]:h-5 [&>svg]:w-5 ${
                      current ? 'border border-white/35 bg-white/15 shadow-inner shadow-white/10' : 'border border-transparent'
                    } ${!current && !done ? 'text-white/45' : ''}`}
                  >
                    {s.icon}
                    <span className="flex-1 font-medium">{s.label}</span>
                    {done && (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-slate-900">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {s.id === 'name' && !current && !done && <span className="text-xs text-white/40">new accounts</span>}
                  </li>
                )
              })}
            </ol>

            {/* The input for the current step */}
            <div className="mt-4 space-y-2">
              {step === 'phone' && (
                <>
                  <label className="block px-1 text-sm text-white/75" htmlFor="phone">
                    Your M-Pesa phone number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    autoFocus
                    className={INPUT}
                    placeholder="0712 345 678"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  <p className="px-1 text-xs text-white/50">We'll send you a 6-digit code by SMS.</p>
                </>
              )}

              {step === 'code' && (
                <>
                  <label className="block px-1 text-sm text-white/75" htmlFor="otp">
                    Verification code
                  </label>
                  <input
                    id="otp"
                    ref={codeRef}
                    aria-label="6-digit code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className={`${INPUT} text-center font-mono text-2xl tracking-[0.5em]`}
                    placeholder="······"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    type="button"
                    disabled={resendIn > 0 || busy}
                    className="px-1 text-sm font-semibold text-brand-300 disabled:text-white/40"
                    onClick={sendCode}
                  >
                    {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                  </button>
                </>
              )}

              {step === 'name' && (
                <>
                  <label className="block px-1 text-sm text-white/75" htmlFor="name">
                    What should we call you?
                  </label>
                  <input
                    id="name"
                    autoFocus
                    autoComplete="name"
                    className={INPUT}
                    placeholder="e.g. Wanjiku Kamau"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  <p className="px-1 text-xs text-white/50">
                    {isVendor ? 'Customers see this name when they call your shop.' : 'Dealers see this name on your order.'}
                  </p>
                </>
              )}

              {step === 'shop' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block px-1 text-sm text-white/75" htmlFor="shop">
                      Shop name
                    </label>
                    <input
                      id="shop"
                      autoFocus
                      className={INPUT}
                      placeholder="e.g. Highpoint Gas Centre"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p className="px-1 text-sm text-white/75">Exact shop location</p>
                    <p className="px-1 text-xs text-white/50">
                      Drop the pin on your shop. Customers use it for pickup directions and to see how far you are.
                    </p>
                    <MapPicker
                      value={shopPos}
                      onChange={(pos) => {
                        setShopPos(pos)
                        setError('')
                      }}
                      onAddress={onShopAddress}
                    />
                    {!isInServiceArea(shopPos) && (
                      <p className="flex items-start gap-2 rounded-xl border border-red-400/70 bg-[#3a0806]/90 p-3 text-sm text-white">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" /> {OUTSIDE_AREA_MESSAGE}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block px-1 text-sm text-white/75" htmlFor="shopaddr">
                      Shop address
                    </label>
                    <input
                      id="shopaddr"
                      className={INPUT}
                      placeholder="e.g. Highpoint, Juja, along Gachororo Rd"
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                    />
                    <input
                      id="shoplandmark"
                      aria-label="Landmark (optional)"
                      className={`${INPUT} text-base`}
                      placeholder="Landmark (optional), e.g. next to Naivas"
                      value={shopLandmark}
                      onChange={(e) => setShopLandmark(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <p className="px-1 text-sm text-white/75">Opening hours</p>
                    <div className="flex flex-wrap gap-2">
                      {HOURS.map((h) => (
                        <Chip key={h} active={hours === h} onClick={() => setHours(h)}>
                          {h}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="px-1 text-sm text-white/75">How far do you deliver?</p>
                    <div className="flex flex-wrap gap-2">
                      {RADII.map((r) => (
                        <Chip key={r} active={radius === r} onClick={() => setRadius(r)}>
                          {r} km
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300/40 bg-red-500/20 p-3 text-sm text-red-50">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={busy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 bg-brand-button py-3.5 font-semibold text-white shadow-lg shadow-black/30 transition hover:brightness-110 disabled:opacity-70"
            >
              {busy && <Loader2 className="h-5 w-5 animate-spin" />}
              {step === 'phone' ? 'Send code' : step === 'code' ? 'Verify' : step === 'shop' ? 'Register my shop' : 'Continue'}
            </button>

            <hr className="my-5 border-white/20" />

            {/* Notice card */}
            <div className="relative h-28 overflow-hidden rounded-2xl border border-white/20" hidden={step === 'shop'}>
              <img src={heroCylinder} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_35%]" />
              <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/0" />
              <div className="relative flex h-full flex-col justify-center px-4 text-slate-900">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase">Now serving</p>
                <p className="text-2xl leading-tight font-extrabold tracking-tight">JUJA</p>
                <p className="text-xs text-slate-600">Kiambu County · Delivery & pickup</p>
              </div>
            </div>

            {USE_MOCK && (step === 'phone' || step === 'code') && (
              <p className="mt-3 rounded-xl border border-amber-200/30 bg-amber-300/15 px-3 py-2 text-xs text-amber-50">
                {step === 'phone'
                  ? isVendor
                    ? 'Demo: use any new number to register a shop.'
                    : `Demo: any number logs in as a customer. ${displayPhone(MOCK_DEALER_PHONE)} logs in as a dealer.`
                  : `Demo code: ${MOCK_OTP}`}
              </p>
            )}

            {(step === 'phone' || step === 'code') && <hr className="my-4 border-white/20" />}

            {(step === 'phone' || step === 'code') && (
              <button type="button" onClick={back} className="flex w-full items-center gap-3.5 rounded-xl px-3 py-2 text-left font-medium text-white/85 hover:bg-white/10">
                <ArrowLeft className="h-5 w-5" />
                {step === 'code' ? 'Change phone number' : 'Back'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-transparent bg-brand-600 bg-brand-button text-white shadow-md shadow-black/30' : 'border-white/25 bg-white/10 text-white/80 hover:bg-white/15'
      }`}
    >
      {children}
    </button>
  )
}
