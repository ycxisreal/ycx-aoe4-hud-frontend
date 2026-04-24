import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import {
  AlertEventPayload,
  AppConfig,
  BackendDataPayload,
  BackendStatusPayload,
  ScreenInfo,
} from "../shared/types";

type Unsubscribe = () => void;

// 统一封装 IPC 事件订阅，避免重复注册与清理逻辑分散
const subscribeIpcChannel = <T>(
  channel: string,
  handler: (payload: T) => void
): Unsubscribe => {
  const listener = (_event: IpcRendererEvent, payload: T) => {
    handler(payload);
  };

  ipcRenderer.on(channel, listener);
  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
};

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
  onBackendStatus: (handler: (payload: BackendStatusPayload) => void): Unsubscribe =>
    subscribeIpcChannel("backend:status", handler),
  // 订阅后端数据
  onBackendData: (handler: (payload: BackendDataPayload) => void): Unsubscribe =>
    subscribeIpcChannel("backend:data", handler),
  // 订阅后端告警
  onBackendAlert: (handler: (payload: AlertEventPayload) => void): Unsubscribe =>
    subscribeIpcChannel("backend:alert", handler),
  // 订阅配置更新
  onConfigUpdated: (handler: (payload: AppConfig) => void): Unsubscribe =>
    subscribeIpcChannel("config:updated", handler),
};

contextBridge.exposeInMainWorld("api", api);
