import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { safeStorage } from '../lib/storage'
import type { AccessoryKind, AccessoryLine, CartLine, OrderType, ProductType } from '../types'

interface CartState {
  orderType: OrderType
  items: CartLine[]
  /** Gas equipment to buy with the cylinder (regulator, hose, lighter, grill), from the chosen shop. */
  accessories: AccessoryLine[]
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
  /** quantity 0 removes it. length_m is for the hose. */
  setAccessory: (kind: AccessoryKind, quantity: number, length_m?: number) => void
  setAddress: (id: number | null) => void
  setDealer: (id: number | null) => void
  clear: () => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      orderType: 'delivery',
      items: [],
      accessories: [],
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
      setAccessory: (kind, quantity, length_m) =>
        set((s) => {
          const old = s.accessories.find((a) => a.kind === kind)
          const rest = s.accessories.filter((a) => a.kind !== kind)
          const line: AccessoryLine = { kind, quantity, ...(kind === 'hose' ? { length_m: length_m ?? old?.length_m ?? 1.5 } : {}) }
          return { accessories: quantity > 0 ? [...rest, line] : rest }
        }),
      setAddress: (addressId) => set({ addressId, dealerId: null }),
      setDealer: (dealerId) => set({ dealerId }),
      clear: () => set({ items: [], accessories: [], dealerId: null }),
    }),
    {
      name: 'gasgo-cart',
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      // v0 carts had no accessories list.
      migrate: (old) => ({ ...(old as object), accessories: [] }) as unknown as CartState,
    },
  ),
)

export const cartCount = (items: CartLine[]) => items.reduce((n, i) => n + i.quantity, 0)
