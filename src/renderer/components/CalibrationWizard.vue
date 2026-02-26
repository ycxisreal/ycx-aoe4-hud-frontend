<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { RoiItem, RoiRect, ScreenInfo, ScreenSignature } from "../../shared/types";

export type CalibrationStep = {
  id: string;
  name: string;
  kind: RoiItem["kind"];
};

const props = defineProps<{
  open: boolean;
  steps: CalibrationStep[];
  screenInfo: ScreenInfo | null;
  existingRois: RoiItem[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "complete", rois: RoiItem[], signature: ScreenSignature): void;
}>();

/**
 * 结构说明：
 * 1) 维护当前步骤索引与临时 ROI 列表。
 * 2) 使用拖拽框选生成矩形，支持重试/跳过/上一步。
 * 3) 完成时输出 ROI 列表和屏幕签名。
 */
const state = reactive({
  stepIndex: 0,
  rois: [] as RoiItem[],
  dragging: false,
  dragStart: { x: 0, y: 0 },
  dragRect: null as RoiRect | null,
  canvasRect: null as DOMRect | null,
});

const overlayRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLDivElement | null>(null);

const currentStep = computed(() => props.steps[state.stepIndex]);

// 重置标定状态
const resetState = () => {
  state.stepIndex = 0;
  state.rois = props.existingRois ? JSON.parse(JSON.stringify(props.existingRois)) : [];
  state.dragging = false;
  state.dragRect = null;
};

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetState();
    }
  }
);

// 处理鼠标按下
const handlePointerDown = (event: MouseEvent) => {
  if (!props.open) {
    return;
  }
  if (!canvasRef.value) {
    return;
  }
  state.canvasRect = canvasRef.value.getBoundingClientRect();
  state.dragging = true;
  const start = toLocalPoint(event.clientX, event.clientY);
  state.dragStart = start;
  state.dragRect = { x: start.x, y: start.y, w: 0, h: 0 };
};

// 处理鼠标移动
const handlePointerMove = (event: MouseEvent) => {
  if (!state.dragging || !state.dragRect) {
    return;
  }
  const current = toLocalPoint(event.clientX, event.clientY);
  const rect = normalizeRect(state.dragStart.x, state.dragStart.y, current.x, current.y);
  state.dragRect = rect;
};

// 处理鼠标释放
const handlePointerUp = () => {
  if (!state.dragging || !state.dragRect) {
    return;
  }
  state.dragging = false;
};

// 保存当前矩形
const confirmRect = () => {
  if (!state.dragRect || !currentStep.value) {
    return;
  }
  const id = currentStep.value.id;
  const next: RoiItem = {
    id,
    name: currentStep.value.name,
    rect: state.dragRect,
    kind: currentStep.value.kind,
  };
  const idx = state.rois.findIndex((roi) => roi.id === id);
  if (idx >= 0) {
    state.rois.splice(idx, 1, next);
  } else {
    state.rois.push(next);
  }
  state.dragRect = null;
};

// 进入下一步
const nextStep = () => {
  if (state.stepIndex < props.steps.length - 1) {
    state.stepIndex += 1;
    state.dragRect = null;
  }
};

// 返回上一步
const prevStep = () => {
  if (state.stepIndex > 0) {
    state.stepIndex -= 1;
    state.dragRect = null;
  }
};

// 跳过当前步骤
const skipStep = () => {
  nextStep();
};

// 完成标定
const finish = () => {
  if (!props.screenInfo) {
    return;
  }
  const signature: ScreenSignature = buildSignature();
  emit("complete", state.rois, signature);
};

// 规范矩形坐标
const normalizeRect = (x1: number, y1: number, x2: number, y2: number): RoiRect => {
  const left = clamp(Math.min(x1, x2), 0, getCanvasSize().width);
  const top = clamp(Math.min(y1, y2), 0, getCanvasSize().height);
  const right = clamp(Math.max(x1, x2), 0, getCanvasSize().width);
  const bottom = clamp(Math.max(y1, y2), 0, getCanvasSize().height);
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
};

// 将屏幕坐标转换为画布内坐标
const toLocalPoint = (clientX: number, clientY: number) => {
  const rect = state.canvasRect;
  if (!rect) {
    return { x: 0, y: 0 };
  }
  return {
    x: clamp(clientX - rect.left, 0, rect.width),
    y: clamp(clientY - rect.top, 0, rect.height),
  };
};

// 获取画布尺寸
const getCanvasSize = () => {
  const rect = state.canvasRect;
  if (!rect) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: rect.width, height: rect.height };
};

// 构造窗口签名
const buildSignature = (): ScreenSignature => {
  const size = getCanvasSize();
  return {
    width: Math.round(size.width),
    height: Math.round(size.height),
    dpiScale: props.screenInfo?.scaleFactor,
    displayId: props.screenInfo?.displayId,
  };
};

// 限制数值范围
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
</script>

<template>
  <div v-if="open" ref="overlayRef" class="calibration-mask">
    <div class="calibration-panel">
      <div class="title">标定向导</div>
      <div class="subtitle">
        当前步骤：{{ currentStep?.name || "完成" }}
      </div>
      <div class="hint">在屏幕上拖拽框选对应区域</div>
      <div class="actions">
        <button type="button" @click="prevStep">上一步</button>
        <button type="button" @click="skipStep">跳过</button>
        <button type="button" @click="confirmRect">确认</button>
        <button type="button" @click="nextStep">下一步</button>
        <button type="button" class="primary" @click="finish">完成</button>
        <button type="button" class="ghost" @click="emit('close')">退出</button>
      </div>
    </div>

    <div
      ref="canvasRef"
      class="calibration-canvas"
      @mousedown="handlePointerDown"
      @mousemove="handlePointerMove"
      @mouseup="handlePointerUp"
    >
      <div
        v-if="state.dragRect"
        class="selection"
        :style="{
          left: state.dragRect.x + 'px',
          top: state.dragRect.y + 'px',
          width: state.dragRect.w + 'px',
          height: state.dragRect.h + 'px',
        }"
      ></div>
    </div>
  </div>
</template>

<style scoped>
.calibration-mask {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 18, 0.2);
  z-index: 40;
}

.calibration-panel {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(8, 12, 20, 0.88);
  border: 1px solid rgba(120, 170, 255, 0.35);
  border-radius: 16px;
  padding: 12px 16px;
  color: #e8f0ff;
  backdrop-filter: blur(10px);
  z-index: 2;
  pointer-events: auto;
}

.title {
  font-size: 16px;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 13px;
  color: rgba(200, 220, 255, 0.9);
}

.hint {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(200, 220, 255, 0.7);
}

.actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

button {
  border: 1px solid rgba(160, 200, 255, 0.35);
  background: rgba(20, 24, 36, 0.8);
  color: #e8f0ff;
  padding: 6px 10px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
}

button.primary {
  background: linear-gradient(135deg, rgba(76, 145, 255, 0.9), rgba(58, 86, 180, 0.9));
}

button.ghost {
  background: transparent;
  border-color: rgba(160, 200, 255, 0.2);
}

.calibration-canvas {
  position: absolute;
  inset: 0;
  cursor: crosshair;
  z-index: 1;
}

.selection {
  position: absolute;
  border: 2px solid rgba(120, 200, 255, 0.8);
  background: rgba(80, 150, 255, 0.2);
  box-shadow: 0 0 20px rgba(80, 150, 255, 0.4);
}
</style>
