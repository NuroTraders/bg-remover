const http = require("http");
const fs = require("fs");
const path = require("path");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".wasm": "application/wasm",
  ".onnx": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

function startServer(wwwDir, port = 0) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Multi-threading requires these headers to enable SharedArrayBuffer
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

      let filePath = path.join(wwwDir, req.url.split("?")[0]);
      if (filePath.endsWith("/")) filePath += "index.html";

      // Prevent directory traversal
      if (!filePath.startsWith(wwwDir)) {
        res.writeHead(403);
        return res.end("Forbidden");
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          if (err.code === "ENOENT") {
            res.writeHead(404);
            res.end("Not Found");
          } else {
            res.writeHead(500);
            res.end("Internal Server Error");
          }
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || "application/octet-stream";
        
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
      });
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // If port is in use, try a random port
        server.listen(0, "127.0.0.1");
      } else {
        reject(err);
      }
    });

    server.on("listening", () => {
      const actualPort = server.address().port;
      resolve(`http://127.0.0.1:${actualPort}`);
    });

    server.listen(port, "127.0.0.1");
  });
}

module.exports = { startServer };