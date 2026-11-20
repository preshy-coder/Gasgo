// Client for the real Django REST API.
import { useAuth } from '../store/auth'
import type { ApiErrorBody, Order, Paginated } from '../types'
import { ApiError, type GasgoApi } from './types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '')

async function refreshAccessToken(): Promise<boolean> {
  const { refresh, setAccess, logout } = useAuth.getState()
  if (!refresh) return false
  const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) {
    logout()
    return false
  }
  const data = (await res.json()) as { access: string }
  setAccess(data.access)
  return true
}

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const { access } = useAuth.getState()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (access) headers.Authorization = `Bearer ${access}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // Access token expired: refresh once and retry.
  if (res.status === 401 && retry && (await refreshAccessToken())) {
    return request<T>(method, path, body, false)
  }

  if (!res.ok) {
    let err: ApiErrorBody = { error: `Request failed (${res.status})` }
    try {
      err = (await res.json()) as ApiErrorBody
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(err.error ?? `Request failed (${res.status})`, res.status, err.code, err.field_errors)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Accepts either a plain array or a DRF paginated response. */
function unwrap<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.results
}

export const realApi: GasgoApi = {
  requestOtp: (phone) => request('POST', '/auth/otp/request/', { phone }),
  verifyOtp: (phone, code) => request('POST', '/auth/otp/verify/', { phone, code }),
  getMe: () => request('GET', '/me/'),
  updateMe: (data) => request('PATCH', '/me/', data),
  registerVendor: (data) => request('POST', '/vendors/register/', data),

  listAddresses: async () => unwrap(await request('GET', '/addresses/')),
  createAddress: (data) => request('POST', '/addresses/', data),
  deleteAddress: (id) => request('DELETE', `/addresses/${id}/`),

  listProducts: async () => unwrap(await request('GET', '/products/')),
  listDealers: async ({ lat, lng }) => {
    const qs = lat !== undefined && lng !== undefined ? `?lat=${lat}&lng=${lng}` : ''
    return unwrap(await request('GET', `/dealers/${qs}`))
  },

  quote: (req) => request('POST', '/orders/quote/', req),
  listOrders: async () => unwrap(await request<Order[] | Paginated<Order>>('GET', '/orders/')),
  getOrder: (id) => request('GET', `/orders/${id}/`),
  createOrder: (req) => request('POST', '/orders/', req),
  payOrder: (id, phone) => request('POST', `/orders/${id}/pay/`, { phone }),
  cancelOrder: (id) => request('POST', `/orders/${id}/cancel/`),
  confirmReceived: (id) => request('POST', `/orders/${id}/confirm-received/`),

  listDealerOrders: async () => unwrap(await request<Order[] | Paginated<Order>>('GET', '/dealer/orders/')),
  dealerAccept: (id) => request('POST', `/dealer/orders/${id}/accept/`),
  dealerReject: (id, reason) => request('POST', `/dealer/orders/${id}/reject/`, { reason }),
  dealerSetStatus: (id, status) => request('POST', `/dealer/orders/${id}/status/`, { status }),

  getMyShop: () => request('GET', '/dealer/shop/'),
  setShopOpen: (is_open) => request('PATCH', '/dealer/shop/', { is_open }),
  updateShop: (patch) => request('PATCH', '/dealer/shop/', patch),
  listMyStock: async () => unwrap(await request('GET', '/dealer/stock/')),
  addStock: (item) => request('POST', '/dealer/stock/', item),
  updateStock: (id, data) => request('PATCH', `/dealer/stock/${id}/`, data),
  removeStock: (id) => request('DELETE', `/dealer/stock/${id}/`),

  setAccessory: (kind, data) => request('PUT', `/dealer/accessories/${kind}/`, data),
  removeAccessory: (kind) => request('DELETE', `/dealer/accessories/${kind}/`),
  getPerformance: (days) => request('GET', `/dealer/performance/?days=${days}`),
}
