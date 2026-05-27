const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

console.log("🗺️  Starting Atlas...\n");

// Step 1 — Start Vite frontend
const frontend = spawn("npm", ["run", "dev"], {
  cwd: path.join(__dirname, "frontend"),
  shell: true,
  stdio: "pipe",
});

frontend.stdout.on("data", (d) => {
  const msg = d.toString();
  if (msg.includes("Local") || msg.includes("localhost")) {
    console.log("✅ Frontend ready:", msg.trim());
  }
});

frontend.stderr.on("data", (d) => {
  const msg = d.toString();
  if (!msg.includes("ExperimentalWarning")) {
    process.stdout.write("Frontend: " + msg);
  }
});

// Step 2 — Wait for frontend on port 5173
function waitForPort(port, retries = 30) {
  return new Promise((resolve, reject) => {
    const check = (left) => {
      if (left === 0) { reject(new Error("Frontend never started")); return; }
      http.get(`http://localhost:${port}`, (res) => {
        resolve();
      }).on("error", () => {
        setTimeout(() => check(left - 1), 1000);
      });
    };
    check(retries);
  });
}

// Step 3 — Launch Electron once frontend is ready
waitForPort(5173)
  .then(() => {
    console.log("✅ Launching Atlas window...\n");
    const electron = spawn(
      path.join(__dirname, "node_modules", "electron", "dist", "electron.exe"),
      ["."],
      {
        cwd: __dirname,
        shell: false,
        stdio: "inherit",
        env: { ...process.env },
      }
    );

    electron.on("close", (code) => {
      console.log("Atlas closed. Shutting down...");
      frontend.kill();
      process.exit(0);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to start:", err.message);
    frontend.kill();
    process.exit(1);
  });