import {
  AlertEventPayload,
  AppConfig,
  BackendDataPayload,
  BackendStatusPayload,
  ScreenInfo,
} from "../shared/types";

export type Unsubscribe = () => void;

export type WindowApi = {
  getConfig: () => Promise<AppConfig>;
  updateConfig: (patch: Partial<AppConfig>) => Promise<AppConfig>;
  getScreenInfo: () => Promise<ScreenInfo>;
  setLocked: (locked: boolean) => void;
  broadcastConfig: (config: AppConfig) => void;
  startRecognition: () => Promise<void>;
  stopRecognition: () => Promise<void>;
  reconnectBackend: () => Promise<void>;
  getBackendStatus: () => Promise<BackendStatusPayload | null>;
  startCalibration: () => Promise<void>;
  stopCalibration: () => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  onBackendStatus: (handler: (payload: BackendStatusPayload) => void) => Unsubscribe;
  onBackendData: (handler: (payload: BackendDataPayload) => void) => Unsubscribe;
  onBackendAlert: (handler: (payload: AlertEventPayload) => void) => Unsubscribe;
  onConfigUpdated: (handler: (payload: AppConfig) => void) => Unsubscribe;
};

declare global {
  interface Window {
    api: WindowApi;
  }
}
