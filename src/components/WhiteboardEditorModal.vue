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
const monitorAspectRatio = computed(() => {
  const match = props.monitorResolutionLabel.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) {
    return 16 / 9;
  }

  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 16 / 9;
  }

  return width / height;
});
const canvasHost = ref<HTMLElement | null>(null);
const drawingCanvas = ref<HTMLCanvasElement | null>(null);
const modalCloseButton = ref<HTMLButtonElement | null>(null);
const widthPopoverWrap = ref<HTMLElement | null>(null);
const widthPopoverButton = ref<HTMLButtonElement | null>(null);
const widthPopoverPanel = ref<HTMLElement | null>(null);
const widthPopoverPosition = ref<{ top: number; left: number; minWidth: number } | null>(null);
const isPointerDown = ref(false);
const isShiftPressed = ref(false);
const isWidthPopoverOpen = ref(false);
const lastPointerPoint = ref<WhiteboardPoint | null>(null);
const bodyScrollSnapshot = ref<{ overflow: string; paddingRight: string } | null>(null);
const WIDTH_PRESET_OPTIONS = [2, 4, 8, 12, 16, 24, 32, 48] as const;
const WIDTH_POPOVER_OFFSET_PX = 8;
const WIDTH_POPOVER_VIEWPORT_PADDING_PX = 8;

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

const closeWidthPopover = () => {
  isWidthPopoverOpen.value = false;
};

const toggleWidthPopover = () => {
  isWidthPopoverOpen.value = !isWidthPopoverOpen.value;
};

const widthPopoverStyle = computed(() => {
  if (!widthPopoverPosition.value) {
    return {
      visibility: 'hidden'
    };
  }

  return {
    top: `${widthPopoverPosition.value.top}px`,
    left: `${widthPopoverPosition.value.left}px`,
    minWidth: `${widthPopoverPosition.value.minWidth}px`
  };
});

const updateWidthPopoverPosition = () => {
  if (!isWidthPopoverOpen.value || !widthPopoverButton.value) {
    return;
  }

  const buttonRect = widthPopoverButton.value.getBoundingClientRect();
  const panel = widthPopoverPanel.value;
  const panelWidth = panel?.offsetWidth ?? buttonRect.width;
  const panelHeight = panel?.offsetHeight ?? 0;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredTop = buttonRect.bottom + WIDTH_POPOVER_OFFSET_PX;
  const maxLeft = Math.max(
    WIDTH_POPOVER_VIEWPORT_PADDING_PX,
    viewportWidth - panelWidth - WIDTH_POPOVER_VIEWPORT_PADDING_PX
  );
  const clampedLeft = Math.min(Math.max(buttonRect.left, WIDTH_POPOVER_VIEWPORT_PADDING_PX), maxLeft);
  const fitsBelow = preferredTop + panelHeight <= viewportHeight - WIDTH_POPOVER_VIEWPORT_PADDING_PX;
  const top = fitsBelow
    ? preferredTop
    : Math.max(
        WIDTH_POPOVER_VIEWPORT_PADDING_PX,
        buttonRect.top - panelHeight - WIDTH_POPOVER_OFFSET_PX
      );

  widthPopoverPosition.value = {
    top,
    left: clampedLeft,
    minWidth: buttonRect.width
  };
};

const selectWidth = (value: number) => {
  selectedWidth.value = value;
  closeWidthPopover();
};

const toCanvasPoint = (point: WhiteboardPoint, width: number, height: number) => ({
  x: point.x * width,
  y: point.y * height
});

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const shouldLockAspectRatio = (tool: WhiteboardTool) => tool === 'rect' || tool === 'circle';
const shouldSnapLineAngle = (tool: WhiteboardTool) => tool === 'line' || tool === 'arrow';
const ANGLE_SNAP_STEP = Math.PI / 4;

const getConstrainedPoint = (point: WhiteboardPoint, shiftPressed: boolean): WhiteboardPoint => {
  const stroke = activeStroke.value;
  const canvas = drawingCanvas.value;
  if (!stroke || !canvas || !shiftPressed) {
    return point;
  }

  const start = stroke.points[0];
  if (!start) {
    return point;
  }

  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return point;
  }

  const dxPx = (point.x - start.x) * rect.width;
  const dyPx = (point.y - start.y) * rect.height;

  if (shouldSnapLineAngle(stroke.tool)) {
    const distancePx = Math.hypot(dxPx, dyPx);
    if (distancePx <= 0) {
      return point;
    }

    const snappedAngle = Math.round(Math.atan2(dyPx, dxPx) / ANGLE_SNAP_STEP) * ANGLE_SNAP_STEP;
    return {
      x: clamp01(start.x + (Math.cos(snappedAngle) * distancePx) / rect.width),
      y: clamp01(start.y + (Math.sin(snappedAngle) * distancePx) / rect.height)
    };
  }

  if (!shouldLockAspectRatio(stroke.tool)) {
    return point;
  }

  const sidePx = Math.max(Math.abs(dxPx), Math.abs(dyPx));
  if (sidePx <= 0) {
    return point;
  }

  const directionX = dxPx < 0 ? -1 : 1;
  const directionY = dyPx < 0 ? -1 : 1;

  return {
    x: clamp01(start.x + (directionX * sidePx) / rect.width),
    y: clamp01(start.y + (directionY * sidePx) / rect.height)
  };
};

const syncLivePreviewState = () => {
  emit('stateChange', props.monitorId, sanitizeWhiteboardState({ strokes: editableStrokes.value }));
  renderCanvas();
};

const updateActivePoint = (point: WhiteboardPoint, shiftPressed: boolean, syncPreview: boolean) => {
  appendPoint(getConstrainedPoint(point, shiftPressed));
  if (syncPreview) {
    syncLivePreviewState();
  }
};

const refreshShiftConstrainedPreview = () => {
  if (!isPointerDown.value || !lastPointerPoint.value) {
    return;
  }

  updateActivePoint(lastPointerPoint.value, isShiftPressed.value, true);
};

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
  isShiftPressed.value = event.shiftKey;
  lastPointerPoint.value = point;
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

  isShiftPressed.value = event.shiftKey;
  lastPointerPoint.value = point;
  updateActivePoint(point, event.shiftKey, true);
  event.preventDefault();
};

const stopDrawing = (event?: PointerEvent) => {
  if (!isPointerDown.value) {
    return;
  }

  if (event) {
    const point = toPointFromPointer(event);
    if (point) {
      isShiftPressed.value = event.shiftKey;
      lastPointerPoint.value = point;
      updateActivePoint(point, event.shiftKey, false);
    }
  }

  isPointerDown.value = false;
  lastPointerPoint.value = null;
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
  if (event.key === 'Shift') {
    if (!isShiftPressed.value) {
      isShiftPressed.value = true;
      refreshShiftConstrainedPreview();
    }
    return;
  }

  if (event.key === 'Escape') {
    if (isWidthPopoverOpen.value) {
      closeWidthPopover();
      return;
    }

    closeModal();
  }
};

const onWindowPointerDown = (event: PointerEvent) => {
  if (!isWidthPopoverOpen.value) {
    return;
  }

  const target = event.target;
  if (!(target instanceof Node)) {
    return;
  }

  if (
    widthPopoverWrap.value?.contains(target) ||
    widthPopoverButton.value?.contains(target) ||
    widthPopoverPanel.value?.contains(target)
  ) {
    return;
  }

  closeWidthPopover();
};

const onWindowKeyup = (event: KeyboardEvent) => {
  if (event.key !== 'Shift') {
    return;
  }

  if (!isShiftPressed.value) {
    return;
  }

  isShiftPressed.value = false;
  refreshShiftConstrainedPreview();
};

const onWindowLayoutChange = () => {
  updateWidthPopoverPosition();
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

watch(isWidthPopoverOpen, (isOpen) => {
  if (!isOpen) {
    widthPopoverPosition.value = null;
    return;
  }

  void nextTick(() => {
    updateWidthPopoverPosition();
  });
});

onMounted(() => {
  lockBodyScroll();
  window.addEventListener('keydown', onWindowKeydown);
  window.addEventListener('keyup', onWindowKeyup);
  window.addEventListener('pointerdown', onWindowPointerDown);
  window.addEventListener('scroll', onWindowLayoutChange, true);
  window.addEventListener('resize', configureCanvasSize);
  window.addEventListener('resize', onWindowLayoutChange);

  void nextTick(() => {
    modalCloseButton.value?.focus();
    configureCanvasSize();
    renderCanvas();
  });
});

onBeforeUnmount(() => {
  unlockBodyScroll();
  window.removeEventListener('keydown', onWindowKeydown);
  window.removeEventListener('keyup', onWindowKeyup);
  window.removeEventListener('pointerdown', onWindowPointerDown);
  window.removeEventListener('scroll', onWindowLayoutChange, true);
  window.removeEventListener('resize', configureCanvasSize);
  window.removeEventListener('resize', onWindowLayoutChange);
});
</script>

<template>
  <div class="app-modal-overlay" data-testid="whiteboard-modal-overlay" @click.self="closeModal">
    <section
      class="app-modal-panel app-modal-panel--xl app-modal-panel--tall"
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

      <div class="app-modal-body app-modal-body--whiteboard">
        <div
          class="whiteboard-toolbar whiteboard-toolbar--single-line"
          role="toolbar"
          aria-label="Herramientas de pizarra"
          data-testid="whiteboard-toolbar"
        >
          <div class="whiteboard-toolbar-track" data-testid="whiteboard-toolbar-track">
            <button
              v-for="toolOption in TOOL_OPTIONS"
              :key="toolOption.value"
              type="button"
              class="whiteboard-toolbar-btn"
              :class="{ 'whiteboard-toolbar-btn--active': activeTool === toolOption.value }"
              :aria-label="toolOption.label"
              :title="toolOption.label"
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
            </button>

            <label class="whiteboard-toolbar-color-chip" for="whiteboard-color" title="Color de trazo">
              <span class="sr-only">Color de trazo</span>
              <input
                id="whiteboard-color"
                v-model="selectedColor"
                data-testid="whiteboard-color-input"
                type="color"
                class="whiteboard-toolbar-color-input"
                aria-label="Color de trazo"
                :disabled="activeTool === 'erase'"
              />
            </label>

            <div ref="widthPopoverWrap" class="whiteboard-toolbar-popover-wrap">
              <button
                ref="widthPopoverButton"
                type="button"
                class="whiteboard-toolbar-btn"
                :class="{ 'whiteboard-toolbar-btn--active': isWidthPopoverOpen }"
                :aria-label="`Grosor actual ${selectedWidth} px`"
                :title="`Grosor actual ${selectedWidth} px`"
                :aria-expanded="isWidthPopoverOpen"
                aria-haspopup="dialog"
                data-testid="whiteboard-width-toggle"
                @click="toggleWidthPopover"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                  <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-linecap="round" :stroke-width="Math.max(1, selectedWidth / 8)" />
                </svg>
              </button>

            </div>

            <button
              type="button"
              class="whiteboard-toolbar-btn"
              aria-label="Deshacer ultimo trazo"
              title="Deshacer ultimo trazo"
              data-testid="whiteboard-undo"
              @click="onUndo"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M8 9L4 13l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M5 13h8a5 5 0 010 10h-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
            </button>
            <button
              type="button"
              class="whiteboard-toolbar-btn whiteboard-toolbar-btn--danger"
              aria-label="Limpiar pizarra"
              title="Limpiar pizarra"
              data-testid="whiteboard-clear"
              @click="onClear"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M4 6h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                <path d="M8 6l1 13h6l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <path d="M10 10v6M14 10v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <Teleport to="body">
          <div
            v-if="isWidthPopoverOpen"
            ref="widthPopoverPanel"
            class="whiteboard-toolbar-popover whiteboard-toolbar-popover--floating"
            :style="widthPopoverStyle"
            role="dialog"
            aria-label="Seleccionar grosor"
            data-testid="whiteboard-width-popover"
          >
            <button
              v-for="widthOption in WIDTH_PRESET_OPTIONS"
              :key="widthOption"
              type="button"
              class="whiteboard-width-option"
              :class="{ 'whiteboard-width-option--active': selectedWidth === widthOption }"
              :aria-label="`Grosor ${widthOption} px`"
              :title="`Grosor ${widthOption} px`"
              :aria-pressed="selectedWidth === widthOption"
              :data-testid="`whiteboard-width-option-${widthOption}`"
              @click="selectWidth(widthOption)"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" class="whiteboard-toolbar-icon">
                <path d="M4 12h16" fill="none" stroke="currentColor" stroke-linecap="round" :stroke-width="Math.max(1, widthOption / 2)" />
              </svg>
            </button>
          </div>
        </Teleport>

        <div class="whiteboard-editor-workspace">
          <div
            ref="canvasHost"
            class="whiteboard-editor-stage"
            :style="{ '--whiteboard-stage-aspect-ratio': `${monitorAspectRatio}` }"
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
      </div>

      <footer class="app-modal-footer">
        <p class="text-xs text-slate-300/90">
          Click y arrastra para dibujar o previsualizar formas antes de soltarlas.
        </p>
      </footer>
    </section>
  </div>
</template>
