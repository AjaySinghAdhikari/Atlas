// Security bridge between Electron and React
// Keep this minimal — we don't need any special IPC for Atlas
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("atlas", {
  version: "1.0.0",
});