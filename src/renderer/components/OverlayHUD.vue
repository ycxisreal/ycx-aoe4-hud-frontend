<script setup lang="ts">
import { computed } from "vue";
import {
  BackendDataPayload,
  BackendStatusPayload,
  PlayerSummary,
  AlertEventPayload,
} from "../../shared/types";

const props = defineProps<{
  selfSummary: PlayerSummary | null;
  opponentSummary: PlayerSummary | null;
  backendStatus: BackendStatusPayload;
  recognitionData: BackendDataPayload["fields"] | null;
  lastAlert: AlertEventPayload | null;
  locked: boolean;
  running: boolean;
  onRefresh: () => void;
  onCalibrate: () => void;
  onSettings: () => void;
  onStart: () => void;
  onStop: () => void;
}>();

// 格式化数值
const formatNumber = (value?: number) => {
  if (value === undefined || value === null) {
    return "--";
  }
  return Number.isFinite(value) ? value.toString() : "--";
};

const statusText = computed(() => props.backendStatus.message ?? props.backendStatus.state);
</script>

<template>
  <div class="hud-root">
    <div class="hud-panels">
      <div class="hud-card">
        <div class="hud-title">我方</div>
        <div class="hud-name">{{ selfSummary?.name || selfSummary?.profileId || "--" }}</div>
        <div class="hud-row">胜率：{{ formatNumber(selfSummary?.winRate) }}%</div>
        <div class="hud-row">排位分：{{ formatNumber(selfSummary?.rating) }}</div>
        <div class="hud-row">段位：{{ selfSummary?.rank || "--" }}</div>
      </div>
      <div class="hud-card">
        <div class="hud-title">对手</div>
        <div class="hud-name">{{ opponentSummary?.name || opponentSummary?.profileId || "--" }}</div>
        <div class="hud-row">胜率：{{ formatNumber(opponentSummary?.winRate) }}%</div>
        <div class="hud-row">排位分：{{ formatNumber(opponentSummary?.rating) }}</div>
        <div class="hud-row">段位：{{ opponentSummary?.rank || "--" }}</div>
      </div>
      <div class="hud-card hud-metrics">
        <div class="hud-title">识别摘要</div>
        <div class="hud-row">
          计时器：
          <span>{{ recognitionData?.timer?.value ?? "--:--" }}</span>
        </div>
        <div class="hud-row">
          空闲村民：
          <span>{{ recognitionData?.idleVillagers?.value ?? "--" }}</span>
        </div>
        <div class="hud-row">
          资源：
          <span>
            F {{ recognitionData?.resources?.food?.value ?? "--" }} /
            W {{ recognitionData?.resources?.wood?.value ?? "--" }} /
            G {{ recognitionData?.resources?.gold?.value ?? "--" }} /
            S {{ recognitionData?.resources?.stone?.value ?? "--" }}
          </span>
        </div>
        <div class="hud-row">
          采集：
          <span>
            F {{ recognitionData?.gatherers?.food?.value ?? "--" }} /
            W {{ recognitionData?.gatherers?.wood?.value ?? "--" }} /
            G {{ recognitionData?.gatherers?.gold?.value ?? "--" }} /
            S {{ recognitionData?.gatherers?.stone?.value ?? "--" }}
          </span>
        </div>
      </div>
    </div>
    <div class="hud-status">
      <span>状态：{{ statusText }}</span>
      <span>锁定：{{ locked ? "已锁定" : "编辑中" }}</span>
      <span v-if="lastAlert" class="hud-alert">{{ lastAlert.text }}</span>
      <div class="hud-actions">
        <button type="button" @click="onRefresh">刷新</button>
        <button type="button" @click="onCalibrate">标定</button>
        <button type="button" @click="onSettings">设置</button>
        <button v-if="!running" type="button" @click="onStart">START</button>
        <button v-else type="button" class="danger" @click="onStop">STOP</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud-root {
  display: grid;
  gap: 12px;
  color: #f2f6ff;
  -webkit-app-region: no-drag;
}

.hud-panels {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.hud-card {
  background: linear-gradient(135deg, rgba(20, 28, 48, 0.72), rgba(10, 10, 20, 0.4));
  border: 1px solid rgba(120, 170, 255, 0.25);
  border-radius: 14px;
  padding: 14px 16px;
  backdrop-filter: blur(8px);
}

.hud-title {
  font-size: 12px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(165, 196, 255, 0.85);
}

.hud-name {
  font-size: 20px;
  margin: 8px 0 6px;
}

.hud-row {
  font-size: 13px;
  color: rgba(240, 245, 255, 0.8);
}

.hud-status {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  background: rgba(8, 10, 16, 0.5);
  border: 1px solid rgba(120, 170, 255, 0.2);
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
}

.hud-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.hud-actions button {
  border: 1px solid rgba(160, 200, 255, 0.35);
  background: rgba(20, 24, 36, 0.8);
  color: #e8f0ff;
  padding: 4px 10px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
}

.hud-actions button.danger {
  background: linear-gradient(135deg, rgba(255, 99, 99, 0.9), rgba(180, 58, 90, 0.9));
}

.hud-alert {
  color: #ffcd74;
}

@media (max-width: 620px) {
  .hud-panels {
    grid-template-columns: 1fr;
  }

  .hud-card {
    padding: 12px 14px;
  }

  .hud-name {
    font-size: 18px;
  }
}
</style>
