import { BrowserWindow, ipcMain, screen, shell } from "electron";
import { BackendClient } from "./backendWs";
import { ConfigStore } from "./configStore";
import { ScreenInfo } from "../../shared/types";

type RegisterParams = {
  windows: BrowserWindow[];
  backend: BackendClient;
  store: ConfigStore;
  onLockedChange?: (locked: boolean) => void;
  onConfigUpdated?: (config: unknown) => void;
  onCalibrationStart?: () => void;
  onCalibrationStop?: () => void;
  getBackendStatus?: () => unknown;
};

// 注册 IPC 通道
export function registerIpcHandlers(params: RegisterParams) {
  const {
    windows,
    backend,
    store,
    onLockedChange,
    onConfigUpdated,
    onCalibrationStart,
    onCalibrationStop,
    getBackendStatus,
  } = params;

  ipcMain.handle("config:get", () => store.getConfig());
  ipcMain.handle("config:update", (_event, patch) => {
    console.log("[ipc] config:update", {
      rois: patch?.calibration?.rois?.length ?? 0,
      hasSignature: Boolean(patch?.calibration?.signature),
    });
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

  ipcMain.handle("backend:status", () => {
    return getBackendStatus?.() ?? null;
  });

  ipcMain.handle("calibration:start", () => {
    console.log("[ipc] calibration:start");
    onCalibrationStart?.();
  });

  ipcMain.handle("calibration:stop", () => {
    console.log("[ipc] calibration:stop");
    onCalibrationStop?.();
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

  // 打开外部链接（使用系统默认浏览器）
  ipcMain.handle("external:openUrl", async (_event, rawUrl: string) => {
    const url = new URL(rawUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol");
    }
    await shell.openExternal(url.toString());
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
