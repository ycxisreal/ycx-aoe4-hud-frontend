<script setup lang="ts">
const props = defineProps<{
  locked: boolean;
  running: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-lock"): void;
  (e: "refresh"): void;
  (e: "calibrate"): void;
  (e: "settings"): void;
  (e: "start"): void;
  (e: "stop"): void;
}>();
</script>

<template>
  <div class="controls">
    <button class="primary" type="button" @click="emit('toggle-lock')">
      {{ props.locked ? "解锁编辑" : "锁定 HUD" }}
    </button>
    <button type="button" @click="emit('refresh')">刷新对局</button>
    <button type="button" @click="emit('calibrate')">标定区域</button>
    <button type="button" @click="emit('settings')">设置</button>
    <button v-if="!props.running" type="button" @click="emit('start')">START</button>
    <button v-else type="button" class="danger" @click="emit('stop')">STOP</button>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  background: rgba(10, 14, 24, 0.68);
  border: 1px solid rgba(120, 170, 255, 0.2);
  border-radius: 12px;
  padding: 10px 12px;
  backdrop-filter: blur(8px);
  -webkit-app-region: no-drag;
}

button {
  border: 1px solid rgba(160, 200, 255, 0.35);
  background: rgba(20, 24, 36, 0.8);
  color: #e8f0ff;
  padding: 6px 12px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
}

button.primary {
  background: linear-gradient(135deg, rgba(76, 145, 255, 0.9), rgba(58, 86, 180, 0.9));
}

button.danger {
  background: linear-gradient(135deg, rgba(255, 99, 99, 0.9), rgba(180, 58, 90, 0.9));
}
</style>
