// Help: contact, FAQ and gas safety on dark glass.
import { ChevronDown, MessageCircle, Phone, ShieldAlert } from 'lucide-react'
import { GLASS, GlassPage } from '../components/glass'
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from '../config'

const FAQ = [
  {
    q: "What's the difference between a refill and a new cylinder?",
    a: 'A refill swaps your empty cylinder for a full one of the same brand and size. A new cylinder is for first-time buyers: you get the cylinder and the gas.',
  },
  { q: 'How do I pay?', a: "With M-Pesa. After you place the order, you'll get a prompt on your phone. Enter your PIN to pay." },
  {
    q: 'What if the dealer can’t fulfil my order?',
    a: "If a dealer rejects a paid order, your money is refunded to your M-Pesa. Contact us if it hasn't arrived within 24 hours.",
  },
  { q: 'Can I cancel an order?', a: 'Yes, until the dealer accepts it. Open the order and tap “Cancel order”.' },
  { q: 'Where do you deliver?', a: 'Anywhere in Kenya where a Gasgo shop is nearby. Each shop sets how far it delivers, and you’ll see the shops that can reach your pin. You can also pick up from any shop.' },
]

const SAFETY = [
  'If you smell gas, close the cylinder valve, open doors and windows, and don’t switch lights or appliances on or off.',
  'Never use a flame to check for leaks. Brush soapy water on the joints: bubbles mean a leak.',
  'Keep the cylinder upright, in a ventilated place, away from heat and direct sunlight.',
  'Check the hose regularly and replace it if it is cracked or hard.',
  'Turn off the cylinder valve when you are not cooking.',
]

export default function Help() {
  return (
    <GlassPage title="Help">
      <div className="space-y-5 p-4">
        <div className="grid grid-cols-2 gap-3">
          <a href={`tel:+${SUPPORT_PHONE}`} className={`${GLASS} flex flex-col items-center gap-2 p-4 transition-colors hover:bg-white/15`}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <Phone className="h-5 w-5 text-brand-300" />
            </span>
            <span className="font-semibold">Call us</span>
          </a>
          <a
            href={`https://wa.me/${SUPPORT_WHATSAPP}`}
            target="_blank"
            rel="noreferrer"
            className={`${GLASS} flex flex-col items-center gap-2 p-4 transition-colors hover:bg-white/15`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10">
              <MessageCircle className="h-5 w-5 text-green-400" />
            </span>
            <span className="font-semibold">WhatsApp</span>
          </a>
        </div>

        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">Questions</h2>
          <div className="space-y-2">
            {FAQ.map((f) => (
              <details key={f.q} className={`${GLASS} group p-4 open:bg-white/15`}>
                <summary className="flex cursor-pointer list-none items-center gap-3 font-medium [&::-webkit-details-marker]:hidden">
                  <span className="flex-1">{f.q}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-white/60 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-white/75">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold tracking-[0.18em] text-white/60 uppercase">
            <ShieldAlert className="h-4 w-4 text-red-400" /> Gas safety
          </h2>
          <div className={`${GLASS} border-red-300/30 p-4`}>
            <ul className="space-y-3 text-sm text-white/85">
              {SAFETY.map((s) => (
                <li key={s} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </GlassPage>
  )
}
