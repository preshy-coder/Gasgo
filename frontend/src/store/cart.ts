import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../lib/storage'
import type { CartLine, OrderType, ProductType } from '../types'

interface CartState {
  orderType: OrderType
  items: CartLine[]
  addressId: number | null
  dealerId: number | null
  /** The gas brand the customer uses (remembered between visits). */
  brand: string | null
  /** Refill (swap an empty cylinder) or new purchase (cylinder + gas). */
  purchaseType: ProductType
  setBrand: (brand: string) => void
  setPurchaseType: (t: ProductType) => void
  setOrderType: (t: OrderType) => void
  setQuantity: (productId: number, quantity: number) => void
  setAddress: (id: number | null) => void
  setDealer: (id: number | null) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      orderType: 'delivery',
      items: [],
      addressId: null,
      dealerId: null,
      brand: null,
      purchaseType: 'refill',
      setBrand: (brand) => set({ brand }),
      setPurchaseType: (purchaseType) => set({ purchaseType }),
      setOrderType: (orderType) => set({ orderType, dealerId: null }),
      setQuantity: (product_id, quantity) =>
        set((s) => {
          const rest = s.items.filter((i) => i.product_id !== product_id)
          return { items: quantity > 0 ? [...rest, { product_id, quantity }] : rest, dealerId: null }
        }),
      setAddress: (addressId) => set({ addressId, dealerId: null }),
      setDealer: (dealerId) => set({ dealerId }),
      clear: () => set({ items: [], dealerId: null }),
    }),
    { name: 'gasgo-cart', storage: createJSONStorage(() => safeStorage) },
  ),
)

export const cartCount = (items: CartLine[]) => items.reduce((n, i) => n + i.quantity, 0)
