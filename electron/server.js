// Tiny local web server used by the Windows app.
// It serves the "www" folder at http://127.0.0.1:<random port> so the AI model and
// runtime files load exactly like they do on the website.

const http = require("http");
const fs = require("fs");
const path = require("path");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function startServer(root) {
  root = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (urlPath.endsWith("/")) urlPath += "index.html";
        const filePath = path.normalize(path.join(root, urlPath));

        // never serve anything outside the www folder
        if (!filePath.startsWith(root + path.sep)) {
          res.writeHead(403);
          return res.end("Forbidden");
        }

        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) {
            res.writeHead(404);
            return res.end("Not found");
          }
          res.writeHead(200, {
            "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
            "Content-Length": stat.size,
            "Cache-Control": "no-cache",
          });
          fs.createReadStream(filePath).pipe(res);
        });
      } catch (e) {
        res.writeHead(400);
        res.end("Bad request");
      }
    });
    server.on("error", reject);
    // port 0 = pick any free port; 127.0.0.1 = only this computer can connect
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

module.exports = { startServer };
