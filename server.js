// AsiaTix server — static files + admin API + support chat
const http = require("http");
const fs = require("fs");
const path = require("path");
const { handleApi, json, requestUrl } = require("./api/_lib");

const PORT = process.env.PORT || 5173;
const ROOT = __dirname;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".json": "application/json"
};

http.createServer(async (req, res) => {
  try {
    const url = requestUrl(req);
    let p = decodeURIComponent(url.pathname);
    if (p === "/") p = "/index.html";
    if (p === "/admin") p = "/admin.html";

    if (p.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (handled === false) json(res, 404, { error: "Not found" });
      return;
    }

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
