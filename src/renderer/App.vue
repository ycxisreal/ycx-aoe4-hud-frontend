<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import CalibrationWizard, { CalibrationStep } from "./components/CalibrationWizard.vue";
import OverlayHUD from "./components/OverlayHUD.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import {
  AlertEventPayload,
  AppConfig,
  BackendDataPayload,
  BackendStatusPayload,
  MatchPlayerView,
  MatchView,
  PlayerHistoryItem,
  RoiItem,
  ScreenInfo,
} from "../shared/types";

const config = ref<AppConfig | null>(null);
const screenInfo = ref<ScreenInfo | null>(null);
const matchView = ref<MatchView | null>(null);
const matchNotice = ref("进入对局后开启识别将自动刷新对局信息，也可手动刷新获取最近一场对局。");
const backendStatus = ref<BackendStatusPayload>({
  state: "starting",
  message: "未连接",
});
const recognitionData = ref<BackendDataPayload["fields"] | null>(null);
const lastAlert = ref<AlertEventPayload | null>(null);
const isCalibrating = ref(false);
const showSettings = ref(false);
const showHelp = ref(false);
const settingsOverlaySnapshot = ref<AppConfig["overlay"] | null>(null);
const isRefreshingMatch = ref(false);
const retryTimer = ref<number | null>(null);
const retryReason = ref<"await_ongoing" | "missing_metrics" | null>(null);
const RETRY_DELAY_MS = 8000;
const MAX_AWAIT_ONGOING_RETRY = 5;
const MAX_MISSING_METRICS_RETRY = 6;
const MISSING_METRICS_RETRY_WINDOW_MS = 60_000;
const autoRefreshState = ref({
  inGame: false,
  lastTimerSeconds: -1,
  awaitOngoingRetryCount: 0,
  missingMetricsRetryCount: 0,
  missingMetricsFirstSeenAt: 0,
});

const calibrationSteps: CalibrationStep[] = [
  { id: "timer", name: "计时器", kind: "timer" },
  { id: "idle", name: "空闲村民", kind: "idle" },
  { id: "population", name: "人口", kind: "population" },
  { id: "res_food", name: "食物资源", kind: "res_food" },
  { id: "res_wood", name: "木材资源", kind: "res_wood" },
  { id: "res_gold", name: "黄金资源", kind: "res_gold" },
  { id: "res_stone", name: "石头资源", kind: "res_stone" },
  { id: "gather_food", name: "食物采集", kind: "gather_food" },
  { id: "gather_wood", name: "木材采集", kind: "gather_wood" },
  { id: "gather_gold", name: "黄金采集", kind: "gather_gold" },
  { id: "gather_stone", name: "石头采集", kind: "gather_stone" },
];

const locked = computed(() => config.value?.overlay.locked ?? true);
// 识别运行态（用于避免 READY 状态误覆盖前端运行显示）
const recognitionRunning = ref(false);
const toggleLockHotkey = computed(() => config.value?.hotkeys?.toggleLock || "Alt+W");

let unsubscribers: Array<() => void> = [];

// 将配置对象转换为可安全跨 IPC 传输的普通对象，避免响应式代理或特殊引用导致克隆失败
const toPlainData = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// 初始化数据
const init = async () => {
  config.value = await window.api.getConfig();
  screenInfo.value = await window.api.getScreenInfo();
  window.api.setLocked(locked.value);
  await refreshMatchInfo();
  const currentStatus = await window.api.getBackendStatus();
  if (currentStatus) {
    backendStatus.value = currentStatus;
    if (currentStatus.state === "running") {
      recognitionRunning.value = true;
    }
  }
};

// 处理配置更新
const applyConfigPatch = async (patch: Partial<AppConfig>) => {
  const next = await window.api.updateConfig(JSON.parse(JSON.stringify(patch)));
  config.value = next;
  window.api.broadcastConfig(next);
  return next;
};

// 快速锁定（仅提供锁定按钮，不提供解锁按钮）
const lockOverlay = async () => {
  if (!config.value) {
    return;
  }
  if (locked.value) {
    return;
  }
  // 仅切换主进程锁定状态，避免额外配置广播影响识别状态
  window.api.setLocked(true);
};

// 切换帮助面板显示状态
const toggleHelpPanel = () => {
  showHelp.value = !showHelp.value;
};

// 打开标定向导
const openCalibration = () => {
  console.log("[calibration] open:", config.value?.calibration?.rois?.length ?? 0);
  showHelp.value = false;
  isCalibrating.value = true;
  window.api.startCalibration();
};

// 关闭标定向导
const closeCalibration = async () => {
  isCalibrating.value = false;
  await window.api.stopCalibration();
};

// 保存标定结果
const handleCalibrationComplete = async (rois: RoiItem[], signature: AppConfig["calibration"]["signature"]) => {
  console.log("[calibration] apply:", { rois: rois.length, signature });
  try {
    await applyConfigPatch({
      calibration: {
        rois,
        signature,
      },
    });
  } catch (error) {
    console.log("[calibration] apply error:", error);
  } finally {
    isCalibrating.value = false;
    await window.api.stopCalibration();
  }
};

// 更新设置
const handleSettingsSave = async (next: AppConfig) => {
  await applyConfigPatch(next);
  settingsOverlaySnapshot.value = null;
  await refreshMatchInfo();
  showHelp.value = false;
  showSettings.value = false;
};

// 实时预览设置面板中的覆盖层布局调整
const previewOverlayLayout = async (overlay: AppConfig["overlay"]) => {
  await window.api.previewOverlay(toPlainData(overlay));
};

// 关闭设置面板时回滚未保存的覆盖层预览
const closeSettingsPanel = async () => {
  if (settingsOverlaySnapshot.value) {
    await window.api.resetOverlayPreview(toPlainData(settingsOverlaySnapshot.value));
  }
  settingsOverlaySnapshot.value = null;
  showSettings.value = false;
};

// 打开设置面板并收起帮助面板
const openSettingsPanel = () => {
  showHelp.value = false;
  settingsOverlaySnapshot.value = config.value ? toPlainData(config.value.overlay) : null;
  showSettings.value = true;
};

// 清理自动重试定时器
const clearRetryTimer = () => {
  if (retryTimer.value !== null) {
    window.clearTimeout(retryTimer.value);
    retryTimer.value = null;
  }
  retryReason.value = null;
};

// 解析计时器文本为秒
const parseTimerSeconds = (timerText?: string): number | null => {
  if (!timerText || !timerText.includes(":")) {
    return null;
  }
  const [min, sec] = timerText.split(":");
  const minNum = Number.parseInt(min, 10);
  const secNum = Number.parseInt(sec, 10);
  if (!Number.isFinite(minNum) || !Number.isFinite(secNum) || minNum < 0 || secNum < 0 || secNum > 59) {
    return null;
  }
  return minNum * 60 + secNum;
};

// 根据 kind 生成模式文案
const formatModeLabel = (kind: string): string => {
  if (!kind) {
    return "UNKNOWN";
  }
  return kind.toUpperCase();
};

// 解析模式统计 key（rank/wins/losses/win_rate）
const resolveModeStatsKey = (kind: string): string => {
  if (kind.startsWith("rm_")) {
    return `${kind}_elo`;
  }
  return kind;
};

// 规范化历史 profileId 列表（去重、裁剪空值、按最近使用时间排序）
const normalizeProfileHistory = (history?: PlayerHistoryItem[]) => {
  const source = Array.isArray(history) ? history : [];
  const dedupMap = new Map<string, PlayerHistoryItem>();
  source.forEach((item) => {
    const profileId = String(item?.profileId ?? "").trim();
    if (!profileId) {
      return;
    }
    const prev = dedupMap.get(profileId);
    const currentTime = typeof item?.lastUsedAt === "number" ? item.lastUsedAt : 0;
    const prevTime = typeof prev?.lastUsedAt === "number" ? prev.lastUsedAt : 0;
    if (!prev || currentTime >= prevTime) {
      dedupMap.set(profileId, {
        profileId,
        name: String(item?.name ?? "").trim() || undefined,
        lastUsedAt: currentTime || undefined,
      });
    }
  });
  return [...dedupMap.values()].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).slice(0, 20);
};

// 将当前 profileId 及其玩家名写回历史列表（用于设置面板快速切换）
const persistSelfProfileHistory = async (profileId: string, playerName?: string) => {
  if (!config.value) {
    return;
  }
  const normalizedId = String(profileId ?? "").trim();
  if (!normalizedId) {
    return;
  }
  const normalizedName = String(playerName ?? "").trim();
  const currentHistory = normalizeProfileHistory(config.value.players.self.history);
  const currentItem = currentHistory.find((item) => item.profileId === normalizedId);
  const needInsert = !currentItem;
  const needRename = Boolean(normalizedName && normalizedName !== currentItem?.name);
  if (!needInsert && !needRename) {
    return;
  }
  const nextHistory = currentHistory.filter((item) => item.profileId !== normalizedId);
  nextHistory.unshift({
    profileId: normalizedId,
    name: normalizedName || currentItem?.name,
    lastUsedAt: Date.now(),
  });
  await applyConfigPatch({
    players: {
      self: {
        ...config.value.players.self,
        profileId: normalizedId,
        history: normalizeProfileHistory(nextHistory),
      },
    },
  });
};

// 映射单个玩家的展示数据
const mapPlayerView = (player: any, kind: string, selfProfileId: string): MatchPlayerView => {
  const modeStatsKey = resolveModeStatsKey(kind);
  const modeStats = player?.modes?.[modeStatsKey] ?? {};
  // RM_1V1 的历史最高分取排位分轨道 rm_solo，而不是隐藏分轨道 rm_1v1_elo
  const soloRankStats = player?.modes?.rm_solo ?? {};
  return {
    profileId: String(player?.profile_id ?? ""),
    name: player?.name ?? String(player?.profile_id ?? "--"),
    rating: typeof player?.rating === "number" ? player.rating : undefined,
    elo: typeof player?.mmr === "number" ? player.mmr : undefined,
    maxRating: typeof soloRankStats?.max_rating === "number" ? soloRankStats.max_rating : undefined,
    rankLevel: typeof modeStats?.rank_level === "string" ? modeStats.rank_level : undefined,
    stats: {
      rank: typeof modeStats?.rank === "number" ? modeStats.rank : undefined,
      wins: typeof modeStats?.wins_count === "number" ? modeStats.wins_count : undefined,
      losses: typeof modeStats?.losses_count === "number" ? modeStats.losses_count : undefined,
      winRate: typeof modeStats?.win_rate === "number" ? modeStats.win_rate : undefined,
    },
    isSelf: String(player?.profile_id ?? "") === selfProfileId,
  };
};

// 将接口数据转换为双方展示结构
const buildMatchView = (data: any, selfProfileId: string): MatchView | null => {
  const kind = String(data?.kind ?? "");
  if (!kind || kind.includes("ffa")) {
    return null;
  }
  const teams = Array.isArray(data?.teams) ? (data.teams as any[][]) : [];
  if (teams.length !== 2) {
    return null;
  }
  const selfTeamIndex = teams.findIndex((team) =>
    Array.isArray(team) && team.some((player) => String(player?.profile_id ?? "") === selfProfileId)
  );
  const leftTeam = selfTeamIndex >= 0 ? teams[selfTeamIndex] : teams[0];
  const rightTeam = selfTeamIndex >= 0 ? teams[1 - selfTeamIndex] : teams[1];
  if (!Array.isArray(leftTeam) || !Array.isArray(rightTeam) || rightTeam.length === 0) {
    return null;
  }
  const selfPlayers = leftTeam.map((player) => mapPlayerView(player, kind, selfProfileId));
  const enemyPlayers = rightTeam.map((player) => mapPlayerView(player, kind, selfProfileId));
  return {
    kind,
    modeLabel: formatModeLabel(kind),
    ongoing: Boolean(data?.ongoing),
    isSolo: leftTeam.length === 1 && rightTeam.length === 1,
    selfTeam: selfPlayers,
    enemyTeam: enemyPlayers,
  };
};

// 判断 ongoing 对局是否缺失关键分数字段（rating/mmr）
const hasMissingRatingOrElo = (view: MatchView): boolean => {
  const allPlayers = [...view.selfTeam, ...view.enemyTeam];
  return allPlayers.some((player) => player.rating === undefined || player.elo === undefined);
};

// 重置 rating/mmr 缺失补拉状态
const resetMissingMetricsRetryState = () => {
  autoRefreshState.value.missingMetricsRetryCount = 0;
  autoRefreshState.value.missingMetricsFirstSeenAt = 0;
};

// 判断 rating/mmr 缺失补拉是否仍允许继续
const canRetryForMissingMetrics = (): boolean => {
  if (autoRefreshState.value.missingMetricsFirstSeenAt <= 0) {
    return true;
  }
  const elapsedMs = Date.now() - autoRefreshState.value.missingMetricsFirstSeenAt;
  return (
    autoRefreshState.value.missingMetricsRetryCount < MAX_MISSING_METRICS_RETRY &&
    elapsedMs <= MISSING_METRICS_RETRY_WINDOW_MS
  );
};

// 请求最近一场对局
const fetchLastGame = async (profileId: string): Promise<any | null> => {
  const endpoint = `https://aoe4world.com/api/v0/players/${profileId}/games/last?include_stats=true`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    return null;
  }
  return response.json();
};

// 调度自动重试刷新（等待 ongoing / 补齐 rating+mmr）
const scheduleRetryRefresh = (reason: "await_ongoing" | "missing_metrics") => {
  if (retryTimer.value !== null) {
    return;
  }
  if (reason === "await_ongoing" && !autoRefreshState.value.inGame) {
    return;
  }
  if (reason === "missing_metrics" && !matchView.value?.ongoing) {
    return;
  }
  if (reason === "await_ongoing" && autoRefreshState.value.awaitOngoingRetryCount >= MAX_AWAIT_ONGOING_RETRY) {
    return;
  }
  if (reason === "missing_metrics" && !canRetryForMissingMetrics()) {
    return;
  }
  retryReason.value = reason;
  retryTimer.value = window.setTimeout(async () => {
    retryTimer.value = null;
    const currentReason = retryReason.value;
    retryReason.value = null;
    if (currentReason === "await_ongoing") {
      autoRefreshState.value.awaitOngoingRetryCount += 1;
    } else if (currentReason === "missing_metrics") {
      autoRefreshState.value.missingMetricsRetryCount += 1;
    }
    await refreshMatchInfo();
    if (!currentReason) {
      return;
    }
    if (currentReason === "await_ongoing" && autoRefreshState.value.inGame && (!matchView.value || !matchView.value.ongoing)) {
      scheduleRetryRefresh("await_ongoing");
    }
    if (currentReason === "missing_metrics" && matchView.value?.ongoing && hasMissingRatingOrElo(matchView.value)) {
      scheduleRetryRefresh("missing_metrics");
    }
  }, RETRY_DELAY_MS);
};

// 刷新对局数据（手动与自动共用）
const refreshMatchInfo = async () => {
  if (!config.value || isRefreshingMatch.value) {
    return;
  }
  const profileId = config.value.players.self.profileId?.trim();
  if (!profileId) {
    matchView.value = null;
    matchNotice.value = "请先在设置中填写我方 profileId。";
    return;
  }
  isRefreshingMatch.value = true;
  try {
    const lastGame = await fetchLastGame(profileId);
    if (!lastGame) {
      matchView.value = null;
      matchNotice.value = "未获取到有效对局信息，请稍后重试。";
      return;
    }
    const parsed = buildMatchView(lastGame, profileId);
    if (!parsed) {
      matchView.value = null;
      matchNotice.value = String(lastGame?.kind ?? "").includes("ffa")
        ? "FFA 模式暂不展示双方阵容信息。"
        : "未识别到可展示的双方队伍信息。";
      return;
    }
    matchView.value = parsed;
    const selfPlayerName =
      parsed.selfTeam.find((player) => player.isSelf)?.name ??
      parsed.selfTeam.find((player) => player.profileId === profileId)?.name;
    await persistSelfProfileHistory(profileId, selfPlayerName);
    if (parsed.ongoing) {
      autoRefreshState.value.awaitOngoingRetryCount = 0;
      const missingMetrics = hasMissingRatingOrElo(parsed);
      if (missingMetrics) {
        if (autoRefreshState.value.missingMetricsFirstSeenAt <= 0) {
          autoRefreshState.value.missingMetricsFirstSeenAt = Date.now();
          autoRefreshState.value.missingMetricsRetryCount = 0;
        }
        matchNotice.value = `当前模式：${parsed.modeLabel}（对局进行中，分数信息补拉中）`;
        if (canRetryForMissingMetrics()) {
          scheduleRetryRefresh("missing_metrics");
        } else {
          matchNotice.value = `当前模式：${parsed.modeLabel}（对局进行中，分数暂缺，已停止补拉）`;
        }
      } else {
        resetMissingMetricsRetryState();
        clearRetryTimer();
        matchNotice.value = `当前模式：${parsed.modeLabel}（对局进行中）`;
      }
    } else if (autoRefreshState.value.inGame) {
      resetMissingMetricsRetryState();
      matchNotice.value = `当前模式：${parsed.modeLabel}（最近一场已结束）`;
      scheduleRetryRefresh("await_ongoing");
    } else {
      resetMissingMetricsRetryState();
      matchNotice.value = `当前模式：${parsed.modeLabel}（最近一场已结束）`;
    }
  } catch {
    matchView.value = null;
    matchNotice.value = "拉取 AoE4World 失败，请检查网络后重试。";
  } finally {
    isRefreshingMatch.value = false;
  }
};

// 识别开始
const startRecognition = async () => {
  if (!config.value) {
    return;
  }
  recognitionRunning.value = true;
  const next = await applyConfigPatch({
    recognition: { ...config.value.recognition, enabled: true },
  });
  window.api.broadcastConfig(next);
  await window.api.startRecognition();
};

// 识别停止
const stopRecognition = async () => {
  recognitionRunning.value = false;
  if (config.value) {
    const next = await applyConfigPatch({
      recognition: { ...config.value.recognition, enabled: false },
    });
    window.api.broadcastConfig(next);
  }
  await window.api.stopRecognition();
};

// 后端重连
// 绑定后端事件
const bindBackendEvents = () => {
  const offStatus = window.api.onBackendStatus((payload) => {
    // 若识别运行中收到 READY，保留当前运行显示，避免锁定等操作导致前端误回退
    if (payload.state === "ready" && recognitionRunning.value) {
      return;
    }
    backendStatus.value = payload;
    if (payload.state === "running") {
      recognitionRunning.value = true;
    } else if (payload.state === "stopped") {
      recognitionRunning.value = false;
    }
  });
  const offData = window.api.onBackendData((payload) => {
    recognitionData.value = payload.fields;
    console.log("[backend-data]", payload);
  });
  const offAlert = window.api.onBackendAlert((payload) => {
    lastAlert.value = payload;
  });
  const offConfig = window.api.onConfigUpdated((next) => {
    config.value = next;
  });
  unsubscribers = [offStatus, offData, offAlert, offConfig];
};

// 根据识别计时器自动判定开局并触发刷新
watch(
  () => recognitionData.value?.timer?.value,
  (timerText) => {
    const timerSeconds = parseTimerSeconds(timerText);
    if (timerSeconds === null) {
      autoRefreshState.value.inGame = false;
      autoRefreshState.value.lastTimerSeconds = -1;
      autoRefreshState.value.awaitOngoingRetryCount = 0;
      resetMissingMetricsRetryState();
      clearRetryTimer();
      return;
    }
    if (!autoRefreshState.value.inGame) {
      autoRefreshState.value.inGame = true;
      autoRefreshState.value.awaitOngoingRetryCount = 0;
      resetMissingMetricsRetryState();
      void refreshMatchInfo();
    } else if (
      autoRefreshState.value.lastTimerSeconds >= 0 &&
      timerSeconds + 90 < autoRefreshState.value.lastTimerSeconds
    ) {
      autoRefreshState.value.awaitOngoingRetryCount = 0;
      resetMissingMetricsRetryState();
      void refreshMatchInfo();
    }
    autoRefreshState.value.lastTimerSeconds = timerSeconds;
    if (!matchView.value || !matchView.value.ongoing) {
      scheduleRetryRefresh("await_ongoing");
    } else if (hasMissingRatingOrElo(matchView.value)) {
      scheduleRetryRefresh("missing_metrics");
    }
  }
);

// 锁定后自动隐藏帮助面板
watch(
  () => locked.value,
  (isLocked) => {
    if (isLocked) {
      showHelp.value = false;
    }
  }
);

onMounted(async () => {
  await init();
  bindBackendEvents();
});

onBeforeUnmount(() => {
  clearRetryTimer();
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
});
</script>

<template>
  <div class="app-root" :class="{ calibrating: isCalibrating }">
    <OverlayHUD
      v-if="!isCalibrating"
      :match-view="matchView"
      :match-notice="matchNotice"
      :backend-status="backendStatus"
      :last-alert="lastAlert"
      :locked="locked"
      :running="recognitionRunning"
      :on-refresh="refreshMatchInfo"
      :on-calibrate="openCalibration"
      :on-settings="openSettingsPanel"
      :on-lock="lockOverlay"
      :help-visible="showHelp"
      :help-hotkey="toggleLockHotkey"
      :on-toggle-help="toggleHelpPanel"
      :on-start="startRecognition"
      :on-stop="stopRecognition"
    />

    <CalibrationWizard
      :open="isCalibrating"
      :steps="calibrationSteps"
      :screen-info="screenInfo"
      :existing-rois="config?.calibration.rois ?? []"
      @close="closeCalibration"
      @complete="handleCalibrationComplete"
    />

    <SettingsPanel
      :open="showSettings"
      :config="config"
      @close="closeSettingsPanel"
      @preview="previewOverlayLayout"
      @save="handleSettingsSave"
    />
  </div>
</template>

<style>
:root {
  font-family: "Space Grotesk", "Noto Sans SC", "PingFang SC", sans-serif;
  color: #e8f0ff;
}

html,
body {
  margin: 0;
  background: transparent;
  overflow: hidden;
  overflow-x: hidden;
}

#app,
.app-root {
  width: 100%;
  height: 100vh;
  /*background: radial-gradient(circle at 20% 20%, rgba(24, 40, 70, 0.55), transparent 55%),*/
  /*  radial-gradient(circle at 80% 0%, rgba(80, 140, 200, 0.18), transparent 50%);*/
  background-color: transparent;
  box-sizing: border-box;
  overflow: hidden;
}

.app-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
}

.app-root.calibrating {
  background: transparent;
}

</style>
