# Gasgo – frontend

The customer and dealer app for Gasgo, a gas delivery and pickup service, currently serving **Juja, Kiambu County**. It's a PWA (a web app customers can add to their home screen), built with React, TypeScript, Vite and Tailwind CSS.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run dev
```

Open http://localhost:5173. On your phone, use the "Network" address Vite prints (same Wi-Fi).

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally (to test the PWA install) |
| `npm run lint` | Check code style |

## Demo mode (no backend needed)

With `VITE_USE_MOCK_API=true` in `.env`, the app uses a fake backend that runs in the browser (`src/api/mock.ts`):

- **Login code:** always `123456`
- **Customer:** any Kenyan number, e.g. `0712 345 678`
- **Dealer:** `0700 000 001` (logs in as "Gasgo Demo Dealer" in Juja Town)
- **M-Pesa:** payments succeed after about 4 seconds. A number ending in `0000` fails, so you can test the failure screen.
- **Reset:** Profile → "Reset demo data"

To test the whole flow, place and pay for an order as a customer from the Gasgo Demo Dealer, log out, then log in as the dealer to accept it and move it to delivered. Log back in as the customer to see the tracking update.

## Ordering flow on the home screen

1. **Delivery or pickup**
2. **Gas brand** – glass dropdown (K-Gas, Total, Pro Gas, Afrigas, Hashi Gas, Rubis in demo data; real brands come from `/products/`)
3. **Refill or new purchase** – glass dropdown
4. **Size and quantity** – 6 kg / 13 kg cards with + and −

The dropdown is a reusable component: `src/components/GlassSelect.tsx`.

## Colours

All colours live in `src/index.css`:

| Name | Hex | Used for |
| --- | --- | --- |
| Branding Orange | `#E85002` | Buttons, active states, accents (`brand-600`) |
| Primary | `#000000` | Dark backgrounds, text on light pages (`ink`) |
| White | `#F9F9F9` | Light page background, text on dark |
| Light Gray / Gray / Dark Gray | `#A7A7A7` / `#646464` / `#333333` | Secondary text, borders, surfaces (the `slate-*` greys are remapped to these) |
| Branding Gradient | `#D9C3AB → #F16001 → #C10801 → #000000` | Accent strips (`bg-brand-gradient`); buttons use its orange→red middle (`bg-brand-button`) |

M-Pesa payment buttons stay green so customers recognise them.

## Animations

- **Page transitions** (`src/components/PageTransition.tsx`): parallax slide with depth blur. The page you leave drifts away, dims and blurs out of focus, and a soft blur band rides along the seam so its edge melts away; the new page slides in sharp. Back reverses it; bottom tabs slide in the direction of the tab. Tweak `DURATION`, `PARALLAX`, `BLUR` and `SEAM_W` at the top of the file.
- **Edge blur** (`EdgeBlur` in `src/components/glass.tsx`): on glass pages, content scrolling under the header or behind the nav bar / bottom buttons fades into a progressive blur instead of a hard edge.
- **Scroll motion** (`src/components/ScrollMotion.tsx` + `.motion-item` styles in `index.css`): cards fade up and come into focus one after another when a page opens; as you scroll, cards leaving the top blur and fade, and sharpen again when you scroll back. Add the `motion-item` class to any element to give it this motion.
- **Scroll parallax** (`src/hooks/useScrollParallax.ts`): the landing and login background photos scroll slower than the content.
- **Floating nav bar** (`src/components/FloatingNav.tsx`): liquid-glass pill with a liquid-slide pointer. The pointer's leading edge springs ahead, the trailing edge follows (it stretches and thins), and a droplet lags behind and melts back in through a gooey SVG filter. Orange dot on Orders while an order is in progress. Sizes and spring settings (`LEAD`, `TRAIL`, `DROP`) are at the top of the file.
- **Dropdowns** (`src/components/GlassSelect.tsx`): parallax open/close. The glass panel unrolls while the options slide in on a separate layer, each lower option travelling further; closing reverses it.
- All of these switch off when the phone's "reduce motion" setting is on.

## Service area (Juja)

`src/lib/serviceArea.ts` sets the area: Juja town centre with a 10 km radius, the Juja neighbourhoods used as quick picks, and the map bounds. Pins outside the area are refused with a clear message. The backend must enforce the same rule; the frontend check only gives instant feedback. Coordinates are approximate, so tune them once you have real dealer locations.

## Connecting the real Django API

1. In `.env`, set `VITE_USE_MOCK_API=false` and `VITE_API_BASE_URL` to the backend (e.g. `http://localhost:8000/api/v1`).
2. Restart `npm run dev` (Vite only reads `.env` at start-up).
3. The backend must allow this origin in CORS (`django-cors-headers`).

Every request goes through `src/api/real.ts`. The endpoints and field names follow the kickoff agreement doc. If the backend names something differently, change it in `src/api/real.ts` and `src/types/index.ts` only.

What the frontend expects from the backend, beyond the agreement doc:

- `POST /auth/otp/verify/` returns `{ access, refresh, user, is_new_user }`.
- **Refunds (pay-first):** when a paid order is `rejected_by_dealer` or `cancelled`, refund it to M-Pesa and then set status `refunded` (keep the earlier status in `status_history`). Orders also carry `cancellation_reason`: `"customer"`, `"dealer_timeout"` (paid order not accepted in time, cancelled by the backend) or `null`. The timeout length is the backend's choice; the demo data uses 3 minutes.
- **Vendor sign-up:** `POST /vendors/register/` (logged-in user) with `{ shop_name, address, landmark_notes, lat, lng, opening_hours, delivery_radius_km }`. It creates the dealer (shop), switches the user's `role` to `dealer`, and returns `{ user, dealer }`. Reject pins outside Juja. Decide whether new shops go live immediately or wait for admin approval (e.g. after checking their licence); the frontend currently assumes they're live.
- **Vendor stock (vendors enter their own gas types):**
  - `GET /dealer/shop/` → the vendor's own shop; `PATCH /dealer/shop/` with `{ is_open }` opens/closes it.
  - `GET /dealer/stock/` → `[{ id, product: { id, brand, size_kg, type, ... }, quantity, price_kes }]`.
  - `POST /dealer/stock/` with `{ brand, size_kg, type, price_kes, quantity }`. The brand is free text typed by the vendor; match it to an existing catalogue entry ignoring case, spaces and dashes ("kgas" = "K-Gas"), or create a new one. Refuse duplicates in the same shop.
  - `PATCH /dealer/stock/{id}/` with `{ quantity }` and/or `{ price_kes }`; `DELETE /dealer/stock/{id}/`.
  - Each dealer's `stock` entries now include the shop's own `price_kes`. Quotes and orders must use **that shop's** price.
  - `GET /products/` should return only gas types that at least one **open** shop has in stock, with `price_kes` = the lowest of those shop prices (shown to customers as "from KES …").
  - Accepting an order should reduce the shop's stock.
- `GET /orders/{id}/` also works for the dealer who owns the order (the dealer screens use it).
- Orders include a `customer: { name, phone }` field for the dealer's view.
- Dealer endpoints: `GET /dealer/orders/`, `POST /dealer/orders/{id}/accept/`, `POST /dealer/orders/{id}/reject/` (`{ reason }`), `POST /dealer/orders/{id}/status/` (`{ status }`).
- Lists can be plain arrays or DRF paginated responses; both work.

## Google Maps

Leave `VITE_GOOGLE_MAPS_API_KEY` empty to use a simple location picker (GPS + test areas). To enable the real map, create a browser key in Google Cloud with **Maps JavaScript API** and **Geocoding API** enabled, restrict it to your site's domains, and put it in `.env`.

## Opening it in Chrome on your computer

Run `npm run dev` and open http://localhost:5173 in Chrome. To see it as a phone, press F12, then Ctrl+Shift+M (device toolbar) and pick a phone such as "iPhone 12 Pro".

## Folder structure

```
src/
  api/          index.ts (picks mock or real), real.ts (Django client), mock.ts (fake backend), types.ts
  components/   Layout (tabs, auth guard, offline + install banners), ui (buttons, cards…),
                MapPicker, StatusTimeline, CylinderIcon
  hooks/        queries.ts – data fetching, caching and polling (TanStack Query)
  lib/          format.ts (KES, phone numbers, status labels), location.ts, storage.ts
  pages/        one file per screen; dealer/ holds the dealer screens
  store/        auth.ts (login tokens), cart.ts (current order being built) – Zustand
  types/        TypeScript shapes of the API data
  App.tsx       all routes
  config.ts     support phone / WhatsApp (placeholders – replace before launch)
  index.css     Tailwind + brand colours (edit the @theme block to re-theme)
public/         app icons (favicon.svg is the logo source)
```

## Joining: clients and vendors

The landing page offers two ways in:

- **I need gas → Join as a client** (`/login?as=client`): phone → SMS code → name → ordering.
- **I sell gas → Join as a vendor** (`/login?as=vendor`): phone → SMS code → owner's name → **shop details** (shop name, exact pin location, address and landmark, opening hours, delivery distance) → the dealer screens.
- **Log in** (`/login`): existing accounts. Customers go to ordering, vendors to their dealer screens.

An existing vendor who taps "I sell gas" goes straight to their dealer screens. A customer who taps it can register a shop on the same phone number.

## Vendor stock

Vendors manage their own gas list on **Stock** (`/dealer/stock`, next to **Orders**):

- **Add a gas type:** brand (typed by the vendor, with suggestions from brands other shops use), cylinder size (3/6/13/22/50 kg or any other), refill or new cylinder, price and quantity in stock.
- **Stock levels:** each item shows *In stock*, *Low* (3 or fewer) or *Out of stock*, with +/− buttons. The price can be edited in place, and items can be removed.
- **Open / closed** switch for the shop.
- New shops start with no gas listed and land on this screen right after registering.

Customers only see brands and sizes that some open shop has in stock, priced "from" the cheapest shop; each shop's own total shows in the dealer list and at checkout.

## Screens

| Route | Screen |
| --- | --- |
| `/welcome` | Intro |
| `/login` | Phone → SMS code → name (new users) → shop details (vendors) |
| `/` | Choose delivery/pickup and gas |
| `/location` | Saved addresses, drop a new pin |
| `/dealers` | Dealers sorted by distance, with stock and opening hours |
| `/checkout` | Summary with backend-calculated fee and total |
| `/orders/:id/pay` | M-Pesa STK Push: waiting, success, failure, timeout |
| `/orders/:id` | Live tracking (refreshes every 3 s) |
| `/orders`, `/help`, `/profile` | History, FAQ + gas safety, account |
| `/dealer`, `/dealer/orders/:id` | Vendor orders: new / in progress / completed, accept, reject, update status |
| `/dealer/stock` | Vendor stock: gas types, prices, stock levels, open/closed |

## Before launch

- Replace the placeholder support numbers in `src/config.ts`.
- Decide pay-before-accept vs accept-before-pay with the backend (see the kickoff doc); the screens currently follow pay first.
- Deploy over HTTPS (needed for the PWA and GPS), e.g. Vercel or Netlify. Set the same `VITE_` variables in the host's settings, and add a rewrite so every path serves `index.html`.
