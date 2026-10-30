# AsiaTix

A ticket marketplace for events across Asia. Language and currency follow the visitor’s country. Checkout is **Stripe only**.

## Run it

```bash
cd C:\Users\Administrator\asiatix
npm start
```

Then open **http://localhost:5173**

Copy `.env.example` to `.env` and set Stripe keys (see below). Without `STRIPE_SECRET_KEY`, checkout returns an error instead of a fake ticket.

## Deploy on Vercel

Import this repo in [Vercel](https://vercel.com/new). There is no build step: static files are served from the root, and `/api/*` goes to serverless functions.

Set these environment variables (Project → Settings → Environment Variables) for **Production**:

| Variable | Required | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | yes | `sk_live_…` (use `sk_test_…` until you go live) |
| `STRIPE_WEBHOOK_SECRET` | yes | `whsec_…` from the Stripe webhook endpoint |
| `SITE_URL` | yes | Public origin, e.g. `https://your-domain.com` (no trailing slash) |
| `ADMIN_PASSWORD` | recommended | Admin panel password |
| `ADMIN_SECRET` | recommended | Token signing secret |

Admin and chat writes on Vercel live on the serverless filesystem, so they can reset between invocations. Seed events in `data/events.json` always load.

Force a country for testing: `http://localhost:5173/?region=JP`  
Codes: `CN` `HK` `TW` `JP` `KR` `IN` `TH` `VN` `ID` `MY` `SG` `PH` `AE` `SA`

## Stripe (production)

Checkout creates a [Stripe Checkout Session](https://stripe.com/docs/payments/checkout) on the server. The amount is quoted from `data/events.json` (event USD × FX × VIP 2.2 × qty + 3% fee). The browser total is never trusted.

1. In Stripe Dashboard, enable the payment methods you want buyers to see (cards, Apple Pay, Google Pay, Link, etc.). AsiaTix does not hard-code method types — Checkout uses whatever is enabled on the account.
2. Enable the currencies you sell in (or leave USD; unsupported local currencies fall back to USD).
3. Add a webhook endpoint: `https://YOUR_DOMAIN/api/webhooks/stripe`  
   Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
4. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Verify the domain in Stripe for Apple Pay / Google Pay.

Local webhook testing: `stripe listen --forward-to localhost:5173/api/webhooks/stripe`

## What it does

- **11 languages** — English, 中文, 日本語, 한국어, हिन्दी, ไทย, Tiếng Việt, Bahasa Indonesia, Bahasa Melayu, Filipino, العربية (RTL)
- **Auto-detect** — IP geolocation, then timezone, then browser language. Choice is saved.
- **Local currency** — prices convert from USD using the rates in `config.js`
- **Stripe Checkout** — 3-step modal, hosted Stripe pay page, QR e-ticket after `payment_status=paid`

## Files

- `index.html` — page
- `styles.css` — theme and animations
- `app.js` — events, checkout, geo
- `config.js` — countries and currencies
- `i18n.js` — translations
- `server.js` — local server
- `api/` — Vercel serverless API (same routes as the local server)
- `api/webhooks/stripe.js` — Stripe webhook (raw body, HMAC verify)
- `vercel.json` — Vercel routing and headers
