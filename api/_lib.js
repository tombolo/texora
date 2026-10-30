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

function stripeAmount(total, currency) {
  const cur = String(currency || "USD").toUpperCase();
  const n = Number(total) || 0;
  return ZERO_DECIMAL.has(cur) ? Math.max(1, Math.round(n)) : Math.max(1, Math.round(n * 100));
}

function stripeMethodTypes(method) {
  const map = {
    alipay: ["alipay", "card"],
    wechat: ["wechat_pay", "card"],
    grabpay: ["grabpay", "card"],
    promptpay: ["promptpay", "card"],
    paynow: ["paynow", "card"],
    paypal: ["paypal", "card"]
  };
  return map[method] || ["card"];
}

async function stripeRequest(path, params) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const body = new URLSearchParams();
  const walk = (obj, prefix) => {
    Object.entries(obj).forEach(([k, v]) => {
      if (v == null || v === "") return;
      const keyName = prefix ? prefix + "[" + k + "]" : k;
      if (Array.isArray(v)) v.forEach((item, i) => {
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
      "Content-Type": "application/x-www-form-urlencoded"
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

async function createStripeSession(order, origin) {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  const currency = String(order.currency || "USD").toLowerCase();
  const title = String(order.title || "AsiaTix tickets").slice(0, 120);
  const qty = Math.max(1, Number(order.qty) || 1);
  const payload = {
    mode: "payment",
    success_url: origin + "/?paid=1&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: origin + "/?canceled=1",
    customer_email: order.email || undefined,
    payment_method_types: stripeMethodTypes(order.method),
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: String(stripeAmount(order.total, order.currency)),
        product_data: { name: title, description: qty + " × " + (order.tier === "vip" ? "VIP" : "General") }
      }
    }],
    metadata: {
      orderId: String(order.id || "").slice(0, 40),
      eventId: String(order.eventId || ""),
      tier: String(order.tier || "gen"),
      qty: String(qty),
      method: String(order.method || "stripe"),
      name: String(order.name || "").slice(0, 80)
    }
  };
  if (order.method === "wechat") {
    payload.payment_method_options = { wechat_pay: { client: "web" } };
  }
  try {
    return await stripeRequest("/checkout/sessions", payload);
  } catch (err) {
    if (Array.isArray(payload.payment_method_types) && payload.payment_method_types.length > 1) {
      payload.payment_method_types = ["card"];
      delete payload.payment_method_options;
      return await stripeRequest("/checkout/sessions", payload);
    }
    throw err;
  }
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

  if (method === "GET" && p === "/api/payments") {
    return json(res, 200, { stripe: Boolean(process.env.STRIPE_SECRET_KEY) });
  }

  if (method === "GET" && p === "/api/checkout/session") {
    const id = url.searchParams.get("id");
    if (!id || !process.env.STRIPE_SECRET_KEY) return json(res, 404, { error: "Not found" });
    try {
      const ses = await stripeGet("/checkout/sessions/" + encodeURIComponent(id));
      if (!ses) return json(res, 404, { error: "Not found" });
      const paid = ses.payment_status === "paid" || ses.status === "complete";
      return json(res, 200, {
        paid,
        orderId: ses.metadata && ses.metadata.orderId,
        eventId: ses.metadata && ses.metadata.eventId,
        tier: ses.metadata && ses.metadata.tier,
        qty: ses.metadata && ses.metadata.qty,
        method: ses.metadata && ses.metadata.method,
        name: ses.metadata && ses.metadata.name,
        email: ses.customer_details && ses.customer_details.email || ses.customer_email
      });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  if (method === "POST" && p === "/api/checkout") {
    const order = await parseJSON(req);
    const origin = (req.headers["x-forwarded-proto"] || "http") + "://" + (req.headers.host || "localhost");
    try {
      const session = await createStripeSession(order, origin);
      if (session && session.url) return json(res, 200, { url: session.url, id: session.id });
      return json(res, 200, { demo: true });
    } catch (err) {
      console.error(err);
      return json(res, 400, { error: err.message || "Stripe checkout failed" });
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

module.exports = { handleApi, handleRequest, json, requestUrl };
