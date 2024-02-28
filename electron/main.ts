import { BrowserWindow, app, screen } from "electron";
import path from "node:path";

import { registerAdvisorHandlers } from "./advisorService.js";
import { registerAgentHandlers } from "./agentService.js";
import { registerProjectHandlers } from "./projectService.js";
import { registerRuntimeHandlers } from "./runtimeService.js";
import { registerSessionHandlers } from "./sessionService.js";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const { width: workWidth, height: workHeight } = screen.getPrimaryDisplay().workAreaSize;
  mainWindow = new BrowserWindow({
    useContentSize: true,
    width: Math.min(1680, workWidth),
    height: Math.min(1000, workHeight),
    minWidth: 1120,
    minHeight: 680,
    backgroundColor: "#e7e2d6",
    ...(process.platform === "darwin" ? { titleBarStyle: "hiddenInset" as const } : {}),
    webPreferences: {
      preload: path.join(process.cwd(), "dist-electron", "electron", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void mainWindow.loadURL(devUrl);
  } else {
    void mainWindow.loadFile(path.join(process.cwd(), "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  registerProjectHandlers();
  registerRuntimeHandlers();
  registerAdvisorHandlers();
  registerAgentHandlers();
  registerSessionHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
