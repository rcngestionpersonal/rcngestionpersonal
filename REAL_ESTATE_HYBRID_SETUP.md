# BrokerHub AI - Stripe + Hybrid Setup

## 1) Hybrid runtime mode

Use `USE_REAL_ESTATE_MOCK=true` for local demo without external database or Stripe.

Use `USE_REAL_ESTATE_MOCK=false` for production-like mode with PostgreSQL + Stripe webhooks.

## 2) Environment variables

Required for production-like billing:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` (optional if you want dynamic fallback pricing)
- `STRIPE_WEBHOOK_SECRET`

## 3) Stripe endpoints

- Checkout session: `POST /api/real-estate/stripe/checkout`
  - Body: `{ "agentId": "..." }`

- Stripe webhook: `POST /api/real-estate/stripe/webhook`
  - Configure this URL in Stripe Dashboard.
  - Events to subscribe:
    - `checkout.session.completed`
    - `customer.subscription.created`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`

## 4) Local run

1. `npm run dev`
2. Open `http://localhost:3000`
3. Bootstrap demo agents
4. Submit a lead from `/contacto`
5. Activate subscription from UI

## 5) Production checklist

1. Set `USE_REAL_ESTATE_MOCK=false`
2. Ensure PostgreSQL connectivity and Prisma schema deployed
3. Configure Stripe webhook endpoint + secret
4. Monitor logs for failed webhook deliveries

## 6) Local Stripe test runbook

For a complete local test with Stripe CLI (checkout + webhook events), see:

- `STRIPE_LOCAL_TESTING.md`

## 7) Security and access control

- Session auth: signed cookie (`brokerhub_session`) with role claims.
- Login endpoints:
  - `POST /api/auth/login` (admin)
  - `POST /api/auth/agent-login` (agent by phone)
  - `GET /api/auth/me`
  - `POST /api/auth/logout`
- View protection:
  - Middleware redirects unauthenticated users to `/login`.
- API protection:
  - All `api/real-estate/*` require auth except integration webhooks.
  - Mutating endpoints require `admin` role, except opportunity claim.
  - Agent can only claim opportunities with its own `agentId`.
