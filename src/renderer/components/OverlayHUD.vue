<script setup lang="ts">
import { computed } from "vue";
import {
  BackendStatusPayload,
  AlertEventPayload,
  MatchPlayerView,
  MatchView,
} from "../../shared/types";

const props = defineProps<{
  matchView: MatchView | null;
  matchNotice: string;
  backendStatus: BackendStatusPayload;
  lastAlert: AlertEventPayload | null;
  locked: boolean;
  running: boolean;
  onRefresh: () => void;
  onCalibrate: () => void;
  onSettings: () => void;
  onLock: () => void;
  helpVisible: boolean;
  helpHotkey: string;
  onToggleHelp: () => void;
  onStart: () => void;
  onStop: () => void;
}>();

// 格式化纯数值字段
const formatNumber = (value?: number) => {
  if (value === undefined || value === null) {
    return "--";
  }
  return Number.isFinite(value) ? value.toString() : "--";
};

// 格式化胜率字段
const formatPercent = (value?: number) => {
  if (value === undefined || value === null) {
    return "--";
  }
  return `${value}%`;
};

// 是否展示排名分（只显示数值，不显示“排名分”文字）
const showRating = (player: MatchPlayerView) => player.rating !== undefined && player.rating !== null;

// 是否展示 elo（只显示 e 前缀，不显示“elo”文字）
const showElo = (player: MatchPlayerView) => {
  if (player.elo === undefined || player.elo === null) {
    return false;
  }
  if (props.matchView?.isSolo && showRating(player)) {
    return false;
  }
  return true;
};

const statusText = computed(() => props.backendStatus.message ?? props.backendStatus.state);
</script>

<template>
  <div class="hud-root">
    <div v-if="matchView" class="hud-panels">
      <div class="hud-card team-card">
        <div v-for="player in matchView.selfTeam" :key="`self-${player.profileId}`" class="team-player">
          <div class="hud-row compact-row">
            <span class="hud-name" :class="{ self: player.isSelf }">{{ player.name || player.profileId }}</span>
            <span v-if="showRating(player)" class="metric rating">{{ formatNumber(player.rating) }}</span>
            <span v-if="showElo(player)" class="metric elo">e{{ formatNumber(player.elo) }}</span>
            <span class="metric wl">
              <span class="win">w {{ formatNumber(player.stats?.wins) }}</span
              ><span class="sep"> / </span><span class="loss">l {{ formatNumber(player.stats?.losses) }}</span>
              <span class="rate">{{ formatPercent(player.stats?.winRate) }}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="mode-card">
        <div class="hud-title">当前模式</div>
        <div class="mode-kind">{{ matchView.modeLabel }}</div>
        <div class="hud-row">{{ matchView.ongoing ? "对局进行中" : "最近一场已结束" }}</div>
      </div>
      <div class="hud-card team-card">
        <div v-for="player in matchView.enemyTeam" :key="`enemy-${player.profileId}`" class="team-player">
          <div class="hud-row compact-row">
            <span class="hud-name">{{ player.name || player.profileId }}</span>
            <span v-if="showRating(player)" class="metric rating">{{ formatNumber(player.rating) }}</span>
            <span v-if="showElo(player)" class="metric elo">e{{ formatNumber(player.elo) }}</span>
            <span class="metric wl">
              <span class="win">w {{ formatNumber(player.stats?.wins) }}</span
              ><span class="sep"> / </span><span class="loss">l {{ formatNumber(player.stats?.losses) }}</span>
              <span class="rate">{{ formatPercent(player.stats?.winRate) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="hud-empty">
      {{ matchNotice }}
    </div>
    <div class="hud-status">
      <span>状态：{{ statusText }}</span>
      <span class="lock-info">
        锁定(<span class="lock-key">Alt + w</span> 切换锁定状态)：{{ locked ? "已锁定" : "编辑中" }}
        <button
          v-if="!locked"
          type="button"
          class="help-trigger"
          aria-label="功能说明"
          @click="onToggleHelp"
        >
          ?
        </button>
      </span>
      <span v-if="lastAlert" class="hud-alert">{{ lastAlert.text }}</span>
      <div class="hud-actions">
        <button type="button" aria-label="刷新对局" @click="onRefresh">
          <span class="icon refresh" aria-hidden="true">⟳</span>
        </button>
        <button type="button" aria-label="标定区域" @click="onCalibrate">
          <span class="icon target" aria-hidden="true">⌖</span>
          标定
        </button>
        <button type="button" aria-label="设置" @click="onSettings">
          <span class="icon gear" aria-hidden="true">⚙</span>
        </button>
        <button v-if="!locked" type="button" aria-label="锁定覆盖层" @click="onLock">
          <span class="icon lock" aria-hidden="true">🔒</span>
        </button>
        <button v-if="!running" type="button" aria-label="开始识别" @click="onStart">
          <span class="icon play" aria-hidden="true">▶</span>
        </button>
        <button v-else type="button" class="danger" aria-label="停止识别" @click="onStop">
          <span class="icon stop" aria-hidden="true">■</span>
        </button>
      </div>
    </div>
    <div v-if="!locked && helpVisible" class="help-panel">
      <div class="help-title">功能说明</div>
      <div class="help-line">⟳：手动刷新对局信息</div>
      <div class="help-line">⌖ 标定：进入标定向导并标定ocr识别区域</div>
      <div class="help-line">⚙：打开设置面板</div>
      <div class="help-line">🔒：快速锁定并启用鼠标穿透</div>
      <div class="help-line">▶ / ■：开始或停止识别数值</div>
      <div class="help-line">快捷键：{{ helpHotkey }}（若注册失败使用 Alt+Shift+W）快速解锁与锁定</div>
      <div class="help-actions">
        <button type="button" class="help-confirm" @click="onToggleHelp">确认</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud-root {
  display: grid;
  gap: clamp(0.45rem, 1vw, 0.75rem);
  color: #f2f6ff;
  -webkit-app-region: no-drag;
}

.hud-panels {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(6.2rem, 0.45fr) minmax(0, 1.6fr);
  gap: clamp(0.45rem, 1vw, 0.8rem);
}

.team-card {
  min-height: clamp(5rem, 10vw, 8rem);
}

.mode-card {
  display: grid;
  align-content: center;
  justify-items: center;
  text-align: center;
  padding: clamp(0.2rem, 0.55vw, 0.45rem) clamp(0.35rem, 0.8vw, 0.7rem);
  border: none;
  background: transparent;
}

.mode-kind {
  margin-top: clamp(0.15rem, 0.35vw, 0.3rem);
  font-size: clamp(0.75rem, 1.8vw, 1.15rem);
  font-weight: 600;
  letter-spacing: 0.05em;
}

.hud-card {
  background: radial-gradient(circle at 50% 50%, rgba(46, 74, 120, 0.2), rgba(10, 12, 20, 0.08) 70%);
  border: 1px solid rgba(120, 170, 255, 0.25);
  border-radius: clamp(0.55rem, 1.2vw, 0.9rem);
  padding: clamp(0.5rem, 1vw, 0.85rem) clamp(0.55rem, 1.1vw, 0.95rem);
  backdrop-filter: blur(8px);
}

.hud-title {
  font-size: clamp(0.63rem, 1.05vw, 0.78rem);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(165, 196, 255, 0.85);
}

.hud-name {
  font-size: clamp(0.88rem, 1.45vw, 1.1rem);
  margin: 0;
  font-weight: 700;
  display: inline-block;
  min-width: 0;
  max-width: clamp(4.5rem, 2vw, 5.5rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}

.hud-name.self {
  color: #ffe08d;
}

.hud-row {
  font-size: clamp(0.76rem, 1.25vw, 0.94rem);
  color: rgba(240, 245, 255, 0.8);
}

.compact-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: clamp(0.22rem, 0.48vw, 0.4rem);
  min-width: 0;
}

.metric {
  white-space: nowrap;
}

.metric.rating {
  color: rgba(226, 235, 255, 0.92);
}

.metric.elo {
  color: #7fd0ff;
}

.metric.wl .win {
  color: #69dd8d;
}

.metric.wl .loss {
  color: #ff7f7f;
}

.metric.wl .sep,
.metric.wl .rate {
  color: rgba(226, 235, 255, 0.88);
}

.metric.wl .rate {
  margin-left: clamp(0.2rem, 0.45vw, 0.35rem);
}

.hud-status {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(0.45rem, 0.9vw, 0.75rem);
  align-items: center;
  background: radial-gradient(circle at 50% 50%, rgba(50, 80, 130, 0.18), rgba(8, 10, 16, 0.06) 70%);
  border: 1px solid rgba(120, 170, 255, 0.18);
  border-radius: clamp(0.45rem, 1vw, 0.65rem);
  padding: clamp(0.3rem, 0.7vw, 0.5rem) clamp(0.45rem, 1vw, 0.7rem);
  font-size: clamp(0.62rem, 1.02vw, 0.76rem);
}

.hud-actions {
  display: flex;
  gap: clamp(0.28rem, 0.7vw, 0.5rem);
  flex-wrap: wrap;
  margin-left: auto;
}

.hud-actions button {
  border: none;
  background: transparent;
  color: #e8f0ff;
  padding: clamp(0.1rem, 0.28vw, 0.18rem) clamp(0.24rem, 0.55vw, 0.4rem);
  border-radius: clamp(0.3rem, 0.75vw, 0.55rem);
  font-size: clamp(0.62rem, 0.98vw, 0.76rem);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: clamp(0.15rem, 0.4vw, 0.3rem);
  opacity: 0.85;
}

.lock-info {
  display: inline-flex;
  align-items: center;
  gap: clamp(0.2rem, 0.45vw, 0.35rem);
}

.help-trigger {
  border: 1px solid rgba(255, 210, 120, 0.95);
  background: radial-gradient(circle at 35% 30%, rgba(255, 210, 120, 0.34), rgba(185, 88, 30, 0.82));
  color: #fff6e7;
  font-weight: 700;
  width: clamp(1.2rem, 2vw, 1.5rem);
  height: clamp(1.2rem, 2vw, 1.5rem);
  padding: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  cursor: pointer;
  opacity: 1;
  box-shadow: 0 0 0.55rem rgba(255, 183, 95, 0.55);
  animation: help-breath 1.8s ease-in-out infinite;
}

.help-trigger:hover {
  filter: brightness(1.08);
}

.help-trigger:active {
  transform: scale(0.96);
}

.help-trigger:focus-visible {
  outline: 1px solid rgba(255, 222, 150, 0.95);
  outline-offset: 1px;
}

.hud-actions button.danger {
  color: #ffb3b3;
  opacity: 0.95;
}

.icon {
  font-size: clamp(0.62rem, 0.98vw, 0.76rem);
  line-height: 1;
  opacity: 0.85;
}

.hud-alert {
  color: #ffcd74;
}

.hud-empty {
  border: 1px dashed rgba(120, 170, 255, 0.35);
  border-radius: clamp(0.55rem, 1.2vw, 0.9rem);
  padding: clamp(0.6rem, 1.2vw, 1rem);
  font-size: clamp(0.65rem, 1.1vw, 0.82rem);
  color: rgba(220, 235, 255, 0.9);
  background: rgba(20, 32, 55, 0.35);
}

.help-panel {
  position: fixed;
  right: clamp(0.7rem, 2vw, 1.2rem);
  bottom: clamp(2.2rem, 5vh, 3.6rem);
  width: min(26rem, 84vw);
  z-index: 80;
  background: rgba(9, 14, 24, 0.96);
  border: 1px solid rgba(255, 210, 140, 0.46);
  border-radius: clamp(0.5rem, 1vw, 0.8rem);
  padding: clamp(0.55rem, 1vw, 0.82rem);
  box-shadow: 0 0.3rem 1.1rem rgba(0, 0, 0, 0.45);
}

.help-title {
  font-size: clamp(0.73rem, 1.2vw, 0.92rem);
  font-weight: 700;
  color: rgba(255, 228, 176, 0.95);
  margin-bottom: clamp(0.25rem, 0.55vw, 0.4rem);
}

.help-line {
  font-size: clamp(0.65rem, 1.05vw, 0.79rem);
  color: rgba(236, 243, 255, 0.92);
  line-height: 1.45;
}

.help-actions {
  margin-top: clamp(0.35rem, 0.8vw, 0.6rem);
  display: flex;
  justify-content: flex-end;
}

.help-confirm {
  border: 1px solid rgba(255, 210, 120, 0.75);
  background: linear-gradient(135deg, rgba(255, 198, 112, 0.35), rgba(190, 98, 35, 0.65));
  color: #fff4de;
  font-size: clamp(0.64rem, 1vw, 0.76rem);
  border-radius: clamp(0.35rem, 0.8vw, 0.55rem);
  padding: clamp(0.2rem, 0.45vw, 0.3rem) clamp(0.42rem, 0.9vw, 0.62rem);
  cursor: pointer;
}

@keyframes help-breath {
  0% {
    box-shadow: 0 0 0.4rem rgba(255, 183, 95, 0.45);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0.9rem rgba(255, 183, 95, 0.85);
    transform: scale(1.06);
  }
  100% {
    box-shadow: 0 0 0.4rem rgba(255, 183, 95, 0.45);
    transform: scale(1);
  }
}
.lock-key {
  font-weight: 700;
  color: #ffb3b3;
}
@media (max-width: 620px) {
  .hud-panels {
    grid-template-columns: 1fr;
  }

  .mode-card {
    justify-items: start;
    text-align: left;
  }

  .hud-card {
    padding: clamp(0.45rem, 1.5vw, 0.75rem) clamp(0.5rem, 1.8vw, 0.85rem);
  }
}
</style>
