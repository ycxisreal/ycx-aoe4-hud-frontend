export type BackendState = "starting" | "ready" | "running" | "stopped" | "error";

export type RoiKind =
  | "timer"
  | "idle"
  | "res_food"
  | "res_wood"
  | "res_gold"
  | "res_stone"
  | "gather_food"
  | "gather_wood"
  | "gather_gold"
  | "gather_stone"
  | "custom";

export type ExpectedField = {
  charset?: "digits" | "digits_colon";
  maxLen?: number;
};

export type RoiRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type RoiItem = {
  id: string;
  name: string;
  rect: RoiRect;
  kind: RoiKind;
  expected?: ExpectedField;
};

export type ScreenSignature = {
  width: number;
  height: number;
  dpiScale?: number;
  displayId?: number;
};

export type RecognitionConfig = {
  enabled: boolean;
  hz: number;
};

export type TtsConfig = {
  enabled: boolean;
  rate?: number;
  volume?: number;
};

export type PlayerIdentity = {
  profileId: string;
  history?: PlayerHistoryItem[];
};

export type PlayerHistoryItem = {
  profileId: string;
  name?: string;
  lastUsedAt?: number;
};

export type AppConfig = {
  version: number;
  app: {
    firstRun: boolean;
  };
  overlay: {
    opacity: number;
    scale: number;
    layoutPreset: "default";
    locked: boolean;
  };
  hotkeys: {
    toggleLock?: string;
    startCalibration?: string;
  };
  players: {
    self: PlayerIdentity;
    opponent?: PlayerIdentity;
  };
  backend: {
    wsUrl: string;
    autoReconnect: boolean;
  };
  recognition: RecognitionConfig;
  tts?: TtsConfig;
  calibration: {
    signature?: ScreenSignature;
    rois: RoiItem[];
  };
};

export type PlayerSummary = {
  profileId: string;
  name?: string;
  winRate?: number;
  rating?: number;
  rank?: string;
};

export type MatchPlayerStats = {
  rank?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
};

export type MatchPlayerView = {
  profileId: string;
  name: string;
  rating?: number;
  elo?: number;
  stats?: MatchPlayerStats;
  isSelf?: boolean;
};

export type MatchView = {
  kind: string;
  modeLabel: string;
  ongoing: boolean;
  isSolo: boolean;
  selfTeam: MatchPlayerView[];
  enemyTeam: MatchPlayerView[];
};

export type BackendStatusPayload = {
  state: BackendState;
  message?: string;
};

export type BackendDataPayload = {
  fields: {
    timer?: { value: string; conf: number };
    idleVillagers?: { value: number; conf: number };
    resources?: {
      food?: { value: number; conf: number };
      wood?: { value: number; conf: number };
      gold?: { value: number; conf: number };
      stone?: { value: number; conf: number };
    };
    gatherers?: {
      food?: { value: number; conf: number };
      wood?: { value: number; conf: number };
      gold?: { value: number; conf: number };
      stone?: { value: number; conf: number };
    };
  };
  frameTs: number;
  quality?: { ok: boolean; reason?: string };
};

export type AlertEventPayload = {
  id: string;
  level: "info" | "warn" | "critical";
  text: string;
  spoken: boolean;
  cooldownMs?: number;
};

export type BackendMessage = {
  type: string;
  version: number;
  ts: number;
  payload: Record<string, unknown>;
};

export type ScreenInfo = {
  width: number;
  height: number;
  scaleFactor: number;
  displayId?: number;
};
