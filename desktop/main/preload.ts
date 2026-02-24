import { contextBridge, ipcRenderer } from "electron";
import { CommandPayload } from "./semantic/models";

contextBridge.exposeInMainWorld("axonize", {
  getWorkspace: async (): Promise<{ workspacePath: string }> => ipcRenderer.invoke("workspace:get"),
  getTheme: async (): Promise<{ source: "system" | "light" | "dark"; effective: "light" | "dark" }> =>
    ipcRenderer.invoke("theme:get"),
  setTheme: async (
    source: "system" | "light" | "dark"
  ): Promise<{ source: "system" | "light" | "dark"; effective: "light" | "dark" }> =>
    ipcRenderer.invoke("theme:set", { source }),
  onThemeChanged: (
    callback: (payload: { source: "system" | "light" | "dark"; effective: "light" | "dark" }) => void
  ): (() => void) => {
    const listener = (
      _event: unknown,
      payload: { source: "system" | "light" | "dark"; effective: "light" | "dark" }
    ) => callback(payload);
    ipcRenderer.on("theme:changed", listener);
    return () => {
      ipcRenderer.removeListener("theme:changed", listener);
    };
  },
  chooseWorkspace: async (): Promise<{ workspacePath: string }> => ipcRenderer.invoke("workspace:choose"),
  setWorkspace: async (workspacePath: string): Promise<{ workspacePath: string }> =>
    ipcRenderer.invoke("workspace:set", { path: workspacePath }),
  onWorkspaceChanged: (callback: (payload: { workspacePath: string }) => void): (() => void) => {
    const listener = (_event: unknown, payload: { workspacePath: string }) => callback(payload);
    ipcRenderer.on("workspace:changed", listener);
    return () => {
      ipcRenderer.removeListener("workspace:changed", listener);
    };
  },
  rebuild: async (full = false) => ipcRenderer.invoke("semantic:rebuild", { full }),
  check: async (): Promise<{ errors: string[] }> => ipcRenderer.invoke("semantic:check"),
  loadGraph: async () => ipcRenderer.invoke("semantic:loadGraph"),
  runCommand: async (command: CommandPayload, apply = false) => ipcRenderer.invoke("semantic:command", { command, apply })
});
