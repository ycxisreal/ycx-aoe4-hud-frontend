<script setup lang="ts">
import { computed, ref } from "vue";
import {
  BackendStatusPayload,
  AlertEventPayload,
  MatchPlayerView,
  MatchView,
} from "../../shared/types";

const soloRankIconModules = import.meta.glob("../../assets/icons/solo/*.svg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const soloRankIconMap = Object.fromEntries(
  Object.entries(soloRankIconModules).map(([path, url]) => [path.split("/").pop() ?? path, url])
);

const SOLO_RANK_LEVELS = [
  { key: "bronze_1", label: "青铜1", minScore: 0, color: "#b98255" },
  { key: "bronze_2", label: "青铜2", minScore: 400, color: "#c48c5d" },
  { key: "bronze_3", label: "青铜3", minScore: 450, color: "#d49a67" },
  { key: "silver_1", label: "白银1", minScore: 500, color: "#c3ced9" },
  { key: "silver_2", label: "白银2", minScore: 600, color: "#d3dde8" },
  { key: "silver_3", label: "白银3", minScore: 650, color: "#e0e9f4" },
  { key: "gold_1", label: "黄金1", minScore: 700, color: "#e7c55a" },
  { key: "gold_2", label: "黄金2", minScore: 800, color: "#f0d36d" },
  { key: "gold_3", label: "黄金3", minScore: 900, color: "#f6dd82" },
  { key: "platinum_1", label: "白金1", minScore: 1000, color: "#67d0c8" },
  { key: "platinum_2", label: "白金2", minScore: 1100, color: "#78ddd4" },
  { key: "platinum_3", label: "白金3", minScore: 1150, color: "#8de8df" },
  { key: "diamond_1", label: "钻石1", minScore: 1200, color: "#6cb4ff" },
  { key: "diamond_2", label: "钻石2", minScore: 1300, color: "#84c1ff" },
  { key: "diamond_3", label: "钻石3", minScore: 1350, color: "#9bd0ff" },
  { key: "conqueror_1", label: "征服者1", minScore: 1400, color: "#ff8f7d" },
  { key: "conqueror_2", label: "征服者2", minScore: 1500, color: "#ff7669" },
  { key: "conqueror_3", label: "征服者3", minScore: 1600, color: "#ff5f57" },
] as const;

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

// 格式化对局场次（高于1000显示为k，不保留小数）
const formatMatchCount = (value?: number) => {
  if (value === undefined || value === null) {
    return "--";
  }
  if (!Number.isFinite(value)) {
    return "--";
  }
  if (value <= 1000) {
    return value.toString();
  }
  const inK = Math.floor(value / 1000);
  return `${inK}k`;
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
  return player.elo !== undefined && player.elo !== null;
};

// 是否使用 RM_1V1 专属展示布局
const isRankedSoloView = computed(() => props.matchView?.kind === "RM_1V1");

// 根据分数解析单排段位元数据（名称、颜色、图标 key）
const resolveSoloRankMeta = (score?: number) => {
  if (score === undefined || score === null || !Number.isFinite(score)) {
    return null;
  }
  let current = SOLO_RANK_LEVELS[0];
  for (const item of SOLO_RANK_LEVELS) {
    if (score >= item.minScore) {
      current = item;
    } else {
      break;
    }
  }
  return current;
};

// 获取当前分数对应的段位颜色样式
const getSoloRankColorStyle = (score?: number) => {
  const rankMeta = resolveSoloRankMeta(score);
  if (!rankMeta) {
    return undefined;
  }
  return {
    color: rankMeta.color,
  };
};

// 获取当前分数对应的单排图标资源
const getSoloRankIcon = (score?: number) => {
  const rankMeta = resolveSoloRankMeta(score);
  if (!rankMeta) {
    return undefined;
  }
  return soloRankIconMap[`solo_${rankMeta.key}.svg`];
};

// 获取历史最高分的中文段位文案
const formatSoloMaxRankLabel = (score?: number) => {
  const rankMeta = resolveSoloRankMeta(score);
  return rankMeta ? `max:${rankMeta.label}` : "max:--";
};

const statusText = computed(() => props.backendStatus.message ?? props.backendStatus.state);
const githubUrl = "https://github.com/ycxisreal";
const isCollapsed = ref(false);

// 切换信息区收起/展开状态
const toggleCollapse = () => {
  if (!isCollapsed.value && props.helpVisible) {
    props.onToggleHelp();
  }
  isCollapsed.value = !isCollapsed.value;
};

// 打开 GitHub 外链（通过主进程调用系统浏览器）
const onOpenGithub = async () => {
  await window.api.openExternalUrl(githubUrl);
};

// 关闭应用（通过主进程调用 app.quit）
const onCloseApp = async () => {
  await window.api.closeApp();
};
</script>

<template>
  <div class="hud-root" :class="{ 'editable-bg': !locked }">
    <button type="button" class="app-close-btn" aria-label="关闭软件" title="关闭软件" @click="onCloseApp">
      ×
    </button>
    <div v-if="!isCollapsed && matchView" class="hud-panels" :class="{ 'solo-layout': isRankedSoloView }">
      <div class="hud-card team-card" :class="{ 'solo-team-card': isRankedSoloView }">
        <div v-for="player in matchView.selfTeam" :key="`self-${player.profileId}`" class="team-player">
          <template v-if="isRankedSoloView">
            <div class="solo-player-card">
              <div class="solo-row solo-row-top">
                <span class="hud-name solo-name" :class="{ self: player.isSelf }">{{ player.name || player.profileId }}</span>
                <span class="metric wl solo-wl">
                  <span class="win">W {{ formatMatchCount(player.stats?.wins) }}</span
                  ><span class="sep"> / </span><span class="loss">L {{ formatMatchCount(player.stats?.losses) }}</span>
                  <span class="rate"> 胜率:{{ formatPercent(player.stats?.winRate) }}</span>
                </span>
              </div>
              <div class="solo-row solo-row-middle">
                <div class="solo-rank-values">
                  <span v-if="showRating(player)" class="metric solo-rank-score" :style="getSoloRankColorStyle(player.rating)">
                    {{ formatNumber(player.rating) }}
                  </span>
                  <span v-if="showElo(player)" class="metric solo-rank-elo">e{{ formatNumber(player.elo) }}</span>
                </div>
                <img
                  v-if="getSoloRankIcon(player.rating)"
                  class="solo-rank-icon"
                  :src="getSoloRankIcon(player.rating)"
                  alt="当前段位图标"
                />
              </div>
              <div class="solo-row solo-row-bottom">
                <span class="solo-max-score" :style="getSoloRankColorStyle(player.maxRating)">
                  max {{ formatNumber(player.maxRating) }}
                </span>
                <span class="solo-max-rank">{{ formatSoloMaxRankLabel(player.maxRating) }}</span>
              </div>
            </div>
          </template>
          <div v-else class="hud-row compact-row">
            <span class="hud-name" :class="{ self: player.isSelf }">{{ player.name || player.profileId }}</span>
            <span v-if="showRating(player)" class="metric rating">{{ formatNumber(player.rating) }}</span>
            <span v-if="showElo(player)" class="metric elo">e{{ formatNumber(player.elo) }}</span>
            <span class="metric wl">
              <span class="win">W {{ formatMatchCount(player.stats?.wins) }}</span
              ><span class="sep"> / </span><span class="loss">L {{ formatMatchCount(player.stats?.losses) }}</span>
              <span class="rate"> 胜率:{{ formatPercent(player.stats?.winRate) }}</span>
            </span>
          </div>
        </div>
      </div>
      <div class="mode-card" :class="{ 'solo-mode-card': isRankedSoloView }">
        <div class="hud-title">当前模式</div>
        <div class="mode-kind">{{ matchView.modeLabel }}</div>
        <div class="hud-row">{{ matchView.ongoing ? "对局进行中" : "最近一场已结束" }}</div>
      </div>
      <div class="hud-card team-card" :class="{ 'solo-team-card': isRankedSoloView }">
        <div v-for="player in matchView.enemyTeam" :key="`enemy-${player.profileId}`" class="team-player">
          <template v-if="isRankedSoloView">
            <div class="solo-player-card">
              <div class="solo-row solo-row-top">
                <span class="hud-name solo-name">{{ player.name || player.profileId }}</span>
                <span class="metric wl solo-wl">
                  <span class="win">W {{ formatMatchCount(player.stats?.wins) }}</span
                  ><span class="sep"> / </span><span class="loss">L {{ formatMatchCount(player.stats?.losses) }}</span>
                  <span class="rate"> <span class="win-rate">胜率:</span>{{ formatPercent(player.stats?.winRate) }}</span>
                </span>
              </div>
              <div class="solo-row solo-row-middle">
                <div class="solo-rank-values">
                  <span v-if="showRating(player)" class="metric solo-rank-score" :style="getSoloRankColorStyle(player.rating)">
                    {{ formatNumber(player.rating) }}
                  </span>
                  <span v-if="showElo(player)" class="metric solo-rank-elo">e{{ formatNumber(player.elo) }}</span>
                </div>
                <img
                  v-if="getSoloRankIcon(player.rating)"
                  class="solo-rank-icon"
                  :src="getSoloRankIcon(player.rating)"
                  alt="当前段位图标"
                />
              </div>
              <div class="solo-row solo-row-bottom">
                <span class="solo-max-score" :style="getSoloRankColorStyle(player.maxRating)">
                  max {{ formatNumber(player.maxRating) }}
                </span>
                <span class="solo-max-rank">{{ formatSoloMaxRankLabel(player.maxRating) }}</span>
              </div>
            </div>
          </template>
          <div v-else class="hud-row compact-row">
            <span class="hud-name">{{ player.name || player.profileId }}</span>
            <span v-if="showRating(player)" class="metric rating">{{ formatNumber(player.rating) }}</span>
            <span v-if="showElo(player)" class="metric elo">e{{ formatNumber(player.elo) }}</span>
            <span class="metric wl">
              <span class="win">W {{ formatMatchCount(player.stats?.wins) }}</span
              ><span class="sep"> / </span><span class="loss">L {{ formatMatchCount(player.stats?.losses) }}</span>
              <span class="rate"> <span class="win-rate">胜率:</span>{{ formatPercent(player.stats?.winRate) }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="!isCollapsed" class="hud-empty">
      {{ matchNotice }}
    </div>
    <div class="hud-status" :class="{ collapsed: isCollapsed }">
      <span v-if="!isCollapsed">状态：{{ statusText }}</span>
      <span v-if="!isCollapsed" class="lock-info">
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
      <span v-if="!isCollapsed && lastAlert" class="hud-alert">{{ lastAlert.text }}</span>
      <div class="hud-actions">
        <button
          type="button"
          :aria-label="isCollapsed ? '展开信息区域' : '收起信息区域'"
          :title="isCollapsed ? '展开信息区域' : '收起信息区域'"
          @click="toggleCollapse"
        >
          {{ isCollapsed ? "展开" : "收起" }}
        </button>
        <button type="button" aria-label="刷新对局" @click="onRefresh">
          <span class="icon refresh" aria-hidden="true">🔄</span>
        </button>
        <button type="button" aria-label="标定区域" @click="onCalibrate">
          <span class="icon target" aria-hidden="true">🎯</span>
          标定
        </button>
        <button type="button" aria-label="设置" @click="onSettings">
          <span class="icon gear" aria-hidden="true">⚙️</span>
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
    <div v-if="!isCollapsed && !locked && helpVisible" class="help-panel">
      <div class="help-title">功能说明</div>
      <div class="help-line">🔄：手动刷新对局信息</div>
      <div class="help-line">🎯 标定：进入标定向导并标定ocr识别区域</div>
      <div class="help-line">⚙️：打开设置面板</div>
      <div class="help-line">🔒：快速锁定并启用鼠标穿透</div>
      <div class="help-line">▶ / ■：开始或停止识别数值</div>
      <div class="help-line">快捷键：{{ helpHotkey }}（若注册失败使用 Alt+Shift+W）快速解锁与锁定</div>
      <div class="help-line">made by 路易唐林
        <a style="color: #7fd0ff" :href="githubUrl" target="_blank" rel="noreferrer" @click.prevent="onOpenGithub">github</a>
      </div>
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
  border-radius: clamp(0.55rem, 1.2vw, 0.9rem);
  transition: background 0.18s ease;
  -webkit-app-region: no-drag;
}

.hud-root.editable-bg {
  background:
    radial-gradient(circle at 20% 20%, rgba(24, 40, 70, 0.62), transparent 60%),
    radial-gradient(circle at 80% 0%, rgba(80, 140, 200, 0.22), transparent 55%),
    rgba(8, 14, 24, 0.38);
}

.app-close-btn {
  position: fixed;
  top: clamp(0.52rem, 1.25vw, 0.72rem);
  right: clamp(0.52rem, 1.25vw, 0.72rem);
  z-index: 9999;
  border: none;
  background: transparent;
  color: #ff9d9d;
  font-size: clamp(0.88rem, 0.95vw, 0.92rem);
  font-weight: 700;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0.05rem 0.08rem;
}

.app-close-btn:hover {
  color: #ffd6d6;
  text-decoration: underline;
  text-underline-offset: 0.12rem;
}

.app-close-btn:active {
  opacity: 0.86;
}

.app-close-btn:focus-visible {
  outline: 1px solid rgba(255, 220, 220, 0.8);
  outline-offset: 1px;
}

.hud-panels {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(6.2rem, 0.45fr) minmax(0, 1.6fr);
  gap: clamp(0.45rem, 1vw, 0.8rem);
}

.hud-panels.solo-layout {
  grid-template-columns: minmax(0, 1.45fr) minmax(6rem, 0.52fr) minmax(0, 1.45fr);
  align-items: stretch;
}

.team-card {
  min-height: clamp(5rem, 10vw, 8rem);
  overflow: hidden;
}

.solo-team-card {
  min-height: clamp(6.2rem, 12vw, 9rem);
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

.solo-mode-card {
  gap: clamp(0.18rem, 0.45vw, 0.3rem);
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
  flex: 0 1 auto;
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

.solo-name {
  max-width: none;
}

.hud-row {
  font-size: clamp(0.76rem, 1.25vw, 0.94rem);
  color: rgba(240, 245, 255, 0.8);
}

.compact-row {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: clamp(0.22rem, 0.48vw, 0.4rem);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.solo-player-card {
  display: grid;
  gap: clamp(0.22rem, 0.55vw, 0.4rem);
  min-width: 0;
}

.solo-row {
  display: flex;
  align-items: center;
  gap: clamp(0.26rem, 0.55vw, 0.42rem);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.solo-row-top {
  justify-content: space-between;
}

.solo-row-middle {
  justify-content: space-between;
  align-items: center;
}

.solo-row-bottom {
  justify-content: space-between;
  font-size: clamp(0.62rem, 1vw, 0.76rem);
  color: rgba(214, 226, 245, 0.88);
}

.solo-rank-values {
  display: inline-flex;
  align-items: baseline;
  gap: clamp(0.28rem, 0.6vw, 0.46rem);
  min-width: 0;
}

.solo-rank-score {
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.solo-rank-elo {
  font-size: clamp(0.78rem, 1.15vw, 0.9rem);
  color: #7fd0ff;
}

.solo-rank-icon {
  width: clamp(1.7rem, 3vw, 2.25rem);
  height: clamp(1.7rem, 3vw, 2.25rem);
  object-fit: contain;
  flex: 0 0 auto;
  filter: drop-shadow(0 0 0.3rem rgba(70, 145, 255, 0.2));
}

.solo-max-score {
  font-weight: 700;
}

.solo-max-rank {
  color: rgba(224, 234, 249, 0.86);
  overflow: hidden;
  text-overflow: ellipsis;
}

.solo-wl {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
}

.metric {
  white-space: nowrap;
  flex: 0 0 auto;
}

.metric.wl {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.metric.rating {
  color: rgba(226, 235, 255, 0.92);
}

.metric.elo {
  color: #7fd0ff;
}

.metric.wl .win {
  margin-left: 0.2rem;
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

.hud-status.collapsed {
  justify-content: flex-end;
}

.hud-status.collapsed .hud-actions {
  margin-left: 0;
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

@media (max-width: 760px) {
  .hud-panels.solo-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.34rem;
  }

  .solo-mode-card {
    order: -1;
    padding: 0.18rem 0.24rem;
  }

  .solo-row-top,
  .solo-row-middle,
  .solo-row-bottom {
    gap: 0.2rem;
  }

  .solo-rank-score {
    font-size: 0.9rem;
  }

  .solo-rank-elo,
  .solo-max-score,
  .solo-max-rank,
  .solo-wl {
    font-size: 0.62rem;
  }

  .solo-rank-icon {
    width: 1.45rem;
    height: 1.45rem;
  }
}

@media (max-width: 620px) {
  .win-rate {
    display: none;
  }

  .app-close-btn {
    top: 0.44rem;
    right: 0.44rem;
    font-size: 0.8rem;
    padding: 0.04rem 0.06rem;
  }

  .hud-panels {
    grid-template-columns: minmax(0, 1.6fr) minmax(4.4rem, 0.34fr) minmax(0, 1.6fr);
    gap: 0.34rem;
  }

  .mode-card {
    padding: 0.12rem 0.2rem;
  }

  .mode-kind {
    font-size: 0.66rem;
    letter-spacing: 0.03em;
  }

  .mode-card .hud-title {
    font-size: 0.52rem;
    letter-spacing: 0.14em;
  }

  .mode-card .hud-row {
    font-size: 0.56rem;
  }

  .hud-card {
    padding: 0.34rem 0.42rem;
  }

  .hud-name {
    font-size: 0.7rem;
    max-width: 4.1rem;
  }

  .solo-name {
    max-width: none;
  }

  .hud-row {
    font-size: 0.6rem;
  }

  .metric {
    font-size: 0.58rem;
  }

  .solo-player-card {
    gap: 0.18rem;
  }

  .solo-rank-score {
    font-size: 0.82rem;
  }

  .solo-rank-elo,
  .solo-max-score,
  .solo-max-rank,
  .solo-wl {
    font-size: 0.56rem;
  }

  .solo-rank-icon {
    width: 1.28rem;
    height: 1.28rem;
  }

  .help-panel {
    width: min(19rem, 90vw);
    padding: 0.45rem 0.55rem;
    right: 0.5rem;
    bottom: 0.5rem;
    max-height: calc(100vh - 1rem);
    overflow-y: auto;
  }

  .help-title {
    font-size: 0.68rem;
    margin-bottom: 0.2rem;
  }

  .help-line {
    font-size: 0.58rem;
    line-height: 1.35;
  }

  .help-confirm {
    font-size: 0.58rem;
    padding: 0.16rem 0.42rem;
  }
}
</style>
