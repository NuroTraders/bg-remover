// Windows app (Electron) for BG Remover.
// Starts a small local server for the "www" folder and shows it in a window.
// Run with:  npm run desktop      (add  -- --dev  to open the developer tools)

const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("path");
const { startServer } = require("./server");

let server = null;

async function createWindow() {
  const wwwDir = path.resolve(__dirname, "..", "www");
  const started = await startServer(wwwDir);
  server = started.server;
  const origin = "http://127.0.0.1:" + started.port;

  Menu.setApplicationMenu(null); // no File/Edit menu bar

  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 420,
    minHeight: 500,
    title: "BG Remover",
    icon: path.join(wwwDir, "icons", "icon-512.png"),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // links to other websites open in the normal browser, never inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) event.preventDefault();
  });

  await win.loadURL(origin + "/index.html");

  if (process.argv.includes("--dev")) win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (server) server.close();
  app.quit();
});
