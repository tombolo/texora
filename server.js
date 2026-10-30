// AsiaTix server — static files + admin API + support chat
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const UPLOADS = path.join(ROOT, "img", "uploads");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".json": "application/json"
};

fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

const tokens = new Map(); // token -> expires

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
const eventsFile = () => path.join(DATA, "events.json");
const msgsFile = () => path.join(DATA, "messages.json");
const adminFile = () => path.join(DATA, "admin.json");

function body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => {
      chunks.push(c);
      if (Buffer.concat(chunks).length > 6 * 1024 * 1024) { req.destroy(); reject(new Error("too large")); }
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}
function auth(req) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const exp = tokens.get(t);
  if (!t || !exp || exp < Date.now()) return false;
  return true;
}
function nextId(list) {
  return list.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
}

async function handleApi(req, res, url) {
  const method = req.method;
  const p = url.pathname;

  if (method === "GET" && p === "/api/events") {
    return json(res, 200, readJSON(eventsFile(), []));
  }

  if (method === "POST" && p === "/api/admin/login") {
    const data = JSON.parse((await body(req)).toString() || "{}");
    const admin = readJSON(adminFile(), { password: "AsiaTixAdmin" });
    if (!data.password || data.password !== admin.password) return json(res, 401, { error: "Wrong password" });
    const token = crypto.randomBytes(24).toString("hex");
    tokens.set(token, Date.now() + 24 * 60 * 60 * 1000);
    return json(res, 200, { token });
  }

  if (method === "GET" && p === "/api/chat") {
    const thread = url.searchParams.get("thread");
    const all = readJSON(msgsFile(), []);
    const one = all.find((t) => t.id === thread);
    return json(res, 200, one || { id: thread, messages: [] });
  }

  if (method === "POST" && p === "/api/chat") {
    const data = JSON.parse((await body(req)).toString() || "{}");
    const text = String(data.text || "").trim();
    if (!text) return json(res, 400, { error: "Empty message" });
    const all = readJSON(msgsFile(), []);
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

  // --- admin only ---
  if (p.startsWith("/api/admin")) {
    if (!auth(req)) return json(res, 401, { error: "Please sign in" });

    if (method === "GET" && p === "/api/admin/events") return json(res, 200, readJSON(eventsFile(), []));

    if (method === "POST" && p === "/api/admin/events") {
      const ev = JSON.parse((await body(req)).toString() || "{}");
      const list = readJSON(eventsFile(), []);
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
      const ev = JSON.parse((await body(req)).toString() || "{}");
      const list = readJSON(eventsFile(), []);
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
      const list = readJSON(eventsFile(), []).filter((x) => x.id !== id);
      writeJSON(eventsFile(), list);
      return json(res, 200, { ok: true });
    }

    if (method === "POST" && p === "/api/admin/upload") {
      const data = JSON.parse((await body(req)).toString() || "{}");
      const raw = String(data.data || "");
      const m = raw.match(/^data:(image\/(jpeg|jpg|png|webp|gif));base64,(.+)$/i);
      if (!m) return json(res, 400, { error: "Send a JPG, PNG, WebP or GIF" });
      const ext = m[2].toLowerCase() === "jpeg" ? "jpg" : m[2].toLowerCase();
      const name = "up-" + Date.now() + "-" + crypto.randomBytes(3).toString("hex") + "." + ext;
      fs.writeFileSync(path.join(UPLOADS, name), Buffer.from(m[3], "base64"));
      return json(res, 200, { url: "img/uploads/" + name });
    }

    if (method === "GET" && p === "/api/admin/messages") {
      const all = readJSON(msgsFile(), []);
      const unread = all.reduce((n, t) => n + (t.unread || 0), 0);
      return json(res, 200, { unread, threads: all });
    }

    if (method === "POST" && p === "/api/admin/reply") {
      const data = JSON.parse((await body(req)).toString() || "{}");
      const text = String(data.text || "").trim();
      if (!text) return json(res, 400, { error: "Empty reply" });
      const all = readJSON(msgsFile(), []);
      const thread = all.find((t) => t.id === data.threadId);
      if (!thread) return json(res, 404, { error: "Thread not found" });
      thread.unread = 0;
      thread.messages.push({ from: "admin", text: text.slice(0, 2000), at: Date.now() });
      writeJSON(msgsFile(), all);
      return json(res, 200, thread);
    }

    if (method === "POST" && p.startsWith("/api/admin/messages/") && p.endsWith("/read")) {
      const id = p.split("/")[4];
      const all = readJSON(msgsFile(), []);
      const thread = all.find((t) => t.id === id);
      if (thread) { thread.unread = 0; writeJSON(msgsFile(), all); }
      return json(res, 200, { ok: true });
    }

    return json(res, 404, { error: "Unknown admin route" });
  }

  return false;
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    if (p === "/admin") p = "/admin.html";

    if (p.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (handled === false) json(res, 404, { error: "Not found" });
      return;
    }

    // never serve the data folder (passwords + inbox live there)
    if (p === "/data" || p.startsWith("/data/")) { res.writeHead(403); return res.end(); }

    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(data);
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) json(res, 500, { error: "Server error" });
  }
}).listen(PORT, () => {
  console.log(`AsiaTix running at http://localhost:${PORT}`);
  console.log(`Admin panel     http://localhost:${PORT}/admin`);
});
