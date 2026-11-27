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
const MODEL_SHA256 = "309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8";
const MODEL_SIZE = 4574861;

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

  if (fs.existsSync(modelFile)) {
    const existing = fs.readFileSync(modelFile);
    if (existing.length === MODEL_SIZE && sha256(existing) === MODEL_SHA256) {
      console.log("verified model already downloaded");
      return;
    }
    fs.rmSync(modelFile);
  }
  console.log("downloading model...");
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error("Download failed: HTTP " + res.status);
  const model = Buffer.from(await res.arrayBuffer());
  if (model.length !== MODEL_SIZE) {
    throw new Error(`Model size mismatch: expected ${MODEL_SIZE} bytes, received ${model.length}`);
  }
  const digest = sha256(model);
  if (digest !== MODEL_SHA256) {
    throw new Error(`Model SHA-256 mismatch: received ${digest}`);
  }
  const temporaryFile = modelFile + ".tmp";
  fs.writeFileSync(temporaryFile, model);
  fs.renameSync(temporaryFile, modelFile);
  console.log("model saved:", modelFile);
}

function sha256(buffer) {
  return require("crypto").createHash("sha256").update(buffer).digest("hex");
}

main().catch((e) => {
  console.error("SETUP FAILED:", e.message);
  process.exit(1);
});
