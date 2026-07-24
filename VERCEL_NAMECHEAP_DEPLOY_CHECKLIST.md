# Vercel + Namecheap Deploy Checklist for redinmo.io

## Goal

Put BrokerHub AI online at `https://redinmo.io` and keep `www.redinmo.io` working as a redirect or secondary domain.

## 1) Prepare production variables

In Vercel, set these environment variables for Production:

- `NEXT_PUBLIC_APP_URL=https://redinmo.io`
- `AUTH_SECRET=<strong-random-secret>`
- `ADMIN_EMAIL=admin@brokerhub.local`
- `ADMIN_PASSWORD=<strong-password>`
- `TENANT_ID=brokerhub`
- `USE_REAL_ESTATE_MOCK=false`
- `DATABASE_URL=<your-neon-postgres-url>`
- `STRIPE_SECRET_KEY=<stripe-secret>`
- `STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>`
- `STRIPE_PRICE_ID=<stripe-price-id>`
- `OPENAI_API_KEY=<optional>`
- `OPENAI_MODEL=gpt-4.1-mini`

## 2) Deploy the app

1. Push the current codebase to your Git provider.
2. Import the repository into Vercel.
3. Confirm the build succeeds.
4. Open the production deployment URL from Vercel.

## 3) Add the custom domain in Vercel

1. Go to the project in Vercel.
2. Open Settings -> Domains.
3. Add `redinmo.io`.
4. Add `www.redinmo.io`.
5. Set `redinmo.io` as the primary domain if Vercel allows it.

## 4) Configure Namecheap DNS

In Namecheap:

1. Open Domain List.
2. Click Manage on `redinmo.io`.
3. Go to Advanced DNS.
4. Remove conflicting records for `@` and `www` if needed.
5. Add these records for Vercel:

- `A` record
  - Host: `@`
  - Value: `76.76.21.21`
  - TTL: Automatic

- `CNAME` record
  - Host: `www`
  - Value: `cname.vercel-dns.com`
  - TTL: Automatic

## 5) Wait for propagation

- DNS can take a few minutes, sometimes longer.
- After propagation, Vercel should show the domain as verified.
- SSL is automatic on Vercel after verification.

## 6) Smoke test after domain is live

Open these URLs:

- `https://redinmo.io`
- `https://redinmo.io/login`
- `https://redinmo.io/api/auth/me`

Expected:

- Home page loads.
- Login page loads.
- `api/auth/me` returns `401` when not authenticated.

## 7) Functionality test

1. Login as admin.
2. Check dashboard loads from the custom domain.
3. Bootstrap demo data.
4. Submit a test lead from `/contacto`.
5. Verify opportunities appear.
6. Login as agent.
7. Verify agent can claim only own opportunities.
8. Activate Stripe subscription flow.

## 8) Stripe webhook verification

1. In Stripe Dashboard, set webhook endpoint to:
   - `https://redinmo.io/api/real-estate/stripe/webhook`
2. Subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
3. Verify subscription status updates in the app.

## 9) Final checks

- `www.redinmo.io` resolves correctly.
- `redinmo.io` resolves correctly.
- Login persists on refresh.
- Mobile layout works on narrow screens.
- No mixed localhost URLs remain in production.

## 11) Rollback plan

If something breaks:

1. Revert the DNS change or pause the custom domain in Vercel.
2. Keep the Vercel deployment live on its default `*.vercel.app` URL.
3. Fix env or webhook issues in the Vercel project settings.

## 12) Notes

- The app now reads the public base URL from `NEXT_PUBLIC_APP_URL`.
- Canonical and Open Graph URLs are derived from that value.
- For production, do not use `http://localhost:3000`.
