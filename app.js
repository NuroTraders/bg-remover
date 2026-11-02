// ... [Keep everything from the top down to the DOM elements exactly the same] ...

// Find and update these DOM variables near the top:
const bgCustom = $("bg-custom");
const bgImageBtn = $("bg-image-btn");
const bgImageInput = $("bg-image");
// NEW: Brush DOM
const brushLayer = $("brush-layer");
const brushToolbar = $("brush-toolbar");
const toggleBrushBtn = $("toggle-brush");
const brushRestoreBtn = $("brush-restore");
const brushEraseBtn = $("brush-erase");
const brushUndoBtn = $("brush-undo");
const brushSize = $("brush-size");
const brushOffBtn = $("brush-off");

// ... [Keep the state exactly the same, but update the `bg` object] ...
const bg = { type: "transparent", color: "#ffffff", image: null, imageUrl: "", blurUrl: null };
const exp = { format: "png", quality: 90, maxSide: 0, targetKB: 0 };

// ... [Keep the helper functions exactly the same] ...

// UPDATE: addFiles to include brushStrokes
function addFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f && f.type && f.type.startsWith("image/"));
  if (!files.length) { setStatus("No image files found."); return; }
  for (const file of files) {
    items.push({
      id: nextId++, file, name: file.name || "pasted-image.png", status: "waiting",
      mask: null, maskSize: SIZE, modelId: "fast", ms: 0, keep: 0, sharp: 0, thumb: "", error: "",
      brushStrokes: [] // NEW
    });
  }
  renderQueue();
  updateEmptyState();
  processQueue();
}

// UPDATE: selectItem to reset blurUrl and set brush canvas size
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

  view = { id, source, blurUrl: null }; // NEW: reset blurUrl
  originalCanvas.width = source.width;
  originalCanvas.height = source.height;
  originalCanvas.getContext("2d").drawImage(source, 0, 0);
  
  // NEW: Match brush layer to original canvas
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

// UPDATE: composeCutout to apply brush strokes
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

  // NEW: Apply brush strokes to a temporary mask canvas
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

// UPDATE: renderResult to pass strokes
function renderResult() {
  const item = currentItem();
  if (!item || !item.mask || !view.source || view.id !== item.id) return;
  composeCutout(view.source, item.mask, item.maskSize, item.keep, item.sharp, resultCanvas, item.brushStrokes);
}

// ... [Keep the rest of the processing code exactly the same] ...

// UPDATE: applyBackgroundPreview to handle Blur
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

// UPDATE: Swatch click listener to handle Blur
document.querySelectorAll(".swatch").forEach((b) => {
  b.addEventListener("click", () => {
    if (b.dataset.color === "transparent") chooseBackground({ type: "transparent" });
    else if (b.dataset.color === "blur") chooseBackground({ type: "blur" });
    else chooseBackground({ type: "color", color: b.dataset.color });
  });
});

// ... [Keep the rest of the background code exactly the same] ...

// UPDATE: renderForExport to bake in the Blur
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
    // ... [Keep the rest of the export code exactly the same] ...
    const longest = Math.max(out.width, out.height);
    if (longest > exp.maxSide) {
      const k = exp.maxSide / longest;
      out = resizeCanvas(out, Math.round(out.width * k), Math.round(out.height * k));
    }
  }
  return out;
}

// ... [Keep the export logic and ZIP logic exactly the same] ...

// ---------- NEW: Touch-up Brush Logic ----------
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

// ... [Keep the rest of the file exactly the same down to the bottom] ...