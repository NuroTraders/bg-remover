// BG Remover - Task 4
// Flow: get image -> shrink if huge -> AI makes a mask -> apply mask as transparency
// Extras: before/after slider, Save PNG, drag and drop, paste (Ctrl+V),
//         background color choice, installable PWA

const MODEL_PATH = "models/u2netp.onnx";
const SIZE = 320;       // U2Netp works on 320x320 images
const MAX_SIDE = 2048;  // big photos are shrunk to this (longest side) to save memory

const statusEl = document.getElementById("status");
const fileInput = document.getElementById("file");
const saveBtn = document.getElementById("save");
const viewer = document.getElementById("viewer");
const slider = document.getElementById("slider");
const originalCanvas = document.getElementById("original");
const resultCanvas = document.getElementById("result");
const dropOverlay = document.getElementById("drop-overlay");
const bgPanel = document.getElementById("bg-panel");
const bgCustom = document.getElementById("bg-custom");
const installBtn = document.getElementById("install");

let session = null;
let busy = false;
let currentName = "image";
let currentBg = "transparent"; // "transparent" or a color like "#ffffff"

// ---- 1. Load the AI model once ----
async function loadModel() {
  try {
    ort.env.wasm.wasmPaths = new URL("ort/", document.baseURI).href;
    ort.env.wasm.numThreads = 1; // single thread works everywhere, no special server headers
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["wasm"],
    });
    statusEl.textContent = "Ready. Choose an image.";
  } catch (err) {
    console.error(err);
    statusEl.textContent =
      "Could not load the model. Did you run 'npm run setup'? (" + err.message + ")";
  }
}

// ---- 2. Read a file into a canvas (shrunk if it is very large) ----
async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---- 3. Turn the image into the numbers the AI expects ----
function imageToTensor(source) {
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d");
  ctx.drawImage(source, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);

  for (let i = 0; i < plane; i++) {
    for (let ch = 0; ch < 3; ch++) {
      const v = data[i * 4 + ch] / 255;
      input[ch * plane + i] = (v - mean[ch]) / std[ch];
    }
  }
  return new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]);
}

// ---- 4. Run the AI and get a mask (0 = background, 1 = subject) ----
async function getMask(source) {
  const tensor = imageToTensor(source);
  const output = await session.run({ [session.inputNames[0]]: tensor });
  const raw = output[session.outputNames[0]].data;

  let min = Infinity, max = -Infinity;
  for (const v of raw) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mask = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i++) mask[i] = (raw[i] - min) / (max - min || 1);
  return mask;
}

// ---- 5. Apply the mask as the alpha (transparency) channel ----
function applyMask(source, mask) {
  const w = source.width;
  const h = source.height;

  const small = document.createElement("canvas");
  small.width = SIZE;
  small.height = SIZE;
  const sctx = small.getContext("2d");
  const sImg = sctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < mask.length; i++) {
    const a = Math.round(mask[i] * 255);
    sImg.data[i * 4] = a;
    sImg.data[i * 4 + 1] = a;
    sImg.data[i * 4 + 2] = a;
    sImg.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(sImg, 0, 0);

  const big = document.createElement("canvas");
  big.width = w;
  big.height = h;
  const bctx = big.getContext("2d");
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, w, h);
  const maskPixels = bctx.getImageData(0, 0, w, h).data;

  resultCanvas.width = w;
  resultCanvas.height = h;
  const rctx = resultCanvas.getContext("2d");
  rctx.drawImage(source, 0, 0);
  const out = rctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    out.data[i * 4 + 3] = maskPixels[i * 4]; // mask brightness becomes transparency
  }
  rctx.putImageData(out, 0, 0);
}

// ---- 6. Before/after slider ----
function updateSlider() {
  const v = Number(slider.value);
  originalCanvas.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)";
}
slider.addEventListener("input", updateSlider);

// ---- 6b. Background color choice ----
// The result canvas always stays transparent. The color is shown behind it with CSS,
// and is only baked into the picture when you press Save.
function setBackground(color) {
  currentBg = color;
  if (color === "transparent") {
    resultCanvas.classList.add("checker");
    resultCanvas.style.backgroundColor = "";
  } else {
    resultCanvas.classList.remove("checker");
    resultCanvas.style.backgroundColor = color;
  }
  document.querySelectorAll(".swatch").forEach((b) => {
    b.classList.toggle("active", b.dataset.color === color);
  });
  bgCustom.classList.toggle("active", !document.querySelector(".swatch.active"));
}

document.querySelectorAll(".swatch").forEach((b) => {
  b.addEventListener("click", () => setBackground(b.dataset.color));
});
bgCustom.addEventListener("input", () => setBackground(bgCustom.value));

// Returns the picture to save: the transparent result, or the result on top of the chosen color
function getExportCanvas() {
  if (currentBg === "transparent") return resultCanvas;
  const c = document.createElement("canvas");
  c.width = resultCanvas.width;
  c.height = resultCanvas.height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = currentBg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(resultCanvas, 0, 0);
  return c;
}

// ---- 7. Process one image file (used by picker, drop and paste) ----
async function processFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    statusEl.textContent = "That is not an image file.";
    return;
  }
  if (!session) {
    statusEl.textContent = "Model is not loaded yet.";
    return;
  }
  if (busy) return;
  busy = true;
  saveBtn.disabled = true;

  try {
    statusEl.textContent = "Removing background...";
    const t0 = performance.now();

    const source = await fileToCanvas(file);
    const mask = await getMask(source);

    originalCanvas.width = source.width;
    originalCanvas.height = source.height;
    originalCanvas.getContext("2d").drawImage(source, 0, 0);
    applyMask(source, mask);

    viewer.hidden = false;
    bgPanel.hidden = false;
    slider.hidden = false;
    slider.value = 50;
    updateSlider();

    currentName = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
    saveBtn.disabled = false;
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    statusEl.textContent = "Done in " + secs + " s. Drag the slider to compare.";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Error: " + err.message;
  } finally {
    busy = false;
  }
}

// ---- 8. Save the result as a transparent PNG ----
saveBtn.addEventListener("click", () => {
  const transparent = currentBg === "transparent";
  getExportCanvas().toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = "Could not create the PNG.";
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentName + (transparent ? "-nobg.png" : "-newbg.png");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
});

// ---- 9. Choose, drag and drop, paste ----
fileInput.addEventListener("change", () => {
  processFile(fileInput.files[0]);
  fileInput.value = ""; // lets you pick the same file again
});

let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragDepth++;
  dropOverlay.hidden = false;
});
window.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.hidden = true;
});
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;
  processFile(e.dataTransfer.files[0]);
});

window.addEventListener("paste", (e) => {
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith("image/")) {
      processFile(item.getAsFile());
      break;
    }
  }
});

// ---- 10. Make it an installable app (PWA) ----
let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  installBtn.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
});

// The service worker saves the app and the AI model so it works offline.
// Only on http/https (not inside the Windows or Android wrapper apps).
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker not registered:", err);
    });
  });
}

loadModel();
