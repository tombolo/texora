// Shared API for local `node server.js` and Vercel serverless.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

try {
  const envFile = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  envFile.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=\s]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) return;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  });
} catch { /* no .env */ }

const ON_VERCEL = process.env.VERCEL === "1";
const ROOT = path.join(__dirname, "..");
const SEED_DIR = path.join(ROOT, "data");
const DATA_DIR = ON_VERCEL ? path.join(os.tmpdir(), "asiatix-data") : SEED_DIR;
const UPLOAD_DIR = ON_VERCEL
  ? path.join(os.tmpdir(), "asiatix-uploads")
  : path.join(ROOT, "img", "uploads");

const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

let seedEvents = [];
try { seedEvents = require("../data/events.json"); } catch { seedEvents = []; }

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function eventsFile() { return path.join(DATA_DIR, "events.json"); }
function msgsFile() { return path.join(DATA_DIR, "messages.json"); }
function adminFile() { return path.join(SEED_DIR, "admin.json"); }

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function writeJSON(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadEvents() {
  if (fs.existsSync(eventsFile())) return readJSON(eventsFile(), seedEvents);
  if (ON_VERCEL) return seedEvents;
  return readJSON(path.join(SEED_DIR, "events.json"), seedEvents);
}

function loadMessages() {
  if (fs.existsSync(msgsFile())) return readJSON(msgsFile(), []);
  return readJSON(path.join(SEED_DIR, "messages.json"), []);
}

function adminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const file = readJSON(adminFile(), null);
  if (file && file.password) return file.password;
  return "AsiaTixAdmin";
}

function tokenSecret() {
  return process.env.ADMIN_SECRET || adminPassword() || "asiatix-dev-secret";
}

function signToken() {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", tokenSecret()).update(payload).digest("hex");
  return payload + "." + sig;
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function checkToken(raw) {
  const [payload, sig] = String(raw || "").split(".");
  if (!payload || !sig) return false;
  const expected = crypto.createHmac("sha256", tokenSecret()).update(payload).digest("hex");
  if (!safeEqual(sig, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}

function json(res, code, obj) {
  if (typeof res.status === "function" && typeof res.json === "function") {
    res.setHeader("Cache-Control", "no-store");
    return res.status(code).json(obj);
  }
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

function send(res, code, type, data, extra = {}) {
  if (typeof res.status === "function") {
    res.statusCode = code;
    res.setHeader("Content-Type", type);
    Object.entries(extra).forEach(([k, v]) => res.setHeader(k, v));
    return res.end(data);
  }
  res.writeHead(code, { "Content-Type": type, ...extra });
  res.end(data);
}

function auth(req) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  return checkToken(t);
}

function nextId(list) {
  return list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body));
    return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => {
      chunks.push(c);
      if (Buffer.concat(chunks).length > 4 * 1024 * 1024) {
        req.destroy();
        reject(new Error("too large"));
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function parseJSON(req) {
  const raw = (await readBody(req)).toString() || "{}";
  return JSON.parse(raw);
}

function requestUrl(req) {
  const host = req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "http";
  return new URL(req.url, proto + "://" + host);
}

const ZERO_DECIMAL = new Set(["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"]);
const SERVICE_FEE = 0.03;
const COUNTRY_CUR = {
  CN: "CNY", HK: "HKD", TW: "TWD", JP: "JPY", KR: "KRW", IN: "INR", TH: "THB",
  VN: "VND", ID: "IDR", MY: "MYR", SG: "SGD", PH: "PHP", AE: "AED", SA: "SAR", XX: "USD"
};
const RATES = {
  USD: 1, CNY: 7.2, HKD: 7.8, TWD: 32, JPY: 150, KRW: 1350, INR: 84,
  THB: 35, VND: 25000, IDR: 15800, MYR: 4.4, SGD: 1.34, PHP: 57, AED: 3.67, SAR: 3.75, KES: 129
};

function fail(message, status) {
  const err = new Error(message);
  err.status = status || 400;
  return err;
}

function round3(n) {
  if (n <= 0) return 0;
  const m = Math.pow(10, Math.floor(Math.log10(n)) - 2);
  return Math.round(n / m) * m;
}

function stripeAmount(total, currency) {
  const cur = String(currency || "USD").toUpperCase();
  const n = Number(total) || 0;
  return ZERO_DECIMAL.has(cur) ? Math.max(1, Math.round(n)) : Math.max(1, Math.round(n * 100));
}

function publicOrigin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return proto + "://" + host;
}

function quoteOrder(order) {
  const ev = loadEvents().find((e) => Number(e.id) === Number(order.eventId));
  if (!ev) throw fail("Event not found", 400);
  const qty = Math.min(10, Math.max(1, Number(order.qty) || 1));
  const tier = order.tier === "vip" ? "vip" : "gen";
  const email = String(order.email || "").trim();
  const name = String(order.name || "").trim().slice(0, 80);
  if (name.length < 2) throw fail("Name required", 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw fail("Valid email required", 400);
  const cc = COUNTRY_CUR[order.country] ? order.country : "XX";
  const currency = COUNTRY_CUR[cc];
  const rate = RATES[currency] || 1;
  const unitUsd = Number(ev.usd) || 0;
  const unit = (currency === "USD" ? unitUsd : round3(unitUsd * rate)) * (tier === "vip" ? 2.2 : 1);
  const sub = unit * qty;
  const total = sub + sub * SERVICE_FEE;
  const usdTotal = unitUsd * (tier === "vip" ? 2.2 : 1) * qty * (1 + SERVICE_FEE);
  return {
    orderId: String(order.id || ("AT" + Date.now().toString(36))).slice(0, 40),
    eventId: ev.id,
    title: String(ev.title || "AsiaTix tickets").slice(0, 120),
    city: String(ev.city || ""),
    qty,
    tier,
    email,
    name,
    currency,
    total,
    stripeAmount: stripeAmount(total, currency),
    usdTotal,
    country: cc
  };
}

async function stripeRequest(path, params, extraHeaders) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw fail("Stripe is not configured. Set STRIPE_SECRET_KEY.", 503);
  const body = new URLSearchParams();
  const walk = (obj, prefix) => {
    Object.entries(obj).forEach(([k, v]) => {
      if (v == null || v === "") return;
      const keyName = prefix ? prefix + "[" + k + "]" : k;
      if (typeof v === "boolean") body.append(keyName, v ? "true" : "false");
      else if (Array.isArray(v)) v.forEach((item, i) => {
        if (item != null && typeof item === "object") walk(item, keyName + "[" + i + "]");
        else body.append(keyName + "[" + i + "]", String(item));
      });
      else if (typeof v === "object") walk(v, keyName);
      else body.append(keyName, String(v));
    });
  };
  walk(params);
  const res = await fetch("https://api.stripe.com/v1" + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(extraHeaders || {})
    },
    body
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || "Stripe error");
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function stripeGet(path) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const res = await fetch("https://api.stripe.com/v1" + path, {
    headers: { Authorization: "Bearer " + key }
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || "Stripe error");
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function sessionPayload(priced, origin, currency, amount) {
  return {
    mode: "payment",
    submit_type: "pay",
    success_url: origin + "/?paid=1&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/?canceled=1",
    customer_email: priced.email,
    client_reference_id: priced.orderId,
    locale: "auto",
    billing_address_collection: "auto",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: currency.toLowerCase(),
        unit_amount: String(amount),
        product_data: {
          name: priced.title,
          description: priced.qty + " × " + (priced.tier === "vip" ? "VIP" : "General") + (priced.city ? " · " + priced.city : "")
        }
      }
    }],
    metadata: {
      orderId: priced.orderId,
      eventId: String(priced.eventId),
      tier: priced.tier,
      qty: String(priced.qty),
      method: "stripe",
      name: priced.name,
      country: priced.country
    },
    payment_intent_data: {
      description: "AsiaTix " + priced.orderId,
      metadata: { orderId: priced.orderId, eventId: String(priced.eventId) }
    }
  };
}

async function createStripeSession(order, origin) {
  const priced = quoteOrder(order);
  try {
    return await stripeRequest(
      "/checkout/sessions",
      sessionPayload(priced, origin, priced.currency, priced.stripeAmount),
      { "Idempotency-Key": priced.orderId + "-" + priced.currency }
    );
  } catch (err) {
    if (priced.currency !== "USD" && /currency/i.test(err.message || "")) {
      return await stripeRequest(
        "/checkout/sessions",
        sessionPayload(priced, origin, "USD", stripeAmount(priced.usdTotal, "USD")),
        { "Idempotency-Key": priced.orderId + "-USD" }
      );
    }
    throw err;
  }
}

function verifyStripeSignature(raw, header, secret) {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures = [];
  String(header).split(",").forEach((piece) => {
    const i = piece.indexOf("=");
    if (i < 0) return;
    const k = piece.slice(0, i).trim();
    const v = piece.slice(i + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") signatures.push(v);
  });
  if (!timestamp || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(timestamp + "." + raw.toString("utf8")).digest("hex");
  return signatures.some((sig) => safeEqual(expected, sig));
}

async function handleStripeWebhook(req, res) {
  const raw = await readBody(req);
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return json(res, 503, { error: "STRIPE_WEBHOOK_SECRET is not set" });
  if (!verifyStripeSignature(raw, req.headers["stripe-signature"], secret)) {
    return json(res, 400, { error: "Invalid Stripe signature" });
  }
  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return json(res, 400, { error: "Invalid payload" }); }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data && event.data.object;
    if (session && session.payment_status === "paid") {
      console.log("Stripe paid", session.metadata && session.metadata.orderId, session.id);
    }
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data && event.data.object;
    console.warn("Stripe payment failed", session && session.metadata && session.metadata.orderId, session && session.id);
  }
  return json(res, 200, { received: true });
}

async function handleApi(req, res, url) {
  const method = req.method;
  const p = url.pathname.replace(/\/$/, "") || "/";

  if (method === "OPTIONS" && p.startsWith("/api")) {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    });
    return res.end();
  }

  if (method === "GET" && p === "/api/events") {
    return json(res, 200, loadEvents());
  }

  if (method === "GET" && p.startsWith("/api/uploads/")) {
    const name = path.basename(p.slice("/api/uploads/".length));
    if (!/^up-[a-zA-Z0-9.-]+$/.test(name)) return json(res, 400, { error: "Bad file" });
    const file = path.join(UPLOAD_DIR, name);
    if (!file.startsWith(UPLOAD_DIR) || !fs.existsSync(file)) return json(res, 404, { error: "Not found" });
    return send(res, 200, TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", fs.readFileSync(file), { "Cache-Control": "public, max-age=86400" });
  }

  if (method === "POST" && p === "/api/admin/login") {
    const data = await parseJSON(req);
    if (!data.password || data.password !== adminPassword()) return json(res, 401, { error: "Wrong password" });
    return json(res, 200, { token: signToken() });
  }

  if (method === "GET" && p === "/api/chat") {
    const thread = url.searchParams.get("thread");
    const all = loadMessages();
    const one = all.find((t) => t.id === thread);
    return json(res, 200, one || { id: thread, messages: [] });
  }

  if (method === "POST" && (p === "/api/webhooks/stripe" || p === "/api/webhook/stripe")) {
    return handleStripeWebhook(req, res);
  }

  if (method === "GET" && p === "/api/checkout/session") {
    const id = url.searchParams.get("id");
    if (!id || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) return json(res, 400, { error: "Invalid session" });
    if (!process.env.STRIPE_SECRET_KEY) return json(res, 503, { error: "Stripe is not configured" });
    try {
      const ses = await stripeGet("/checkout/sessions/" + encodeURIComponent(id));
      if (!ses) return json(res, 404, { error: "Not found" });
      return json(res, 200, {
        paid: ses.payment_status === "paid",
        status: ses.status,
        payment_status: ses.payment_status,
        orderId: ses.metadata && ses.metadata.orderId,
        eventId: ses.metadata && ses.metadata.eventId,
        tier: ses.metadata && ses.metadata.tier,
        qty: ses.metadata && ses.metadata.qty,
        method: "stripe",
        name: ses.metadata && ses.metadata.name,
        email: (ses.customer_details && ses.customer_details.email) || ses.customer_email
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (method === "POST" && p === "/api/checkout") {
    if (!process.env.STRIPE_SECRET_KEY) return json(res, 503, { error: "Stripe is not configured. Set STRIPE_SECRET_KEY." });
    try {
      const order = await parseJSON(req);
      const session = await createStripeSession(order, publicOrigin(req));
      if (!session || !session.url) throw fail("Could not start Stripe Checkout", 502);
      return json(res, 200, { url: session.url, id: session.id });
    } catch (err) {
      console.error(err);
      return json(res, err.status || 400, { error: err.message || "Stripe checkout failed" });
    }
  }

  if (method === "POST" && p === "/api/chat") {
    const data = await parseJSON(req);
    const text = String(data.text || "").trim();
    if (!text) return json(res, 400, { error: "Empty message" });
    const all = loadMessages();
    let thread = all.find((t) => t.id === data.threadId);
    if (!thread) {
      thread = {
        id: data.threadId || ("T" + Date.now().toString(36)),
        name: String(data.name || "Guest").slice(0, 80),
        email: String(data.email || "").slice(0, 120),
        created: Date.now(),
        unread: 1,
        messages: []
      };
      all.unshift(thread);
    }
    thread.name = String(data.name || thread.name).slice(0, 80);
    thread.email = String(data.email || thread.email).slice(0, 120);
    thread.unread = (thread.unread || 0) + 1;
    thread.messages.push({ from: "user", text: text.slice(0, 2000), at: Date.now() });
    writeJSON(msgsFile(), all);
    return json(res, 200, thread);
  }

  if (p.startsWith("/api/admin")) {
    if (!auth(req)) return json(res, 401, { error: "Please sign in" });

    if (method === "GET" && p === "/api/admin/events") return json(res, 200, loadEvents());

    if (method === "POST" && p === "/api/admin/events") {
      const ev = await parseJSON(req);
      const list = loadEvents();
      const item = {
        id: nextId(list),
        title: String(ev.title || "Untitled").slice(0, 120),
        city: String(ev.city || "").slice(0, 60),
        cc: String(ev.cc || "XX").slice(0, 2).toUpperCase(),
        cat: String(ev.cat || "music"),
        img: String(ev.img || "img/logo.jpg"),
        usd: Number(ev.usd) || 0,
        date: ev.date || new Date().toISOString(),
        left: Number(ev.left) || 0,
        hot: !!ev.hot,
        desc: String(ev.desc || "").slice(0, 500)
      };
      list.unshift(item);
      writeJSON(eventsFile(), list);
      return json(res, 200, item);
    }

    if (method === "PUT" && p.startsWith("/api/admin/events/")) {
      const id = Number(p.split("/").pop());
      const ev = await parseJSON(req);
      const list = loadEvents();
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return json(res, 404, { error: "Not found" });
      list[i] = {
        ...list[i],
        title: String(ev.title ?? list[i].title).slice(0, 120),
        city: String(ev.city ?? list[i].city).slice(0, 60),
        cc: String(ev.cc ?? list[i].cc).slice(0, 2).toUpperCase(),
        cat: String(ev.cat ?? list[i].cat),
        img: String(ev.img ?? list[i].img),
        usd: ev.usd != null ? Number(ev.usd) : list[i].usd,
        date: ev.date || list[i].date,
        left: ev.left != null ? Number(ev.left) : list[i].left,
        hot: ev.hot != null ? !!ev.hot : list[i].hot,
        desc: String(ev.desc ?? list[i].desc ?? "").slice(0, 500)
      };
      writeJSON(eventsFile(), list);
      return json(res, 200, list[i]);
    }

    if (method === "DELETE" && p.startsWith("/api/admin/events/")) {
      const id = Number(p.split("/").pop());
      const list = loadEvents().filter((x) => x.id !== id);
      writeJSON(eventsFile(), list);
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && p === "/api/admin/upload") {
      const data = await parseJSON(req);
      const raw = String(data.data || "");
      const m = raw.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i);
      if (!m) return json(res, 400, { error: "Send a JPG, PNG, WebP or GIF" });
      if (ON_VERCEL) return json(res, 200, { url: raw });
      const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
      const name = "up-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex") + "." + ext;
      ensureDirs();
      fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[3], "base64"));
      return json(res, 200, { url: "img/uploads/" + name });
    }

    if (method === "GET" && p === "/api/admin/messages") {
      const all = loadMessages();
      const unread = all.reduce((n, t) => n + (t.unread || 0), 0);
      return json(res, 200, { unread, threads: all });
    }

    if (method === "POST" && p === "/api/admin/reply") {
      const data = await parseJSON(req);
      const text = String(data.text || "").trim();
      if (!text) return json(res, 400, { error: "Empty reply" });
      const all = loadMessages();
      const thread = all.find((t) => t.id === data.threadId);
      if (!thread) return json(res, 404, { error: "Thread not found" });
      thread.unread = 0;
      thread.messages.push({ from: "admin", text: text.slice(0, 2000), at: Date.now() });
      writeJSON(msgsFile(), all);
      return json(res, 200, thread);
    }

    if (method === "POST" && p.startsWith("/api/admin/messages/") && p.endsWith("/read")) {
      const id = p.split("/")[4];
      const all = loadMessages();
      const thread = all.find((t) => t.id === id);
      if (thread) { thread.unread = 0; writeJSON(msgsFile(), all); }
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Unknown admin route" });
  }

  return false;
}

async function handleRequest(req, res) {
  try {
    const url = requestUrl(req);
    const handled = await handleApi(req, res, url);
    if (handled === false) json(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: "Server error" });
  }
}

module.exports = { handleApi, handleRequest, handleStripeWebhook, json, requestUrl };
