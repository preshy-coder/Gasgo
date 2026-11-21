// TanStack Query hooks: caching, loading states and refetching for every API call.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import type { AccessoryKind, NewAddress, NewStockItem, Order, OrderStatus, QuoteRequest, StockItem, ShopUpdate } from '../types'
import { awaitingRefund, isActiveOrder } from '../lib/format'

export const keys = {
  me: ['me'] as const,
  addresses: ['addresses'] as const,
  products: ['products'] as const,
  dealers: (lat?: number, lng?: number) => ['dealers', lat, lng] as const,
  quote: (req: QuoteRequest | null) => ['quote', req] as const,
  orders: ['orders'] as const,
  order: (id: number) => ['order', id] as const,
  dealerOrders: ['dealer-orders'] as const,
  myShop: ['my-shop'] as const,
  myStock: ['my-stock'] as const,
  performance: (days: number) => ['performance', days] as const,
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
      const o = q.state.data
      if (!o) return false
      if (isActiveOrder(o.status)) return 3000
      return awaitingRefund(o) ? 10_000 : false // keep checking until the refund shows up
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
export const useConfirmReceived = () => useOrderMutation((id: number) => api.confirmReceived(id))

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

// ---------- Vendor shop & stock ----------

export const useMyShop = () => useQuery({ queryKey: keys.myShop, queryFn: api.getMyShop })
export const useMyStock = () => useQuery({ queryKey: keys.myStock, queryFn: api.listMyStock })

/** After any stock change, refresh the vendor's list and everything customers see. */
function useStockInvalidate() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: keys.myStock })
    qc.invalidateQueries({ queryKey: keys.myShop })
    qc.invalidateQueries({ queryKey: keys.products })
    qc.invalidateQueries({ queryKey: ['dealers'] })
  }
}

export function useUpdateShop() {
  const invalidate = useStockInvalidate()
  return useMutation({ mutationFn: (patch: ShopUpdate) => api.updateShop(patch), onSuccess: invalidate })
}

export function useSetShopOpen() {
  const invalidate = useStockInvalidate()
  return useMutation({ mutationFn: (isOpen: boolean) => api.setShopOpen(isOpen), onSuccess: invalidate })
}

export function useAddStock() {
  const invalidate = useStockInvalidate()
  return useMutation({ mutationFn: (item: NewStockItem) => api.addStock(item), onSuccess: invalidate })
}

export function useUpdateStock() {
  const qc = useQueryClient()
  const invalidate = useStockInvalidate()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<Pick<StockItem, 'quantity' | 'price_kes' | 'delivery_fee_kes'>>) => api.updateStock(id, data),
    // Update the list straight away so +/- feels instant; the server copy replaces it after.
    onMutate: ({ id, ...data }) => {
      qc.setQueryData<StockItem[]>(keys.myStock, (old) => old?.map((it) => (it.id === id ? { ...it, ...data } : it)))
    },
    onSettled: invalidate,
  })
}

export function useRemoveStock() {
  const invalidate = useStockInvalidate()
  return useMutation({ mutationFn: (id: number) => api.removeStock(id), onSuccess: invalidate })
}

// ---------- Vendor market & performance ----------

export function useSetAccessory() {
  const invalidate = useStockInvalidate()
  return useMutation({
    mutationFn: ({ kind, ...data }: { kind: AccessoryKind; price_kes: number; in_stock: boolean }) => api.setAccessory(kind, data),
    onSuccess: invalidate,
  })
}

export function useRemoveAccessory() {
  const invalidate = useStockInvalidate()
  return useMutation({ mutationFn: (kind: AccessoryKind) => api.removeAccessory(kind), onSuccess: invalidate })
}

export const usePerformance = (days: number) =>
  useQuery({ queryKey: keys.performance(days), queryFn: () => api.getPerformance(days), refetchInterval: 30_000 })
