/* ============================================================
   AsiaTix – configuration
   Edit this file to connect real payment gateways & payouts.
   ============================================================ */
window.ASIATIX_CONFIG = {
  brand: "AsiaTix",
  baseCurrency: "USD",
  serviceFeePct: 3,

  /* true  = payments are SIMULATED (great for demos / design review)
     false = the site POSTs the order to `checkoutEndpoint` on YOUR backend,
             which must create a payment session with your gateway and return
             { "url": "https://gateway/checkout/..." } – the browser is then redirected. */
  demoMode: true,
  checkoutEndpoint: "/api/checkout",

  /* Suggested international payout rails (not shown on the site):
       - Cards via Stripe / 2C2P / Xendit / Airwallex
       - PayPal Business, Payoneer
       - USDT (TRC20 / Polygon)
       - Alipay / WeChat / UPI / GCash / GrabPay via a regional aggregator */
  payoutNotes: "International settlement",

  /* Fixed indicative FX rates (1 USD = x). Replace with a live-rates API in production. */
  rates: {
    USD: 1, CNY: 7.2, HKD: 7.8, TWD: 32, JPY: 150, KRW: 1350, INR: 84,
    THB: 35, VND: 25000, IDR: 15800, MYR: 4.4, SGD: 1.34, PHP: 57, AED: 3.67, SAR: 3.75
  },

  /* IP geolocation providers (tried in order, 2.5 s timeout each) */
  geoEndpoints: [
    { url: "https://ipwho.is/", pick: (d) => d.success !== false && d.country_code },
    { url: "https://ipapi.co/json/", pick: (d) => d.country_code }
  ]
};

/* ------------------------------------------------------------
   Payment methods (brand-neutral badges; swap for official logos
   once your gateway agreement allows it).
   ------------------------------------------------------------ */
window.ASIATIX_METHODS = {
  card:      { name: "Visa · Mastercard", short: "VISA", c1: "#1a3cff", c2: "#00b2ff", via: "Card gateway" },
  unionpay:  { name: "UnionPay",          short: "UP",   c1: "#d6001c", c2: "#0a5aa8", via: "Card gateway" },
  paypal:    { name: "PayPal",            short: "PP",   c1: "#003087", c2: "#009cde", via: "PayPal Business" },
  payoneer:  { name: "Payoneer",          short: "PY",   c1: "#ff4800", c2: "#ff9a00", via: "Payoneer" },
  alipay:    { name: "Alipay",            short: "支",    c1: "#1677ff", c2: "#4fc3ff", via: "Wallet aggregator" },
  wechat:    { name: "WeChat Pay",        short: "微",    c1: "#07c160", c2: "#7bed9f", via: "Wallet aggregator" },
  upi:       { name: "UPI",               short: "UPI",  c1: "#ff7a00", c2: "#1a8f3c", via: "Wallet aggregator" },
  gcash:     { name: "GCash",             short: "G",    c1: "#007dfe", c2: "#00c6ff", via: "Wallet aggregator" },
  grabpay:   { name: "GrabPay",           short: "GP",   c1: "#00b14f", c2: "#6ee7a1", via: "Wallet aggregator" },
  promptpay: { name: "PromptPay",         short: "PP",   c1: "#1e3a8a", c2: "#38bdf8", via: "Wallet aggregator" },
  paynow:    { name: "PayNow",            short: "PN",   c1: "#7c1fa5", c2: "#e040fb", via: "Wallet aggregator" },
  dana:      { name: "DANA",              short: "DA",   c1: "#118eea", c2: "#6dc3ff", via: "Wallet aggregator" },
  gopay:     { name: "GoPay",             short: "GO",   c1: "#00aed6", c2: "#00d9a5", via: "Wallet aggregator" },
  momo:      { name: "MoMo",              short: "MO",   c1: "#a50064", c2: "#ff5fa8", via: "Wallet aggregator" },
  kakaopay:  { name: "KakaoPay",          short: "K",    c1: "#f9e000", c2: "#ffb300", dark: true, via: "Wallet aggregator" },
  linepay:   { name: "LINE Pay",          short: "L",    c1: "#06c755", c2: "#00e676", via: "Wallet aggregator" },
  paypay:    { name: "PayPay",            short: "PP",   c1: "#ff0033", c2: "#ff6b81", via: "Wallet aggregator" },
  usdt:      { name: "USDT (Crypto)",     short: "₮",    c1: "#26a17b", c2: "#6ee7b7", via: "TRC20 · Polygon" },
  bank:      { name: "Bank transfer",     short: "🏦",    c1: "#475569", c2: "#94a3b8", via: "SWIFT / Wise" }
};

/* ------------------------------------------------------------
   Countries -> language, currency, payment methods (best first)
   ------------------------------------------------------------ */
window.ASIATIX_COUNTRIES = {
  CN: { flag: "🇨🇳", name: "China",        lang: "zh", cur: "CNY", pay: ["alipay", "wechat", "unionpay", "card", "paypal", "usdt"] },
  HK: { flag: "🇭🇰", name: "Hong Kong",    lang: "zh", cur: "HKD", pay: ["card", "alipay", "wechat", "unionpay", "paypal"] },
  TW: { flag: "🇹🇼", name: "Taiwan",       lang: "zh", cur: "TWD", pay: ["card", "linepay", "paypal", "usdt"] },
  JP: { flag: "🇯🇵", name: "Japan",        lang: "ja", cur: "JPY", pay: ["card", "paypay", "linepay", "paypal"] },
  KR: { flag: "🇰🇷", name: "South Korea",  lang: "ko", cur: "KRW", pay: ["card", "kakaopay", "paypal"] },
  IN: { flag: "🇮🇳", name: "India",        lang: "hi", cur: "INR", pay: ["upi", "card", "paypal", "payoneer"] },
  TH: { flag: "🇹🇭", name: "Thailand",     lang: "th", cur: "THB", pay: ["promptpay", "card", "linepay", "paypal"] },
  VN: { flag: "🇻🇳", name: "Vietnam",      lang: "vi", cur: "VND", pay: ["momo", "card", "paypal", "usdt"] },
  ID: { flag: "🇮🇩", name: "Indonesia",    lang: "id", cur: "IDR", pay: ["gopay", "dana", "card", "paypal"] },
  MY: { flag: "🇲🇾", name: "Malaysia",     lang: "ms", cur: "MYR", pay: ["card", "grabpay", "paypal", "usdt"] },
  SG: { flag: "🇸🇬", name: "Singapore",    lang: "en", cur: "SGD", pay: ["paynow", "grabpay", "card", "paypal"] },
  PH: { flag: "🇵🇭", name: "Philippines",  lang: "tl", cur: "PHP", pay: ["gcash", "card", "paypal", "usdt"] },
  AE: { flag: "🇦🇪", name: "UAE",          lang: "ar", cur: "AED", pay: ["card", "paypal", "payoneer", "usdt"] },
  SA: { flag: "🇸🇦", name: "Saudi Arabia", lang: "ar", cur: "SAR", pay: ["card", "paypal", "payoneer", "usdt"] },
  XX: { flag: "🌍", name: "Other",         lang: "en", cur: "USD", pay: ["card", "paypal", "payoneer", "usdt", "bank"] }
};

window.ASIATIX_TZ = {
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Chongqing": "CN", "Asia/Urumqi": "CN",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN",
  "Asia/Jakarta": "ID", "Asia/Makassar": "ID", "Asia/Kuala_Lumpur": "MY", "Asia/Singapore": "SG", "Asia/Manila": "PH",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW"
};
