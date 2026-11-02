// BG Remover - Phase 4 (Export & Workflow)
const MODEL_PATH = "models/u2netp.onnx";
const SIZE = 320;
const MAX_SIDE = 2560;
const SETTINGS_KEY = "bgRemoverSettings.v1";

const HF = "https://huggingface.co/shozebDev/birefnet-lite-512-onnx/resolve/main/onnx/";
const ORT_GPU_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.1/dist/";
const MODEL_CACHE = "bg-remover-models";
const MODELS = {
  fast: {
    id: "fast", short: "Fast", label: "Fast",
    info: "Built in (about 4 MB) and works offline. Quick, but rough on hair, thin straps and busy backgrounds.",
  },
  hq: {
    id: "hq", short: "HQ", label: "High quality", size: 512, url: HF + "model_fp16.onnx", mb: 100,
    info: "BiRefNet lite (MIT license). Much cleaner edges. Downloaded once (about 100 MB), then runs on your graphics card with WebGPU. Needs Chrome or Edge.",
  },
  hq32: {
    id: "hq32", short: "HQ", label: "High quality", size: 512, url: HF + "model.onnx", mb: 192,
    info: "The same model in full precision (about 192 MB). Try this one if the 100 MB version does not start on your PC.",
  },
};
const modelState = {
  hq: { cached: false, session: null, busy: false, phase: "", progress: -1, error: "" },
  hq32: { cached: false, session: null, busy: false, phase: "", progress: -1, error: "" },
};
let activeModel = "fast";
let ortGpu = null;
let ortGpuPromise = null;

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const fileInput = $("file");
const addBtn = $("add-btn");
const installBtn = $("install");
const queueList = $("queue");
const queueTitle = $("queue-title");
const queueEmpty = $("queue-empty");
const clearAllBtn = $("clear-all");
const dropzone = $("dropzone");
const dzTitle = $("dz-title");
const dzSub = $("dz-sub");
const workspace = $("workspace");
const viewer = $("viewer");
const originalCanvas = $("original");
const resultCanvas = $("result");
const handle = $("handle");
const panel = $("panel");
const bgCustom = $("bg-custom");
const bgImageBtn = $("bg-image-btn");
const bgImageInput = $("bg-image");
const keepSlider = $("keep");
const sharpSlider = $("sharp");
const tuneReset = $("tune-reset");
const tuneAll = $("tune-all");
const formatSel = $("format");
const jpgNote = $("jpg-note");
const qualityRow = $("quality-row");
const qualityInput = $("quality");
const qualityOut = $("quality-out");
const maxSideSel = $("max-side");
const targetKb = $("target-kb");
const namePatternInput = $("name-pattern");
const estimateEl = $("estimate");
const saveBtn = $("save");
const copyBtn = $("copy");
const shareBtn = $("share");
const saveAllBtn = $("save-all");
const dropOverlay = $("drop-overlay");
const modelSelect = $("model-select");
const modelInfo = $("model-info");
const modelStateEl = $("model-state");
const modelProgress = $("model-progress");
const modelGet = $("model-get");
const modelRemove = $("model-remove");
const modelRedo = $("model-redo");

// Phase 1 & 2 DOM
const themeToggle = $("theme-toggle");
const themeIcon = $("theme-icon");
const menuBtn = $("menu-btn");
const menuDropdown = $("menu-dropdown");
const brushLayer = $("brush-layer");
const brushToolbar = $("brush-toolbar");
const toggleBrushBtn = $("toggle-brush");
const brushRestoreBtn = $("brush-restore");
const brushEraseBtn = $("brush-erase");
const brushUndoBtn = $("brush-undo");
const brushSize = $("brush-size");
const brushOffBtn = $("brush-off");

let session = null;
let nextId = 1;
const items = [];
let currentId = null;
let view = { id: null, source: null, blurUrl: null };
let selectToken = 0;
const bg = { type: "transparent", color: "#ffffff", image: null, imageUrl: "", blurUrl: null };
const exp = { format: "png", quality: 90, maxSide: 0, targetKB: 0, namePattern: "{name}-nobg" };

const nextPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const secs = (ms) => (ms / 1000).toFixed(1);
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
const baseName = (name) => String(name || "image").replace(/\.[^.]+$/, "") || "image";
const currentItem = () => items.find((i) => i.id === currentId) || null;
const doneItems = () => items.filter((i) => i.status === "done");
function setStatus(text) { statusEl.textContent = text; }

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (!saved) return;
    if (saved.bg && (saved.bg.type === "color" || saved.bg.type === "transparent" || saved.bg.type === "blur")) {
      bg.type = saved.bg.type;
      if (/^#[0-9a-f]{6}$/i.test(saved.bg.color || "")) bg.color = saved.bg.color;
    }
    if (saved.exp) {
      if (["png", "webp", "jpg"].includes(saved.exp.format)) exp.format = saved.exp.format;
      if (saved.exp.quality >= 40 && saved.exp.quality <= 100) exp.quality = Number(saved.exp.quality);
      if (saved.exp.maxSide >= 0) exp.maxSide = Number(saved.exp.maxSide);
      if (saved.exp.targetKB >= 0) exp.targetKB = Number(saved.exp.targetKB);
      if (saved.exp.namePattern) exp.namePattern = saved.exp.namePattern;
    }
  } catch (e) { /* ignore */ }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      bg: { type: bg.type === "image" ? "transparent" : bg.type, color: bg.color },
      exp,
    }));
  } catch (e) { /* ignore */ }
}

async function loadModel() {
  try {
    ort.env.wasm.wasmPaths = new URL("ort/", document.baseURI).href;
    
    if (self.crossOriginIsolated) {
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency || 2);
      console.log(`Multi-threading enabled with ${ort.env.wasm.numThreads} threads.`);
    } else {
      ort.env.wasm.numThreads = 1;
      console.log("Multi-threading not available. Using 1 thread.");
    }

    session = await ort.InferenceSession.create(MODEL_PATH, { executionProviders: ["wasm"] });
    refreshStatus();
    processQueue();
  } catch (err) {
    console.error(err);
    setStatus("Could not load the model. Did you run 'npm run setup'? (" + err.message + ")");
  }
}

async function fileToCanvas(file, maxSide) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

function pixelsToInput(source, size, smooth) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (smooth) ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const plane = size * size;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let ch = 0; ch < 3; ch++) {
      input[ch * plane + i] = (data[i * 4 + ch] / 255 - MEAN[ch]) / STD[ch];
    }
  }
  return input;
}

async function getMaskFast(source) {
  const tensor = new ort.Tensor("float32", pixelsToInput(source, SIZE, false), [1, 3, SIZE, SIZE]);
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

async function getMaskHq(def, source) {
  const st = modelState[def.id];
  const tensor = new ortGpu.Tensor("float32", pixelsToInput(source, def.size, true), [1, 3, def.size, def.size]);
  const out = await st.session.run({ [st.session.inputNames[0]]: tensor });
  const logits = await out[st.session.outputNames[0]].getData();
  const mask = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) mask[i] = 1 / (1 + Math.exp(-logits[i]));
  return mask;
}

async function getMaskActive(source) {
  if (activeModel !== "fast") {
    const def = MODELS[activeModel];
    try {
      return { mask: await getMaskHq(def, source), size: def.size, model: def.id };
    } catch (err) {
      console.error(err);
      const st = modelState[def.id];
      st.error = "It stopped working on this PC (" + ((err && err.message) || err) + "). Switched back to Fast.";
      st.session = null;
      activeModel = "fast";
      refreshModelCard();
    }
  }
  return { mask: await getMaskFast(source), size: SIZE, model: "fast" };
}

const surfaces = {};
function maskSurface(n) {
  if (!surfaces[n]) {
    const canvas = document.createElement("canvas");
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext("2d");
    surfaces[n] = { canvas, ctx, image: ctx.createImageData(n, n) };
  }
  return surfaces[n];
}

function composeCutout(source, mask, maskSize, keep, sharp, target, strokes = []) {
  const center = 0.5 + keep / 200;
  const width = 0.5 - (sharp / 100) * 0.4;
  const lo = center - width;
  const span = 2 * width;
  const surf = maskSurface(maskSize);
  const d = surf.image.data;
  for (let i = 0; i < mask.length; i++) {
    let a = (mask[i] - lo) / span;
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    d[i * 4 + 3] = Math.round(a * 255);
  }
  surf.ctx.putImageData(surf.image, 0, 0);

  let finalMask = surf.canvas;
  if (strokes.length > 0) {
    const temp = document.createElement('canvas');
    temp.width = maskSize;
    temp.height = maskSize;
    const tctx = temp.getContext('2d');
    tctx.drawImage(surf.canvas, 0, 0);
    const scale = maskSize / source.width;
    
    for (const stroke of strokes) {
      tctx.beginPath();
      tctx.lineWidth = stroke.size * scale;
      tctx.lineCap = 'round';
      tctx.lineJoin = 'round';
      if (stroke.mode === 'restore') {
        tctx.strokeStyle = '#fff';
        tctx.globalCompositeOperation = 'source-over';
      } else {
        tctx.strokeStyle = '#000';
        tctx.globalCompositeOperation = 'destination-out';
      }
      for (let i = 0; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        if (i === 0) tctx.moveTo(p.x * scale, p.y * scale);
        else tctx.lineTo(p.x * scale, p.y * scale);
      }
      tctx.stroke();
    }
    finalMask = temp;
  }

  const w = source.width;
  const h = source.height;
  if (target.width !== w || target.height !== h) {
    target.width = w;
    target.height = h;
  }
  const ctx = target.getContext("2d");
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(finalMask, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
}

function renderResult() {
  const item = currentItem();
  if (!item || !item.mask || !view.source || view.id !== item.id) return;
  composeCutout(view.source, item.mask, item.maskSize, item.keep, item.sharp, resultCanvas, item.brushStrokes);
}

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderResult(); });
}

function stateLabel(item) {
  if (item.status === "waiting") return "Waiting";
  if (item.status === "working") return "Working...";
  if (item.status === "error") return "Failed";
  const model = MODELS[item.modelId] ? MODELS[item.modelId].short : "";
  return "Done" + (item.ms ? " · " + secs(item.ms) + " s" : "") + (model ? " · " + model : "");
}

function renderQueue() {
  queueList.textContent = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.className = "q-item " + item.status + (item.id === currentId ? " active" : "");
    li.dataset.id = String(item.id);

    const img = document.createElement("img");
    img.className = "q-thumb";
    img.alt = "";
    if (item.thumb) img.src = item.thumb;

    const text = document.createElement("div");
    text.className = "q-text";
    const name = document.createElement("span");
    name.className = "q-name";
    name.textContent = item.name;
    name.title = item.name;
    const state = document.createElement("span");
    state.className = "q-state";
    state.textContent = stateLabel(item);
    if (item.status === "error") state.title = item.error;
    text.append(name, state);

    const remove = document.createElement("button");
    remove.className = "q-remove";
    remove.type = "button";
    remove.title = "Remove";
    remove.setAttribute("aria-label", "Remove " + item.name);
    remove.textContent = "×";

    li.append(img, text, remove);
    queueList.appendChild(li);
  }
  queueTitle.textContent = items.length ? "Images (" + items.length + ")" : "Images";
  queueEmpty.hidden = items.length > 0;
  clearAllBtn.hidden = items.length === 0;
  const n = doneItems().length;
  saveAllBtn.hidden = n < 2;
  saveAllBtn.textContent = "Save all " + n + " as ZIP";
}

queueList.addEventListener("click", (e) => {
  const li = e.target.closest(".q-item");
  if (!li) return;
  const id = Number(li.dataset.id);
  if (e.target.closest(".q-remove")) removeItem(id);
  else selectItem(id);
});

function showWorkspace(show) {
  workspace.hidden = !show;
  dropzone.hidden = show;
  panel.classList.toggle("disabled", !show);
  saveBtn.disabled = !show;
  copyBtn.disabled = !show;
  shareBtn.disabled = !show;
}

function updateEmptyState() {
  if (items.length === 0) {
    dzTitle.textContent = "Drop images here";
    dzSub.textContent = "or click to choose. You can pick many at once. Ctrl+V pastes from the clipboard.";
  } else {
    dzTitle.textContent = "Working on your first image...";
    dzSub.textContent = "It will appear here in a moment. You can keep adding more images.";
  }
}

function refreshStatus() {
  if (!session) return;
  if (items.length === 0) { setStatus("Ready. Add images to begin."); return; }
  const waiting = items.filter((i) => i.status === "waiting" || i.status === "working").length;
  const failed = items.filter((i) => i.status === "error").length;
  if (waiting > 0) {
    setStatus("Processing... " + doneItems().length + " of " + items.length + " done.");
  } else {
    setStatus("All done: " + doneItems().length + " image" + (doneItems().length === 1 ? "" : "s") +
      (failed ? ", " + failed + " failed." : "."));
  }
}

function removeItem(id) {
  const index = items.findIndex((i) => i.id === id);
  if (index < 0) return;
  items.splice(index, 1);
  if (currentId === id) {
    const next = items.slice(index).concat(items.slice(0, index)).find((i) => i.status === "done");
    currentId = null;
    view = { id: null, source: null, blurUrl: null };
    if (next) selectItem(next.id);
    else showWorkspace(false);
  }
  renderQueue();
  updateEmptyState();
  refreshStatus();
}

clearAllBtn.addEventListener("click", () => {
  items.length = 0;
  currentId = null;
  view = { id: null, source: null, blurUrl: null };
  selectToken++;
  showWorkspace(false);
  renderQueue();
  updateEmptyState();
  refreshStatus();
  estimateEl.textContent = "";
});

async function selectItem(id, knownSource) {
  const item = items.find((i) => i.id === id);
  if (!item || item.status !== "done") return;
  const token = ++selectToken;
  currentId = id;
  renderQueue();
  showWorkspace(true);

  let source = knownSource;
  if (!source) {
    if (view.id === id && view.source) source = view.source;
    else {
      setStatus("Loading...");
      try { source = await fileToCanvas(item.file, MAX_SIDE); }
      catch (err) { setStatus("Could not open " + item.name); return; }
    }
  }
  if (token !== selectToken) return;

  view = { id, source, blurUrl: null };
  originalCanvas.width = source.width;
  originalCanvas.height = source.height;
  originalCanvas.getContext("2d").drawImage(source, 0, 0);
  
  brushLayer.width = source.width;
  brushLayer.height = source.height;

  keepSlider.value = item.keep;
  sharpSlider.value = item.sharp;
  renderResult();
  setSplit(50);
  applyBackgroundPreview();
  scheduleEstimate();
  refreshStatus();
}

function setSplit(pct) {
  pct = Math.max(0, Math.min(100, pct));
  originalCanvas.style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";
  handle.style.left = pct + "%";
}
let dragging = false;
function splitFromEvent(e) {
  const rect = viewer.getBoundingClientRect();
  if (!rect.width) return;
  setSplit(((e.clientX - rect.left) / rect.width) * 100);
}
viewer.addEventListener("pointerdown", (e) => {
  if (brushMode) return;
  dragging = true;
  try { viewer.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  splitFromEvent(e);
});
viewer.addEventListener("pointermove", (e) => { if (dragging) splitFromEvent(e); });
const stopDrag = () => { dragging = false; };
viewer.addEventListener("pointerup", stopDrag);
viewer.addEventListener("pointercancel", stopDrag);

let processing = false;
async function processQueue() {
  if (processing) return;
  if (!session) { setStatus("Loading AI model..."); return; }
  processing = true;
  try {
    let item;
    while ((item = items.find((i) => i.status === "waiting"))) {
      item.status = "working";
      renderQueue();
      refreshStatus();
      await nextPaint();
      try {
        const t0 = performance.now();
        const source = await fileToCanvas(item.file, MAX_SIDE);
        const res = await getMaskActive(source);
        if (!items.includes(item)) continue;
        item.mask = res.mask;
        item.maskSize = res.size;
        item.modelId = res.model;
        item.thumb = makeThumb(source);
        item.ms = performance.now() - t0;
        item.status = "done";
        if (currentId === null) await selectItem(item.id, source);
        else if (item.id === currentId && view.id === item.id) { renderResult(); scheduleEstimate(); }
      } catch (err) {
        console.error(err);
        item.status = "error";
        item.error = err && err.message ? err.message : "Unknown error";
      }
      renderQueue();
      refreshModelCard();
      refreshStatus();
    }
  } finally {
    processing = false;
    refreshStatus();
  }
}

function makeThumb(source) {
  const s = 92;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d");
  const k = Math.max(s / source.width, s / source.height);
  const w = source.width * k;
  const h = source.height * k;
  ctx.drawImage(source, (s - w) / 2, (s - h) / 2, w, h);
  return c.toDataURL("image/jpeg", 0.7);
}

function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith("image/"));
  if (!files.length) { setStatus("No image files found."); return; }
  for (const file of files) {
    items.push({
      id: nextId++, file, name: file.name || "pasted-image.png", status: "waiting",
      mask: null, maskSize: SIZE, modelId: "fast", ms: 0, keep: 0, sharp: 0, thumb: "", error: "",
      brushStrokes: []
    });
  }
  renderQueue();
  updateEmptyState();
  processQueue();
}

function applyBackgroundPreview() {
  resultCanvas.style.backgroundImage = "";
  resultCanvas.style.backgroundColor = "";
  resultCanvas.style.backgroundSize = "";
  resultCanvas.style.backgroundPosition = "";
  resultCanvas.classList.toggle("checker", bg.type === "transparent");
  
  if (bg.type === "color") resultCanvas.style.backgroundColor = bg.color;
  if (bg.type === "image") {
    resultCanvas.style.backgroundImage = 'url("' + bg.imageUrl + '")';
    resultCanvas.style.backgroundSize = "cover";
    resultCanvas.style.backgroundPosition = "center";
  }
  if (bg.type === "blur" && view.source) {
    if (!view.blurUrl) {
      const temp = document.createElement('canvas');
      temp.width = view.source.width;
      temp.height = view.source.height;
      const tctx = temp.getContext('2d');
      tctx.filter = 'blur(24px)';
      tctx.drawImage(view.source, 0, 0);
      view.blurUrl = temp.toDataURL('image/jpeg', 0.8);
    }
    resultCanvas.style.backgroundImage = `url(${view.blurUrl})`;
    resultCanvas.style.backgroundSize = "cover";
    resultCanvas.style.backgroundPosition = "center";
  }

  let matched = false;
  document.querySelectorAll(".swatch").forEach((b) => {
    const on =
      (bg.type === "transparent" && b.dataset.color === "transparent") ||
      (bg.type === "blur" && b.dataset.color === "blur") ||
      (bg.type === "color" && b.dataset.color.toLowerCase() === bg.color.toLowerCase());
    b.classList.toggle("active", on);
    if (on) matched = true;
  });
  bgCustom.classList.toggle("active", bg.type === "color" && !matched);
  bgImageBtn.classList.toggle("active", bg.type === "image");
  jpgNote.hidden = !(exp.format === "jpg" && bg.type === "transparent");
}

function chooseBackground(next) {
  Object.assign(bg, next);
  applyBackgroundPreview();
  saveSettings();
  scheduleEstimate();
}

document.querySelectorAll(".swatch").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.color === "transparent") chooseBackground({ type: "transparent" });
    else if (b.dataset.color === "blur") chooseBackground({ type: "blur" });
    else chooseBackground({ type: "color", color: b.dataset.color });
  });
});
bgCustom.addEventListener("input", () => chooseBackground({ type: "color", color: bgCustom.value }));

bgImageBtn.addEventListener("click", () => bgImageInput.click());
bgImageInput.addEventListener("change", async () => {
  const file = bgImageInput.files[0];
  bgImageInput.value = "";
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (bg.imageUrl) URL.revokeObjectURL(bg.imageUrl);
    chooseBackground({ type: "image", image: img, imageUrl: url });
  } catch (err) {
    URL.revokeObjectURL(url);
    setStatus("Could not open that background picture.");
  }
});

keepSlider.addEventListener("input", () => {
  const item = currentItem();
  if (item) item.keep = Number(keepSlider.value);
  scheduleRender();
  scheduleEstimate();
});
sharpSlider.addEventListener("input", () => {
  const item = currentItem();
  if (item) item.sharp = Number(sharpSlider.value);
  scheduleRender();
  scheduleEstimate();
});
tuneReset.addEventListener("click", () => {
  keepSlider.value = 0;
  sharpSlider.value = 0;
  const item = currentItem();
  if (item) { item.keep = 0; item.sharp = 0; }
  renderResult();
  scheduleEstimate();
});
tuneAll.addEventListener("click", () => {
  const item = currentItem();
  if (!item) return;
  for (const other of items) { other.keep = item.keep; other.sharp = item.sharp; }
  setStatus("Applied these settings to all " + items.length + " images.");
});

function drawCover(ctx, img, w, h) {
  const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k;
  const dh = img.naturalHeight * k;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function resizeCanvas(canvas, newW, newH) {
  let cur = canvas;
  while (cur.width / 2 > newW && cur.height / 2 > newH) {
    const half = document.createElement("canvas");
    half.width = Math.max(1, Math.round(cur.width / 2));
    half.height = Math.max(1, Math.round(cur.height / 2));
    const hctx = half.getContext("2d");
    hctx.imageSmoothingQuality = "high";
    hctx.drawImage(cur, 0, 0, half.width, half.height);
    cur = half;
  }
  const out = document.createElement("canvas");
  out.width = Math.max(1, newW);
  out.height = Math.max(1, newH);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cur, 0, 0, out.width, out.height);
  return out;
}

async function renderForExport(item) {
  if (!item.mask) throw new Error("This image is still being processed.");
  const source = view.id === item.id && view.source ? view.source : await fileToCanvas(item.file, MAX_SIDE);
  const cut = document.createElement("canvas");
  composeCutout(source, item.mask, item.maskSize, item.keep, item.sharp, cut, item.brushStrokes);

  let out = cut;
  if (bg.type !== "transparent" || exp.format === "jpg") {
    out = document.createElement("canvas");
    out.width = cut.width;
    out.height = cut.height;
    const ctx = out.getContext("2d");
    
    if (bg.type === "blur") {
      ctx.filter = "blur(24px)";
      ctx.drawImage(source, 0, 0, out.width, out.height);
      ctx.filter = "none";
    } else if (bg.type === "image" && bg.image) {
      drawCover(ctx, bg.image, out.width, out.height);
    } else {
      ctx.fillStyle = bg.type === "color" ? bg.color : "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(cut, 0, 0);
  }

  if (exp.maxSide > 0) {
    const longest = Math.max(out.width, out.height);
    if (longest > exp.maxSide) {
      const k = exp.maxSide / longest;
      out = resizeCanvas(out, Math.round(out.width * k), Math.round(out.height * k));
    }
  }
  return out;
}

const MIME = { png: "image/png", webp: "image/webp", jpg: "image/jpeg" };
function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), MIME[format], quality));
}

async function encodeImage(canvas, format, quality, targetBytes) {
  const lossy = format !== "png";
  let c = canvas;
  let scale = 1;
  let last = null;
  for (let round = 0; round < 8; round++) {
    if (lossy) {
      const first = await canvasToBlob(c, format, quality / 100);
      last = { blob: first, scale, quality };
      if (!targetBytes || first.size <= targetBytes) return last;
      let lo = 0.3;
      let hi = quality / 100;
      let best = null;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        const b = await canvasToBlob(c, format, mid);
        if (b.size <= targetBytes) { best = { blob: b, scale, quality: Math.round(mid * 100) }; lo = mid; }
        else hi = mid;
      }
      if (best) return best;
      last = { blob: await canvasToBlob(c, format, 0.3), scale, quality: 30 };
    } else {
      const blob = await canvasToBlob(c, format);
      last = { blob, scale, quality: 100 };
      if (!targetBytes || blob.size <= targetBytes) return last;
    }
    scale *= 0.85;
    c = resizeCanvas(canvas, Math.round(canvas.width * scale), Math.round(canvas.height * scale));
  }
  return last;
}

function getExportName(item, ext) {
  let base = exp.namePattern || "{name}-nobg";
  base = base.replace(/{name}/g, baseName(item.name));
  return base + "." + ext;
}

async function exportItem(item) {
  const canvas = await renderForExport(item);
  const target = exp.targetKB > 0 ? exp.targetKB * 1024 : 0;
  const res = await encodeImage(canvas, exp.format, exp.quality, target);
  const type = res.blob.type;
  const ext = type === "image/webp" ? "webp" : type === "image/jpeg" ? "jpg" : "png";
  return { blob: res.blob, res, name: getExportName(item, ext) };
}

let estTimer = null;
let estToken = 0;
function scheduleEstimate() {
  clearTimeout(estTimer);
  if (!currentItem()) { estimateEl.textContent = ""; return; }
  estimateEl.textContent = "Calculating file size...";
  estTimer = setTimeout(runEstimate, 450);
}
async function runEstimate() {
  const item = currentItem();
  if (!item) return;
  const token = ++estToken;
  try {
    const out = await exportItem(item);
    if (token !== estToken || item.id !== currentId) return;
    let text = "File size: about " + fmtSize(out.blob.size) + " (original photo: " + fmtSize(item.file.size) + ")";
    if (out.res.scale < 1) text += ". Shrunk to fit your size limit.";
    else if (exp.targetKB > 0 && out.res.quality < exp.quality) text += ". Quality lowered to " + out.res.quality + "% to fit.";
    if (exp.targetKB > 0 && out.blob.size > exp.targetKB * 1024) text += " Could not reach " + exp.targetKB + " KB.";
    if (out.blob.type !== MIME[exp.format]) text += " (This browser cannot make " + exp.format.toUpperCase() + ", PNG was used.)";
    estimateEl.textContent = text;
  } catch (err) {
    console.error(err);
    if (token === estToken) estimateEl.textContent = "";
  }
}

function syncExportControls() {
  formatSel.value = exp.format;
  qualityInput.value = exp.quality;
  qualityOut.textContent = exp.quality + "%";
  maxSideSel.value = String(exp.maxSide);
  targetKb.value = exp.targetKB > 0 ? String(exp.targetKB) : "";
  namePatternInput.value = exp.namePattern;
  qualityRow.hidden = exp.format === "png";
  jpgNote.hidden = !(exp.format === "jpg" && bg.type === "transparent");
}
function exportSettingChanged() {
  syncExportControls();
  saveSettings();
  scheduleEstimate();
}
formatSel.addEventListener("change", () => { exp.format = formatSel.value; exportSettingChanged(); });
qualityInput.addEventListener("input", () => { exp.quality = Number(qualityInput.value); exportSettingChanged(); });
maxSideSel.addEventListener("change", () => { exp.maxSide = Number(maxSideSel.value); exportSettingChanged(); });
targetKb.addEventListener("input", () => {
  const v = Number(targetKb.value);
  exp.targetKB = v > 0 ? v : 0;
  saveSettings();
  scheduleEstimate();
});
namePatternInput.addEventListener("input", () => {
  exp.namePattern = namePatternInput.value || "{name}-nobg";
  saveSettings();
});

(function checkWebp() {
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    if (!c.toDataURL("image/webp").startsWith("data:image/webp")) {
      const opt = formatSel.querySelector('option[value="webp"]');
      if (opt) opt.remove();
      if (exp.format === "webp") exp.format = "png";
    }
  } catch (e) { /* ignore */ }
})();

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

saveBtn.addEventListener("click", async () => {
  const item = currentItem();
  if (!item) return;
  saveBtn.disabled = true;
  try {
    setStatus("Preparing the picture...");
    await nextPaint();
    const out = await exportItem(item);
    downloadBlob(out.blob, out.name);
    setStatus("Saved " + out.name + " (" + fmtSize(out.blob.size) + ").");
  } catch (err) {
    console.error(err);
    setStatus("Could not save: " + err.message);
  } finally {
    saveBtn.disabled = false;
  }
});

copyBtn.addEventListener("click", async () => {
  const item = currentItem();
  if (!item) return;
  copyBtn.disabled = true;
  try {
    setStatus("Copying to clipboard...");
    await nextPaint();
    const canvas = await renderForExport(item);
    canvas.toBlob(async (blob) => {
      try {
        // Clipboard API mostly supports PNG for images across browsers
        const pngBlob = canvas.toDataURL('image/png');
        const res = await fetch(pngBlob);
        const data = [new ClipboardItem({ "image/png": await res.blob() })];
        await navigator.clipboard.write(data);
        setStatus("Copied to clipboard!");
      } catch (err) {
        setStatus("Failed to copy image: " + err.message);
      } finally {
        copyBtn.disabled = false;
      }
    }, 'image/png');
  } catch (err) {
    console.error(err);
    setStatus("Could not copy: " + err.message);
    copyBtn.disabled = false;
  }
});

// Web Share API
if (navigator.share && navigator.canShare) {
  shareBtn.hidden = false;
}
shareBtn.addEventListener("click", async () => {
  const item = currentItem();
  if (!item) return;
  try {
    setStatus("Preparing to share...");
    const out = await exportItem(item);
    const file = new File([out.blob], out.name, { type: out.blob.type });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Background Removed Image",
      });
      setStatus("Shared successfully.");
    } else {
      setStatus("This device cannot share this file type.");
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      setStatus("Could not share: " + err.message);
    }
  }
});

function uniqueName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  for (let n = 2; ; n++) {
    const candidate = stem + " (" + n + ")" + ext;
    if (!used.has(candidate)) { used.add(candidate); return candidate; }
  }
}

saveAllBtn.addEventListener("click", async () => {
  const list = doneItems();
  if (!list.length) return;
  saveAllBtn.disabled = true;
  saveBtn.disabled = true;
  copyBtn.disabled = true;
  shareBtn.disabled = true;
  try {
    const used = new Set();
    const files = [];
    let total = 0;
    for (let i = 0; i < list.length; i++) {
      setStatus("Preparing picture " + (i + 1) + " of " + list.length + "...");
      await nextPaint();
      const out = await exportItem(list[i]);
      total += out.blob.size;
      files.push({ name: uniqueName(out.name, used), data: new Uint8Array(await out.blob.arrayBuffer()) });
    }
    downloadBlob(makeZip(files), "bg-removed-images.zip");
    setStatus("Saved " + files.length + " pictures in bg-removed-images.zip (" + fmtSize(total) + ").");
  } catch (err) {
    console.error(err);
    setStatus("Could not save the ZIP: " + err.message);
  } finally {
    saveAllBtn.disabled = false;
    saveBtn.disabled = !currentItem();
    copyBtn.disabled = !currentItem();
    shareBtn.disabled = !currentItem();
  }
});

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.length;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, f.data);

    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint16(10, 0, true);
    cen.setUint16(12, dosTime, true);
    cen.setUint16(14, dosDate, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, size, true);
    cen.setUint32(24, size, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);

    offset += 30 + nameBytes.length + size;
  }
  let centralSize = 0;
  for (const c of central) centralSize += c.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

addBtn.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

let dragDepth = 0;
window.addEventListener("dragenter", (e) => { e.preventDefault(); dragDepth++; dropOverlay.hidden = false; });
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
  addFiles(e.dataTransfer.files);
});
window.addEventListener("paste", (e) => {
  const files = [];
  for (const item of e.clipboardData ? e.clipboardData.items : []) {
    if (item.type.startsWith("image/")) files.push(item.getAsFile());
  }
  if (files.length) addFiles(files);
});

window.addEventListener("keydown", (e) => {
  const t = e.target;
  const typing = t && (t.tagName === "SELECT" || (t.tagName === "INPUT" && t.type !== "range" && t.type !== "color"));
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    if (!saveBtn.disabled) saveBtn.click();
    return;
  }
  if (typing || (t && t.tagName === "INPUT" && t.type === "range")) return;
  const list = doneItems();
  const at = list.findIndex((i) => i.id === currentId);
  if ((e.key === "ArrowRight" || e.key === "ArrowDown") && at >= 0 && list.length > 1) {
    e.preventDefault();
    selectItem(list[(at + 1) % list.length].id);
  } else if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && at >= 0 && list.length > 1) {
    e.preventDefault();
    selectItem(list[(at - 1 + list.length) % list.length].id);
  } else if (e.key === "Delete" && currentId !== null) {
    removeItem(currentId);
  }
});

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
window.addEventListener("appinstalled", () => { installBtn.hidden = true; });

const insideDesktopApp = navigator.userAgent.includes("Electron");
if ("serviceWorker" in navigator && location.protocol.startsWith("http") && !insideDesktopApp) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service worker not registered:", err));
  });
}

function loadOrtGpu() {
  if (ortGpuPromise) return ortGpuPromise;
  ortGpuPromise = new Promise((resolve, reject) => {
    const previous = window.ort;
    const tag = document.createElement("script");
    tag.src = ORT_GPU_BASE + "ort.webgpu.min.js";
    tag.onload = () => {
      const lib = window.ort;
      window.ort = previous;
      ortGpu = lib;
      resolve(lib);
    };
    tag.onerror = () => reject(new Error("Could not load the graphics runtime. You need to be online the first time."));
    document.head.appendChild(tag);
  });
  ortGpuPromise.catch(() => { ortGpuPromise = null; });
  return ortGpuPromise;
}

async function getModelBytes(def, st) {
  let cache = null;
  try { cache = await caches.open(MODEL_CACHE); } catch (e) { /* no saved files */ }
  if (cache) {
    const hit = await cache.match(def.url);
    if (hit) { st.cached = true; return new Uint8Array(await hit.arrayBuffer()); }
  }
  st.phase = "Downloading...";
  st.progress = 0;
  refreshModelCard();
  const res = await fetch(def.url);
  if (!res.ok) throw new Error("Download failed (HTTP " + res.status + ").");
  const total = Number(res.headers.get("content-length")) || def.mb * 1048576;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  let lastDraw = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    st.progress = Math.min(100, (got / total) * 100);
    st.phase = "Downloading... " + Math.round(st.progress) + "% (" + Math.round(got / 1048576) + " of " + Math.round(total / 1048576) + " MB)";
    const now = performance.now();
    if (now - lastDraw > 150) { lastDraw = now; refreshModelCard(); }
  }
  const bytes = new Uint8Array(got);
  let pos = 0;
  for (const c of chunks) { bytes.set(c, pos); pos += c.length; }
  if (cache) {
    try {
      await cache.put(def.url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } }));
      st.cached = true;
    } catch (e) { /* too big */ }
  }
  return bytes;
}

async function checkWebGPU(silent = false) {
  if (!navigator.gpu) {
    if (!silent) setStatus("This browser does not support WebGPU. High Quality models require WebGPU.");
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      if (!silent) setStatus("No graphics adapter found. High Quality models require a GPU.");
      return false;
    }
    if (!adapter.features.has("shader-f16") && modelSelect.value === "hq") {
      if (!silent) setStatus("Your GPU does not support 16-bit floats. Please use the 'High quality compatible' (192 MB) model instead.");
      return false;
    }
    return true;
  } catch (e) {
    if (!silent) setStatus("WebGPU check failed: " + e.message);
    return false;
  }
}

async function startHq(def) {
  const st = modelState[def.id];
  st.busy = true;
  st.error = "";
  st.progress = -1;
  st.phase = "Preparing...";
  refreshModelCard();
  try {
    st.phase = "Loading the graphics runtime...";
    refreshModelCard();
    const lib = await loadOrtGpu();
    const bytes = await getModelBytes(def, st);
    st.progress = -1;
    st.phase = "Starting on the graphics card. The first start can take up to a minute...";
    refreshModelCard();
    await nextPaint();
    lib.env.wasm.wasmPaths = ORT_GPU_BASE;
    st.session = await lib.InferenceSession.create(bytes, { executionProviders: ["webgpu"] });
    activeModel = def.id;
  } catch (err) {
    console.error(err);
    st.session = null;
    st.error = (err && err.message) || String(err);
  } finally {
    st.busy = false;
    refreshModelCard();
  }
}

function refreshModelCard() {
  const id = modelSelect.value;
  const def = MODELS[id];
  const st = modelState[id] || null;
  modelInfo.textContent = def.info;

  let line = "";
  let label = "";
  if (id === "fast") {
    label = activeModel === "fast" ? "" : "Use this model";
    if (activeModel === "fast") line = "In use.";
  } else if (st.busy) {
    line = st.phase;
  } else {
    if (st.session) label = activeModel === id ? "" : "Use this model";
    else label = st.cached ? "Use this model" : "Download and use (" + def.mb + " MB)";
    if (st.error) line = "Problem: " + st.error;
    else if (st.session && activeModel === id) line = "In use.";
    else if (st.cached) line = "Downloaded and saved on this computer.";
  }
  modelStateEl.textContent = line;
  modelStateEl.classList.toggle("error", !!(st && st.error && !st.busy));
  modelGet.hidden = !label;
  modelGet.textContent = label;
  modelGet.disabled = !!(st && st.busy);
  modelProgress.hidden = !(st && st.busy && st.progress >= 0);
  if (st && st.progress >= 0) modelProgress.value = st.progress;
  modelRemove.hidden = !(st && st.cached && !st.busy);
  modelSelect.disabled = !!(modelState.hq.busy || modelState.hq32.busy);
  const stale = items.some((i) => i.status === "done" && i.modelId !== activeModel);
  modelRedo.hidden = !stale;
  modelRedo.textContent = "Redo all images with " + MODELS[activeModel].label;
}

modelSelect.addEventListener("change", refreshModelCard);
modelGet.addEventListener("click", async () => {
  const id = modelSelect.value;
  if (id === "fast") { activeModel = "fast"; refreshModelCard(); return; }
  const st = modelState[id];
  if (st.session) { activeModel = id; refreshModelCard(); return; }
  
  const gpuOk = await checkWebGPU();
  if (!gpuOk) return; 

  await startHq(MODELS[id]);
});
modelRemove.addEventListener("click", async () => {
  const id = modelSelect.value;
  const st = modelState[id];
  if (!st) return;
  try { const cache = await caches.open(MODEL_CACHE); await cache.delete(MODELS[id].url); } catch (e) { /* ignore */ }
  st.cached = false;
  st.error = "";
  if (st.session) { try { if (st.session.release) st.session.release(); } catch (e) { /* ignore */ } st.session = null; }
  if (activeModel === id) activeModel = "fast";
  refreshModelCard();
});
modelRedo.addEventListener("click", () => {
  for (const item of items) if (item.status === "done" || item.status === "error") item.status = "waiting";
  renderQueue();
  refreshModelCard();
  processQueue();
});

(async function checkSavedModels() {
  try {
    const cache = await caches.open(MODEL_CACHE);
    for (const id of ["hq", "hq32"]) modelState[id].cached = !!(await cache.match(MODELS[id].url));
  } catch (e) { /* no saved files */ }
  refreshModelCard();
})();

// Theme Toggle
const savedTheme = localStorage.getItem("bgRemoverTheme");
if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
  document.body.setAttribute("data-theme", "dark");
  themeIcon.textContent = "☀️";
} else {
  document.body.setAttribute("data-theme", "light");
  themeIcon.textContent = "🌙";
}

themeToggle.addEventListener("click", () => {
  const current = document.body.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);
  localStorage.setItem("bgRemoverTheme", next);
  themeIcon.textContent = next === "dark" ? "☀️" : "🌙";
});

// Menu Dropdown
menuBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  menuDropdown.hidden = !menuDropdown.hidden;
});
document.addEventListener("click", (e) => {
  if (!menuDropdown.hidden && !menuDropdown.contains(e.target)) {
    menuDropdown.hidden = true;
  }
});

// Modals
document.querySelectorAll("[data-dialog]").forEach(btn => {
  btn.addEventListener("click", () => {
    const dialogId = btn.getAttribute("data-dialog");
    const dialog = $(dialogId);
    if (dialog) {
      dialog.showModal();
      menuDropdown.hidden = true;
    }
  });
});

document.querySelectorAll(".modal-close").forEach(btn => {
  btn.addEventListener("click", () => {
    btn.closest("dialog").close();
  });
});

document.querySelectorAll("dialog").forEach(dialog => {
  dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      dialog.close();
    }
  });
});

// Touch-up Brush Logic
let currentStroke = null;
let brushMode = null;

function setBrushMode(mode) {
  brushMode = mode;
  brushLayer.classList.toggle("active", mode !== null);
  brushRestoreBtn.classList.toggle("active", mode === "restore");
  brushEraseBtn.classList.toggle("active", mode === "erase");
  toggleBrushBtn.classList.toggle("active", mode !== null);
  
  if (mode) {
    brushToolbar.hidden = false;
  } else {
    brushToolbar.hidden = true;
  }
}

toggleBrushBtn.addEventListener("click", () => {
  setBrushMode(brushMode ? null : "restore");
});
brushOffBtn.addEventListener("click", () => setBrushMode(null));
brushRestoreBtn.addEventListener("click", () => setBrushMode("restore"));
brushEraseBtn.addEventListener("click", () => setBrushMode("erase"));

brushUndoBtn.addEventListener("click", () => {
  const item = currentItem();
  if (item && item.brushStrokes.length > 0) {
    item.brushStrokes.pop();
    renderResult();
    scheduleEstimate();
  }
});

brushLayer.addEventListener('pointerdown', (e) => {
  const item = currentItem();
  if (!brushMode || !item) return;
  
  const rect = brushLayer.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (brushLayer.width / rect.width);
  const y = (e.clientY - rect.top) * (brushLayer.height / rect.height);
  
  currentStroke = { mode: brushMode, size: Number(brushSize.value), points: [{x, y}] };
  item.brushStrokes.push(currentStroke);
  renderResult();
});

brushLayer.addEventListener('pointermove', (e) => {
  if (!currentStroke) return;
  const rect = brushLayer.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (brushLayer.width / rect.width);
  const y = (e.clientY - rect.top) * (brushLayer.height / rect.height);
  
  currentStroke.points.push({x, y});
  renderResult();
});

window.addEventListener('pointerup', () => {
  if (currentStroke) {
    currentStroke = null;
    scheduleEstimate();
  }
});

// Start
loadSettings();
syncExportControls();
applyBackgroundPreview();
showWorkspace(false);
renderQueue();
updateEmptyState();
refreshModelCard();
loadModel();