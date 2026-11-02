// Tiny local web server used by the Windows app.
// It serves the "www" folder at http://127.0.0.1:<port> so the AI model and runtime files
// load exactly like they do on the website.
//
// startServer(wwwDir, preferredPort) returns a promise of { server, port }.

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
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

function startServer(wwwDir, preferredPort) {
  const root = path.resolve(wwwDir);

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath;
      try {
        urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      } catch (e) {
        res.writeHead(400);
        return res.end("Bad request");
      }
      if (urlPath.endsWith("/")) urlPath += "index.html";
      const filePath = path.normalize(path.join(root, urlPath));

      // never serve anything outside the www folder
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
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
          // These two headers switch on SharedArrayBuffer, which lets the AI use several processor threads.
          "Cross-Origin-Opener-Policy": "same-origin",
          "Cross-Origin-Embedder-Policy": "require-corp",
        });
        if (req.method === "HEAD") return res.end();
        // stream the file (the High quality model is about 100 MB)
        fs.createReadStream(filePath)
          .on("error", () => res.destroy())
          .pipe(res);
      });
    });

    // 127.0.0.1 = only this computer can connect; port 0 = any free port
    const listen = (port) =>
      new Promise((ok, fail) => {
        const onError = (err) => fail(err);
        server.once("error", onError);
        server.listen(port, "127.0.0.1", () => {
          server.off("error", onError);
          ok();
        });
      });

    // The same port every time means the app remembers your settings between runs.
    // If that port is busy, any free port is used instead.
    listen(preferredPort || 0)
      .catch((err) => {
        if (preferredPort && err.code === "EADDRINUSE") return listen(0);
        throw err;
      })
      .then(() => resolve({ server, port: server.address().port }))
      .catch(reject);
  });
}

module.exports = { startServer };
