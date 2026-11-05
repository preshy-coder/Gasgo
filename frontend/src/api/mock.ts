// A fake backend that runs in the browser, so the frontend works before the Django API is ready.
// Data is kept in localStorage under "gasgo-mock-db". Clear it from the Profile page (Reset demo data).
//
// Demo rules:
//   - The OTP code is always 123456.
//   - Phone 0700 000 001 logs in as a dealer (Gasgo Demo Dealer, Juja Town).
//   - Each shop lists its own gas types, prices and stock (vendors manage them on the Stock screen).
//   - Delivery addresses must be within Juja, Kiambu County (see src/lib/serviceArea.ts).
//   - Any other phone logs in as a customer.
//   - Paid orders not accepted within 3 minutes are cancelled (dealer timeout); refunds for
//     rejected/cancelled paid orders arrive ~8 seconds later (status "refunded").
//   - M-Pesa payments succeed ~4 seconds after the STK push,
//     except numbers ending in 0000, which fail (to test the failure screen).
import { useAuth } from '../store/auth'
import type {
  Address,
  Dealer,
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
const KEY = 'gasgo-mock-db-v3' // bump the version when the seed data changes

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
const BRANDS: { brand: string; refill6: number; refill13: number; new6: number; new13: number }[] = [
  { brand: 'K-Gas', refill6: 1250, refill13: 2900, new6: 4200, new13: 7600 },
  { brand: 'Total', refill6: 1300, refill13: 3000, new6: 4400, new13: 7800 },
  { brand: 'Pro Gas', refill6: 1200, refill13: 2850, new6: 4100, new13: 7400 },
  { brand: 'Afrigas', refill6: 1200, refill13: 2800, new6: 4000, new13: 7300 },
  { brand: 'Hashi Gas', refill6: 1150, refill13: 2750, new6: 3900, new13: 7200 },
  { brand: 'Rubis', refill6: 1280, refill13: 2950, new6: 4300, new13: 7700 },
]

const PRODUCTS: Product[] = BRANDS.flatMap((b, i) => [
  { id: i * 4 + 1, brand: b.brand, size_kg: 6, type: 'refill' as const, price_kes: b.refill6, image_url: null, is_active: true },
  { id: i * 4 + 2, brand: b.brand, size_kg: 13, type: 'refill' as const, price_kes: b.refill13, image_url: null, is_active: true },
  { id: i * 4 + 3, brand: b.brand, size_kg: 6, type: 'new_cylinder' as const, price_kes: b.new6, image_url: null, is_active: true },
  { id: i * 4 + 4, brand: b.brand, size_kg: 13, type: 'new_cylinder' as const, price_kes: b.new13, image_url: null, is_active: true },
])

/**
 * Builds a shop's stock list: every size/type of the given brands, at the reference price plus
 * `offset` KES. `tweak` lets a shop have a few items out of stock or running low.
 */
function stockFor(brands: string[], qty: number, offset = 0, opts: { refillOnly?: boolean; tweak?: Record<number, number> } = {}) {
  return PRODUCTS.filter((p) => brands.includes(p.brand) && (!opts.refillOnly || p.type === 'refill')).map((p) => ({
    product_id: p.id,
    quantity: opts.tweak?.[p.id] ?? qty,
    price_kes: p.price_kes + offset,
  }))
}

// Demo dealers in Juja, Kiambu County (fictional names, approximate locations).
const DEALERS: Dealer[] = [
  { id: 1, name: 'Gasgo Demo Dealer', phone: '254700000001', lat: -1.1021, lng: 37.0139, address: 'Juja Town, off Thika Rd', opening_hours: 'Mon–Sun 7:00–21:00', delivery_radius_km: 8, is_open: true, stock: stockFor(['K-Gas', 'Total', 'Pro Gas', 'Afrigas'], 12, 0, { tweak: { 3: 2, 12: 0 } }) },
  { id: 2, name: 'JKUAT Gate Gas Point', phone: '254711000002', lat: -1.0951, lng: 37.0106, address: 'Near JKUAT Gate C, Juja', opening_hours: 'Mon–Sat 7:30–20:00', delivery_radius_km: 6, is_open: true, stock: stockFor(['K-Gas', 'Pro Gas', 'Hashi Gas'], 6, -50, { refillOnly: true, tweak: { 10: 0 } }) },
  { id: 3, name: 'Highpoint Gas Centre', phone: '254722000003', lat: -1.1066, lng: 37.0207, address: 'Highpoint, Juja', opening_hours: 'Mon–Sun 6:30–22:00', delivery_radius_km: 7, is_open: true, stock: stockFor(['Total', 'Rubis', 'K-Gas', 'Afrigas'], 9, 50) },
  { id: 4, name: 'Witeithie Gas Shop', phone: '254744000005', lat: -1.1161, lng: 37.0402, address: 'Witeithie, Juja', opening_hours: 'Mon–Sun 7:00–20:00', delivery_radius_km: 6, is_open: true, stock: stockFor(['Pro Gas', 'Hashi Gas', 'Afrigas'], 5, -30) },
  { id: 5, name: 'Kalimoni Energies', phone: '254733000004', lat: -1.1236, lng: 37.0087, address: 'Kalimoni, Juja', opening_hours: 'Mon–Sat 8:00–19:00', delivery_radius_km: 6, is_open: false, stock: stockFor(['K-Gas', 'Total'], 4) },
]

function seed(): MockDb {
  return {
    users: [{ id: 1, phone: MOCK_DEALER_PHONE, name: 'Demo Dealer', role: 'dealer', dealer_id: 1 }],
    addresses: [],
    products: PRODUCTS,
    dealers: DEALERS,
    orders: [],
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

/** Delivery fee rule used by the mock: KES 150 for the first 3 km, then KES 30 per km. */
function deliveryFee(distanceKm: number): number {
  return 150 + Math.max(0, Math.ceil(distanceKm - 3)) * 30
}

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
  return structuredClone({ ...rest, cancellation_reason: rest.cancellation_reason ?? null })
}

function computeQuote(db: MockDb, userId: number, req: QuoteRequest): Quote & { dealer: Dealer; address: Address | null } {
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
    fee = deliveryFee(km)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { user_id, ...rest } = a
    address = rest
  }
  return { subtotal_kes: subtotal, delivery_fee_kes: fee, total_kes: subtotal + fee, dealer, address }
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
  return { id: st.product_id, product: { ...product, price_kes: st.price_kes }, quantity: st.quantity, price_kes: st.price_kes }
}

const sameBrand = (a: string, b: string) => a.replace(/[\s-]/g, '').toLowerCase() === b.replace(/[\s-]/g, '').toLowerCase()

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
    return { subtotal_kes: q.subtotal_kes, delivery_fee_kes: q.delivery_fee_kes, total_kes: q.total_kes }
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
      dealer: q.dealer,
      address: q.address,
      customer: { name: user.name || 'Customer', phone: user.phone },
      subtotal_kes: q.subtotal_kes,
      delivery_fee_kes: q.delivery_fee_kes,
      total_kes: q.total_kes,
      mpesa_receipt: null,
      cancellation_reason: null,
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
      .sort((a, b) => b.id - a.id)
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
    const brand = item.brand.trim()
    if (brand.length < 2) throw new ApiError('Enter the gas brand, e.g. K-Gas.', 400, 'invalid')
    if (!(item.size_kg > 0)) throw new ApiError('Choose the cylinder size.', 400, 'invalid')
    if (!(item.price_kes > 0)) throw new ApiError('Enter the price in KES.', 400, 'invalid')
    if (item.quantity < 0) throw new ApiError('Quantity cannot be negative.', 400, 'invalid')
    // Re-use the catalogue entry if this brand/size/type already exists (e.g. "Kgas" = "K-Gas").
    let product = db.products.find((p) => sameBrand(p.brand, brand) && p.size_kg === item.size_kg && p.type === item.type)
    if (!product) {
      product = { id: db.nextId++, brand, size_kg: item.size_kg, type: item.type, price_kes: item.price_kes, image_url: null, is_active: true }
      db.products.push(product)
    }
    if (shop.stock.some((st) => st.product_id === product.id)) {
      throw new ApiError(`${product.brand} ${product.size_kg}kg ${item.type === 'refill' ? 'refill' : 'new cylinder'} is already in your stock. Update it below instead.`, 400, 'duplicate')
    }
    const st = { product_id: product.id, quantity: Math.floor(item.quantity), price_kes: Math.round(item.price_kes) }
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

  async dealerSetStatus(id, status) {
    await wait()
    const db = load()
    const order = dealerOrder(db, id)
    if (!ALLOWED_DEALER_MOVES[order.status]?.includes(status)) {
      throw new ApiError(`Can't move an order from "${order.status}" to "${status}".`, 400, 'invalid_status')
    }
    setStatus(order, status)
    save(db)
    return publicOrder(order)
  },
}
