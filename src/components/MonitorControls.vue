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
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MonitorRuntimeState } from '../types/broadcaster';
import {
  CONTENT_TRANSITION_TYPES,
  TRANSITION_DURATION_MAX_MS,
  TRANSITION_DURATION_MIN_MS,
  type ContentTransition,
  type ContentTransitionType
} from '../types/transitions';
import {
  pickImageFromClipboard,
  pickImageFromDataTransfer,
  pickImageFromFileList,
  type ImageImportFailureReason
} from '../utils/imageFileImport';

const props = defineProps<{
  monitorId: string;
  state: MonitorRuntimeState;
  isFileImportBlocked?: boolean;
  fileImportBlockedMessage?: string;
}>();

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
  setContentTransition: [monitorId: string, transition: ContentTransition];
}>();

const imageImportFeedback = ref<string | null>(null);
const isImageDropZoneActive = ref(false);
const imageDropZoneDragDepth = ref(0);
const isContentEditorModalOpen = ref(false);
const contentEditorModalTitleId = computed(() => `monitor-content-editor-title-${props.monitorId}`);
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

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (effectiveFileImportBlocked.value) {
    imageImportFeedback.value = effectiveFileImportBlockedMessage.value;
    target.value = '';
    return;
  }

  const selection = pickImageFromFileList(target.files);
  if (!selection.file) {
    imageImportFeedback.value = feedbackForFailureReason(selection.reason ?? 'empty');
    target.value = '';
    return;
  }

  emitImageFile(selection.file, 'file-picker');
  target.value = '';
};

const resetImageDropZoneState = () => {
  imageDropZoneDragDepth.value = 0;
  isImageDropZoneActive.value = false;
};

const onImageDragEnter = (event: DragEvent) => {
  event.preventDefault();
  imageDropZoneDragDepth.value += 1;
  isImageDropZoneActive.value = true;
};

const onImageDragOver = (event: DragEvent) => {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy';
  }

  isImageDropZoneActive.value = true;
};

const onImageDragLeave = (event: DragEvent) => {
  event.preventDefault();
  imageDropZoneDragDepth.value = Math.max(0, imageDropZoneDragDepth.value - 1);
  if (imageDropZoneDragDepth.value === 0) {
    isImageDropZoneActive.value = false;
  }
};

const onImageDrop = (event: DragEvent) => {
  event.preventDefault();
  resetImageDropZoneState();

  const selection = pickImageFromDataTransfer(event.dataTransfer);
  if (!selection.file) {
    imageImportFeedback.value = feedbackForFailureReason(selection.reason ?? 'empty');
    return;
  }

  emitImageFile(selection.file, 'drag-drop');
};

const onImagePaste = (event: ClipboardEvent) => {
  resetImageDropZoneState();

  const selection = pickImageFromClipboard(event.clipboardData);
  if (!selection.file) {
    imageImportFeedback.value = feedbackForFailureReason(selection.reason ?? 'empty');
    return;
  }

  event.preventDefault();
  emitImageFile(selection.file, 'paste');
};

const fullscreenActionLabel = computed(() => {
  if (!props.state.isFullscreen && props.state.fullscreenIntentActive) {
    return 'Reactivar fullscreen';
  }

  return 'Solicitar fullscreen';
});

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

const onWindowKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isContentEditorModalOpen.value) {
    closeContentEditorModal();
  }
};

watch(isContentEditorModalOpen, (isOpen) => {
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
    <div class="surface-panel">
      <label class="section-kicker-muted mb-2 block text-[11px]">Imagen local</label>
      <p
        v-if="effectiveFileImportBlocked"
        data-testid="monitor-file-import-blocked-feedback"
        class="mb-2 text-xs text-amber-200"
      >
        {{ effectiveFileImportBlockedMessage }}
      </p>
      <div class="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          :disabled="effectiveFileImportBlocked"
          class="form-file-control mt-0 text-xs text-slate-200 file:mr-3 file:bg-indigo-500 file:px-3 file:py-1.5 file:text-white"
          @change="onFileChange"
        />
        <button
          type="button"
          class="btn-with-icon btn-sm btn-rose-soft shrink-0"
          @click="emit('clearImage', monitorId)"
        >
          <TrashIcon aria-hidden="true" class="btn-icon" />
          Limpiar
        </button>
      </div>
      <div
        data-testid="monitor-image-drop-zone"
        class="image-drop-zone mt-3"
        :class="isImageDropZoneActive ? 'image-drop-zone--active' : ''"
        role="button"
        tabindex="0"
        @dragenter="onImageDragEnter"
        @dragover="onImageDragOver"
        @dragleave="onImageDragLeave"
        @drop="onImageDrop"
        @paste="onImagePaste"
        @focus="clearImageImportFeedback"
        @blur="resetImageDropZoneState"
      >
        Arrastra una imagen aqui o pega desde portapapeles (Ctrl/Cmd+V).
      </div>
      <p v-if="imageImportFeedback" data-testid="monitor-image-import-feedback" class="mt-2 text-xs text-amber-200">
        {{ imageImportFeedback }}
      </p>
    </div>

    <div class="monitor-action-toolbar" data-testid="monitor-action-toolbar">
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
