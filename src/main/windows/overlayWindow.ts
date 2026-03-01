import path from "node:path";
import { BrowserWindow, screen } from "electron";

let overlayWindow: BrowserWindow | null = null;
let previousBounds: Electron.Rectangle | null = null;
let calibrationActive = false;

// 创建覆盖层窗口
export function createOverlayWindow() {
  const primary = screen.getPrimaryDisplay();
  const bounds = primary.bounds;
  const workArea = primary.workAreaSize;
  const width = Math.round(workArea.width * 0.38);
  const height = Math.round(workArea.height * 0.18);
  const x = Math.round(bounds.x + workArea.width * 0.05);
  const y = Math.round(bounds.y);

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
    titleBarStyle: 'hidden',
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
    overlayWindow.webContents.openDevTools({ mode: "detach" });
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

// 进入标定模式（全屏）
export function enterCalibration() {
  if (!overlayWindow || calibrationActive) {
    return;
  }
  const display = screen.getPrimaryDisplay();
  previousBounds = overlayWindow.getBounds();
  calibrationActive = true;
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.setFocusable(true);
  overlayWindow.setBounds(display.bounds);
  overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
}

// 退出标定模式（恢复窗口）
export function exitCalibration(locked: boolean) {
  if (!overlayWindow || !calibrationActive) {
    return;
  }
  if (previousBounds) {
    overlayWindow.setBounds(previousBounds);
  }
  calibrationActive = false;
  setOverlayLocked(locked);
  overlayWindow.setAlwaysOnTop(true, "screen-saver", 0);
}
