import path from "node:path";
import { BrowserWindow, screen } from "electron";
import { AppConfig } from "../../shared/types";

let overlayWindow: BrowserWindow | null = null;
let previousBounds: Electron.Rectangle | null = null;
let calibrationActive = false;

type OverlayConfig = AppConfig["overlay"];

const OVERLAY_PERCENT_LIMITS = {
  width: { min: 20, max: 80 },
  height: { min: 10, max: 50 },
  offsetX: { min: 0, max: 60 },
  offsetY: { min: 0, max: 60 },
} as const;

// 将数值限制在指定范围内，避免异常配置导致窗口越界或尺寸失控
function clampPercent(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

// 规范化覆盖层布局比例配置，统一处理默认值与边界限制
export function normalizeOverlayConfig(overlay: Partial<OverlayConfig> | undefined): OverlayConfig {
  return {
    opacity: typeof overlay?.opacity === "number" ? overlay.opacity : 0.9,
    scale: typeof overlay?.scale === "number" ? overlay.scale : 1,
    layoutPreset: overlay?.layoutPreset === "default" ? "default" : "default",
    locked: typeof overlay?.locked === "boolean" ? overlay.locked : true,
    widthPercent: clampPercent(overlay?.widthPercent ?? 38, OVERLAY_PERCENT_LIMITS.width.min, OVERLAY_PERCENT_LIMITS.width.max),
    heightPercent: clampPercent(
      overlay?.heightPercent ?? 18,
      OVERLAY_PERCENT_LIMITS.height.min,
      OVERLAY_PERCENT_LIMITS.height.max
    ),
    offsetXPercent: clampPercent(
      overlay?.offsetXPercent ?? 5,
      OVERLAY_PERCENT_LIMITS.offsetX.min,
      OVERLAY_PERCENT_LIMITS.offsetX.max
    ),
    offsetYPercent: clampPercent(
      overlay?.offsetYPercent ?? 0,
      OVERLAY_PERCENT_LIMITS.offsetY.min,
      OVERLAY_PERCENT_LIMITS.offsetY.max
    ),
  };
}

// 根据覆盖层比例配置计算窗口位置与尺寸，统一用于初始化、预览和保存后的应用
function getOverlayBounds(overlay: Partial<OverlayConfig> | undefined) {
  const primary = screen.getPrimaryDisplay();
  const bounds = primary.bounds;
  const workArea = primary.workAreaSize;
  const normalizedOverlay = normalizeOverlayConfig(overlay);
  const width = Math.round(workArea.width * (normalizedOverlay.widthPercent / 100));
  const height = Math.round(workArea.height * (normalizedOverlay.heightPercent / 100));
  const x = Math.round(bounds.x + workArea.width * (normalizedOverlay.offsetXPercent / 100));
  const y = Math.round(bounds.y + workArea.height * (normalizedOverlay.offsetYPercent / 100));

  return { x, y, width, height };
}

// 创建覆盖层窗口
export function createOverlayWindow(overlay: Partial<OverlayConfig> | undefined) {
  const { x, y, width, height } = getOverlayBounds(overlay);

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

// 应用覆盖层布局；标定模式期间仅记录最新普通态尺寸，避免打断全屏标定
export function applyOverlayLayout(overlay: Partial<OverlayConfig> | undefined) {
  const nextBounds = getOverlayBounds(overlay);
  previousBounds = nextBounds;
  if (!overlayWindow || calibrationActive) {
    return;
  }
  overlayWindow.setBounds(nextBounds);
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
