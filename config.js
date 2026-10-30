/* ============================================================
   AsiaTix – configuration
   ============================================================ */
window.ASIATIX_CONFIG = {
  brand: "AsiaTix",
  baseCurrency: "USD",
  serviceFeePct: 3,
  checkoutEndpoint: "/api/checkout",

  /* Fixed indicative FX rates (1 USD = x). Replace with a live-rates API in production. */
  rates: {
    USD: 1, CNY: 7.2, HKD: 7.8, TWD: 32, JPY: 150, KRW: 1350, INR: 84,
    THB: 35, VND: 25000, IDR: 15800, MYR: 4.4, SGD: 1.34, PHP: 57, AED: 3.67, SAR: 3.75, KES: 129
  },

  geoEndpoints: [
    { url: "https://ipwho.is/", pick: (d) => d.success !== false && d.country_code },
    { url: "https://ipapi.co/json/", pick: (d) => d.country_code }
  ]
};

window.ASIATIX_COUNTRIES = {
  CN: { flag: "🇨🇳", name: "China",        lang: "zh", cur: "CNY" },
  HK: { flag: "🇭🇰", name: "Hong Kong",    lang: "zh", cur: "HKD" },
  TW: { flag: "🇹🇼", name: "Taiwan",       lang: "zh", cur: "TWD" },
  JP: { flag: "🇯🇵", name: "Japan",        lang: "ja", cur: "JPY" },
  KR: { flag: "🇰🇷", name: "South Korea",  lang: "ko", cur: "KRW" },
  IN: { flag: "🇮🇳", name: "India",        lang: "hi", cur: "INR" },
  TH: { flag: "🇹🇭", name: "Thailand",     lang: "th", cur: "THB" },
  VN: { flag: "🇻🇳", name: "Vietnam",      lang: "vi", cur: "VND" },
  ID: { flag: "🇮🇩", name: "Indonesia",    lang: "id", cur: "IDR" },
  MY: { flag: "🇲🇾", name: "Malaysia",     lang: "ms", cur: "MYR" },
  SG: { flag: "🇸🇬", name: "Singapore",    lang: "en", cur: "SGD" },
  PH: { flag: "🇵🇭", name: "Philippines",  lang: "tl", cur: "PHP" },
  AE: { flag: "🇦🇪", name: "UAE",          lang: "ar", cur: "AED" },
  SA: { flag: "🇸🇦", name: "Saudi Arabia", lang: "ar", cur: "SAR" },
  XX: { flag: "🌍", name: "Other",         lang: "en", cur: "USD" }
};

window.ASIATIX_TZ = {
  "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN", "Asia/Chongqing": "CN", "Asia/Urumqi": "CN",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Bangkok": "TH", "Asia/Ho_Chi_Minh": "VN", "Asia/Saigon": "VN",
  "Asia/Jakarta": "ID", "Asia/Makassar": "ID", "Asia/Kuala_Lumpur": "MY", "Asia/Singapore": "SG", "Asia/Manila": "PH",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW"
};
