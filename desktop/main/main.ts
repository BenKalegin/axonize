import { app, BrowserWindow, dialog, ipcMain, nativeTheme, OpenDialogOptions } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { executeCommand } from "./semantic/command";
import { SemanticEngine } from "./semantic/engine";
import { CommandPayload } from "./semantic/models";

let mainWindow: BrowserWindow | null = null;
let workspacePath = process.cwd();
const engines = new Map<string, SemanticEngine>();
const THEME_SOURCES = new Set(["system", "light", "dark"] as const);
type ThemeSource = "system" | "light" | "dark";

function cdpPortFromEnvOrArgs(args: readonly string[] = process.argv): string | null {
  const envPort = String(process.env.AXONIZE_CDP_PORT ?? "").trim();
  if (envPort) {
    return envPort;
  }

  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    if (arg === "--cdp-port" && idx + 1 < args.length) {
      return String(args[idx + 1] ?? "").trim();
    }
    if (arg.startsWith("--cdp-port=")) {
      return arg.slice("--cdp-port=".length).trim();
    }
  }

  return null;
}

const cdpPort = cdpPortFromEnvOrArgs();
if (cdpPort) {
  app.commandLine.appendSwitch("remote-debugging-port", cdpPort);
}

const MULTI_INSTANCE_ALLOWED = String(process.env.AXONIZE_ALLOW_MULTI_INSTANCE ?? "") === "1";
const SINGLE_INSTANCE_LOCK = MULTI_INSTANCE_ALLOWED ? true : app.requestSingleInstanceLock();

if (!SINGLE_INSTANCE_LOCK) {
  app.quit();
}

function getEngine(rootPath: string): SemanticEngine {
  if (!engines.has(rootPath)) {
    engines.set(rootPath, new SemanticEngine(rootPath));
  }
  return engines.get(rootPath)!;
}

function createWindow(): BrowserWindow {
  const startsDark = nativeTheme.shouldUseDarkColors;
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 720,
    title: "Axonize",
    backgroundColor: startsDark ? "#10141a" : "#f8f3eb",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(__dirname, "../renderer/index.html")).catch((error: unknown) => {
    console.error("Failed to load renderer:", error);
  });

  return window;
}

function getThemePayload(): { source: ThemeSource; effective: "light" | "dark" } {
  const source = (nativeTheme.themeSource as ThemeSource) || "system";
  const safeSource: ThemeSource = THEME_SOURCES.has(source) ? source : "system";
  return {
    source: safeSource,
    effective: nativeTheme.shouldUseDarkColors ? "dark" : "light"
  };
}

function applyWindowBackground(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  const payload = getThemePayload();
  mainWindow.setBackgroundColor(payload.effective === "dark" ? "#10141a" : "#f8f3eb");
}

function emitThemeChanged(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("theme:changed", getThemePayload());
}

function workspaceFromEnvOrArgs(args: readonly string[] = process.argv): string | null {
  const envWorkspace = String(process.env.AXONIZE_WORKSPACE ?? "").trim();
  if (envWorkspace) {
    return envWorkspace;
  }

  for (let idx = 0; idx < args.length; idx += 1) {
    const arg = args[idx];
    if (arg === "--workspace" && idx + 1 < args.length) {
      return String(args[idx + 1] ?? "").trim();
    }
    if (arg.startsWith("--workspace=")) {
      return arg.slice("--workspace=".length).trim();
    }
  }

  return null;
}

async function isDirectory(candidate: string): Promise<boolean> {
  try {
    return (await fs.stat(candidate)).isDirectory();
  } catch {
    return false;
  }
}

async function normalizeWorkspace(input: string): Promise<string> {
  const resolved = path.resolve(input);
  if (await isDirectory(path.join(resolved, "docs"))) {
    return resolved;
  }

  if (path.basename(resolved) === "docs") {
    const parent = path.dirname(resolved);
    if (await isDirectory(path.join(parent, "docs"))) {
      return parent;
    }
  }

  return resolved;
}

async function setWorkspacePath(requested: string): Promise<string> {
  const normalized = await normalizeWorkspace(requested);
  if (!(await isDirectory(normalized))) {
    throw new Error("workspace_not_found");
  }
  workspacePath = normalized;
  return workspacePath;
}

function emitWorkspaceChanged(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("workspace:changed", { workspacePath });
}

if (!MULTI_INSTANCE_ALLOWED) {
  app.on("second-instance", (_event, commandLine) => {
    const requestedWorkspace = workspaceFromEnvOrArgs(commandLine);
    if (requestedWorkspace) {
      setWorkspacePath(requestedWorkspace)
        .then(() => {
          emitWorkspaceChanged();
        })
        .catch((error: unknown) => {
          console.error("Failed to switch workspace from second-instance:", error);
        });
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  const requestedWorkspace = workspaceFromEnvOrArgs();
  if (requestedWorkspace) {
    workspacePath = requestedWorkspace;
  }

  normalizeWorkspace(workspacePath)
    .then((normalizedWorkspace) => {
      workspacePath = normalizedWorkspace;
      mainWindow = createWindow();
      applyWindowBackground();
      emitThemeChanged();
    })
    .catch((error: unknown) => {
      console.error("Workspace normalization failed:", error);
      mainWindow = createWindow();
      applyWindowBackground();
      emitThemeChanged();
    });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

nativeTheme.on("updated", () => {
  applyWindowBackground();
  emitThemeChanged();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("workspace:get", async () => ({ workspacePath }));

ipcMain.handle("theme:get", async () => getThemePayload());

ipcMain.handle("theme:set", async (_event, payload?: { source?: string }) => {
  const source = String(payload?.source ?? "").trim().toLowerCase();
  if (!THEME_SOURCES.has(source as ThemeSource)) {
    throw new Error("invalid_theme_source");
  }

  nativeTheme.themeSource = source as ThemeSource;
  applyWindowBackground();
  emitThemeChanged();
  return getThemePayload();
});

ipcMain.handle("workspace:choose", async () => {
  const options: OpenDialogOptions = {
    title: "Choose Markdown Workspace",
    buttonLabel: "Use Workspace",
    properties: ["openDirectory", "createDirectory"]
  };
  const result = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { workspacePath };
  }

  await setWorkspacePath(result.filePaths[0]);
  emitWorkspaceChanged();
  return { workspacePath };
});

ipcMain.handle("workspace:set", async (_event, payload?: { path?: string }) => {
  const requested = String(payload?.path ?? "").trim();
  if (!requested) {
    throw new Error("missing_workspace_path");
  }

  await setWorkspacePath(requested);
  emitWorkspaceChanged();
  return { workspacePath };
});

ipcMain.handle("semantic:rebuild", async (_event, payload?: { full?: boolean }) => {
  const engine = getEngine(workspacePath);
  return engine.rebuild({ full: Boolean(payload?.full) });
});

ipcMain.handle("semantic:check", async () => {
  const engine = getEngine(workspacePath);
  return { errors: await engine.check() };
});

ipcMain.handle("semantic:loadGraph", async () => {
  const engine = getEngine(workspacePath);
  return engine.loadGraph();
});

ipcMain.handle("semantic:command", async (_event, payload: { command: CommandPayload; apply?: boolean }) => {
  const command = payload?.command;
  if (!command) {
    throw new Error("missing_command_payload");
  }
  const result = await executeCommand(workspacePath, command, Boolean(payload.apply));
  if (payload.apply) {
    const engine = getEngine(workspacePath);
    await engine.rebuild({ full: false });
  }
  return result;
});
