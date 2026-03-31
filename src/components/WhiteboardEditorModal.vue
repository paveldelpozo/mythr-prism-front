<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useWhiteboardEditor } from '../composables/useWhiteboardEditor';
import {
  sanitizeWhiteboardState,
  type WhiteboardPoint,
  type WhiteboardState,
  type WhiteboardStroke,
  type WhiteboardTool
} from '../types/whiteboard';

const props = defineProps<{
  monitorId: string;
  monitorLabel: string;
  monitorResolutionLabel: string;
  referenceImageDataUrl: string | null;
  state: WhiteboardState;
}>();

const emit = defineEmits<{
  close: [];
  stateChange: [monitorId: string, state: WhiteboardState];
  clear: [monitorId: string];
  undo: [monitorId: string];
}>();

const panelTitleId = computed(() => `whiteboard-modal-title-${props.monitorId}`);
const canvasHost = ref<HTMLElement | null>(null);
const drawingCanvas = ref<HTMLCanvasElement | null>(null);
const modalCloseButton = ref<HTMLButtonElement | null>(null);
const isPointerDown = ref(false);
const bodyScrollSnapshot = ref<{ overflow: string; paddingRight: string } | null>(null);

const TOOL_OPTIONS: ReadonlyArray<{ value: WhiteboardTool; label: string }> = [
  { value: 'draw', label: 'Lapiz' },
  { value: 'line', label: 'Linea' },
  { value: 'arrow', label: 'Flecha' },
  { value: 'rect', label: 'Rectangulo' },
  { value: 'circle', label: 'Circulo' },
  { value: 'erase', label: 'Borrar trazo' }
];

const {
  activeStroke,
  activeTool,
  selectedColor,
  selectedWidth,
  whiteboardState,
  appendPoint,
  beginStroke,
  clear,
  commitStroke,
  setState,
  undo
} = useWhiteboardEditor({
  onChange: (nextState) => {
    emit('stateChange', props.monitorId, nextState);
    renderCanvas();
  }
});

const editableStrokes = computed<WhiteboardStroke[]>(() => {
  if (!activeStroke.value) {
    return whiteboardState.value.strokes;
  }

  return [...whiteboardState.value.strokes, activeStroke.value];
});

const canvasCursorClass = computed(() =>
  activeTool.value === 'erase' ? 'whiteboard-editor-canvas--erase' : 'whiteboard-editor-canvas--draw'
);

const selectTool = (tool: WhiteboardTool) => {
  activeTool.value = tool;
};

const toCanvasPoint = (point: WhiteboardPoint, width: number, height: number) => ({
  x: point.x * width,
  y: point.y * height
});

const drawFreehandStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
  width: number,
  height: number
) => {
  ctx.beginPath();
  stroke.points.forEach((point, index) => {
    const canvasPoint = toCanvasPoint(point, width, height);
    if (index === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
      return;
    }

    ctx.lineTo(canvasPoint.x, canvasPoint.y);
  });
  ctx.stroke();
};

const drawShapeStroke = (
  ctx: CanvasRenderingContext2D,
  stroke: WhiteboardStroke,
  width: number,
  height: number
) => {
  const start = stroke.points[0];
  const end = stroke.points[stroke.points.length - 1];
  if (!start || !end) {
    return;
  }

  const from = toCanvasPoint(start, width, height);
  const to = toCanvasPoint(end, width, height);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (stroke.tool === 'line') {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'arrow') {
    const angle = Math.atan2(dy, dx);
    const headSize = Math.max(10, stroke.width * 2.8);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headSize * Math.cos(angle - Math.PI / 7),
      to.y - headSize * Math.sin(angle - Math.PI / 7)
    );
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(
      to.x - headSize * Math.cos(angle + Math.PI / 7),
      to.y - headSize * Math.sin(angle + Math.PI / 7)
    );
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'rect') {
    const x = Math.min(from.x, to.x);
    const y = Math.min(from.y, to.y);
    const rectWidth = Math.abs(dx);
    const rectHeight = Math.abs(dy);

    if (rectWidth < 1 && rectHeight < 1) {
      return;
    }

    ctx.beginPath();
    ctx.rect(x, y, rectWidth, rectHeight);
    ctx.stroke();
    return;
  }

  if (stroke.tool === 'circle') {
    const radiusX = Math.abs(dx) / 2;
    const radiusY = Math.abs(dy) / 2;

    if (radiusX < 1 && radiusY < 1) {
      return;
    }

    ctx.beginPath();
    ctx.ellipse((from.x + to.x) / 2, (from.y + to.y) / 2, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
};

const lockBodyScroll = () => {
  if (typeof document === 'undefined' || bodyScrollSnapshot.value) {
    return;
  }

  const body = document.body;
  bodyScrollSnapshot.value = {
    overflow: body.style.overflow,
    paddingRight: body.style.paddingRight
  };

  const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  body.style.overflow = 'hidden';
  body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : body.style.paddingRight;
};

const unlockBodyScroll = () => {
  if (typeof document === 'undefined' || !bodyScrollSnapshot.value) {
    return;
  }

  const body = document.body;
  body.style.overflow = bodyScrollSnapshot.value.overflow;
  body.style.paddingRight = bodyScrollSnapshot.value.paddingRight;
  bodyScrollSnapshot.value = null;
};

const configureCanvasSize = () => {
  const host = canvasHost.value;
  const canvas = drawingCanvas.value;
  if (!host || !canvas) {
    return;
  }

  const rect = host.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return;
  }

  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

const renderStroke = (ctx: CanvasRenderingContext2D, stroke: WhiteboardStroke, width: number, height: number) => {
  if (stroke.points.length < 2) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = stroke.tool === 'erase' ? 'destination-out' : 'source-over';
  ctx.strokeStyle = stroke.tool === 'erase' ? '#000000' : stroke.color;
  ctx.lineWidth = Math.max(1, stroke.width);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'draw' || stroke.tool === 'erase') {
    drawFreehandStroke(ctx, stroke, width, height);
  } else {
    drawShapeStroke(ctx, stroke, width, height);
  }

  ctx.restore();
};

const renderCanvas = () => {
  const canvas = drawingCanvas.value;
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const ratio = Math.max(1, window.devicePixelRatio || 1);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;

  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  editableStrokes.value.forEach((stroke) => {
    renderStroke(ctx, stroke, width, height);
  });
  ctx.restore();
};

const toPointFromPointer = (event: PointerEvent): WhiteboardPoint | null => {
  const canvas = drawingCanvas.value;
  if (!canvas) {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;

  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y))
  };
};

const startDrawing = (event: PointerEvent) => {
  const point = toPointFromPointer(event);
  if (!point) {
    return;
  }

  isPointerDown.value = true;
  event.preventDefault();
  beginStroke(point);
  renderCanvas();
};

const continueDrawing = (event: PointerEvent) => {
  if (!isPointerDown.value) {
    return;
  }

  const point = toPointFromPointer(event);
  if (!point) {
    return;
  }

  appendPoint(point);
  event.preventDefault();
  emit('stateChange', props.monitorId, sanitizeWhiteboardState({ strokes: editableStrokes.value }));
  renderCanvas();
};

const stopDrawing = (event?: PointerEvent) => {
  if (!isPointerDown.value) {
    return;
  }

  if (event) {
    const point = toPointFromPointer(event);
    if (point) {
      appendPoint(point);
    }
  }

  isPointerDown.value = false;
  commitStroke();
  renderCanvas();
};

const onClear = () => {
  clear();
  emit('clear', props.monitorId);
};

const onUndo = () => {
  undo();
  emit('undo', props.monitorId);
};

const closeModal = () => {
  emit('close');
};

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

watch(
  () => props.monitorId,
  () => {
    setState(sanitizeWhiteboardState(props.state));
    void nextTick(() => {
      configureCanvasSize();
      renderCanvas();
    });
  },
  { immediate: true }
);

watch([activeTool, selectedColor, selectedWidth], () => {
  renderCanvas();
});

onMounted(() => {
  lockBodyScroll();
  window.addEventListener('keydown', onWindowKeydown);
  window.addEventListener('resize', configureCanvasSize);

  void nextTick(() => {
    modalCloseButton.value?.focus();
    configureCanvasSize();
    renderCanvas();
  });
});

onBeforeUnmount(() => {
  unlockBodyScroll();
  window.removeEventListener('keydown', onWindowKeydown);
  window.removeEventListener('resize', configureCanvasSize);
});
</script>

<template>
  <div class="app-modal-overlay" data-testid="whiteboard-modal-overlay" @click.self="closeModal">
    <section
      class="app-modal-panel app-modal-panel--lg"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="panelTitleId"
      data-testid="whiteboard-modal"
    >
      <header class="app-modal-header">
        <div>
          <p class="section-kicker">Pizarra en vivo</p>
          <h3 :id="panelTitleId" class="mt-1 text-lg font-semibold text-slate-100">
            {{ monitorLabel }}
          </h3>
          <p class="text-xs text-slate-300/85">{{ monitorResolutionLabel }}</p>
        </div>
        <button
          ref="modalCloseButton"
          type="button"
          class="app-modal-close-btn"
          aria-label="Cerrar pizarra"
          data-testid="whiteboard-modal-close"
          @click="closeModal"
        >
          <XMarkIcon aria-hidden="true" class="h-4 w-4" />
        </button>
      </header>

      <div class="app-modal-body space-y-4">
        <div class="whiteboard-toolbar" role="toolbar" aria-label="Herramientas de pizarra" data-testid="whiteboard-toolbar">
          <div class="whiteboard-toolbar-group" role="group" aria-label="Herramientas de dibujo">
            <button
              v-for="toolOption in TOOL_OPTIONS"
              :key="toolOption.value"
              type="button"
              class="whiteboard-toolbar-btn"
              :class="{ 'whiteboard-toolbar-btn--active': activeTool === toolOption.value }"
              :aria-label="toolOption.label"
              :aria-pressed="activeTool === toolOption.value"
              :data-testid="`whiteboard-tool-${toolOption.value}`"
              @click="selectTool(toolOption.value)"
            >
              <svg v-if="toolOption.value === 'draw'" aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M5 19l4-1 9-9-3-3-9 9-1 4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M14.5 6.5l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              <svg v-else-if="toolOption.value === 'line'" aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M4 18L20 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <svg v-else-if="toolOption.value === 'arrow'" aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M4 18L20 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M15 6h5v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else-if="toolOption.value === 'rect'" aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <rect x="4.5" y="6" width="15" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="1.8" />
              </svg>
              <svg v-else-if="toolOption.value === 'circle'" aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <ellipse cx="12" cy="12" rx="7" ry="5.5" fill="none" stroke="currentColor" stroke-width="1.8" />
              </svg>
              <svg v-else aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M6 7h12M8.5 10h7M10 13h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M9 6l-2 12h10L15 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              </svg>
              <span>{{ toolOption.label }}</span>
            </button>
          </div>

          <div class="whiteboard-toolbar-group" role="group" aria-label="Ajustes de trazo">
            <label class="whiteboard-toolbar-control" for="whiteboard-color">
              <span class="whiteboard-toolbar-control-label">Color</span>
              <input
                id="whiteboard-color"
                v-model="selectedColor"
                data-testid="whiteboard-color-input"
                type="color"
                class="whiteboard-toolbar-color-input"
                :disabled="activeTool === 'erase'"
              />
            </label>
            <label class="whiteboard-toolbar-control whiteboard-toolbar-control--width" for="whiteboard-width">
              <span class="whiteboard-toolbar-control-label">Grosor {{ selectedWidth }} px</span>
              <input
                id="whiteboard-width"
                v-model.number="selectedWidth"
                data-testid="whiteboard-width-input"
                type="range"
                min="1"
                max="48"
                class="whiteboard-toolbar-range"
              />
            </label>
          </div>

          <div class="whiteboard-toolbar-group" role="group" aria-label="Acciones">
            <button
              type="button"
              class="whiteboard-toolbar-btn"
              aria-label="Deshacer ultimo trazo"
              data-testid="whiteboard-undo"
              @click="onUndo"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M8 9L4 13l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M5 13h8a5 5 0 010 10h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span>Undo</span>
            </button>
            <button
              type="button"
              class="whiteboard-toolbar-btn whiteboard-toolbar-btn--danger"
              aria-label="Limpiar pizarra"
              data-testid="whiteboard-clear"
              @click="onClear"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M4 6h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M8 6l1 13h6l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M10 10v6M14 10v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
              <span>Limpiar</span>
            </button>
          </div>
        </div>

        <div
          ref="canvasHost"
          class="whiteboard-editor-stage"
          :style="{ aspectRatio: monitorResolutionLabel.replace('x', ' / ') }"
          data-testid="whiteboard-canvas-stage"
        >
          <img
            v-if="referenceImageDataUrl"
            :src="referenceImageDataUrl"
            :alt="`Referencia de ${monitorLabel}`"
            class="whiteboard-editor-reference"
          />
          <div v-else class="whiteboard-editor-empty">Sin miniatura de referencia. Puedes dibujar igualmente.</div>

          <canvas
            ref="drawingCanvas"
            class="whiteboard-editor-canvas"
            :class="canvasCursorClass"
            data-testid="whiteboard-canvas"
            @pointerdown="startDrawing"
            @pointermove="continueDrawing"
            @pointerup="stopDrawing"
            @pointerleave="stopDrawing"
            @pointercancel="stopDrawing"
          />
        </div>
      </div>

      <footer class="app-modal-footer">
        <p class="text-xs text-slate-300/90">
          Click y arrastra para dibujar o previsualizar formas antes de soltarlas.
        </p>
      </footer>
    </section>
  </div>
</template>
