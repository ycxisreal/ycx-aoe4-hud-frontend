import { app, globalShortcut } from "electron";
import { createOverlayWindow, enterCalibration, exitCalibration, setOverlayLocked } from "./windows/overlayWindow";
import { createBackendClient } from "./services/backendWs";
import { initConfigStore } from "./services/configStore";
import { registerIpcHandlers } from "./services/ipcBridge";
import { AppConfig, BackendDataPayload, BackendStatusPayload, AlertEventPayload } from "../shared/types";

// 注册全局快捷键
const registerShortcuts = (getConfig: () => AppConfig, applyLockState: (locked: boolean) => void) => {
  globalShortcut.unregisterAll();
  const hotkey = getConfig().hotkeys.toggleLock || "Alt+W";
  const registered = globalShortcut.register(hotkey, () => {
    const current = getConfig();
    const nextLocked = !current.overlay.locked;
    applyLockState(nextLocked);
  });

  if (!registered) {
    const fallback = "Alt+Shift+W";
    globalShortcut.register(fallback, () => {
      const current = getConfig();
      const nextLocked = !current.overlay.locked;
      applyLockState(nextLocked);
    });
  }
};

// 初始化应用
const bootstrap = () => {
  const store = initConfigStore();
  const window = createOverlayWindow();
  const backend = createBackendClient(store.getConfig);
  let latestStatus: BackendStatusPayload | null = null;

  // 监听后端事件并转发给渲染进程
  const forwardStatus = (payload: BackendStatusPayload) => {
    latestStatus = payload;
    window.webContents.send("backend:status", payload);
  };
  const forwardData = (payload: BackendDataPayload) => {
    window.webContents.send("backend:data", payload);
  };
  const forwardAlert = (payload: AlertEventPayload) => {
    window.webContents.send("backend:alert", payload);
  };

  backend.on("status", forwardStatus);
  backend.on("data", forwardData);
  backend.on("alert", forwardAlert);

  // 初始化锁定状态
  // 根据锁定状态切换穿透
  const applyLockState = (locked: boolean) => {
    setOverlayLocked(locked);
    const next = store.updateConfig({
      overlay: { ...store.getConfig().overlay, locked },
    });
    window.webContents.send("config:updated", next);
  };

  const config = store.getConfig();
  applyLockState(config.overlay.locked);
  registerShortcuts(store.getConfig, applyLockState);

  // 配置更新后同步到后端
  const syncConfigToBackend = (next: AppConfig) => {
    backend.sendConfig(next.calibration.signature);
  };

  registerIpcHandlers({
    windows: [window],
    backend,
    store,
    onLockedChange: (locked) => applyLockState(locked),
    onCalibrationStart: () => {
      enterCalibration();
    },
    onCalibrationStop: () => {
      exitCalibration(store.getConfig().overlay.locked);
    },
    onConfigUpdated: (next) => syncConfigToBackend(next as AppConfig),
    getBackendStatus: () => latestStatus,
  });

  backend.connect();

  window.webContents.on("did-finish-load", () => {
    if (latestStatus) {
      window.webContents.send("backend:status", latestStatus);
    }
  });
};

app.whenReady().then(bootstrap);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
