# Wallet Web

React frontend for the Wallet API (React, React Router, React Hook Form, Zod).

## Run
```bash
npm install
cp .env.example .env     # VITE_API_URL must point at the running backend
npm run dev              # http://localhost:5173
```
The backend's `CORS_ORIGIN` must be `http://localhost:5173` (its default).

Other scripts: `npm test`, `npm run build`, `npm run preview`.

## Structure
```
src/
├── api/          fetch client + one file per backend resource
├── components/   ui primitives, WalletCard, TransactionTable, TransactionResult
├── context/      AuthContext (token, current user, logout on 401)
├── hooks/        useFetch, useWallets
├── layouts/      AuthLayout (public), AppLayout (protected shell)
├── pages/        one file per screen
├── utils/        money, format, errors, idempotency, transactions
└── styles/
```

## What's in the UI
- Sidebar navigation (drawer on mobile), top bar with dark-mode toggle, and a profile page.
- Charts (Recharts): 7-day cash flow, spending breakdown donut, balance over time, plus an Analytics page
  with 7 / 30 / 90 day periods and per-currency views. Chart data is built by pure, tested functions in
  `src/utils/analytics.js` from your latest 100 transactions / ledger entries (the API's page-size limit).
- Wallet cards with hide-balance toggle, quick actions, skeleton loaders, and a light/dark theme saved per device.
- The profile page is read-only: the backend has no endpoint for editing a name, email or password.

## Screens
`/login`, `/register`, `/` (dashboard), `/wallets`, `/analytics`, `/profile`, `/wallets/:id` (transactions + ledger),
`/wallets/:id/deposit`, `/wallets/:id/withdraw`, `/transfer` (form -> review -> confirm),
`/transactions` (filters + pagination, kept in the URL), `/transactions/:reference` (receipt + ledger entries).

## Things worth knowing
- **Money is integer minor units.** Users type naira; `toMinorUnits` converts with string maths (no floats).
- **Idempotency.** Each deposit / withdrawal / transfer form holds one `Idempotency-Key`. It is kept when
  the outcome is unknown (network error, 5xx) so a retry cannot double-charge, and replaced after success or
  a definite rejection.
- **POST bodies are always JSON**, even `{}` (the API rejects a missing body).
- A 401 anywhere signs the user out (except on the login/register calls).
- Wallet references are the public recipient address for transfers; there is no recipient lookup endpoint yet.
