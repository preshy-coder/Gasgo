// Shapes returned by the Django REST API.
// These mirror the "Data shapes" section of the kickoff agreement doc.
// If the backend renames a field, update it here and TypeScript will show every place that breaks.

export type Role = 'customer' | 'dealer' | 'rider'

export interface User {
  id: number
  phone: string // 2547XXXXXXXX
  name: string
  role: Role
  dealer_id?: number | null // set when role is "dealer"
}

export interface AuthTokens {
  access: string
  refresh: string
}

export interface VerifyOtpResponse extends AuthTokens {
  user: User
  is_new_user: boolean
}

export type ProductType = 'refill' | 'new_cylinder'

/**
 * A gas type in the catalogue (brand + size + refill/new). Vendors create these when they add
 * stock; customers only see types that at least one shop lists.
 */
export interface Product {
  id: number
  brand: string
  size_kg: number
  type: ProductType
  /** Lowest price across shops that have it in stock ("from" price). The shop's own price is in DealerStock. */
  price_kes: number
  image_url: string | null
  is_active: boolean
}

export interface DealerStock {
  product_id: number
  quantity: number
  /** This shop's price for this gas type */
  price_kes: number
}

/** One line of a vendor's own stock list. */
export interface StockItem {
  id: number
  product: Product
  quantity: number
  price_kes: number
}

/** What a vendor enters to add a gas type to their shop. The brand is typed by the vendor. */
export interface NewStockItem {
  brand: string
  size_kg: number
  type: ProductType
  price_kes: number
  quantity: number
}

export interface Dealer {
  id: number
  name: string
  phone: string
  lat: number
  lng: number
  address: string
  opening_hours: string
  delivery_radius_km: number
  /** The shop's own delivery charge (flat, KES), set by the vendor. Charged on delivery orders only. */
  delivery_fee_kes: number
  is_open: boolean
  stock: DealerStock[]
  /** Gas equipment the shop sells (the vendor's Market). */
  accessories: DealerAccessory[]
  distance_km?: number
}

/** Gas equipment a shop can sell with cylinders. Fixed list (see src/lib/catalog.ts). */
export type AccessoryKind = 'regulator' | 'hose' | 'lighter' | 'grill'

export interface DealerAccessory {
  kind: AccessoryKind
  /** For 'hose' this is the price per metre. */
  price_kes: number
  in_stock: boolean
}

/** What a vendor (gas shop) fills in when joining Gasgo. */
export interface VendorSignup {
  shop_name: string
  address: string // written address, e.g. "Ngong Rd, Kilimani, next to the stage"
  landmark_notes: string
  lat: number // exact pin location
  lng: number
  opening_hours: string
  delivery_radius_km: number
  delivery_fee_kes: number
}

/** What a vendor can change about their shop (PATCH /dealer/shop/). */
export interface ShopUpdate {
  is_open?: boolean
  delivery_fee_kes?: number
}

export interface VendorSignupResponse {
  user: User // role is now "dealer", with dealer_id set
  dealer: Dealer
}

export interface Address {
  id: number
  label: string
  lat: number
  lng: number
  formatted_address: string
  landmark_notes: string
}

export type NewAddress = Omit<Address, 'id'>

export type OrderType = 'delivery' | 'pickup'

export type OrderStatus =
  | 'placed'
  | 'paid'
  | 'accepted'
  | 'out_for_delivery'
  | 'delivered'
  | 'ready_for_pickup'
  | 'collected'
  | 'payment_failed'
  | 'rejected_by_dealer'
  | 'cancelled'
  /** Money returned to the customer's M-Pesa (after a paid order was rejected or cancelled). */
  | 'refunded'

/**
 * Why an order was cancelled (null if it wasn't).
 * - customer: the customer cancelled it.
 * - dealer_timeout: the dealer didn't accept the paid order in time, so the system cancelled it.
 */
export type CancellationReason = 'customer' | 'dealer_timeout'

export interface OrderItem {
  product: Product
  quantity: number
  unit_price_kes: number
}

export interface StatusChange {
  status: OrderStatus
  at: string // ISO 8601
}

/** An accessory line on an order, priced by the shop at the time of ordering. */
export interface OrderAccessory {
  kind: AccessoryKind
  name: string
  quantity: number
  length_m: number | null // hose only
  unit_price_kes: number // per piece (for a hose: price per metre × length)
  total_kes: number
}

export interface Order {
  id: number
  order_number: string
  type: OrderType
  status: OrderStatus
  items: OrderItem[]
  accessories: OrderAccessory[]
  dealer: Dealer
  address: Address | null // null for pickup
  customer?: { name: string; phone: string }
  subtotal_kes: number // gas only
  accessories_kes: number
  delivery_fee_kes: number
  /** Gasgo's fixed service fee. Kept by Gasgo, not paid out to the dealer. */
  service_fee_kes: number
  total_kes: number
  mpesa_receipt: string | null
  cancellation_reason: CancellationReason | null
  /**
   * When the customer confirmed they received the gas (POST /orders/{id}/confirm-received/), null until then.
   * Only after this can the dealer mark the order delivered / collected.
   */
  customer_confirmed_at: string | null
  /** When the payment was released to the dealer (null while held). Set when the customer confirms. */
  funds_released_at: string | null
  status_history: StatusChange[]
  created_at: string
}

export interface CartLine {
  product_id: number
  quantity: number
}

/** An accessory in the customer's cart. length_m is required for 'hose' (and ignored otherwise). */
export interface AccessoryLine {
  kind: AccessoryKind
  quantity: number
  length_m?: number
}

export interface QuoteRequest {
  type: OrderType
  dealer_id: number
  address_id?: number
  items: CartLine[]
  /** Optional equipment from the same shop. */
  accessories?: AccessoryLine[]
}

export interface Quote {
  subtotal_kes: number // gas, at the shop's prices
  accessories_kes: number // equipment from the same shop (0 if none)
  delivery_fee_kes: number // the shop's delivery fee (0 for pickup)
  service_fee_kes: number // Gasgo's fixed service fee, the same on every order
  total_kes: number // subtotal + accessories + delivery fee + service fee
}

export type CreateOrderRequest = QuoteRequest

export interface PayResponse {
  checkout_request_id: string
}

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiErrorBody {
  error: string
  code?: string
  field_errors?: Record<string, string[]>
}

/** Vendor sales performance for the last `days` days (GET /dealer/performance/?days=). Only orders the customer confirmed count. */
export interface DealerPerformance {
  days: number
  /** What the shop earned: gas + accessories + delivery fees (Gasgo's service fee excluded). */
  sales_kes: number
  /** The same figure for the `days` before that, to show the change. */
  previous_sales_kes: number
  orders: number
  cylinders: number
  gas_kes: number
  accessories_kes: number
  delivery_fees_kes: number
  /** One entry per day, oldest first, including days with no sales. date = YYYY-MM-DD (Kenya time). */
  daily: { date: string; sales_kes: number; orders: number }[]
  /** Best sellers by sales, largest first (gas types and accessories). */
  top_items: { name: string; quantity: number; sales_kes: number }[]
}
