# redinmo.io Domain Setup

I can prepare the app for the domain, but I cannot access your Namecheap account directly from here. What I can do is leave the project ready and tell you the exact DNS changes.

## 1) App changes already prepared

- The app now reads `NEXT_PUBLIC_APP_URL` as the production base URL.
- Metadata and canonical URLs now come from that base URL.
- Stripe redirects should use `https://redinmo.io` once deployed.

## 2) Namecheap DNS records

In Namecheap, go to:

- Domain List
- Manage
- Advanced DNS

Then set:

- `A` record for `@` -> your hosting platform IP or the provider's required target
- `CNAME` record for `www` -> `redinmo.io`

If you deploy on Vercel, use the values Vercel gives you:

- `A` record for `@` -> `76.76.21.21`
- `CNAME` record for `www` -> `cname.vercel-dns.com`

## 3) Vercel domain binding

If the app is deployed on Vercel:

1. Open the project in Vercel.
2. Add the domain `redinmo.io`.
3. Add `www.redinmo.io` as a redirect or secondary domain.
4. Set `NEXT_PUBLIC_APP_URL=https://redinmo.io` in production environment variables.

## 4) SSL and propagation

- Namecheap DNS changes can take a few minutes to propagate.
- SSL is managed by the hosting provider; in Vercel it is automatic after domain verification.

## 5) What to check after pointing the domain

- `https://redinmo.io` loads the login page.
- `/login` works on the custom domain.
- API routes respond on the same domain.
- Stripe checkout redirects back to `https://redinmo.io`.

## 6) If you want me to finish the repo side

I can also add:

- a `robots.txt`
- a `sitemap.xml`
- a stronger production `metadataBase`
- a deployment checklist for Vercel + Namecheap
