# AsiaTix

A modern, animated ticket marketplace for events across Asia. Language, currency and payment methods switch automatically from the visitor’s country.

## Run it

```bash
cd C:\Users\Administrator\asiatix
node server.js
```

Then open **http://localhost:5173**

Or just open `index.html` in a browser (geo-detection needs a local server).

Force a country for testing: `http://localhost:5173/?region=JP`  
Codes: `CN` `HK` `TW` `JP` `KR` `IN` `TH` `VN` `ID` `MY` `SG` `PH` `AE` `SA`

## What it does

- **11 languages** — English, 中文, 日本語, 한국어, हिन्दी, ไทย, Tiếng Việt, Bahasa Indonesia, Bahasa Melayu, Filipino, العربية (RTL)
- **Auto-detect** — IP geolocation, then timezone, then browser language. Choice is saved.
- **Local currency** — prices convert from USD using the rates in `config.js`
- **Local wallets** — Alipay, WeChat Pay, UPI, GCash, GrabPay, PromptPay, PayNow, DANA, GoPay, MoMo, KakaoPay, LINE Pay, PayPay, UnionPay, plus Visa/Mastercard, PayPal, Payoneer and USDT
- **Checkout** — 3-step modal, processing loader, QR e-ticket, confetti. Demo mode is on by default.

## Files

All of the project lives in `C:\Users\Administrator\asiatix` on this computer:

- `index.html` — page
- `styles.css` — theme and animations
- `app.js` — events, checkout, geo
- `config.js` — countries, currencies, payment methods
- `i18n.js` — translations
- `server.js` — local server

## Go live (real payments)

1. Connect a card / wallet aggregator (Stripe, 2C2P, Xendit, Airwallex, or similar).
2. Set `demoMode: false` in `config.js` and point `checkoutEndpoint` at your backend.
3. Your backend creates a payment session with the gateway and returns `{ "url": "https://…" }`. The site redirects the buyer there.
4. Swap the indicative FX rates in `config.js` for a live-rates API.

Edit events, countries and copy in `app.js`, `config.js` and `i18n.js`.
# texora
