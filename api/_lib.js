// Shared API for local `node server.js` and Vercel serverless.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

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
