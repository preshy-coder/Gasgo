import type {
  ShopUpdate,
  Address,
  CreateOrderRequest,
  Dealer,
  NewAddress,
  NewStockItem,
  StockItem,
  Order,
  OrderStatus,
  PayResponse,
  Product,
  Quote,
  QuoteRequest,
  User,
  VendorSignup,
  VendorSignupResponse,
  VerifyOtpResponse,
} from '../types'

/**
 * Everything the app can ask the backend.
 * Two implementations exist: `real.ts` (Django API) and `mock.ts` (fake backend for development).
 * Screens only ever import `api` from `src/api/index.ts`, never these files directly.
 */
export interface GasgoApi {
  // Auth
  requestOtp(phone: string): Promise<void>
  verifyOtp(phone: string, code: string): Promise<VerifyOtpResponse>
  getMe(): Promise<User>
  updateMe(data: Partial<Pick<User, 'name'>>): Promise<User>
  /** Turns the logged-in user into a vendor and creates their shop. */
  registerVendor(data: VendorSignup): Promise<VendorSignupResponse>

  // Addresses
  listAddresses(): Promise<Address[]>
  createAddress(data: NewAddress): Promise<Address>
  deleteAddress(id: number): Promise<void>

  // Catalogue
  listProducts(): Promise<Product[]>
  listDealers(params: { lat?: number; lng?: number }): Promise<Dealer[]>

  // Orders (customer)
  quote(req: QuoteRequest): Promise<Quote>
  listOrders(): Promise<Order[]>
  getOrder(id: number): Promise<Order>
  createOrder(req: CreateOrderRequest): Promise<Order>
  payOrder(id: number, phone: string): Promise<PayResponse>
  cancelOrder(id: number): Promise<Order>
  /** Customer confirms they have the gas: order becomes delivered / collected and the payment is released to the dealer. */
  confirmReceived(id: number): Promise<Order>

  // Dealer
  listDealerOrders(): Promise<Order[]>
  dealerAccept(id: number): Promise<Order>
  dealerReject(id: number, reason: string): Promise<Order>
  dealerSetStatus(id: number, status: OrderStatus): Promise<Order>

  // Vendor shop and stock (gas types are entered by the vendor)
  getMyShop(): Promise<Dealer>
  setShopOpen(isOpen: boolean): Promise<Dealer>
  /** Change shop settings such as the delivery fee. */
  updateShop(patch: ShopUpdate): Promise<Dealer>
  listMyStock(): Promise<StockItem[]>
  addStock(item: NewStockItem): Promise<StockItem>
  updateStock(id: number, data: Partial<Pick<StockItem, 'quantity' | 'price_kes'>>): Promise<StockItem>
  removeStock(id: number): Promise<void>
}

export class ApiError extends Error {
  status: number
  code?: string
  fieldErrors?: Record<string, string[]>

  constructor(message: string, status: number, code?: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof TypeError) return 'Could not reach the server. Check your internet connection.'
  return 'Something went wrong. Please try again.'
}
