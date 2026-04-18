import { contextBridge, ipcRenderer } from "electron";
import {
  AppConfig,
  BackendDataPayload,
  BackendStatusPayload,
  AlertEventPayload,
  ScreenInfo,
} from "../shared/types";

type Unsubscribe = () => void;

const api = {
  // 获取配置
  getConfig: () => ipcRenderer.invoke("config:get") as Promise<AppConfig>,
  // 更新配置
  updateConfig: (patch: Partial<AppConfig>) =>
    ipcRenderer.invoke("config:update", patch) as Promise<AppConfig>,
  // 预览覆盖层布局
  previewOverlay: (overlay: Partial<AppConfig["overlay"]>) =>
    ipcRenderer.invoke("overlay:preview", overlay) as Promise<void>,
  // 取消预览并恢复覆盖层布局
  resetOverlayPreview: (overlay: AppConfig["overlay"]) =>
    ipcRenderer.invoke("overlay:previewReset", overlay) as Promise<void>,
  // 获取屏幕信息
  getScreenInfo: () => ipcRenderer.invoke("screen:get") as Promise<ScreenInfo>,
  // 设置锁定状态
  setLocked: (locked: boolean) => ipcRenderer.send("overlay:setLocked", locked),
  // 发送配置更新广播
  broadcastConfig: (config: AppConfig) => ipcRenderer.send("config:updated", config),
  // 后端控制
  startRecognition: () => ipcRenderer.invoke("backend:start"),
  stopRecognition: () => ipcRenderer.invoke("backend:stop"),
  reconnectBackend: () => ipcRenderer.invoke("backend:reconnect"),
  getBackendStatus: () => ipcRenderer.invoke("backend:status"),
  // 关闭应用
  closeApp: () => ipcRenderer.invoke("app:close") as Promise<void>,
  // 标定模式
  startCalibration: () => ipcRenderer.invoke("calibration:start"),
  stopCalibration: () => ipcRenderer.invoke("calibration:stop"),
  // 打开外部链接（系统浏览器）
  openExternalUrl: (url: string) => ipcRenderer.invoke("external:openUrl", url) as Promise<void>,
  // 订阅后端状态
  onBackendStatus: (handler: (payload: BackendStatusPayload) => void): Unsubscribe => {
    ipcRenderer.on("backend:status", (_event, payload) => handler(payload));
    return () => ipcRenderer.removeAllListeners("backend:status");
  },
  // 订阅后端数据
  onBackendData: (handler: (payload: BackendDataPayload) => void): Unsubscribe => {
    ipcRenderer.on("backend:data", (_event, payload) => handler(payload));
    return () => ipcRenderer.removeAllListeners("backend:data");
  },
  // 订阅后端告警
  onBackendAlert: (handler: (payload: AlertEventPayload) => void): Unsubscribe => {
    ipcRenderer.on("backend:alert", (_event, payload) => handler(payload));
    return () => ipcRenderer.removeAllListeners("backend:alert");
  },
  // 订阅配置更新
  onConfigUpdated: (handler: (payload: AppConfig) => void): Unsubscribe => {
    ipcRenderer.on("config:updated", (_event, payload) => handler(payload));
    return () => ipcRenderer.removeAllListeners("config:updated");
  },
};

contextBridge.exposeInMainWorld("api", api);
