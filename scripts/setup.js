// Run once with:  npm run setup
// 1) copies the AI runtime files into www/ort
// 2) downloads the free U2Netp model (about 4.5 MB) into www/models

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ortSrc = path.join(root, "node_modules", "onnxruntime-web", "dist");
const ortDst = path.join(root, "www", "ort");
const modelDir = path.join(root, "www", "models");
const modelFile = path.join(modelDir, "u2netp.onnx");
const MODEL_URL =
  "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx";

async function main() {
  fs.mkdirSync(ortDst, { recursive: true });
  fs.mkdirSync(modelDir, { recursive: true });

  for (const f of [
    "ort.wasm.min.js",
    "ort-wasm-simd-threaded.wasm",
    "ort-wasm-simd-threaded.mjs",
  ]) {
    fs.copyFileSync(path.join(ortSrc, f), path.join(ortDst, f));
    console.log("copied", f);
  }

  if (fs.existsSync(modelFile) && fs.statSync(modelFile).size > 1000000) {
    console.log("model already downloaded");
    return;
  }
  console.log("downloading model...");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error("Download failed: HTTP " + res.status);
  fs.writeFileSync(modelFile, Buffer.from(await res.arrayBuffer()));
  console.log("model saved:", modelFile);
}

main().catch((e) => {
  console.error("SETUP FAILED:", e.message);
  process.exit(1);
});
