import { app, globalShortcut } from "electron";
import {
  AlertEventPayload,
  AppConfig,
  BackendDataPayload,
  BackendStatusPayload,
} from "../shared/types";
import { createBackendClient } from "./services/backendWs";
import { initConfigStore } from "./services/configStore";
import { registerIpcHandlers } from "./services/ipcBridge";
import {
  applyOverlayLayout,
  createOverlayWindow,
  enterCalibration,
  exitCalibration,
  normalizeOverlayConfig,
  setOverlayLocked,
} from "./windows/overlayWindow";

// 注册全局快捷键
const registerShortcuts = (
  getConfig: () => AppConfig,
  applyLockState: (locked: boolean) => void
) => {
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
  const initialConfig = store.getConfig();
  const window = createOverlayWindow(initialConfig.overlay);
  const backend = createBackendClient(store.getConfig);
  let latestStatus: BackendStatusPayload | null = null;

  // 规范化覆盖层配置字段，确保新增比例配置在旧配置升级时立即补齐
  const normalizeAndPersistOverlayConfig = () => {
    const current = store.getConfig();
    const normalizedOverlay = normalizeOverlayConfig(current.overlay);
    const next = store.updateConfig({
      overlay: normalizedOverlay,
    });
    return next;
  };

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

  const normalizedConfig = normalizeAndPersistOverlayConfig();
  applyOverlayLayout(normalizedConfig.overlay);

  // 初始化锁定状态
  // 根据锁定状态切换穿透
  const applyLockState = (locked: boolean) => {
    setOverlayLocked(locked);
    const next = store.updateConfig({
      overlay: { ...store.getConfig().overlay, locked },
    });
    window.webContents.send("config:updated", next);
  };

  applyLockState(normalizedConfig.overlay.locked);
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
    onOverlayPreview: (overlay) => {
      const currentOverlay = store.getConfig().overlay;
      applyOverlayLayout({
        ...currentOverlay,
        ...(overlay as Partial<AppConfig["overlay"]>),
      });
    },
    onOverlayPreviewReset: (overlay) => {
      applyOverlayLayout(overlay as AppConfig["overlay"]);
    },
    onCalibrationStart: () => {
      enterCalibration();
    },
    onCalibrationStop: () => {
      exitCalibration(store.getConfig().overlay.locked);
    },
    onConfigUpdated: (next) => {
      const typedConfig = next as AppConfig;
      applyOverlayLayout(typedConfig.overlay);
      syncConfigToBackend(typedConfig);
    },
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
