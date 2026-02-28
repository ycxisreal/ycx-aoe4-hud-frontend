<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import CalibrationWizard, { CalibrationStep } from "./components/CalibrationWizard.vue";
import OverlayHUD from "./components/OverlayHUD.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import {
  AlertEventPayload,
  AppConfig,
  BackendDataPayload,
  BackendStatusPayload,
  PlayerSummary,
  RoiItem,
  ScreenInfo,
} from "../shared/types";

const config = ref<AppConfig | null>(null);
const screenInfo = ref<ScreenInfo | null>(null);
const selfSummary = ref<PlayerSummary | null>(null);
const opponentSummary = ref<PlayerSummary | null>(null);
const backendStatus = ref<BackendStatusPayload>({
  state: "starting",
  message: "未连接",
});
const recognitionData = ref<BackendDataPayload["fields"] | null>(null);
const lastAlert = ref<AlertEventPayload | null>(null);
const isCalibrating = ref(false);
const showSettings = ref(false);

const calibrationSteps: CalibrationStep[] = [
  { id: "timer", name: "计时器", kind: "timer" },
  { id: "idle", name: "空闲村民", kind: "idle" },
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
const recognitionRunning = computed(() => backendStatus.value.state === "running");

let unsubscribers: Array<() => void> = [];

// 初始化数据
const init = async () => {
  config.value = await window.api.getConfig();
  screenInfo.value = await window.api.getScreenInfo();
  window.api.setLocked(locked.value);
  await refreshMatchInfo();
  const currentStatus = await window.api.getBackendStatus();
  if (currentStatus) {
    backendStatus.value = currentStatus;
  }
};

// 处理配置更新
const applyConfigPatch = async (patch: Partial<AppConfig>) => {
  const next = await window.api.updateConfig(JSON.parse(JSON.stringify(patch)));
  config.value = next;
  window.api.broadcastConfig(next);
  return next;
};

// 切换锁定
const toggleLock = async () => {
  if (!config.value) {
    return;
  }
  const next = await applyConfigPatch({
    overlay: { ...config.value.overlay, locked: !locked.value },
  });
  window.api.setLocked(next.overlay.locked);
};

// 打开标定向导
const openCalibration = () => {
  console.log("[calibration] open:", config.value?.calibration?.rois?.length ?? 0);
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
  showSettings.value = false;
};

// 刷新对局数据
const refreshMatchInfo = async () => {
  if (!config.value) {
    return;
  }
  selfSummary.value = await fetchPlayerSummary(config.value.players.self.profileId);
  if (config.value.players.opponent?.profileId) {
    opponentSummary.value = await fetchPlayerSummary(config.value.players.opponent.profileId);
  } else {
    opponentSummary.value = null;
  }
};

// 拉取玩家摘要（字段映射需根据 AoE4World 文档校准）
const fetchPlayerSummary = async (profileId: string): Promise<PlayerSummary | null> => {
  if (!profileId) {
    return null;
  }
  try {
    const response = await fetch(`https://aoe4world.com/api/v0/players/${profileId}`);
    if (!response.ok) {
      return { profileId };
    }
    const data = await response.json();
    return {
      profileId,
      name: data?.name ?? data?.steam_name,
      rating: data?.rating ?? data?.leaderboards?.[0]?.rating,
      winRate: data?.win_rate ?? data?.leaderboards?.[0]?.win_rate,
      rank: data?.rank ?? data?.leaderboards?.[0]?.rank,
    };
  } catch {
    return { profileId };
  }
};

// 识别开始
const startRecognition = async () => {
  if (!config.value) {
    return;
  }
  const next = await applyConfigPatch({
    recognition: { ...config.value.recognition, enabled: true },
  });
  window.api.broadcastConfig(next);
  await window.api.startRecognition();
};

// 识别停止
const stopRecognition = async () => {
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
    backendStatus.value = payload;
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

onMounted(async () => {
  await init();
  bindBackendEvents();
});

onBeforeUnmount(() => {
  unsubscribers.forEach((fn) => fn());
  unsubscribers = [];
});
</script>

<template>
  <div class="app-root" :class="{ calibrating: isCalibrating }">
    <OverlayHUD
      v-if="!isCalibrating"
      :self-summary="selfSummary"
      :opponent-summary="opponentSummary"
      :backend-status="backendStatus"
      :recognition-data="recognitionData"
      :last-alert="lastAlert"
      :locked="locked"
      :running="recognitionRunning"
      :on-refresh="refreshMatchInfo"
      :on-calibrate="openCalibration"
      :on-settings="() => (showSettings = true)"
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
      @close="showSettings = false"
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
  overflow-x: hidden;
}

#app,
.app-root {
  width: 100%;
  height: 100vh;
  background: radial-gradient(circle at 20% 20%, rgba(24, 40, 70, 0.55), transparent 55%),
    radial-gradient(circle at 80% 0%, rgba(80, 140, 200, 0.18), transparent 50%);
  box-sizing: border-box;
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
