import { BrowserWindow, ipcMain, screen } from "electron";
import { BackendClient } from "./backendWs";
import { ConfigStore } from "./configStore";
import { ScreenInfo } from "../../shared/types";

type RegisterParams = {
  windows: BrowserWindow[];
  backend: BackendClient;
  store: ConfigStore;
  onLockedChange?: (locked: boolean) => void;
  onConfigUpdated?: (config: unknown) => void;
};

// 注册 IPC 通道
export function registerIpcHandlers(params: RegisterParams) {
  const { windows, backend, store, onLockedChange, onConfigUpdated } = params;

  ipcMain.handle("config:get", () => store.getConfig());
  ipcMain.handle("config:update", (_event, patch) => {
    const next = store.updateConfig(patch);
    return next;
  });

  ipcMain.handle("backend:reconnect", () => {
    backend.reconnect();
  });
  ipcMain.handle("backend:start", () => {
    backend.start();
  });
  ipcMain.handle("backend:stop", () => {
    backend.stop();
  });

  ipcMain.handle("screen:get", () => {
    const display = screen.getPrimaryDisplay();
    const info: ScreenInfo = {
      width: display.bounds.width,
      height: display.bounds.height,
      scaleFactor: display.scaleFactor,
      displayId: display.id,
    };
    return info;
  });

  ipcMain.on("overlay:setLocked", (_event, locked) => {
    onLockedChange?.(Boolean(locked));
  });

  // 广播配置更新给渲染进程
  const sendConfigUpdated = (config: unknown) => {
    windows.forEach((win) => {
      win.webContents.send("config:updated", config);
    });
  };

  ipcMain.on("config:updated", (_event, config) => {
    sendConfigUpdated(config);
    onConfigUpdated?.(config);
  });
}
