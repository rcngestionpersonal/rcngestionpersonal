# Stripe Local Testing (BrokerHub AI)

This guide validates checkout + webhook end-to-end in local development.

## 1) Prerequisites

- Stripe CLI installed and logged in (`stripe login`)
- App running: `npm run dev`
- Local env configured in `.env.local`:
  - `USE_REAL_ESTATE_MOCK=false`
  - `STRIPE_SECRET_KEY=sk_test_...`
  - `NEXT_PUBLIC_APP_URL=http://localhost:3000`

Optional but recommended:

- `STRIPE_WEBHOOK_SECRET` (filled from Stripe CLI listen command output)
- `STRIPE_PRICE_ID` (if you already created a recurring monthly price)

## 2) Start Stripe webhook forwarder

Use script:

- `npm run stripe:listen`

It forwards events to:

- `http://localhost:3000/api/real-estate/stripe/webhook`

Copy the webhook secret shown by Stripe CLI and place it in `.env.local` as `STRIPE_WEBHOOK_SECRET`.
Restart `npm run dev` after updating env.

## 3) Create or bootstrap an agent

From UI:

- Open `http://localhost:3000`
- Click `Cargar agentes demo`

Or API:

- `POST /api/real-estate/bootstrap`

## 4) Launch checkout

From UI:

- Click `Activar $8.99` on any trial agent.

From API:

- `POST /api/real-estate/stripe/checkout` with `{ "agentId": "..." }`

Expected:

- Redirect to Stripe Checkout hosted page.

## 5) Trigger test events (CLI)

- `npm run stripe:trigger:checkout`
- `npm run stripe:trigger:sub-updated`
- `npm run stripe:trigger:sub-deleted`

## 6) Expected webhook behavior

- `checkout.session.completed` -> agent becomes `ACTIVE`
- `customer.subscription.updated` -> status mapped (`ACTIVE`, `TRIAL`, `PAST_DUE`, etc.)
- `customer.subscription.deleted` -> agent becomes `CANCELED`
- Duplicate event IDs are ignored (idempotency enabled)

## 7) Troubleshooting

- If checkout returns mock mode:
  - verify `USE_REAL_ESTATE_MOCK=false`
  - verify `STRIPE_SECRET_KEY`
- If webhook signature fails:
  - verify `STRIPE_WEBHOOK_SECRET`
  - restart dev server after env changes
- If DB updates fail:
  - verify `DATABASE_URL` and Prisma schema deployment
