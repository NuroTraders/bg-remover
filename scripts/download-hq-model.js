// Download the pinned, MIT-licensed BiRefNet Lite ONNX model for Windows bundles.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const modelFile = path.join(root, "www", "models", "model_fp16.onnx");
const modelUrl =
  "https://huggingface.co/studioludens/birefnet-lite-512/resolve/962e67969ec6acec9c19fab76acee4f5e22e990c/onnx/model_fp16.onnx";
const expectedSha256 = "4059896039dfccb0f15b9080ff06d11d90e499449bb045e797055eb8901cf5f4";
const minimumSize = 90_000_000;

async function main() {
  fs.mkdirSync(path.dirname(modelFile), { recursive: true });
  if (fs.existsSync(modelFile)) {
    const existing = fs.readFileSync(modelFile);
    if (existing.length >= minimumSize && sha256(existing) === expectedSha256) {
      console.log("verified pinned BiRefNet Lite model already downloaded");
      return;
    }
    fs.rmSync(modelFile);
  }

  console.log("downloading pinned BiRefNet Lite model...");
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
  const model = Buffer.from(await response.arrayBuffer());
  if (model.length < minimumSize) {
    throw new Error(`Model is truncated or invalid: only ${model.length} bytes`);
  }
  const digest = sha256(model);
  if (digest !== expectedSha256) {
    throw new Error(`Model SHA-256 mismatch: expected ${expectedSha256}, received ${digest}`);
  }

  const temporaryFile = modelFile + ".tmp";
  fs.writeFileSync(temporaryFile, model);
  fs.renameSync(temporaryFile, modelFile);
  console.log(`verified BiRefNet Lite model (${model.length} bytes)`);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

main().catch((error) => {
  console.error("HQ MODEL SETUP FAILED:", error.message);
  process.exit(1);
});
