<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { AppConfig, PlayerHistoryItem } from "../../shared/types";

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

const OVERLAY_PERCENT_LIMITS = {
  widthPercent: { min: 20, max: 80 },
  heightPercent: { min: 10, max: 50 },
  offsetXPercent: { min: 0, max: 60 },
  offsetYPercent: { min: 0, max: 60 },
} as const;

// 限制设置页中的比例数值范围，避免输入过程出现空值或越界
const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

// 生成用于窗口实时预览与最终保存的覆盖层配置快照
const buildOverlayPreview = (): AppConfig["overlay"] => ({
  ...form.overlay,
  widthPercent: clampNumber(
    Number(form.overlay.widthPercent),
    OVERLAY_PERCENT_LIMITS.widthPercent.min,
    OVERLAY_PERCENT_LIMITS.widthPercent.max
  ),
  heightPercent: clampNumber(
    Number(form.overlay.heightPercent),
    OVERLAY_PERCENT_LIMITS.heightPercent.min,
    OVERLAY_PERCENT_LIMITS.heightPercent.max
  ),
  offsetXPercent: clampNumber(
    Number(form.overlay.offsetXPercent),
    OVERLAY_PERCENT_LIMITS.offsetXPercent.min,
    OVERLAY_PERCENT_LIMITS.offsetXPercent.max
  ),
  offsetYPercent: clampNumber(
    Number(form.overlay.offsetYPercent),
    OVERLAY_PERCENT_LIMITS.offsetYPercent.min,
    OVERLAY_PERCENT_LIMITS.offsetYPercent.max
  ),
});

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
    widthPercent: 38,
    heightPercent: 18,
    offsetXPercent: 5,
    offsetYPercent: 0,
  },
  hotkeys: {},
  players: { self: { profileId: "", history: [] } },
  backend: { wsUrl: "ws://127.0.0.1:8765", autoReconnect: true },
  recognition: { enabled: false, hz: 1 },
  tts: { enabled: true, rate: 150, volume: 1 },
  calibration: { rois: [] },
});

// 规范化历史 profileId 列表（去重、裁剪空值、按最近使用排序）
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

// 将指定 profileId 写入历史列表并更新最近使用时间
const upsertProfileHistory = (profileId: string, name?: string) => {
  const normalizedId = String(profileId ?? "").trim();
  if (!normalizedId) {
    return;
  }
  const normalizedName = String(name ?? "").trim();
  const current = normalizeProfileHistory(form.players.self.history);
  const filtered = current.filter((item) => item.profileId !== normalizedId);
  filtered.unshift({
    profileId: normalizedId,
    name: normalizedName || current.find((item) => item.profileId === normalizedId)?.name,
    lastUsedAt: Date.now(),
  });
  form.players.self.history = normalizeProfileHistory(filtered);
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
    next.players = { ...(next.players ?? {}), self: { profileId: "", history: [] } };
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
  upsertProfileHistory(form.players.self.profileId);
  closeProfileHistory();
  emit("save", JSON.parse(JSON.stringify(form)) as AppConfig);
};

// 覆盖层布局字段变动后实时通知父层进行窗口预览
watch(
  () => [
    form.overlay.widthPercent,
    form.overlay.heightPercent,
    form.overlay.offsetXPercent,
    form.overlay.offsetYPercent,
  ],
  () => {
    if (!props.open) {
      return;
    }
    emit("preview", buildOverlayPreview());
  }
);

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
                  <button type="button" class="history-remove" @click.stop="removeHistoryProfileId(item.profileId)">
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
        <label>
          HUD 宽度占比 (%)
          <input
            v-model.number="form.overlay.widthPercent"
            type="number"
            :min="OVERLAY_PERCENT_LIMITS.widthPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.widthPercent.max"
          />
        </label>
        <label>
          HUD 高度占比 (%)
          <input
            v-model.number="form.overlay.heightPercent"
            type="number"
            :min="OVERLAY_PERCENT_LIMITS.heightPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.heightPercent.max"
          />
        </label>
        <label>
          左侧偏移占比 (%)
          <input
            v-model.number="form.overlay.offsetXPercent"
            type="number"
            :min="OVERLAY_PERCENT_LIMITS.offsetXPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.offsetXPercent.max"
          />
        </label>
        <label>
          顶部偏移占比 (%)
          <input
            v-model.number="form.overlay.offsetYPercent"
            type="number"
            :min="OVERLAY_PERCENT_LIMITS.offsetYPercent.min"
            :max="OVERLAY_PERCENT_LIMITS.offsetYPercent.max"
          />
        </label>
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
