import Store from "electron-store";
import { AppConfig } from "../../shared/types";

const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  app: {
    firstRun: true,
  },
  overlay: {
    opacity: 0.9,
    scale: 1,
    layoutPreset: "default",
    locked: true,
  },
  hotkeys: {
    toggleLock: "Alt+W",
  },
  players: {
    self: { profileId: "", history: [] },
  },
  backend: {
    wsUrl: "ws://127.0.0.1:8765",
    autoReconnect: true,
  },
  recognition: {
    enabled: false,
    hz: 1,
  },
  tts: {
    enabled: true,
    rate: 150,
    volume: 1,
  },
  calibration: {
    rois: [],
  },
};

export type ConfigStore = ReturnType<typeof initConfigStore>;

// 初始化配置存储
export function initConfigStore() {
  const store = new Store<AppConfig>({
    name: "aoe4-hud",
    defaults: DEFAULT_CONFIG,
  });

  // 获取完整配置
  const getConfig = () => store.store;

  // 合并配置（浅层+对象深合并）
  const updateConfig = (patch: Partial<AppConfig>) => {
    const current = store.store;
    const merged = mergeDeep(current, patch);
    store.store = merged;
    console.log("[config-store] update:", {
      rois: merged.calibration?.rois?.length ?? 0,
      hasSignature: Boolean(merged.calibration?.signature),
    });
    return merged;
  };

  return {
    getConfig,
    updateConfig,
  };
}


// 深度合并对象，数组直接替换
function mergeDeep<T>(base: T, patch: Partial<T>): T {
  if (typeof base !== "object" || base === null) {
    return patch as T;
  }
  if (typeof patch !== "object" || patch === null) {
    return base;
  }
  if (Array.isArray(base) || Array.isArray(patch)) {
    return patch as T;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch)) {
    const baseValue = (base as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }
    if (typeof value === "object" && value !== null) {
      result[key] = mergeDeep(baseValue as object, value as object);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
