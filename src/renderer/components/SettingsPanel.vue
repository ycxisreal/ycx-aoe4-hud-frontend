<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import {
  clampOverlayPercent,
  DEFAULT_OVERLAY_PERCENT,
  OVERLAY_PERCENT_LIMITS,
} from "../../shared/overlay";
import {
  normalizeProfileHistory,
  upsertProfileHistory as mergeProfileHistory,
} from "../../shared/playerHistory";
import { AppConfig } from "../../shared/types";

const props = defineProps<{
  open: boolean;
  config: AppConfig | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "preview", overlay: AppConfig["overlay"]): void;
  (e: "save", config: AppConfig): void;
}>();

const profileInputWrapRef = ref<HTMLElement | null>(null);
const profileHistoryOpen = ref(false);

// 生成用于窗口实时预览与最终保存的覆盖层配置快照
const buildOverlayPreview = (): AppConfig["overlay"] => ({
  ...form.overlay,
  widthPercent: clampOverlayPercent(
    "widthPercent",
    Number(form.overlay.widthPercent)
  ),
  heightPercent: clampOverlayPercent(
    "heightPercent",
    Number(form.overlay.heightPercent)
  ),
  offsetXPercent: clampOverlayPercent(
    "offsetXPercent",
    Number(form.overlay.offsetXPercent)
  ),
  offsetYPercent: clampOverlayPercent(
    "offsetYPercent",
    Number(form.overlay.offsetYPercent)
  ),
});

// 在用户完成一次滑杆调节后再触发窗口预览，避免拖动过程中窗口变化打断操作
const commitOverlayPreview = () => {
  if (!props.open) {
    return;
  }
  emit("preview", buildOverlayPreview());
};

// 一键恢复覆盖层尺寸与偏移的默认比例，并立即应用一次预览
const resetOverlayPercentToDefault = () => {
  form.overlay.widthPercent = DEFAULT_OVERLAY_PERCENT.widthPercent;
  form.overlay.heightPercent = DEFAULT_OVERLAY_PERCENT.heightPercent;
  form.overlay.offsetXPercent = DEFAULT_OVERLAY_PERCENT.offsetXPercent;
  form.overlay.offsetYPercent = DEFAULT_OVERLAY_PERCENT.offsetYPercent;
  commitOverlayPreview();
};

/**
 * 结构说明：
 * 1) 使用本地表单态复制全量配置，避免输入时直接污染全局状态。
 * 2) 当外部配置变化或面板打开时重置表单。
 * 3) 点击保存时将完整配置回传给上层统一落库。
 */
const form = reactive<AppConfig>({
  version: 1,
  app: { firstRun: true },
  overlay: {
    opacity: 0.9,
    scale: 1,
    layoutPreset: "default",
    locked: true,
    widthPercent: DEFAULT_OVERLAY_PERCENT.widthPercent,
    heightPercent: DEFAULT_OVERLAY_PERCENT.heightPercent,
    offsetXPercent: DEFAULT_OVERLAY_PERCENT.offsetXPercent,
    offsetYPercent: DEFAULT_OVERLAY_PERCENT.offsetYPercent,
  },
  hotkeys: {},
  players: { self: { profileId: "", history: [] } },
  backend: { wsUrl: "ws://127.0.0.1:8765", autoReconnect: true },
  recognition: { enabled: false, hz: 1 },
  tts: { enabled: true, rate: 150, volume: 1 },
  calibration: { rois: [] },
});

// 将指定 profileId 写入历史列表并更新最近使用时间
const syncProfileHistory = (profileId: string, name?: string) => {
  form.players.self.history = mergeProfileHistory(
    form.players.self.history,
    profileId,
    name
  );
};

// 历史 profileId 列表（按最近使用排序）
const profileHistoryList = computed(() => normalizeProfileHistory(form.players.self.history));

// 点击历史项快速填充 profileId
const selectHistoryProfileId = (profileId: string) => {
  form.players.self.profileId = profileId;
  profileHistoryOpen.value = false;
};

// 删除指定历史 profileId
const removeHistoryProfileId = (profileId: string) => {
  const history = normalizeProfileHistory(form.players.self.history);
  form.players.self.history = history.filter((item) => item.profileId !== profileId);
  if (!form.players.self.history.length) {
    closeProfileHistory();
  }
};

// 切换 profileId 历史悬浮列表
const toggleProfileHistory = () => {
  if (!profileHistoryList.value.length) {
    profileHistoryOpen.value = false;
    return;
  }
  profileHistoryOpen.value = !profileHistoryOpen.value;
};

// 关闭 profileId 历史悬浮列表
const closeProfileHistory = () => {
  profileHistoryOpen.value = false;
};

// 点击外部区域时关闭 profileId 历史悬浮列表
const onGlobalPointerDown = (event: MouseEvent) => {
  const target = event.target as Node | null;
  if (!target) {
    return;
  }
  if (profileInputWrapRef.value?.contains(target)) {
    return;
  }
  closeProfileHistory();
};

// 同步外部配置到表单
const syncForm = () => {
  if (!props.config) {
    return;
  }
  const next = JSON.parse(JSON.stringify(props.config)) as AppConfig;
  if (!next.players?.self) {
    next.players = {
      ...(next.players ?? {}),
      self: { profileId: "", history: [] },
    };
  }
  next.players.self.history = normalizeProfileHistory(next.players.self.history);
  Object.assign(form, next);
};

watch(
  () => [props.config, props.open],
  () => {
    syncForm();
    if (!props.open) {
      closeProfileHistory();
    }
  },
  { immediate: true }
);

// 保存配置
const handleSave = () => {
  form.players.self.profileId = String(form.players.self.profileId ?? "").trim();
  form.players.self.history = normalizeProfileHistory(form.players.self.history);
  form.overlay = buildOverlayPreview();
  syncProfileHistory(form.players.self.profileId);
  closeProfileHistory();
  emit("save", JSON.parse(JSON.stringify(form)) as AppConfig);
};

onMounted(() => {
  document.addEventListener("mousedown", onGlobalPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", onGlobalPointerDown);
});
</script>

<template>
  <div v-if="open" class="settings-mask">
    <div class="settings-panel">
      <div class="settings-header">
        <div class="settings-title">设置面板</div>
        <div class="settings-actions">
          <button type="button" @click="emit('close')">取消</button>
          <button type="button" class="primary" @click="handleSave">保存</button>
        </div>
      </div>
      <div class="settings-grid">
        <label>
          我方 profileId
          <div ref="profileInputWrapRef" class="profile-input-wrap">
            <input
              v-model="form.players.self.profileId"
              placeholder="必填"
              @keydown.esc="closeProfileHistory"
            />
            <button
              type="button"
              class="history-toggle"
              :disabled="!profileHistoryList.length"
              @click="toggleProfileHistory"
            >
              历史
            </button>
            <div v-if="profileHistoryOpen && profileHistoryList.length" class="history-popover">
              <div class="history-list">
                <div v-for="item in profileHistoryList" :key="item.profileId" class="history-item">
                  <button type="button" class="history-pick" @click="selectHistoryProfileId(item.profileId)">
                    <span class="history-id">{{ item.profileId }}</span>
                    <span class="history-name">{{ item.name || "未命名" }}</span>
                  </button>
                  <button
                    type="button"
                    class="history-remove"
                    @click.stop="removeHistoryProfileId(item.profileId)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </label>
        <label>
          后端 WS
          <input v-model="form.backend.wsUrl" placeholder="ws://127.0.0.1:8765" />
        </label>
        <label>
          识别频率 (Hz)
          <input v-model.number="form.recognition.hz" type="number" min="1" max="2" />
        </label>
        <div class="overlay-reset-field">
          <div class="overlay-reset-copy">
            <div class="overlay-reset-title">重置尺寸至默认值</div>
          </div>
          <button type="button" class="overlay-reset-button" @click="resetOverlayPercentToDefault">
            重置默认布局
          </button>
        </div>
        <div class="overlay-range-field">
          <div class="overlay-range-head">
            <div>
              <div class="overlay-range-title">HUD 宽度占比</div>
            </div>
            <div class="overlay-range-value">{{ form.overlay.widthPercent }}%</div>
          </div>
          <input
            v-model.number="form.overlay.widthPercent"
            class="overlay-range-input"
            type="range"
            :min="OVERLAY_PERCENT_LIMITS.widthPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.widthPercent.max"
            step="1"
            @change="commitOverlayPreview"
          />
          <div class="overlay-range-scale">
            <span>{{ OVERLAY_PERCENT_LIMITS.widthPercent.min }}%</span>
            <span>{{ OVERLAY_PERCENT_LIMITS.widthPercent.max }}%</span>
          </div>
        </div>
        <div class="overlay-range-field">
          <div class="overlay-range-head">
            <div>
              <div class="overlay-range-title">HUD 高度占比</div>
            </div>
            <div class="overlay-range-value">{{ form.overlay.heightPercent }}%</div>
          </div>
          <input
            v-model.number="form.overlay.heightPercent"
            class="overlay-range-input"
            type="range"
            :min="OVERLAY_PERCENT_LIMITS.heightPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.heightPercent.max"
            step="1"
            @change="commitOverlayPreview"
          />
          <div class="overlay-range-scale">
            <span>{{ OVERLAY_PERCENT_LIMITS.heightPercent.min }}%</span>
            <span>{{ OVERLAY_PERCENT_LIMITS.heightPercent.max }}%</span>
          </div>
        </div>
        <div class="overlay-range-field">
          <div class="overlay-range-head">
            <div>
              <div class="overlay-range-title">左侧偏移占比</div>
            </div>
            <div class="overlay-range-value">{{ form.overlay.offsetXPercent }}%</div>
          </div>
          <input
            v-model.number="form.overlay.offsetXPercent"
            class="overlay-range-input"
            type="range"
            :min="OVERLAY_PERCENT_LIMITS.offsetXPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.offsetXPercent.max"
            step="1"
            @change="commitOverlayPreview"
          />
          <div class="overlay-range-scale">
            <span>{{ OVERLAY_PERCENT_LIMITS.offsetXPercent.min }}%</span>
            <span>{{ OVERLAY_PERCENT_LIMITS.offsetXPercent.max }}%</span>
          </div>
        </div>
        <div class="overlay-range-field">
          <div class="overlay-range-head">
            <div>
              <div class="overlay-range-title">顶部偏移占比</div>
            </div>
            <div class="overlay-range-value">{{ form.overlay.offsetYPercent }}%</div>
          </div>
          <input
            v-model.number="form.overlay.offsetYPercent"
            class="overlay-range-input"
            type="range"
            :min="OVERLAY_PERCENT_LIMITS.offsetYPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.offsetYPercent.max"
            step="1"
            @change="commitOverlayPreview"
          />
          <div class="overlay-range-scale">
            <span>{{ OVERLAY_PERCENT_LIMITS.offsetYPercent.min }}%</span>
            <span>{{ OVERLAY_PERCENT_LIMITS.offsetYPercent.max }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-mask {
  position: fixed;
  inset: 0;
  background: rgba(3, 6, 12, 0.6);
  display: grid;
  place-items: center;
  z-index: 30;
}

.settings-panel {
  width: 90vw;
  height: 80vh;
  overflow-y: scroll;
  background: rgba(12, 16, 30, 0.94);
  border: 1px solid rgba(120, 170, 255, 0.25);
  border-radius: clamp(0.7rem, 1.8vw, 1.15rem);
  padding: clamp(0.75rem, 1.8vw, 1.15rem) clamp(0.85rem, 2vw, 1.25rem) clamp(0.7rem, 1.6vw, 1rem);
  color: #e8f0ff;
  scrollbar-width: thin;
  scrollbar-color: rgba(120, 170, 255, 0.35) rgba(6, 10, 18, 0.2);
}

.settings-title {
  font-size: clamp(0.95rem, 1.8vw, 1.2rem);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(0.4rem, 1vw, 0.7rem);
  margin-bottom: clamp(0.25rem, 0.65vw, 0.5rem);
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.5rem, 1.2vw, 0.8rem);
}

label {
  display: grid;
  gap: clamp(0.25rem, 0.6vw, 0.4rem);
  font-size: clamp(0.68rem, 1.1vw, 0.8rem);
}

input {
  background: rgba(10, 14, 24, 0.85);
  border: 1px solid rgba(120, 170, 255, 0.3);
  border-radius: clamp(0.4rem, 1vw, 0.6rem);
  padding: clamp(0.28rem, 0.65vw, 0.42rem) clamp(0.35rem, 0.8vw, 0.5rem);
  color: #e8f0ff;
  font-size: clamp(0.68rem, 1.1vw, 0.8rem);
}

.overlay-range-field {
  display: grid;
  gap: clamp(0.35rem, 0.8vw, 0.5rem);
  padding: clamp(0.55rem, 1vw, 0.75rem);
  border: 1px solid rgba(120, 170, 255, 0.2);
  border-radius: clamp(0.55rem, 1vw, 0.8rem);
  background:
    linear-gradient(180deg, rgba(20, 28, 48, 0.88), rgba(11, 16, 28, 0.88)),
    radial-gradient(circle at top right, rgba(92, 158, 255, 0.12), transparent 55%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.overlay-reset-field {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(0.45rem, 1vw, 0.7rem);
  padding: clamp(0.15rem, 0.4vw, 0.35rem);
  border: 1px solid rgba(120, 170, 255, 0.18);
  border-radius: clamp(0.55rem, 1vw, 0.8rem);
  background: linear-gradient(180deg, rgba(18, 24, 42, 0.88), rgba(10, 15, 28, 0.92));
}

.overlay-reset-copy {
  min-width: 0;
}

.overlay-reset-title {
  font-size: clamp(0.72rem, 1.08vw, 0.84rem);
  font-weight: 600;
  color: rgba(236, 244, 255, 0.98);
}

.overlay-reset-button {
  min-width: 6.9rem;
  padding-inline: clamp(0.65rem, 1.2vw, 0.95rem);
  background: linear-gradient(135deg, rgba(54, 111, 221, 0.92), rgba(37, 72, 158, 0.94));
  border-color: rgba(141, 184, 255, 0.34);
}

.overlay-range-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: clamp(0.45rem, 1vw, 0.7rem);
}

.overlay-range-title {
  font-size: clamp(0.72rem, 1.1vw, 0.84rem);
  font-weight: 600;
  color: rgba(236, 244, 255, 0.98);
}

.overlay-range-value {
  flex-shrink: 0;
  min-width: 2.9rem;
  padding: 0.24rem 0.46rem;
  border: 1px solid rgba(120, 170, 255, 0.26);
  border-radius: 999px;
  background: rgba(39, 64, 108, 0.52);
  color: #eef5ff;
  text-align: center;
  font-size: clamp(0.66rem, 1vw, 0.76rem);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.overlay-range-input {
  appearance: none;
  width: 100%;
  height: 0.38rem;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(69, 129, 255, 0.92), rgba(126, 198, 255, 0.88));
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
  cursor: pointer;
}

.overlay-range-input::-webkit-slider-thumb {
  appearance: none;
  width: 0.92rem;
  height: 0.92rem;
  border: 2px solid rgba(228, 240, 255, 0.96);
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff, #8ec5ff 65%, #5c84ff 100%);
  box-shadow: 0 0.18rem 0.45rem rgba(26, 52, 96, 0.45);
}

.overlay-range-input::-moz-range-thumb {
  width: 0.92rem;
  height: 0.92rem;
  border: 2px solid rgba(228, 240, 255, 0.96);
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #ffffff, #8ec5ff 65%, #5c84ff 100%);
  box-shadow: 0 0.18rem 0.45rem rgba(26, 52, 96, 0.45);
}

.overlay-range-input::-moz-range-track {
  height: 0.38rem;
  border: none;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(69, 129, 255, 0.92), rgba(126, 198, 255, 0.88));
}

.overlay-range-scale {
  display: flex;
  justify-content: space-between;
  color: rgba(160, 188, 234, 0.72);
  font-size: clamp(0.56rem, 0.9vw, 0.66rem);
}

.profile-input-wrap {
  position: relative;
  width: 100%;
}

.profile-input-wrap input {
  width: 100%;
  box-sizing: border-box;
  padding-right: 2.2rem;
}

.history-toggle {
  position: absolute;
  top: 50%;
  right: 0.3rem;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: rgba(182, 210, 255, 0.92);
  border-radius: 0;
  padding: 0 0.14rem;
  font-size: clamp(0.58rem, 0.95vw, 0.7rem);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
}

.history-toggle:hover {
  color: #e8f0ff;
}

.history-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.history-popover {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 0.2rem);
  z-index: 60;
  border: 1px solid rgba(120, 170, 255, 0.3);
  border-radius: clamp(0.45rem, 1vw, 0.62rem);
  background: rgba(10, 14, 24, 0.98);
  box-shadow: 0 0.35rem 0.9rem rgba(0, 0, 0, 0.35);
  padding: clamp(0.3rem, 0.7vw, 0.42rem);
}

.history-list {
  display: grid;
  gap: clamp(0.25rem, 0.6vw, 0.38rem);
  max-height: 5.1rem;
  overflow-y: auto;
  padding-right: 0.2rem;
}

.history-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(0.24rem, 0.55vw, 0.35rem);
}

.history-pick {
  border: 1px solid rgba(120, 170, 255, 0.28);
  background: rgba(12, 18, 32, 0.8);
  border-radius: clamp(0.35rem, 0.85vw, 0.5rem);
  color: #e8f0ff;
  min-width: 0;
  padding: clamp(0.2rem, 0.5vw, 0.3rem) clamp(0.32rem, 0.75vw, 0.45rem);
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: clamp(0.26rem, 0.6vw, 0.4rem);
}

.history-id {
  font-weight: 600;
  color: rgba(226, 238, 255, 0.96);
}

.history-name {
  color: rgba(165, 196, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-remove {
  border: 1px solid rgba(255, 150, 150, 0.35);
  background: rgba(56, 20, 26, 0.65);
  color: rgba(255, 206, 206, 0.95);
  border-radius: clamp(0.34rem, 0.8vw, 0.48rem);
  padding: clamp(0.2rem, 0.48vw, 0.28rem) clamp(0.32rem, 0.75vw, 0.46rem);
  cursor: pointer;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: clamp(0.4rem, 1vw, 0.65rem);
  flex-shrink: 0;
}

button {
  border: 1px solid rgba(160, 200, 255, 0.35);
  background: rgba(20, 24, 36, 0.8);
  color: #e8f0ff;
  padding: clamp(0.28rem, 0.65vw, 0.42rem) clamp(0.5rem, 1.2vw, 0.75rem);
  border-radius: clamp(0.4rem, 1vw, 0.6rem);
  font-size: clamp(0.68rem, 1.1vw, 0.8rem);
  cursor: pointer;
}

button.primary {
  background: linear-gradient(135deg, rgba(76, 145, 255, 0.9), rgba(58, 86, 180, 0.9));
}

.settings-panel::-webkit-scrollbar {
  width: 8px;
}

.settings-panel::-webkit-scrollbar-track {
  background: rgba(6, 10, 18, 0.2);
  border-radius: 10px;
}

.settings-panel::-webkit-scrollbar-thumb {
  background: rgba(120, 170, 255, 0.35);
  border-radius: 10px;
  border: 2px solid rgba(6, 10, 18, 0.2);
}

.settings-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(120, 170, 255, 0.5);
}

@media (max-width: 620px) {
  .settings-panel {
    width: 95vw;
    height: 84vh;
    border-radius: 0.58rem;
    padding: 0.52rem 0.62rem 0.56rem;
  }

  .settings-header {
    margin-bottom: 0.28rem;
    gap: 0.38rem;
  }

  .settings-title {
    font-size: 0.78rem;
  }

  .settings-grid {
    gap: 0.35rem;
  }

  label {
    gap: 0.18rem;
    font-size: 0.62rem;
  }

  input {
    border-radius: 0.38rem;
    padding: 0.2rem 0.32rem;
    font-size: 0.62rem;
  }

  .overlay-range-field {
    gap: 0.32rem;
    padding: 0.45rem 0.5rem;
    border-radius: 0.46rem;
  }

  .overlay-reset-field {
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 0.34rem;
    padding: 0.15rem 0.3rem;
    border-radius: 0.46rem;
  }

  .overlay-reset-title {
    font-size: 0.66rem;
  }

  .overlay-reset-button {
    min-width: 0;
  }

  .overlay-range-title {
    font-size: 0.66rem;
  }

  .overlay-range-value {
    min-width: 2.45rem;
    padding: 0.18rem 0.34rem;
    font-size: 0.58rem;
  }

  .overlay-range-input {
    height: 0.34rem;
  }

  .profile-input-wrap input {
    padding-right: 2.05rem;
  }

  .history-toggle {
    right: 0.22rem;
    padding: 0 0.12rem;
    font-size: 0.56rem;
  }

  .settings-actions {
    gap: 0.3rem;
  }

  .history-list {
    max-height: 4.8rem;
    gap: 0.22rem;
  }

  .history-item {
    gap: 0.24rem;
  }

  .history-pick {
    border-radius: 0.34rem;
    padding: 0.18rem 0.26rem;
  }

  .history-remove {
    border-radius: 0.34rem;
    padding: 0.16rem 0.28rem;
    font-size: 0.58rem;
  }

  button {
    padding: 0.2rem 0.42rem;
    border-radius: 0.38rem;
    font-size: 0.6rem;
  }
}
</style>
