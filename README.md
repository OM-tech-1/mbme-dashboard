# MBME Dashboard

A small admin dashboard for the [MBME payment module](https://github.com/nexa/payment-module) — store management (create, edit, activate/deactivate, rotate HMAC secrets) against its JWT-authenticated admin API.

Talks to `/admin-jwt/v1/*` — see `docs/admin-jwt-api.md` in the payment module repo for the full API contract and its security model (single access tier, no client-certificate gate — read that before deploying this anywhere).

## Stack

React + TypeScript + Vite + Tailwind. No backend of its own — this is a static SPA that calls the payment module's API directly from the browser.

## Setup

```bash
npm install
cp .env.example .env.local   # point VITE_API_BASE_URL at your backend
npm run dev
```

`VITE_API_BASE_URL` must not have a trailing slash, e.g. `http://localhost:18080/admin-jwt/v1`.

## Backend requirements

The payment module must have this dashboard's origin allowed via `ADMIN_JWT_CORS_ORIGIN` (its own env var, set on the backend, not here) — otherwise login will fail with a CORS error in the browser console, not a visible error on the login form. For local dev against `npm run dev` (port 5173), set `ADMIN_JWT_CORS_ORIGIN=http://localhost:5173` on the backend.

Create a login on the backend first (there's no self-service signup):

```bash
# from the payment-module repo, DATABASE_URL pointed at the target DB
go run ./cmd/adminuser create -username you@example.com
```

## Build

```bash
npm run build   # outputs to dist/ — deploy as a static site anywhere
```

## What it does

- **Login** — username/password against `/admin-jwt/v1/login`, JWT stored in `localStorage`, 2-hour session.
- **Stores list** — id, return origin, events URL, secret fingerprint, active/inactive (click the badge to toggle).
- **Create store** — optionally with placeholder URLs if a partner's real ones aren't known yet; a new store is always created active, so deactivate it right after if the URLs aren't final.
- **Edit** — return origin, events URL, path template. Never touches the HMAC secret (that's separate, on purpose).
- **Rotate secret** — confirms first (not zero-downtime), then reveals the new secret once.

Every secret reveal (create or rotate) requires checking "I've copied this secret somewhere secure" before the modal can be dismissed — it cannot be retrieved again afterward.

## Notes

- No per-store scoping: any login can see and modify every store. See the "Security model" section of `docs/admin-jwt-api.md` before handing a login to anyone outside your own team.
- `npm audit` currently flags a moderate esbuild advisory that only affects the Vite dev server (not the production build) and needs a breaking Vite 8 upgrade to clear — left alone deliberately for now.
