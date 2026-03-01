<script setup lang="ts">
import { reactive, watch } from "vue";
import { AppConfig } from "../../shared/types";

const props = defineProps<{
  open: boolean;
  config: AppConfig | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", config: AppConfig): void;
}>();

/**
 * 结构说明：
 * 1) 使用本地表单态复制全量配置，避免输入时直接污染全局状态。
 * 2) 当外部配置变化或面板打开时重置表单。
 * 3) 点击保存时将完整配置回传给上层统一落库。
 */
const form = reactive<AppConfig>({
  version: 1,
  app: { firstRun: true },
  overlay: { opacity: 0.9, scale: 1, layoutPreset: "default", locked: true },
  hotkeys: {},
  players: { self: { profileId: "" } },
  backend: { wsUrl: "ws://127.0.0.1:8765", autoReconnect: true },
  recognition: { enabled: false, hz: 1 },
  tts: { enabled: true, rate: 150, volume: 1 },
  calibration: { rois: [] },
});

// 同步外部配置到表单
const syncForm = () => {
  if (!props.config) {
    return;
  }
  const next = JSON.parse(JSON.stringify(props.config)) as AppConfig;
  Object.assign(form, next);
};

watch(
  () => [props.config, props.open],
  () => syncForm(),
  { immediate: true }
);

// 保存配置
const handleSave = () => {
  emit("save", JSON.parse(JSON.stringify(form)) as AppConfig);
};
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
          <input v-model="form.players.self.profileId" placeholder="必填" />
        </label>
        <label>
          后端 WS
          <input v-model="form.backend.wsUrl" placeholder="ws://127.0.0.1:8765" />
        </label>
        <label>
          识别频率 (Hz)
          <input v-model.number="form.recognition.hz" type="number" min="1" max="2" />
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

  .settings-actions {
    gap: 0.3rem;
  }

  button {
    padding: 0.2rem 0.42rem;
    border-radius: 0.38rem;
    font-size: 0.6rem;
  }
}
</style>
