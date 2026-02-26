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
