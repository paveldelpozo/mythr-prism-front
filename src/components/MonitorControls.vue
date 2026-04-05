<script setup lang="ts">
import {
  AdjustmentsHorizontalIcon,
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ArrowsPointingOutIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BoltIcon,
  GlobeAltIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  PaintBrushIcon,
  PhotoIcon,
  RectangleGroupIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppFileDropzone from './ui/AppFileDropzone.vue';
import type { MonitorRuntimeState } from '../types/broadcaster';
import {
  CONTENT_TRANSITION_TYPES,
  TRANSITION_DURATION_MAX_MS,
  TRANSITION_DURATION_MIN_MS,
  type ContentTransition,
  type ContentTransitionType
} from '../types/transitions';

type ImageImportFailureReason = 'empty' | 'not-image';
type SourceTabId = 'local-image' | 'external-url' | 'external-app';

const SOURCE_TABS: Array<{ id: SourceTabId; label: string }> = [
  { id: 'local-image', label: 'Imagen local' },
  { id: 'external-url', label: 'URL externa' },
  { id: 'external-app', label: 'Aplicacion externa' }
];

const props = withDefaults(defineProps<{
  monitorId: string;
  state: MonitorRuntimeState;
  showMonitorUtilities?: boolean;
  showFullscreenAction?: boolean;
  isFileImportBlocked?: boolean;
  fileImportBlockedMessage?: string;
}>(), {
  showFullscreenAction: true
});

type ImageImportSource = 'file-picker' | 'drag-drop' | 'paste';

const emit = defineEmits<{
  uploadImage: [monitorId: string, file: File, source: ImageImportSource];
  clearImage: [monitorId: string];
  transform: [
    monitorId: string,
    action: { type: 'rotate'; value: number } | { type: 'scale'; value: number } | { type: 'move'; value: { x?: number; y?: number } } | { type: 'reset' }
  ];
  requestFullscreen: [monitorId: string];
  closeWindow: [monitorId: string];
  openWhiteboard: [monitorId: string];
  flashMonitorId: [monitorId: string];
  setContentTransition: [monitorId: string, transition: ContentTransition];
  assignExternalUrl: [monitorId: string, url: string];
  reloadExternalUrl: [monitorId: string];
  clearExternalUrl: [monitorId: string];
  navigateExternalUrl: [monitorId: string, direction: 'back' | 'forward'];
  startExternalAppCapture: [monitorId: string];
  stopExternalAppCapture: [monitorId: string];
}>();

const imageImportFeedback = ref<string | null>(null);
const externalUrlFeedback = ref<string | null>(null);
const externalUrlDraft = ref('');
const isSourceModalOpen = ref(false);
const activeSourceTab = ref<SourceTabId>('local-image');
const isContentEditorModalOpen = ref(false);
const sourceModalTitleId = computed(() => `monitor-source-modal-title-${props.monitorId}`);
const sourceModalTabListId = computed(() => `monitor-source-tablist-${props.monitorId}`);
const contentEditorModalTitleId = computed(() => `monitor-content-editor-title-${props.monitorId}`);
const sourceModalTriggerButton = ref<HTMLButtonElement | null>(null);
const contentEditorTriggerButton = ref<HTMLButtonElement | null>(null);
const bodyScrollSnapshot = ref<{
  overflow: string;
  paddingRight: string;
} | null>(null);
const effectiveFileImportBlocked = computed(() => props.isFileImportBlocked);
const effectiveFileImportBlockedMessage = computed(() =>
  props.fileImportBlockedMessage ?? 'Para importar archivo, sal del fullscreen o usa Drag & Drop / pegar imagen.'
);
const onTransitionTypeChange = (event: Event) => {
  const nextType = (event.target as HTMLSelectElement).value as ContentTransitionType;
  if (!CONTENT_TRANSITION_TYPES.includes(nextType)) {
    return;
  }

  emit('setContentTransition', props.monitorId, {
    type: nextType,
    durationMs: props.state.contentTransition.durationMs
  });
};

const onTransitionDurationInput = (event: Event) => {
  const rawValue = Number((event.target as HTMLInputElement).value);
  const fallback = props.state.contentTransition.durationMs;
  const safeValue = Number.isFinite(rawValue)
    ? Math.max(TRANSITION_DURATION_MIN_MS, Math.min(TRANSITION_DURATION_MAX_MS, Math.round(rawValue)))
    : fallback;

  emit('setContentTransition', props.monitorId, {
    type: props.state.contentTransition.type,
    durationMs: safeValue
  });
};

const activeExternalUrl = computed(() =>
  props.state.activeMediaItem?.kind === 'external-url'
    ? props.state.activeMediaItem.source
    : null
);

watch(activeExternalUrl, (nextUrl) => {
  externalUrlDraft.value = nextUrl ?? '';
}, {
  immediate: true
});

const assignExternalUrl = () => {
  const nextUrl = externalUrlDraft.value.trim();
  emit('assignExternalUrl', props.monitorId, nextUrl);
  externalUrlFeedback.value = nextUrl.length > 0
    ? 'Solicitud enviada para cargar URL externa.'
    : 'Ingresa una URL valida para continuar.';
};

const reloadExternalUrl = () => {
  emit('reloadExternalUrl', props.monitorId);
};

const clearExternalUrl = () => {
  externalUrlDraft.value = '';
  emit('clearExternalUrl', props.monitorId);
};

const navigateExternalUrl = (direction: 'back' | 'forward') => {
  emit('navigateExternalUrl', props.monitorId, direction);
};

const feedbackForFailureReason = (reason: ImageImportFailureReason): string =>
  reason === 'not-image'
    ? 'El archivo seleccionado no es una imagen valida.'
    : 'No se detecto ninguna imagen para importar.';

const clearImageImportFeedback = () => {
  imageImportFeedback.value = null;
};

const emitImageFile = (file: File, source: ImageImportSource) => {
  emit('uploadImage', props.monitorId, file, source);
  imageImportFeedback.value = `Imagen "${file.name}" lista para proyectar.`;
};

const onImageFilesSelected = (files: File[], source: ImageImportSource) => {
  const file = files[0] ?? null;
  if (!file) {
    imageImportFeedback.value = feedbackForFailureReason('empty');
    return;
  }

  if (!file.type.startsWith('image/')) {
    imageImportFeedback.value = feedbackForFailureReason('not-image');
    return;
  }

  emitImageFile(file, source);
};

const onImageDropzoneError = (message: string) => {
  imageImportFeedback.value = message;
};

const onImageDropzoneCleared = () => {
  imageImportFeedback.value = null;
  emit('clearImage', props.monitorId);
};

const fullscreenActionLabel = computed(() => {
  if (!props.state.isFullscreen && props.state.fullscreenIntentActive) {
    return 'Reactivar fullscreen';
  }

  return 'Solicitar fullscreen';
});

const externalAppCaptureFeedback = computed(() => {
  if (props.state.isExternalAppCapturePending) {
    return 'Selector nativo abierto: elige la app/pestana a retransmitir.';
  }

  if (props.state.isExternalAppCaptureActive) {
    return 'Captura externa activa en este monitor.';
  }

  return 'Sin captura externa activa.';
});

const sourceTabButtonId = (tabId: SourceTabId): string =>
  `monitor-source-tab-${props.monitorId}-${tabId}`;

const sourceTabPanelId = (tabId: SourceTabId): string =>
  `monitor-source-panel-${props.monitorId}-${tabId}`;

const resolveDefaultSourceTab = (): SourceTabId => {
  if (props.state.isExternalAppCapturePending || props.state.isExternalAppCaptureActive) {
    return 'external-app';
  }

  if (props.state.activeMediaItem?.kind === 'external-url') {
    return 'external-url';
  }

  return 'local-image';
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

const openContentEditorModal = () => {
  isContentEditorModalOpen.value = true;
};

const closeContentEditorModal = () => {
  isContentEditorModalOpen.value = false;
  void nextTick(() => {
    contentEditorTriggerButton.value?.focus();
  });
};

const openSourceModal = () => {
  activeSourceTab.value = resolveDefaultSourceTab();
  isSourceModalOpen.value = true;
};

const closeSourceModal = () => {
  isSourceModalOpen.value = false;
  void nextTick(() => {
    sourceModalTriggerButton.value?.focus();
  });
};

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (isSourceModalOpen.value) {
    closeSourceModal();
    return;
  }

  if (isContentEditorModalOpen.value) {
    closeContentEditorModal();
  }
};

watch(() => isSourceModalOpen.value || isContentEditorModalOpen.value, (isOpen) => {
  if (isOpen) {
    lockBodyScroll();
    return;
  }

  unlockBodyScroll();
});

onMounted(() => {
  window.addEventListener('keydown', onWindowKeydown);
});

onBeforeUnmount(() => {
  unlockBodyScroll();
  window.removeEventListener('keydown', onWindowKeydown);
});
</script>

<template>
  <div class="space-y-4">
    <div class="monitor-action-toolbar" data-testid="monitor-action-toolbar">
      <div class="monitor-action-toolbar-group" data-testid="monitor-action-toolbar-left">
        <button
          v-if="showMonitorUtilities"
          ref="sourceModalTriggerButton"
          type="button"
          class="btn-with-icon btn-sm btn-slate-soft monitor-source-btn"
          data-testid="monitor-open-source-modal"
          title="Seleccionar fuente"
          aria-label="Seleccionar fuente"
          @click="openSourceModal"
        >
          <PhotoIcon aria-hidden="true" class="btn-icon" />
          Fuentes
        </button>

        <button
          v-if="showMonitorUtilities"
          type="button"
          class="monitor-action-btn btn-emerald-soft"
          data-testid="monitor-open-whiteboard"
          :disabled="!state.isWindowOpen"
          :title="state.isWindowOpen ? 'Abrir pizarra' : 'Abre la ventana del monitor para usar la pizarra'"
          :aria-label="state.isWindowOpen ? 'Abrir pizarra' : 'Abrir pizarra (deshabilitado: ventana cerrada)'"
          @click="emit('openWhiteboard', monitorId)"
        >
          <PaintBrushIcon aria-hidden="true" class="btn-icon" />
        </button>

        <button
          v-if="showMonitorUtilities"
          type="button"
          class="monitor-action-btn btn-indigo-soft"
          data-testid="monitor-flash-id"
          :disabled="!state.isWindowOpen"
          :title="state.isWindowOpen ? 'Destacar pantalla para identificar monitor' : 'Abre la ventana del monitor para identificarlo'"
          :aria-label="state.isWindowOpen ? 'Identificar monitor' : 'Identificar monitor (deshabilitado: ventana cerrada)'"
          @click="emit('flashMonitorId', monitorId)"
        >
          <BoltIcon aria-hidden="true" class="btn-icon" />
        </button>
      </div>

      <div class="monitor-action-toolbar-group monitor-action-toolbar-group--end" data-testid="monitor-action-toolbar-right">
        <button
          ref="contentEditorTriggerButton"
          type="button"
          data-testid="monitor-open-content-editor"
          class="monitor-action-btn btn-slate-soft"
          title="Editar contenido"
          aria-label="Editar contenido"
          @click="openContentEditorModal"
        >
          <AdjustmentsHorizontalIcon aria-hidden="true" class="btn-icon" />
        </button>

        <button
          v-if="showFullscreenAction !== false"
          type="button"
          data-testid="monitor-request-fullscreen"
          class="monitor-action-btn btn-indigo-soft"
          :title="fullscreenActionLabel"
          :aria-label="fullscreenActionLabel"
          @click="emit('requestFullscreen', monitorId)"
        >
          <ArrowsPointingOutIcon aria-hidden="true" class="btn-icon" />
        </button>

        <button
          type="button"
          data-testid="monitor-close-window"
          class="monitor-action-btn btn-rose-soft"
          title="Cerrar ventana"
          aria-label="Cerrar ventana"
          @click="emit('closeWindow', monitorId)"
        >
          <XMarkIcon aria-hidden="true" class="btn-icon" />
        </button>
      </div>
    </div>

    <div
      v-if="isSourceModalOpen"
      data-testid="monitor-source-modal-overlay"
      class="app-modal-overlay"
      @click.self="closeSourceModal"
    >
      <section
        data-testid="monitor-source-modal"
        class="app-modal-panel app-modal-panel--md"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="sourceModalTitleId"
      >
        <header class="app-modal-header">
          <div>
            <p class="section-kicker">Contenido del monitor</p>
            <h3 :id="sourceModalTitleId" class="mt-1 text-lg font-semibold text-slate-100">
              Seleccionar fuente
            </h3>
          </div>
          <button
            type="button"
            class="app-modal-close-btn"
            data-testid="monitor-source-modal-close"
            aria-label="Cerrar selector de fuente"
            @click="closeSourceModal"
          >
            <XMarkIcon aria-hidden="true" class="h-4 w-4" />
          </button>
        </header>

        <div class="app-modal-body">
          <div
            :id="sourceModalTabListId"
            class="monitor-source-tabs"
            role="tablist"
            aria-label="Tipos de fuente"
          >
            <button
              v-for="tab in SOURCE_TABS"
              :id="sourceTabButtonId(tab.id)"
              :key="tab.id"
              type="button"
              role="tab"
              class="app-tab-btn btn-sm"
              :class="activeSourceTab === tab.id ? 'app-tab-btn--active' : 'app-tab-btn--inactive'"
              :aria-selected="activeSourceTab === tab.id"
              :aria-controls="sourceTabPanelId(tab.id)"
              :tabindex="activeSourceTab === tab.id ? 0 : -1"
              :data-testid="`monitor-source-tab-${tab.id}`"
              @click="activeSourceTab = tab.id"
            >
              <PhotoIcon v-if="tab.id === 'local-image'" aria-hidden="true" class="btn-icon" />
              <GlobeAltIcon v-else-if="tab.id === 'external-url'" aria-hidden="true" class="btn-icon" />
              <RectangleGroupIcon v-else aria-hidden="true" class="btn-icon" />
              {{ tab.label }}
            </button>
          </div>

          <section
            v-if="activeSourceTab === 'local-image'"
            :id="sourceTabPanelId('local-image')"
            role="tabpanel"
            :aria-labelledby="sourceTabButtonId('local-image')"
            data-testid="monitor-source-panel-local-image"
            class="surface-panel mt-3 space-y-2"
          >
            <label class="section-kicker-muted block text-[11px]">Imagen local</label>
            <p
              v-if="effectiveFileImportBlocked"
              data-testid="monitor-file-import-blocked-feedback"
              class="text-xs text-amber-200"
            >
              {{ effectiveFileImportBlockedMessage }}
            </p>
            <div class="w-full" @focusin="clearImageImportFeedback">
              <AppFileDropzone
                data-testid="monitor-image-drop-zone"
                accept="image/*"
                :multiple="false"
                :disable-picker="effectiveFileImportBlocked"
                pick-button-test-id="monitor-image-select-button"
                @files-selected="onImageFilesSelected"
                @cleared="onImageDropzoneCleared"
                @error="onImageDropzoneError"
              />
            </div>
            <p v-if="imageImportFeedback" data-testid="monitor-image-import-feedback" class="text-xs text-amber-200">
              {{ imageImportFeedback }}
            </p>
          </section>

          <section
            v-else-if="activeSourceTab === 'external-url'"
            :id="sourceTabPanelId('external-url')"
            role="tabpanel"
            :aria-labelledby="sourceTabButtonId('external-url')"
            data-testid="monitor-source-panel-external-url"
            class="surface-panel mt-3 space-y-2"
          >
            <label class="section-kicker-muted block text-[11px]">URL externa segura</label>
            <div class="flex flex-wrap items-center gap-2">
              <input
                v-model="externalUrlDraft"
                data-testid="monitor-external-url-input"
                type="text"
                class="form-control flex-1"
                placeholder="https://example.com"
              />
              <button
                type="button"
                data-testid="monitor-external-url-apply"
                class="btn-with-icon btn-sm btn-indigo-soft"
                @click="assignExternalUrl"
              >
                Cargar URL
              </button>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="monitor-external-url-back"
                class="btn-with-icon btn-sm btn-slate-soft"
                :disabled="!activeExternalUrl"
                @click="navigateExternalUrl('back')"
              >
                <ArrowLeftIcon aria-hidden="true" class="btn-icon" />
                Atras
              </button>
              <button
                type="button"
                data-testid="monitor-external-url-forward"
                class="btn-with-icon btn-sm btn-slate-soft"
                :disabled="!activeExternalUrl"
                @click="navigateExternalUrl('forward')"
              >
                <ArrowRightIcon aria-hidden="true" class="btn-icon" />
                Adelante
              </button>
              <button
                type="button"
                data-testid="monitor-external-url-reload"
                class="btn-with-icon btn-sm btn-emerald-soft"
                :disabled="!activeExternalUrl"
                @click="reloadExternalUrl"
              >
                <ArrowPathIcon aria-hidden="true" class="btn-icon" />
                Recargar
              </button>
            </div>

            <p
              v-if="externalUrlFeedback"
              data-testid="monitor-external-url-feedback"
              class="text-xs text-slate-300/90"
            >
              {{ externalUrlFeedback }}
            </p>
            <p
              v-if="state.lastError"
              data-testid="monitor-external-url-error"
              class="text-xs text-amber-200"
            >
              {{ state.lastError }}
            </p>
          </section>

          <section
            v-else
            :id="sourceTabPanelId('external-app')"
            role="tabpanel"
            :aria-labelledby="sourceTabButtonId('external-app')"
            data-testid="monitor-source-panel-external-app"
            class="surface-panel mt-3 space-y-2"
          >
            <label class="section-kicker-muted block text-[11px]">Aplicacion externa</label>
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="monitor-external-app-capture-start"
                class="btn-with-icon btn-sm btn-indigo-soft"
                :disabled="state.isExternalAppCapturePending"
                @click="emit('startExternalAppCapture', monitorId)"
              >
                <ArrowPathIcon aria-hidden="true" class="btn-icon" />
                Capturar App
              </button>
            </div>
            <p data-testid="monitor-external-app-capture-feedback" class="text-xs text-slate-300/90">
              {{ externalAppCaptureFeedback }}
            </p>
          </section>
        </div>

        <footer class="app-modal-footer">
          <button
            v-if="activeSourceTab === 'local-image'"
            type="button"
            data-testid="monitor-image-clear"
            class="btn-with-icon btn-sm btn-rose-soft"
            @click="emit('clearImage', monitorId)"
          >
            <TrashIcon aria-hidden="true" class="btn-icon" />
            Limpiar imagen
          </button>

          <button
            v-else-if="activeSourceTab === 'external-url'"
            type="button"
            data-testid="monitor-external-url-clear"
            class="btn-with-icon btn-sm btn-rose-soft"
            :disabled="!activeExternalUrl"
            @click="clearExternalUrl"
          >
            <TrashIcon aria-hidden="true" class="btn-icon" />
            Detener URL
          </button>

          <button
            v-else
            type="button"
            data-testid="monitor-external-app-capture-stop"
            class="btn-with-icon btn-sm btn-rose-soft"
            :disabled="!state.isExternalAppCaptureActive && !state.isExternalAppCapturePending"
            @click="emit('stopExternalAppCapture', monitorId)"
          >
            <TrashIcon aria-hidden="true" class="btn-icon" />
            Detener captura
          </button>
        </footer>
      </section>
    </div>

    <div
      v-if="isContentEditorModalOpen"
      data-testid="monitor-content-editor-overlay"
      class="app-modal-overlay"
      @click.self="closeContentEditorModal"
    >
      <section
        data-testid="monitor-content-editor-modal"
        class="app-modal-panel app-modal-panel--lg"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="contentEditorModalTitleId"
      >
        <header class="app-modal-header">
          <div>
            <p class="section-kicker">Contenido en pantalla</p>
            <h3 :id="contentEditorModalTitleId" class="mt-1 text-lg font-semibold text-slate-100">
              Editar posicion, escala y rotacion
            </h3>
          </div>
          <button
            type="button"
            class="app-modal-close-btn"
            data-testid="monitor-content-editor-close"
            aria-label="Cerrar editor de contenido"
            @click="closeContentEditorModal"
          >
            <XMarkIcon aria-hidden="true" class="h-4 w-4" />
          </button>
        </header>

        <div class="app-modal-body space-y-4">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="surface-panel">
              <p class="section-kicker-muted mb-2 text-[11px]">Rotacion</p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  data-testid="monitor-content-rotate-left"
                  class="control-btn btn-with-icon"
                  type="button"
                  @click="emit('transform', monitorId, { type: 'rotate', value: -90 })"
                >
                  <ArrowUturnLeftIcon aria-hidden="true" class="btn-icon" />
                  Rotar -90
                </button>
                <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'rotate', value: 90 })">
                  <ArrowUturnRightIcon aria-hidden="true" class="btn-icon" />
                  Rotar +90
                </button>
              </div>
            </div>

            <div class="surface-panel">
              <p class="section-kicker-muted mb-2 text-[11px]">Escala</p>
              <div class="grid grid-cols-3 gap-2">
                <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'scale', value: -0.1 })">
                  <MagnifyingGlassMinusIcon aria-hidden="true" class="btn-icon" />
                  Reducir
                </button>
                <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'reset' })">
                  <ArrowPathIcon aria-hidden="true" class="btn-icon" />
                  Reset
                </button>
                <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'scale', value: 0.1 })">
                  <MagnifyingGlassPlusIcon aria-hidden="true" class="btn-icon" />
                  Aumentar
                </button>
              </div>
            </div>
          </div>

          <div class="surface-panel">
            <p class="section-kicker-muted mb-2 text-[11px]">Posicion</p>
            <div class="mx-auto grid w-full max-w-sm grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                data-testid="monitor-content-move-up"
                class="control-btn btn-with-icon"
                type="button"
                @click="emit('transform', monitorId, { type: 'move', value: { y: -40 } })"
              >
                <ArrowUpIcon aria-hidden="true" class="btn-icon" />
                Arriba
              </button>
              <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { y: 40 } })">
                <ArrowDownIcon aria-hidden="true" class="btn-icon" />
                Abajo
              </button>
              <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { x: -40 } })">
                <ArrowLeftIcon aria-hidden="true" class="btn-icon" />
                Izquierda
              </button>
              <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { x: 40 } })">
                <ArrowRightIcon aria-hidden="true" class="btn-icon" />
                Derecha
              </button>
            </div>
          </div>

          <div class="surface-panel">
            <p class="section-kicker-muted mb-2 text-[11px]">Transicion de contenido</p>
            <div class="grid gap-3 md:grid-cols-2">
              <label class="form-field text-xs" for="monitor-transition-type">
                Tipo
                <select
                  id="monitor-transition-type"
                  data-testid="monitor-transition-type"
                  class="form-control"
                  :value="state.contentTransition.type"
                  @change="onTransitionTypeChange"
                >
                  <option value="cut">Cut</option>
                  <option value="fade">Fade</option>
                  <option value="wipe">Wipe</option>
                </select>
              </label>
              <label class="form-field text-xs" for="monitor-transition-duration">
                Duracion (ms)
                <input
                  id="monitor-transition-duration"
                  data-testid="monitor-transition-duration"
                  type="number"
                  class="form-control"
                  :min="TRANSITION_DURATION_MIN_MS"
                  :max="TRANSITION_DURATION_MAX_MS"
                  :value="state.contentTransition.durationMs"
                  @input="onTransitionDurationInput"
                />
              </label>
            </div>
            <p class="mt-2 text-xs text-slate-300/85">
              Rango recomendado: {{ TRANSITION_DURATION_MIN_MS }}-{{ TRANSITION_DURATION_MAX_MS }} ms.
            </p>
          </div>

          <p class="text-xs text-slate-300/80">
            Transform: scale {{ state.transform.scale.toFixed(2) }} | rotate {{ state.transform.rotate }}deg | x {{ state.transform.translateX }} | y {{ state.transform.translateY }}
          </p>
        </div>

        <footer class="app-modal-footer">
          <button
            type="button"
            class="btn-with-icon btn-sm btn-slate-soft"
            data-testid="monitor-content-editor-reset"
            @click="emit('transform', monitorId, { type: 'reset' })"
          >
            <ArrowPathIcon aria-hidden="true" class="btn-icon" />
            Restablecer transformacion
          </button>
        </footer>
      </section>
    </div>
  </div>
</template>
