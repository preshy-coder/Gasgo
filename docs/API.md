# API Contract (draft v0.1)

Base URL (dev): `http://127.0.0.1:8000/api/`
Auth: `Authorization: Token <token>` on every request except register/login.
Phones are always `2547XXXXXXXX`. Money is a string like `"1650.00"` (KES).
Backend changes this file in the same PR as any endpoint change.

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register/` | `phone`, `password`, `name` | `{token, user}` |
| POST | `/auth/login/` | `phone`, `password` | `{token, user}` |

## Dealers (customer side)
| Method | Path | Notes |
|---|---|---|
| GET | `/dealers/?lat=-1.10&lng=37.01` | Active dealers within their delivery radius, nearest first |
| GET | `/dealers/{id}/` | Dealer with products: `[{id, brand, size_kg, refill_price, in_stock}]` |

## Orders (customer side)
| Method | Path | Notes |
|---|---|---|
| POST | `/orders/` | `{dealer, product, customer_phone, latitude, longitude, address_note}` creates the order |
| GET | `/orders/` | My orders |
| GET | `/orders/{id}/` | Order detail. Poll every 10 seconds for status |
| POST | `/orders/{id}/cancel/` | Only allowed before payment |
| POST | `/orders/{id}/pay/` | Triggers M-Pesa STK Push once status is `accepted` |

## Orders (dealer side)
| Method | Path | Notes |
|---|---|---|
| GET | `/dealer/orders/?status=awaiting_dealer` | Incoming orders |
| POST | `/dealer/orders/{id}/accept/` | |
| POST | `/dealer/orders/{id}/reject/` | |
| POST | `/dealer/orders/{id}/out-for-delivery/` | |
| POST | `/dealer/orders/{id}/delivered/` | |

## Order object
```json
{
  "id": 12,
  "status": "accepted",
  "dealer": {"id": 3, "name": "Juja Gas Hub", "phone": "254700000000"},
  "product": {"brand": "Total", "size_kg": 13},
  "latitude": -1.1012,
  "longitude": 37.0144,
  "address_note": "Gate B, block 4",
  "gas_price": "1500.00",
  "delivery_fee": "150.00",
  "total": "1650.00",
  "created_at": "2026-10-29T12:30:00+03:00"
}
```

## Status flow
`placed` > `awaiting_dealer` > `accepted` > `paid` > `out_for_delivery` > `delivered`
Side exits: `rejected`, `expired`, `cancelled`, `payment_failed`, `refunded`

Customers pay after the dealer accepts, so a rejection never needs a refund.
Status after payment is confirmed by the M-Pesa callback on the server, never by the app.

## Errors
`{"detail": "message"}` with a normal HTTP code (400 validation, 401 not logged in, 403 not allowed, 404 not found, 409 invalid status change).
