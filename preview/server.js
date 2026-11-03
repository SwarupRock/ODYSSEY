/* Zero-dependency static file server for the ODYSSEY preview.
   Serves ../ (the odyssey game folder), no caching, correct MIME types.
   Binds all interfaces so a phone on the same WiFi can play:
     - PC:            http://localhost:8391/index.html
     - Android (PWA): http://<pc-LAN-ip>:8391/index.html
   Run: node server.js                                                */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 8391;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function lanIPs() {
  const out = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos || []) {
      if (info.family === "IPv4" && !info.internal) out.push(info.address);
    }
  }
  return out;
}

http
  .createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split("?")[0]);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const filePath = path.join(ROOT, urlPath);

    // dev-only file writer: POST /__icon { name, data } — loopback callers only
    if (req.method === "POST" && /^\/__icon$/.test(urlPath)) {
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress)) {
        res.writeHead(403);
        return res.end("forbidden");
      }
      let body = "";
      req.on("data", (c) => { body += c; if (body.length > 2e6) req.destroy(); });
      req.on("end", () => {
        try {
          const { name, data } = JSON.parse(body);
          const okKind = /\.png$/.test(name) && data.startsWith("data:image/png;base64,")
            || /\.woff2$/.test(name) && data.startsWith("data:font/woff2;base64,");
          if (!/^[\w.-]+\.(png|woff2)$/.test(name) || !okKind) throw new Error("bad payload");
          const dir = /\.woff2$/.test(name) ? path.join(ROOT, "fonts") : path.join(ROOT, "icons");
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, name), Buffer.from(data.split(",")[1], "base64"));
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("saved " + name);
        } catch (e) {
          res.writeHead(400);
          res.end("bad request: " + e.message);
        }
      });
      return;
    }

    // stay inside ROOT
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("forbidden");
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        return res.end("404: " + urlPath);
      }
      res.writeHead(200, {
        "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end(data);
    });
  })
  .listen(PORT, "::", () => {
    const ips = lanIPs();
    console.log(`odyssey server: http://localhost:${PORT}/index.html  (root: ${ROOT})`);
    for (const ip of ips) console.log(`  phone (same WiFi): http://${ip}:${PORT}/index.html`);
  });
