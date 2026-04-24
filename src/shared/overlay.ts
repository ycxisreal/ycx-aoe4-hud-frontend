import type { AppConfig } from "./types";

export type OverlayConfig = AppConfig["overlay"];

export const DEFAULT_OVERLAY_PERCENT = {
  widthPercent: 38,
  heightPercent: 18,
  offsetXPercent: 5,
  offsetYPercent: 0,
} as const;

export const OVERLAY_PERCENT_LIMITS = {
  widthPercent: { min: 20, max: 80 },
  heightPercent: { min: 10, max: 50 },
  offsetXPercent: { min: 0, max: 60 },
  offsetYPercent: { min: 0, max: 60 },
} as const;

type OverlayPercentKey = keyof typeof OVERLAY_PERCENT_LIMITS;

// 统一限制覆盖层百分比字段的取值范围，避免主进程与渲染层出现不一致
export const clampOverlayPercent = (key: OverlayPercentKey, value: number) => {
  const limits = OVERLAY_PERCENT_LIMITS[key];
  if (!Number.isFinite(value)) {
    return limits.min;
  }
  return Math.min(Math.max(value, limits.min), limits.max);
};
