import path from "node:path";
import { BrowserWindow, screen } from "electron";

let overlayWindow: BrowserWindow | null = null;

// 创建覆盖层窗口
export function createOverlayWindow() {
  const primary = screen.getPrimaryDisplay();
  const bounds = primary.bounds;
  const width = 520;
  const height = 300;
  const margin = 20;
  const x = Math.max(bounds.x + bounds.width - width - margin, bounds.x);
  const y = bounds.y + margin;

  overlayWindow = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    thickFrame: false,
    roundedCorners: false,
    hasShadow: false,
    focusable: false,
    title: "",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver", 0);
  overlayWindow.setMenuBarVisibility(false);

  overlayWindow.once("ready-to-show", () => {
    overlayWindow?.showInactive();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return overlayWindow;
}

// 获取覆盖层窗口
export function getOverlayWindow() {
  return overlayWindow;
}

// 设置覆盖层锁定状态
export function setOverlayLocked(locked: boolean) {
  if (!overlayWindow) {
    return;
  }
  if (locked) {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.setFocusable(false);
  } else {
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.setFocusable(true);
  }
}
