// TanStack Query hooks: caching, loading states and refetching for every API call.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { NewAddress, Order, OrderStatus, QuoteRequest } from '../types'
import { isActiveOrder } from '../lib/format'

export const keys = {
  me: ['me'] as const,
  addresses: ['addresses'] as const,
  products: ['products'] as const,
  dealers: (lat?: number, lng?: number) => ['dealers', lat, lng] as const,
  quote: (req: QuoteRequest | null) => ['quote', req] as const,
  orders: ['orders'] as const,
  order: (id: number) => ['order', id] as const,
  dealerOrders: ['dealer-orders'] as const,
}

export const useProducts = () => useQuery({ queryKey: keys.products, queryFn: api.listProducts, staleTime: 5 * 60_000 })

export const useAddresses = () => useQuery({ queryKey: keys.addresses, queryFn: api.listAddresses })

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: NewAddress) => api.createAddress(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

export function useDeleteAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.deleteAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.addresses }),
  })
}

export const useDealers = (lat?: number, lng?: number) =>
  useQuery({ queryKey: keys.dealers(lat, lng), queryFn: () => api.listDealers({ lat, lng }) })

export const useQuote = (req: QuoteRequest | null) =>
  useQuery({
    queryKey: keys.quote(req),
    queryFn: () => api.quote(req!),
    enabled: req !== null,
    retry: false,
  })

export const useOrders = () =>
  useQuery({
    queryKey: keys.orders,
    queryFn: api.listOrders,
    // Keep the list fresh while any order is still moving.
    refetchInterval: (q) => (q.state.data?.some((o) => isActiveOrder(o.status)) ? 10_000 : false),
  })

/** Polls every 3 s while the order is awaiting payment or in progress. */
export const useOrder = (id: number) =>
  useQuery({
    queryKey: keys.order(id),
    queryFn: () => api.getOrder(id),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      if (!s) return false
      return isActiveOrder(s) ? 3000 : false
    },
  })

function useOrderMutation<V>(fn: (v: V) => Promise<Order>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(keys.order(order.id), order)
      qc.invalidateQueries({ queryKey: keys.orders })
      qc.invalidateQueries({ queryKey: keys.dealerOrders })
    },
  })
}

export const useCreateOrder = () => useOrderMutation((req: QuoteRequest) => api.createOrder(req))
export const useCancelOrder = () => useOrderMutation((id: number) => api.cancelOrder(id))

export function usePayOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, phone }: { id: number; phone: string }) => api.payOrder(id, phone),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: keys.order(v.id) }),
  })
}

export const useDealerOrders = () =>
  useQuery({ queryKey: keys.dealerOrders, queryFn: api.listDealerOrders, refetchInterval: 10_000 })

export const useDealerAccept = () => useOrderMutation((id: number) => api.dealerAccept(id))
export const useDealerReject = () =>
  useOrderMutation(({ id, reason }: { id: number; reason: string }) => api.dealerReject(id, reason))
export const useDealerSetStatus = () =>
  useOrderMutation(({ id, status }: { id: number; status: OrderStatus }) => api.dealerSetStatus(id, status))
