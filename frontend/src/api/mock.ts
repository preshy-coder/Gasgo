// A fake backend that runs in the browser, so the frontend works before the Django API is ready.
// Data is kept in localStorage under "gasgo-mock-db". Clear it from the Profile page (Reset demo data).
//
// Demo rules:
//   - The OTP code is always 123456.
//   - Phone 0700 000 001 logs in as a dealer (Gasgo Demo Dealer, Nairobi CBD).
//   - Each shop lists its own gas types, prices and stock (vendors manage them on the Stock screen).
//   - Delivery addresses and shop pins must be in Kenya (see src/lib/serviceArea.ts).
//   - Any other phone logs in as a customer.
//   - Paid orders not accepted within 3 minutes are cancelled (dealer timeout); refunds for
//     rejected/cancelled paid orders arrive ~8 seconds later (status "refunded").
//   - M-Pesa payments succeed ~4 seconds after the STK push,
//     except numbers ending in 0000, which fail (to test the failure screen).
import { useAuth } from '../store/auth'
import type {
  AccessoryKind,
  Address,
  Dealer,
  DealerAccessory,
  DealerPerformance,
  OrderAccessory,
  DealerStock,
  StockItem,
  Order,
  OrderStatus,
  Product,
  Quote,
  QuoteRequest,
  User,
} from '../types'
import { ApiError, type GasgoApi } from './types'
import { OUTSIDE_AREA_MESSAGE, isInServiceArea } from '../lib/serviceArea'

export const MOCK_OTP = '123456'
export const MOCK_DEALER_PHONE = '254700000001'
const PAYMENT_DELAY_MS = 4000
/** Demo: a paid order the dealer hasn't accepted after this long is cancelled automatically. */
const DEALER_TIMEOUT_MS = 3 * 60_000
/** Demo: how long after a rejection/cancellation the M-Pesa refund "arrives". */
const REFUND_DELAY_MS = 8000
const KEY = 'gasgo-mock-db-v7' // bump the version when the seed data changes

interface MockOrder extends Order {
  customer_id: number
  payment_started_at: number | null
  payment_phone: string | null
  refund_due_at?: number | null
}

interface MockDb {
  users: User[]
  addresses: (Address & { user_id: number })[]
  products: Product[]
  dealers: Dealer[]
  orders: MockOrder[]
  nextId: number
}

// Sample brands and prices for the demo (approximate, not live prices).
// refill = price per kg for a refill; cyl = extra for a new cylinder of each size.
const BRANDS: { brand: string; perKg: number; sizes: number[] }[] = [
  { brand: 'K-Gas', perKg: 223, sizes: [3, 6, 13, 22.5, 50] },
  { brand: 'Total Gas', perKg: 231, sizes: [3, 6, 13, 22.5, 35, 50] },
  { brand: 'ProGas', perKg: 219, sizes: [6, 13, 22.5, 50] },
  { brand: 'Shell Afrigas', perKg: 215, sizes: [6, 13, 35] },
  { brand: 'Hashi Gas', perKg: 211, sizes: [3, 6, 13] },
  { brand: 'Taifa Gas', perKg: 214, sizes: [6, 13] },
  { brand: 'Oryx Gas', perKg: 226, sizes: [6, 13, 50] },
  { brand: 'Lake Gas', perKg: 208, sizes: [6, 13] },
  { brand: 'SupaGas', perKg: 205, sizes: [3, 6, 13] },
  { brand: 'MenGas', perKg: 209, sizes: [6, 13] },
]
const CYLINDER_COST: Record<number, number> = { 3: 1800, 6: 2900, 13: 4700, 22.5: 6800, 35: 9500, 50: 12500 }

const round50 = (n: number) => Math.round(n / 50) * 50

const PRODUCTS: Product[] = (() => {
  let id = 1
  return BRANDS.flatMap((b) =>
    b.sizes.flatMap((size) => {
      const refill = round50(b.perKg * size)
      return [
        { id: id++, brand: b.brand, size_kg: size, type: 'refill' as const, price_kes: refill, image_url: null, is_active: true },
        { id: id++, brand: b.brand, size_kg: size, type: 'new_cylinder' as const, price_kes: refill + CYLINDER_COST[size], image_url: null, is_active: true },
      ]
    }),
  )
})()

const productKey = (p: Pick<Product, 'brand' | 'size_kg' | 'type'>) => `${p.brand}|${p.size_kg}|${p.type}`

/**
 * Builds a shop's stock list: every size/type of the given brands (optionally only some sizes),
 * at the reference price plus `offset` KES. `tweak` sets the quantity of a few items,
 * keyed "Brand|size|type", e.g. { 'K-Gas|6|new_cylinder': 2 }. `fee` is the delivery fee (KES 100 more
 * for 22.5 kg and up); `free` picks gas types delivered for free.
 */
function stockFor(
  brands: string[],
  qty: number,
  offset = 0,
  opts: { refillOnly?: boolean; sizes?: number[]; tweak?: Record<string, number>; fee?: number; free?: (p: Product) => boolean } = {},
) {
  return PRODUCTS.filter(
    (p) => brands.includes(p.brand) && (!opts.refillOnly || p.type === 'refill') && (!opts.sizes || opts.sizes.includes(p.size_kg)),
  ).map((p) => ({
    product_id: p.id,
    quantity: opts.tweak?.[productKey(p)] ?? qty,
    price_kes: p.price_kes + offset,
    // Each gas type has its own delivery fee: bigger cylinders cost more to deliver, and some are delivered free.
    delivery_fee_kes: opts.free?.(p) ? 0 : (opts.fee ?? 150) + (p.size_kg >= 22.5 ? 100 : 0),
  }))
}

const acc = (regulator: number | null, hosePerM: number | null, lighter: number | null, grill: number | null, out: AccessoryKind[] = []): DealerAccessory[] =>
  (
    [
      ['regulator', regulator],
      ['hose', hosePerM],
      ['lighter', lighter],
      ['grill', grill],
    ] as const
  )
    .filter(([, price]) => price !== null)
    .map(([kind, price]) => ({ kind, price_kes: price!, in_stock: !out.includes(kind) }))

// Demo dealers around Nairobi and Thika Road (fictional names, approximate locations).
const DEALERS: Dealer[] = [
  { id: 1, name: 'Gasgo Demo Dealer', phone: '254700000001', lat: -1.2841, lng: 36.8233, address: 'Moi Avenue, Nairobi CBD', opening_hours: 'Mon–Sun 7:00–21:00', delivery_radius_km: 8, is_open: true, stock: stockFor(['K-Gas', 'Total Gas', 'ProGas', 'Shell Afrigas'], 12, 0, { tweak: { 'K-Gas|6|new_cylinder': 2, 'ProGas|22.5|new_cylinder': 0 }, fee: 150, free: (p) => p.size_kg === 13 && p.type === 'refill' }), accessories: acc(1200, 150, 250, 1800) },
  { id: 2, name: 'Westlands Gas Point', phone: '254711000002', lat: -1.2676, lng: 36.8108, address: 'Woodvale Grove, Westlands', opening_hours: 'Mon–Sat 7:30–20:00', delivery_radius_km: 6, is_open: true, stock: stockFor(['K-Gas', 'ProGas', 'Hashi Gas', 'Oryx Gas'], 6, -50, { refillOnly: true, sizes: [3, 6, 13], fee: 200 }), accessories: acc(1100, 180, null, null) },
  { id: 3, name: 'Kilimani Gas Centre', phone: '254722000003', lat: -1.2921, lng: 36.7856, address: 'Argwings Kodhek Rd, Kilimani', opening_hours: 'Mon–Sun 6:30–22:00', delivery_radius_km: 7, is_open: true, stock: stockFor(['Total Gas', 'K-Gas', 'Shell Afrigas', 'Taifa Gas', 'SupaGas'], 9, 50, { fee: 120, free: (p) => p.type === 'new_cylinder' }), accessories: acc(1350, 160, 300, 2100, ['grill']) },
  { id: 4, name: 'Ruiru Gas Shop', phone: '254744000005', lat: -1.146, lng: 36.96, address: 'Ruiru Town, off Thika Rd', opening_hours: 'Mon–Sun 7:00–20:00', delivery_radius_km: 10, is_open: true, stock: stockFor(['ProGas', 'Hashi Gas', 'Lake Gas', 'MenGas'], 5, -30, { fee: 100 }), accessories: acc(1000, 120, 200, null) },
  { id: 5, name: 'Thika Energies', phone: '254733000004', lat: -1.0333, lng: 37.0693, address: 'Kenyatta Hwy, Thika', opening_hours: 'Mon–Sat 8:00–19:00', delivery_radius_km: 8, is_open: false, stock: stockFor(['K-Gas', 'Total Gas'], 4, 0, { fee: 150 }), accessories: [] },
]

const ACCESSORY_NAMES: Record<AccessoryKind, string> = { regulator: 'Gas regulator', hose: 'Gas hose pipe', lighter: 'Gas lighter', grill: 'Gas grill' }

/** Demo sales history for the demo dealer: ~6 months of completed orders, so the Performance page has data (and a period to compare with). */
function seedHistory(nextId: () => number): MockOrder[] {
  const dealer = DEALERS[0]
  let r = 7
  const rand = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646 // fixed sequence, same every reset
  const day = 86_400_000
  const orders: MockOrder[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let d = 185; d >= 1; d--) {
    const weekday = new Date(today.getTime() - d * day).getDay()
    // Busier on weekends and growing slowly over time.
    const n = Math.floor(rand() * 3 + (weekday === 0 || weekday === 6 ? 2 : 1) + (185 - d) / 80)
    for (let k = 0; k < n; k++) {
      const st = dealer.stock[Math.floor(rand() * dealer.stock.length)]
      const product = PRODUCTS.find((p) => p.id === st.product_id)!
      if (product.size_kg > 13 && rand() < 0.7) continue // big cylinders sell less often
      const quantity = rand() < 0.85 ? 1 : 2
      const delivery = rand() < 0.7
      const accessories: OrderAccessory[] = []
      if (rand() < 0.2) accessories.push({ kind: 'regulator', name: ACCESSORY_NAMES.regulator, quantity: 1, length_m: null, unit_price_kes: 1200, total_kes: 1200 })
      if (rand() < 0.15) accessories.push({ kind: 'hose', name: ACCESSORY_NAMES.hose, quantity: 1, length_m: 2, unit_price_kes: 300, total_kes: 300 })
      if (rand() < 0.1) accessories.push({ kind: 'lighter', name: ACCESSORY_NAMES.lighter, quantity: 1, length_m: null, unit_price_kes: 250, total_kes: 250 })
      const at = new Date(today.getTime() - d * day + (8 + rand() * 12) * 3_600_000).toISOString()
      const subtotal = st.price_kes * quantity
      const accessoriesKes = accessories.reduce((s, a) => s + a.total_kes, 0)
      const fee = delivery ? st.delivery_fee_kes : 0
      const id = nextId()
      orders.push({
        id,
        order_number: `GG-${String(10000 + id).slice(-5)}`,
        type: delivery ? 'delivery' : 'pickup',
        status: delivery ? 'delivered' : 'collected',
        items: [{ product: { ...product, price_kes: st.price_kes }, quantity, unit_price_kes: st.price_kes }],
        accessories,
        dealer,
        address: delivery ? { id: 0, label: 'Home', lat: -1.29, lng: 36.82, formatted_address: 'Nairobi', landmark_notes: '' } : null,
        customer: { name: ['Achieng O.', 'Kamau M.', 'Wanjiru N.', 'Otieno J.', 'Mutua K.', 'Njeri W.'][Math.floor(rand() * 6)], phone: '254712000111' },
        subtotal_kes: subtotal,
        accessories_kes: accessoriesKes,
        delivery_fee_kes: fee,
        service_fee_kes: SERVICE_FEE_KES,
        total_kes: subtotal + accessoriesKes + fee + SERVICE_FEE_KES,
        mpesa_receipt: `S${id}DEMO`,
        cancellation_reason: null,
        customer_confirmed_at: at,
        funds_released_at: at,
        status_history: [
          { status: 'placed', at },
          { status: 'paid', at },
          { status: 'accepted', at },
          { status: delivery ? 'out_for_delivery' : 'ready_for_pickup', at },
          { status: delivery ? 'delivered' : 'collected', at },
        ],
        created_at: at,
        customer_id: 2,
        payment_started_at: null,
        payment_phone: null,
      })
    }
  }
  return orders
}

function seed(): MockDb {
  let id = 1000
  return {
    users: [
      { id: 1, phone: MOCK_DEALER_PHONE, name: 'Demo Dealer', role: 'dealer', dealer_id: 1 },
      { id: 2, phone: '254712000111', name: 'Past customers (demo)', role: 'customer' },
    ],
    addresses: [],
    products: PRODUCTS,
    dealers: DEALERS,
    orders: seedHistory(() => id++),
    nextId: 100,
  }
}

function load(): MockDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    /* fall through to seed */
  }
  return seed()
}

function save(db: MockDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* ignore */
  }
}

export function resetMockDb() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()

function currentUser(db: MockDb): User {
  const token = useAuth.getState().access
  const id = token?.startsWith('mock-access-') ? Number(token.slice('mock-access-'.length)) : NaN
  const user = db.users.find((u) => u.id === id)
  if (!user) throw new ApiError('Please log in again.', 401)
  return user
}

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Gasgo's service fee: the same on every order (delivery or pickup). The real value is set by the backend. */
const SERVICE_FEE_KES = 50

function setStatus(order: MockOrder, status: OrderStatus) {
  order.status = status
  order.status_history.push({ status, at: now() })
}

/**
 * Moves orders along on their own, lazily, as the backend would:
 * - pending M-Pesa payments resolve (as if Safaricom's callback had arrived);
 * - paid orders the dealer hasn't accepted in time are cancelled (reason "dealer_timeout");
 * - refunds for rejected/cancelled paid orders arrive.
 */
function settlePayments(db: MockDb) {
  let changed = false
  for (const o of db.orders) {
    if (o.status === 'paid') {
      const paidAt = Date.parse([...o.status_history].reverse().find((h) => h.status === 'paid')?.at ?? '')
      if (Date.now() - paidAt > DEALER_TIMEOUT_MS) {
        setStatus(o, 'cancelled')
        o.cancellation_reason = 'dealer_timeout'
        o.refund_due_at = Date.now() + REFUND_DELAY_MS
        changed = true
      }
    }
    if ((o.status === 'rejected_by_dealer' || o.status === 'cancelled') && o.refund_due_at && Date.now() > o.refund_due_at) {
      setStatus(o, 'refunded')
      o.refund_due_at = null
      changed = true
    }
    if (o.status === 'placed' && o.payment_started_at && Date.now() - o.payment_started_at > PAYMENT_DELAY_MS) {
      if (o.payment_phone?.endsWith('0000')) {
        setStatus(o, 'payment_failed')
      } else {
        setStatus(o, 'paid')
        o.mpesa_receipt = `S${Math.random().toString(36).slice(2, 11).toUpperCase()}`
      }
      o.payment_started_at = null
      changed = true
    }
  }
  if (changed) save(db)
}

function publicOrder(o: MockOrder): Order {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { customer_id, payment_started_at, payment_phone, refund_due_at, ...rest } = o
  return structuredClone({ ...rest, accessories: rest.accessories ?? [], accessories_kes: rest.accessories_kes ?? 0, service_fee_kes: rest.service_fee_kes ?? 0, cancellation_reason: rest.cancellation_reason ?? null, funds_released_at: rest.funds_released_at ?? null, customer_confirmed_at: rest.customer_confirmed_at ?? null })
}

function computeQuote(db: MockDb, userId: number, req: QuoteRequest): Quote & { dealer: Dealer; address: Address | null; accessoryLines: OrderAccessory[] } {
  const dealer = db.dealers.find((d) => d.id === req.dealer_id)
  if (!dealer) throw new ApiError('Dealer not found.', 404, 'not_found')
  if (!dealer.is_open) throw new ApiError(`${dealer.name} is closed right now.`, 400, 'dealer_closed')
  if (req.items.length === 0) throw new ApiError('Your cart is empty.', 400, 'empty_cart')

  let subtotal = 0
  for (const line of req.items) {
    const product = db.products.find((p) => p.id === line.product_id)
    if (!product) throw new ApiError('Product not found.', 404, 'not_found')
    const listing = dealer.stock.find((s) => s.product_id === line.product_id)
    if (!listing || listing.quantity < line.quantity) {
      throw new ApiError(`${dealer.name} doesn't have enough ${product.brand} ${product.size_kg}kg in stock.`, 400, 'out_of_stock')
    }
    subtotal += listing.price_kes * line.quantity
  }

  let address: Address | null = null
  let fee = 0
  if (req.type === 'delivery') {
    const a = db.addresses.find((x) => x.id === req.address_id && x.user_id === userId)
    if (!a) throw new ApiError('Choose a delivery location.', 400, 'address_required')
    const km = haversineKm(a.lat, a.lng, dealer.lat, dealer.lng)
    if (km > dealer.delivery_radius_km) {
      throw new ApiError(`${dealer.name} doesn't deliver that far (${km.toFixed(1)} km).`, 400, 'out_of_range')
    }
    // Each gas type has its own delivery fee (0 = free). One trip, so the order pays the highest of them.
    fee = Math.max(0, ...req.items.map((line) => dealer.stock.find((st) => st.product_id === line.product_id)?.delivery_fee_kes ?? 0))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, ...rest } = a
    address = rest
  }
  // Equipment from the same shop
  const accessoryLines: OrderAccessory[] = (req.accessories ?? [])
    .filter((l) => l.quantity > 0)
    .map((l) => {
      const listing = (dealer.accessories ?? []).find((x) => x.kind === l.kind)
      if (!listing || !listing.in_stock) throw new ApiError(`${dealer.name} doesn't have a ${ACCESSORY_NAMES[l.kind].toLowerCase()} in stock.`, 400, 'out_of_stock')
      let unit = listing.price_kes
      let length: number | null = null
      if (l.kind === 'hose') {
        if (!l.length_m || l.length_m <= 0 || l.length_m > 20) throw new ApiError('Choose a hose length between 0.5 and 20 metres.', 400, 'invalid_length')
        length = l.length_m
        unit = Math.round(listing.price_kes * l.length_m)
      }
      return { kind: l.kind, name: ACCESSORY_NAMES[l.kind], quantity: Math.floor(l.quantity), length_m: length, unit_price_kes: unit, total_kes: unit * Math.floor(l.quantity) }
    })
  const accessoriesKes = accessoryLines.reduce((sum, a) => sum + a.total_kes, 0)

  return {
    subtotal_kes: subtotal,
    accessories_kes: accessoriesKes,
    delivery_fee_kes: fee,
    service_fee_kes: SERVICE_FEE_KES,
    total_kes: subtotal + accessoriesKes + fee + SERVICE_FEE_KES,
    dealer,
    address,
    accessoryLines,
  }
}

function dealerOrder(db: MockDb, id: number): MockOrder {
  const user = currentUser(db)
  const order = db.orders.find((o) => o.id === id)
  if (!order || user.role !== 'dealer' || order.dealer.id !== user.dealer_id) {
    throw new ApiError('Order not found.', 404, 'not_found')
  }
  return order
}

const ALLOWED_DEALER_MOVES: Partial<Record<OrderStatus, OrderStatus[]>> = {
  accepted: ['out_for_delivery', 'ready_for_pickup'],
  // Only allowed once the customer has confirmed they received the gas (see dealerSetStatus).
  out_for_delivery: ['delivered'],
  ready_for_pickup: ['collected'],
}

function myShop(db: MockDb): Dealer {
  const user = currentUser(db)
  const shop = db.dealers.find((d) => d.id === user.dealer_id)
  if (user.role !== 'dealer' || !shop) throw new ApiError('Vendors only.', 403, 'forbidden')
  return shop
}

function stockItem(db: MockDb, st: DealerStock): StockItem {
  const product = db.products.find((p) => p.id === st.product_id)!
  return { id: st.product_id, product: { ...product, price_kes: st.price_kes }, quantity: st.quantity, price_kes: st.price_kes, delivery_fee_kes: st.delivery_fee_kes ?? 0 }
}

const sameBrand = (a: string, b: string) => a.replace(/[\s-]/g, '').toLowerCase() === b.replace(/[\s-]/g, '').toLowerCase()

/** Kenya calendar day (UTC+3) of an ISO time, as YYYY-MM-DD. */
const kenyaDay = (iso: string | number) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString().slice(0, 10)

/** Sales figures the backend would compute: orders the customer confirmed, by confirmation day. */
function performanceFor(orders: MockOrder[], days: number): DealerPerformance {
  const dayMs = 86_400_000
  const today = kenyaDay(Date.now())
  const startMs = Date.parse(today) - (days - 1) * dayMs
  const prevStartMs = startMs - days * dayMs
  const earned = (o: MockOrder) => o.subtotal_kes + (o.accessories_kes ?? 0) + o.delivery_fee_kes
  const confirmed = orders.filter((o) => o.customer_confirmed_at)
  const dayOf = (o: MockOrder) => kenyaDay(o.customer_confirmed_at!)
  const inRange = confirmed.filter((o) => Date.parse(dayOf(o)) >= startMs)
  const prev = confirmed.filter((o) => Date.parse(dayOf(o)) >= prevStartMs && Date.parse(dayOf(o)) < startMs)

  const daily = Array.from({ length: days }, (_, i) => ({ date: new Date(startMs + i * dayMs).toISOString().slice(0, 10), sales_kes: 0, orders: 0 }))
  const byDate = new Map(daily.map((d) => [d.date, d]))
  const items = new Map<string, { name: string; quantity: number; sales_kes: number }>()
  const addItem = (name: string, quantity: number, sales: number) => {
    const it = items.get(name) ?? { name, quantity: 0, sales_kes: 0 }
    it.quantity += quantity
    it.sales_kes += sales
    items.set(name, it)
  }
  for (const o of inRange) {
    const d = byDate.get(dayOf(o))
    if (d) {
      d.sales_kes += earned(o)
      d.orders += 1
    }
    for (const i of o.items) addItem(`${i.product.brand} ${i.product.size_kg}kg ${i.product.type === 'refill' ? 'refill' : 'new cylinder'}`, i.quantity, i.unit_price_kes * i.quantity)
    for (const a of o.accessories ?? []) addItem(a.name, a.quantity, a.total_kes)
  }
  const sum = (list: MockOrder[], f: (o: MockOrder) => number) => list.reduce((s, o) => s + f(o), 0)
  return {
    days,
    sales_kes: sum(inRange, earned),
    previous_sales_kes: sum(prev, earned),
    orders: inRange.length,
    cylinders: sum(inRange, (o) => o.items.reduce((n, i) => n + i.quantity, 0)),
    gas_kes: sum(inRange, (o) => o.subtotal_kes),
    accessories_kes: sum(inRange, (o) => o.accessories_kes ?? 0),
    delivery_fees_kes: sum(inRange, (o) => o.delivery_fee_kes),
    daily,
    top_items: [...items.values()].sort((a, b) => b.sales_kes - a.sales_kes).slice(0, 5),
  }
}

export const mockApi: GasgoApi = {
  async requestOtp(phone) {
    await wait()
    if (!/^254[17]\d{8}$/.test(phone)) throw new ApiError('Enter a valid Kenyan phone number.', 400, 'invalid_phone')
  },

  async verifyOtp(phone, code) {
    await wait()
    if (code !== MOCK_OTP) throw new ApiError('That code is incorrect. (Demo code: 123456)', 400, 'invalid_otp')
    const db = load()
    let user = db.users.find((u) => u.phone === phone)
    const isNew = !user
    if (!user) {
      user = { id: db.nextId++, phone, name: '', role: 'customer' }
      db.users.push(user)
      save(db)
    }
    return { access: `mock-access-${user.id}`, refresh: `mock-refresh-${user.id}`, user, is_new_user: isNew }
  },

  async getMe() {
    await wait(150)
    return currentUser(load())
  },

  async updateMe(data) {
    await wait()
    const db = load()
    const user = currentUser(db)
    Object.assign(user, data)
    save(db)
    return user
  },

  async registerVendor(data) {
    await wait(700)
    const db = load()
    const user = currentUser(db)
    if (user.role === 'dealer') throw new ApiError('This account already has a shop.', 400, 'already_vendor')
    if (data.shop_name.trim().length < 2) throw new ApiError('Enter your shop name.', 400, 'invalid')
    if (!isInServiceArea(data)) throw new ApiError(OUTSIDE_AREA_MESSAGE, 400, 'outside_service_area')
    const dealer: Dealer = {
      id: db.nextId++,
      name: data.shop_name.trim(),
      phone: user.phone,
      lat: data.lat,
      lng: data.lng,
      address: [data.address.trim(), data.landmark_notes.trim()].filter(Boolean).join(' · '),
      opening_hours: data.opening_hours,
      delivery_radius_km: data.delivery_radius_km,
      is_open: true,
      // New shops start with no gas listed; the vendor adds their gas types on the Stock screen.
      stock: [],
      accessories: [],
    }
    db.dealers.push(dealer)
    user.role = 'dealer'
    user.dealer_id = dealer.id
    save(db)
    return { user: { ...user }, dealer }
  },

  async listAddresses() {
    await wait(200)
    const db = load()
    const user = currentUser(db)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return db.addresses.filter((a) => a.user_id === user.id).map(({ user_id, ...a }) => a)
  },

  async createAddress(data) {
    await wait()
    const db = load()
    const user = currentUser(db)
    if (!isInServiceArea(data)) throw new ApiError(OUTSIDE_AREA_MESSAGE, 400, 'outside_service_area')
    const address = { ...data, id: db.nextId++ }
    db.addresses.push({ ...address, user_id: user.id })
    save(db)
    return address
  },

  async deleteAddress(id) {
    await wait()
    const db = load()
    const user = currentUser(db)
    db.addresses = db.addresses.filter((a) => !(a.id === id && a.user_id === user.id))
    save(db)
  },

  async listProducts() {
    await wait(200)
    const db = load()
    // Only gas types that at least one open shop has in stock, priced "from" the cheapest shop.
    return db.products
      .filter((p) => p.is_active)
      .map((p) => {
        const prices = db.dealers
          .filter((d) => d.is_open)
          .flatMap((d) => d.stock.filter((st) => st.product_id === p.id && st.quantity > 0).map((st) => st.price_kes))
        return prices.length ? { ...p, price_kes: Math.min(...prices) } : null
      })
      .filter((p): p is Product => p !== null)
  },

  async listDealers({ lat, lng }) {
    await wait(250)
    const dealers = load().dealers.map((d) =>
      lat !== undefined && lng !== undefined
        ? { ...d, distance_km: Math.round(haversineKm(lat, lng, d.lat, d.lng) * 10) / 10 }
        : { ...d },
    )
    return dealers.sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
  },

  async quote(req) {
    await wait(250)
    const db = load()
    const user = currentUser(db)
    const q = computeQuote(db, user.id, req)
    return { subtotal_kes: q.subtotal_kes, accessories_kes: q.accessories_kes, delivery_fee_kes: q.delivery_fee_kes, service_fee_kes: q.service_fee_kes, total_kes: q.total_kes }
  },

  async listOrders() {
    await wait(250)
    const db = load()
    settlePayments(db)
    const user = currentUser(db)
    return db.orders
      .filter((o) => o.customer_id === user.id)
      .sort((a, b) => b.id - a.id)
      .map(publicOrder)
  },

  async getOrder(id) {
    await wait(150)
    const db = load()
    settlePayments(db)
    const user = currentUser(db)
    const order = db.orders.find((o) => o.id === id && (o.customer_id === user.id || o.dealer.id === user.dealer_id))
    if (!order) throw new ApiError('Order not found.', 404, 'not_found')
    return publicOrder(order)
  },

  async createOrder(req) {
    await wait()
    const db = load()
    const user = currentUser(db)
    const q = computeQuote(db, user.id, req)
    const id = db.nextId++
    const order: MockOrder = {
      id,
      order_number: `GG-${String(10000 + id).slice(-5)}`,
      type: req.type,
      status: 'placed',
      items: req.items.map((line) => {
        const product = db.products.find((p) => p.id === line.product_id)!
        const price = q.dealer.stock.find((st) => st.product_id === line.product_id)!.price_kes
        return { product: { ...product, price_kes: price }, quantity: line.quantity, unit_price_kes: price }
      }),
      accessories: q.accessoryLines,
      dealer: q.dealer,
      address: q.address,
      customer: { name: user.name || 'Customer', phone: user.phone },
      subtotal_kes: q.subtotal_kes,
      accessories_kes: q.accessories_kes,
      delivery_fee_kes: q.delivery_fee_kes,
      service_fee_kes: q.service_fee_kes,
      total_kes: q.total_kes,
      mpesa_receipt: null,
      cancellation_reason: null,
      customer_confirmed_at: null,
      funds_released_at: null,
      refund_due_at: null,
      status_history: [{ status: 'placed', at: now() }],
      created_at: now(),
      customer_id: user.id,
      payment_started_at: null,
      payment_phone: null,
    }
    db.orders.push(order)
    save(db)
    return publicOrder(order)
  },

  async payOrder(id, phone) {
    await wait(600)
    const db = load()
    const user = currentUser(db)
    const order = db.orders.find((o) => o.id === id && o.customer_id === user.id)
    if (!order) throw new ApiError('Order not found.', 404, 'not_found')
    if (order.status === 'payment_failed') setStatus(order, 'placed')
    if (order.status !== 'placed') throw new ApiError('This order is already paid.', 400, 'already_paid')
    order.payment_started_at = Date.now()
    order.payment_phone = phone
    save(db)
    return { checkout_request_id: `ws_CO_${Date.now()}` }
  },

  async confirmReceived(id) {
    await wait()
    const db = load()
    const user = currentUser(db)
    const order = db.orders.find((o) => o.id === id && o.customer_id === user.id)
    if (!order) throw new ApiError('Order not found.', 404, 'not_found')
    if (order.status !== 'out_for_delivery' && order.status !== 'ready_for_pickup') {
      throw new ApiError('You can confirm once the dealer has sent your gas or it is ready for pickup.', 400, 'cannot_confirm')
    }
    if (order.customer_confirmed_at) throw new ApiError('You have already confirmed this order.', 400, 'already_confirmed')
    order.customer_confirmed_at = now()
    order.funds_released_at = now()
    save(db)
    return publicOrder(order)
  },

  async cancelOrder(id) {
    await wait()
    const db = load()
    const user = currentUser(db)
    const order = db.orders.find((o) => o.id === id && o.customer_id === user.id)
    if (!order) throw new ApiError('Order not found.', 404, 'not_found')
    if (!['placed', 'paid', 'payment_failed'].includes(order.status)) {
      throw new ApiError('This order can no longer be cancelled.', 400, 'cannot_cancel')
    }
    const wasPaid = order.status === 'paid'
    setStatus(order, 'cancelled')
    order.cancellation_reason = 'customer'
    order.payment_started_at = null
    if (wasPaid) order.refund_due_at = Date.now() + REFUND_DELAY_MS // pay-first: refund the M-Pesa payment
    save(db)
    return publicOrder(order)
  },

  async listDealerOrders() {
    await wait(250)
    const db = load()
    settlePayments(db)
    const user = currentUser(db)
    if (user.role !== 'dealer') throw new ApiError('Dealers only.', 403, 'forbidden')
    return db.orders
      .filter((o) => o.dealer.id === user.dealer_id && o.status !== 'placed' && o.status !== 'payment_failed')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(publicOrder)
  },

  async dealerAccept(id) {
    await wait()
    const db = load()
    const order = dealerOrder(db, id)
    if (order.status !== 'paid') throw new ApiError('Only paid orders can be accepted.', 400, 'invalid_status')
    setStatus(order, 'accepted')
    const dealer = db.dealers.find((d) => d.id === order.dealer.id)!
    for (const item of order.items) {
      const s = dealer.stock.find((x) => x.product_id === item.product.id)
      if (s) s.quantity = Math.max(0, s.quantity - item.quantity)
    }
    save(db)
    return publicOrder(order)
  },

  async dealerReject(id) {
    await wait()
    const db = load()
    const order = dealerOrder(db, id)
    if (order.status !== 'paid') throw new ApiError('Only paid orders can be rejected.', 400, 'invalid_status')
    setStatus(order, 'rejected_by_dealer')
    order.refund_due_at = Date.now() + REFUND_DELAY_MS
    save(db)
    return publicOrder(order)
  },

  async getMyShop() {
    await wait(150)
    return structuredClone(myShop(load()))
  },

  async updateShop(patch) {
    await wait()
    const db = load()
    const shop = myShop(db)
    if (patch.is_open !== undefined) shop.is_open = patch.is_open
    save(db)
    return structuredClone(shop)
  },

  async setShopOpen(isOpen) {
    await wait()
    const db = load()
    const shop = myShop(db)
    shop.is_open = isOpen
    save(db)
    return structuredClone(shop)
  },

  async listMyStock() {
    await wait(200)
    const db = load()
    return myShop(db).stock.map((st) => stockItem(db, st))
  },

  async addStock(item) {
    await wait()
    const db = load()
    const shop = myShop(db)
    const brand = item.brand.trim().replace(/\s+/g, ' ')
    if (brand.length < 2) throw new ApiError('Type the gas brand, e.g. K-Gas.', 400, 'invalid_brand')
    if (!(item.size_kg > 0 && item.size_kg <= 100)) throw new ApiError('Enter the cylinder size in kg (up to 100).', 400, 'invalid_size')
    const sizeKg = Math.round(item.size_kg * 10) / 10
    if (!(item.price_kes > 0)) throw new ApiError('Enter the price in KES.', 400, 'invalid')
    if (!(item.delivery_fee_kes >= 0 && item.delivery_fee_kes <= 5000)) throw new ApiError('Enter a delivery fee between KES 0 and 5,000.', 400, 'invalid_fee')
    if (item.quantity < 0) throw new ApiError('Quantity cannot be negative.', 400, 'invalid')
    // Re-use the catalogue entry if this brand/size/type already exists (e.g. "Kgas" = "K-Gas").
    let product = db.products.find((p) => sameBrand(p.brand, brand) && p.size_kg === sizeKg && p.type === item.type)
    if (!product) {
      // A brand already in the system keeps its spelling ("kgas" → "K-Gas").
      const known = db.products.find((p) => sameBrand(p.brand, brand))?.brand ?? brand
      product = { id: db.nextId++, brand: known, size_kg: sizeKg, type: item.type, price_kes: item.price_kes, image_url: null, is_active: true }
      db.products.push(product)
    }
    if (shop.stock.some((st) => st.product_id === product.id)) {
      throw new ApiError(`${product.brand} ${product.size_kg}kg ${item.type === 'refill' ? 'refill' : 'new cylinder'} is already in your stock. Update it below instead.`, 400, 'duplicate')
    }
    const st = { product_id: product.id, quantity: Math.floor(item.quantity), price_kes: Math.round(item.price_kes), delivery_fee_kes: Math.round(item.delivery_fee_kes) }
    shop.stock.push(st)
    save(db)
    return stockItem(db, st)
  },

  async updateStock(id, data) {
    await wait(200)
    const db = load()
    const st = myShop(db).stock.find((x) => x.product_id === id)
    if (!st) throw new ApiError('Gas type not found.', 404, 'not_found')
    if (data.quantity !== undefined) {
      if (data.quantity < 0) throw new ApiError('Quantity cannot be negative.', 400, 'invalid')
      st.quantity = Math.floor(data.quantity)
    }
    if (data.price_kes !== undefined) {
      if (!(data.price_kes > 0)) throw new ApiError('Enter a price above 0.', 400, 'invalid')
      st.price_kes = Math.round(data.price_kes)
    }
    if (data.delivery_fee_kes !== undefined) {
      if (!(data.delivery_fee_kes >= 0 && data.delivery_fee_kes <= 5000)) throw new ApiError('Enter a delivery fee between KES 0 and 5,000.', 400, 'invalid_fee')
      st.delivery_fee_kes = Math.round(data.delivery_fee_kes)
    }
    save(db)
    return stockItem(db, st)
  },

  async removeStock(id) {
    await wait()
    const db = load()
    const shop = myShop(db)
    shop.stock = shop.stock.filter((x) => x.product_id !== id)
    save(db)
  },

  async setAccessory(kind, data) {
    await wait(250)
    const db = load()
    const shop = myShop(db)
    if (!(kind in ACCESSORY_NAMES)) throw new ApiError('Unknown item.', 400, 'invalid')
    if (!(data.price_kes > 0)) throw new ApiError('Enter a price above 0.', 400, 'invalid')
    shop.accessories = shop.accessories ?? []
    const existing = shop.accessories.find((a) => a.kind === kind)
    if (existing) Object.assign(existing, { price_kes: Math.round(data.price_kes), in_stock: data.in_stock })
    else shop.accessories.push({ kind, price_kes: Math.round(data.price_kes), in_stock: data.in_stock })
    save(db)
    return structuredClone(shop)
  },

  async removeAccessory(kind) {
    await wait(250)
    const db = load()
    const shop = myShop(db)
    shop.accessories = (shop.accessories ?? []).filter((a) => a.kind !== kind)
    save(db)
    return structuredClone(shop)
  },

  async getPerformance(days) {
    await wait(300)
    const db = load()
    const shop = myShop(db)
    return performanceFor(db.orders.filter((o) => o.dealer.id === shop.id), days)
  },

  async dealerSetStatus(id, status) {
    await wait()
    const db = load()
    const order = dealerOrder(db, id)
    if (!ALLOWED_DEALER_MOVES[order.status]?.includes(status)) {
      throw new ApiError(`Can't move an order from "${order.status}" to "${status}".`, 400, 'invalid_status')
    }
    if ((status === 'delivered' || status === 'collected') && !order.customer_confirmed_at) {
      throw new ApiError('The customer hasn’t confirmed they received the gas yet.', 400, 'not_confirmed')
    }
    setStatus(order, status)
    save(db)
    return publicOrder(order)
  },
}
