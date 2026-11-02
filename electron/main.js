// Windows app (Electron) for BG Remover.
// Starts a small local server for the "www" folder and shows it in a window.
//
//   npm run desktop              start the app from the project folder
//   npm run desktop -- --dev     same, with the developer tools open
//   "BG Remover.exe" --smoke-test    used by the build: starts the server, checks the files, then quits

const { app, BrowserWindow, Menu, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { startServer } = require("./server");

const SMOKE = process.argv.includes("--smoke-test");
const PORT = 47329;
let server = null;
let mainWindow = null;

// installed app: www sits next to the app in "resources"; during development: the project folder
function wwwFolder() {
  return app.isPackaged ? path.join(process.resourcesPath, "www") : path.resolve(__dirname, "..", "www");
}

// ---- problems: show them instead of a blank window, and keep a copy in a log file ----
function smokeLog(text) {
  try { fs.appendFileSync(path.join(os.tmpdir(), "bg-remover-smoke.log"), text + "\n"); } catch (e) { /* ignore */ }
  console.log(text);
}

function fail(title, err) {
  const text = (err && err.stack) || String(err);
  if (SMOKE) {
    smokeLog("FAILED: " + title + "\n" + text);
    app.exit(1);
    return;
  }
  let where = "";
  try {
    const dir = app.getPath("userData");
    fs.mkdirSync(dir, { recursive: true });
    where = path.join(dir, "startup-error.log");
    fs.writeFileSync(where, new Date().toISOString() + "\n" + title + "\n" + text + "\n");
  } catch (e) { /* ignore */ }
  dialog.showErrorBox("BG Remover could not start", title + "\n\n" + text + (where ? "\n\nA copy was saved in:\n" + where : ""));
  app.quit();
}

// ---- smoke test (run by the build): are all files there and served correctly? ----
async function smokeTest() {
  const wwwDir = wwwFolder();
  smokeLog("www folder: " + wwwDir);
  const started = await startServer(wwwDir, 0);
  server = started.server;
  const base = "http://127.0.0.1:" + started.port;
  const mustHave = [
    ["/index.html", "text/html"],
    ["/app.js", "text/javascript"],
    ["/ort/ort.wasm.min.js", "text/javascript"],
    ["/ort/ort-wasm-simd-threaded.mjs", "text/javascript"],
    ["/ort/ort-wasm-simd-threaded.wasm", "application/wasm"],
    ["/models/u2netp.onnx", "application/octet-stream"],
  ];
  for (const [file, type] of mustHave) {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(file + " -> HTTP " + res.status);
    const got = res.headers.get("content-type") || "";
    if (!got.startsWith(type)) throw new Error(file + " has the wrong type: " + got);
    const size = (await res.arrayBuffer()).byteLength;
    if (size < 1000) throw new Error(file + " is too small (" + size + " bytes)");
    smokeLog("ok  " + file + "  " + size + " bytes");
  }
  smokeLog("SMOKE TEST PASSED");
  server.close();
  app.exit(0);
}

// ---- the real window ----
async function createWindow() {
  const wwwDir = wwwFolder();
  const started = await startServer(wwwDir, PORT);
  server = started.server;
  const origin = "http://127.0.0.1:" + started.port;

  Menu.setApplicationMenu(null); // no File/Edit menu bar

  const iconPath = path.join(wwwDir, "icons", "icon-512.png");
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 420,
    minHeight: 500,
    title: "BG Remover",
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // links to other websites open in the normal browser, never inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) event.preventDefault();
  });
  mainWindow.webContents.on("did-fail-load", (event, code, description, url, isMainFrame) => {
    if (isMainFrame) fail("The app page could not be loaded.", new Error(description + " (" + code + ") " + url));
  });

  await mainWindow.loadURL(origin + "/index.html");

  if (process.argv.includes("--dev")) mainWindow.webContents.openDevTools();

  // Check for updates silently in the background
  if (app.isPackaged && !SMOKE) {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.warn("Update check failed:", err);
    });
  }
}

autoUpdater.on("error", (err) => {
  console.warn("Update error:", err);
});

app.setAppUserModelId("com.nurotraders.bgremover");

// only one copy at a time: a second start just brings the first window forward
if (!SMOKE && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app
    .whenReady()
    .then(SMOKE ? smokeTest : createWindow)
    .catch((err) => fail("Something went wrong while starting.", err));
}

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});