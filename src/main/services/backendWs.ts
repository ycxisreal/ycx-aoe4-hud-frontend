import { EventEmitter } from "node:events";
import { screen } from "electron";
import WebSocket from "ws";
import {
  AppConfig,
  BackendDataPayload,
  BackendMessage,
  BackendStatusPayload,
  AlertEventPayload,
  ScreenSignature,
} from "../../shared/types";

type BackendEvents = {
  status: (payload: BackendStatusPayload) => void;
  data: (payload: BackendDataPayload) => void;
  alert: (payload: AlertEventPayload) => void;
  connected: () => void;
  disconnected: () => void;
};

export type BackendClient = ReturnType<typeof createBackendClient>;

// 创建后端 WS 客户端
export function createBackendClient(getConfig: () => AppConfig) {
  const emitter = new EventEmitter();
  let socket: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectIndex = 0;
  let manualClose = false;
  const backoff = [500, 1000, 2000, 5000];

  // 连接 WS
  const connect = () => {
    const { backend } = getConfig();
    if (!backend.wsUrl) {
      emitStatus({ state: "error", message: "WS 地址未配置" });
      return;
    }

    clearReconnect();
    manualClose = false;
    console.log("[backend-ws] connecting:", backend.wsUrl);
    emitStatus({ state: "starting", message: "正在连接后端..." });

    socket = new WebSocket(backend.wsUrl);

    socket.on("open", () => {
      reconnectIndex = 0;
      console.log("[backend-ws] connected");
      emitStatus({ state: "ready", message: "后端已连接" });
      emitter.emit("connected");
      sendConfig();
    });

    socket.on("message", (data: any) => {
      handleMessage(data.toString());
    });

    socket.on("close", () => {
      socket = null;
      console.log("[backend-ws] disconnected");
      emitStatus({ state: "stopped", message: "后端已断开" });
      emitter.emit("disconnected");
      if (!manualClose && getConfig().backend.autoReconnect) {
        scheduleReconnect();
      }
    });

    socket.on("error", (err: any) => {
      console.log("[backend-ws] error:", err.message);
      emitStatus({ state: "error", message: err.message });
    });
  };

  // 主动断开
  const disconnect = () => {
    manualClose = true;
    clearReconnect();
    socket?.close();
    socket = null;
  };

  // 立即重连
  const reconnect = () => {
    disconnect();
    connect();
  };

  // 发送配置
  const sendConfig = (signature?: ScreenSignature) => {
    const config = getConfig();
    const screenSignature = signature ?? config.calibration.signature ?? buildScreenSignature();
    const payload = {
      clientId: "overlay",
      screen: screenSignature,
      rois: config.calibration.rois,
      recognition: config.recognition,
      tts: config.tts,
    };
    console.log("[backend-ws] send CONFIG_SET:", {
      screen: screenSignature,
      rois: payload.rois.length,
      recognition: payload.recognition,
    });
    sendMessage("CONFIG_SET", payload);
  };

  // 启动识别
  const start = () => {
    sendMessage("START", {});
    emitStatus({ state: "running", message: "识别已启动" });
  };

  // 停止识别
  const stop = () => {
    sendMessage("STOP", {});
    emitStatus({ state: "stopped", message: "识别已停止" });
  };

  // 发送 PING
  const ping = (seq: number) => {
    sendMessage("PING", { seq });
  };

  // 绑定事件
  const on = <K extends keyof BackendEvents>(event: K, handler: BackendEvents[K]) => {
    emitter.on(event, handler);
  };

  // 解绑事件
  const off = <K extends keyof BackendEvents>(event: K, handler: BackendEvents[K]) => {
    emitter.off(event, handler);
  };

  // 处理消息
  const handleMessage = (raw: string) => {
    let parsed: BackendMessage | null = null;
    try {
      parsed = JSON.parse(raw) as BackendMessage;
    } catch {
      emitStatus({ state: "error", message: "后端消息解析失败" });
      return;
    }
    if (!parsed) {
      return;
    }
    console.log("[backend-ws] recv:", parsed.type);
    switch (parsed.type) {
      case "BACKEND_STATUS":
        emitter.emit("status", parsed.payload as BackendStatusPayload);
        break;
      case "DATA":
        console.log("[backend-ws] data:", parsed.payload);
        emitter.emit("data", parsed.payload as BackendDataPayload);
        break;
      case "ALERT_EVENT":
        emitter.emit("alert", parsed.payload as AlertEventPayload);
        break;
      default:
        break;
    }
  };

  // 发送消息
  const sendMessage = (type: string, payload: Record<string, unknown>) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const message: BackendMessage = {
      type,
      version: 1,
      ts: Date.now(),
      payload,
    };
    socket.send(JSON.stringify(message));
  };

  // 构造屏幕签名（兜底）
  const buildScreenSignature = (): ScreenSignature => {
    const display = screen.getPrimaryDisplay();
    return {
      width: display.bounds.width,
      height: display.bounds.height,
      dpiScale: display.scaleFactor,
      displayId: display.id,
    };
  };

  // 派发状态
  const emitStatus = (payload: BackendStatusPayload) => {
    emitter.emit("status", payload);
  };

  // 安排重连
  const scheduleReconnect = () => {
    const delay = backoff[Math.min(reconnectIndex, backoff.length - 1)];
    reconnectIndex += 1;
    clearReconnect();
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  };

  // 清理重连计时器
  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  return {
    connect,
    disconnect,
    reconnect,
    sendConfig,
    start,
    stop,
    ping,
    on,
    off,
  };
}
