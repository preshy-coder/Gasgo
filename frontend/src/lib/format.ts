import type { OrderStatus, Product } from '../types'

/** 2950 -> "KES 2,950" */
export function formatKes(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

/**
 * Normalise a Kenyan phone number to 2547XXXXXXXX / 2541XXXXXXXX (the format M-Pesa needs).
 * Accepts 07..., 01..., 7..., 1..., +254..., 254... Returns null if invalid.
 */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  let local: string
  if (digits.startsWith('254')) local = digits.slice(3)
  else if (digits.startsWith('0')) local = digits.slice(1)
  else local = digits
  if (!/^[17]\d{8}$/.test(local)) return null
  return `254${local}`
}

/** 254712345678 -> "0712 345 678" */
export function displayPhone(phone: string): string {
  const local = phone.startsWith('254') ? `0${phone.slice(3)}` : phone
  return local.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3')
}

export function productName(p: Product): string {
  return `${p.brand} ${p.size_kg}kg`
}

export function productTypeLabel(p: Product): string {
  return p.type === 'refill' ? 'Refill' : 'New cylinder + gas'
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Awaiting payment',
  paid: 'Paid',
  accepted: 'Accepted by dealer',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  ready_for_pickup: 'Ready for pickup',
  collected: 'Collected',
  payment_failed: 'Payment failed',
  rejected_by_dealer: 'Rejected by dealer',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export type StatusTone = 'neutral' | 'progress' | 'success' | 'danger'

export function statusTone(s: OrderStatus): StatusTone {
  if (s === 'delivered' || s === 'collected') return 'success'
  if (s === 'payment_failed' || s === 'rejected_by_dealer' || s === 'cancelled') return 'danger'
  if (s === 'placed' || s === 'refunded') return 'neutral'
  return 'progress'
}

export function isActiveOrder(s: OrderStatus): boolean {
  return statusTone(s) === 'progress' || s === 'placed'
}

/** Statuses where the customer's M-Pesa payment has gone through and the order is going ahead. */
export const PAID_STATUSES: OrderStatus[] = ['paid', 'accepted', 'out_for_delivery', 'ready_for_pickup', 'delivered', 'collected']

/** What the dealer is paid for an order: the gas plus their delivery fee (Gasgo keeps the service fee). */
export function dealerPayout(o: { subtotal_kes: number; delivery_fee_kes: number }): number {
  return o.subtotal_kes + o.delivery_fee_kes
}

/** A paid order that was rejected or cancelled and whose refund hasn't been sent yet. */
export function awaitingRefund(o: { status: OrderStatus; mpesa_receipt: string | null }): boolean {
  return (o.status === 'rejected_by_dealer' || o.status === 'cancelled') && !!o.mpesa_receipt
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  })
}
