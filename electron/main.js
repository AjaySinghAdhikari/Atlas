const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

let mainWindow;
let backendProcess;
let tray;

// ── Find Python ──────────────────────────────────────────────────
function getPythonPath() {
  const venvPython = path.join(__dirname, "..", "backend", "venv", "Scripts", "python.exe");
  if (fs.existsSync(venvPython)) return venvPython;
  return "python"; // fallback to system python
}

// ── Start Python backend ─────────────────────────────────────────
function startBackend() {
  const pythonPath = getPythonPath();
  const backendDir = path.join(__dirname, "..", "backend");

  console.log("Starting backend with:", pythonPath);

  backendProcess = spawn(
    pythonPath,
    ["-m", "uvicorn", "main:app", "--port", "8000", "--host", "127.0.0.1"],
    {
      cwd: backendDir,
      windowsHide: true, // hide terminal window on Windows
      env: { ...process.env },
    }
  );

  backendProcess.stdout.on("data", (data) => {
    console.log("Backend:", data.toString());
  });

  backendProcess.stderr.on("data", (data) => {
    console.log("Backend stderr:", data.toString());
  });

  backendProcess.on("close", (code) => {
    console.log("Backend stopped with code:", code);
  });
}

// ── Wait for backend to be ready ─────────────────────────────────
function waitForBackend(retries = 30) {
  return new Promise((resolve, reject) => {
    const check = (attemptsLeft) => {
      if (attemptsLeft === 0) {
        reject(new Error("Backend failed to start after 30 attempts"));
        return;
      }
      http.get("http://127.0.0.1:8000/", (res) => {
        if (res.statusCode === 200) {
          console.log("Backend is ready!");
          resolve();
        } else {
          setTimeout(() => check(attemptsLeft - 1), 1000);
        }
      }).on("error", () => {
        setTimeout(() => check(attemptsLeft - 1), 1000);
      });
    };
    check(retries);
  });
}

// ── Create main window ───────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Atlas",
    backgroundColor: "#0d0d14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    // Remove default menu bar
    autoHideMenuBar: true,
    // Nice window frame
    show: false, // don't show until ready
  });

  // Load the React frontend
  mainWindow.loadURL("http://localhost:5173");

  // Show window when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Create system tray ───────────────────────────────────────────
function createTray() {
  // Simple 16x16 tray icon (purple square)
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABLSURBVDiNY/z//z8DNYCJgUJAuQH/GagBRjUMagNYGBgYGP7//09NQ4asgYGBgfH///8MDAwM1DRkSBsAAAAAAP//AwBJ4g5T6Gz0OQAAAABJRU5ErkJggg=="
  );

  tray = new Tray(icon);
  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Atlas", click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: "separator" },
    { label: "Quit Atlas", click: () => { app.quit(); } },
  ]);

  tray.setToolTip("Atlas — Knowledge Base");
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (mainWindow) mainWindow.show();
    else createWindow();
  });
}

// ── App lifecycle ────────────────────────────────────────────────
app.whenReady().then(async () => {
  console.log("Electron ready. Starting backend...");

  // Start Python backend
  startBackend();

  // Create tray immediately
  createTray();

  // Show a loading window while backend starts
  mainWindow = new BrowserWindow({
    width: 480,
    height: 300,
    resizable: false,
    frame: false,
    backgroundColor: "#0d0d14",
    webPreferences: { nodeIntegration: false },
    show: true,
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(`data:text/html,
    <html>
    <body style="background:#0d0d14;color:#e2e8f0;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px;">
      <div style="font-size:48px">🗺️</div>
      <div style="font-size:22px;font-weight:700;color:#fff">Atlas</div>
      <div style="font-size:13px;color:#4a4a6a">Starting up...</div>
      <div style="width:200px;height:2px;background:#1e1e30;border-radius:2px;overflow:hidden;margin-top:8px;">
        <div style="height:100%;background:#7c3aed;animation:load 2s ease-in-out infinite;" />
      </div>
      <style>@keyframes load{0%{width:0%}50%{width:100%}100%{width:0%}}</style>
    </body>
    </html>
  `);

  try {
    // Wait for backend
    await waitForBackend();

    // Close loading window
    mainWindow.close();

    // Open real window
    createWindow();

  } catch (err) {
    console.error("Backend failed to start:", err);
    mainWindow.loadURL(`data:text/html,
      <html>
      <body style="background:#0d0d14;color:#f87171;font-family:monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;gap:16px;">
        <div style="font-size:48px">⚠️</div>
        <div style="font-size:18px;font-weight:700;">Backend failed to start</div>
        <div style="font-size:12px;color:#4a4a6a;text-align:center;max-width:320px;">
          Make sure Python and the venv are set up correctly in the backend folder.
        </div>
      </body>
      </html>
    `);
  }
});

// Keep app running when all windows closed (stays in tray)
app.on("window-all-closed", (e) => {
  e.preventDefault(); // don't quit, stay in tray
});

// Clean up backend on quit
app.on("before-quit", () => {
  if (backendProcess) {
    console.log("Killing backend...");
    backendProcess.kill();
  }
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});