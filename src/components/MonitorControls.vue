<script setup lang="ts">
import {
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
import { computed, ref } from 'vue';
import type { MonitorRuntimeState } from '../types/broadcaster';
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

const emit = defineEmits<{
  uploadImage: [monitorId: string, file: File];
  clearImage: [monitorId: string];
  transform: [
    monitorId: string,
    action: { type: 'rotate'; value: number } | { type: 'scale'; value: number } | { type: 'move'; value: { x?: number; y?: number } } | { type: 'reset' }
  ];
  requestFullscreen: [monitorId: string];
  closeWindow: [monitorId: string];
}>();

const imageImportFeedback = ref<string | null>(null);
const isImageDropZoneActive = ref(false);
const imageDropZoneDragDepth = ref(0);
const effectiveFileImportBlocked = computed(() => props.isFileImportBlocked === true);
const effectiveFileImportBlockedMessage = computed(() =>
  props.fileImportBlockedMessage ?? 'Para importar archivo, sal del fullscreen o usa Drag & Drop / pegar imagen.'
);

const feedbackForFailureReason = (reason: ImageImportFailureReason): string =>
  reason === 'not-image'
    ? 'El archivo seleccionado no es una imagen valida.'
    : 'No se detecto ninguna imagen para importar.';

const clearImageImportFeedback = () => {
  imageImportFeedback.value = null;
};

const emitImageFile = (file: File) => {
  emit('uploadImage', props.monitorId, file);
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

  emitImageFile(selection.file);
  target.value = '';
};

const resetImageDropZoneState = () => {
  imageDropZoneDragDepth.value = 0;
  isImageDropZoneActive.value = false;
};

const onImageDragEnter = (event: DragEvent) => {
  event.preventDefault();
  imageDropZoneDragDepth.value += 1;
  isImageDropZoneActive.value = !effectiveFileImportBlocked.value;
};

const onImageDragOver = (event: DragEvent) => {
  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = effectiveFileImportBlocked.value ? 'none' : 'copy';
  }

  if (!effectiveFileImportBlocked.value) {
    isImageDropZoneActive.value = true;
  }
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

  if (effectiveFileImportBlocked.value) {
    imageImportFeedback.value = effectiveFileImportBlockedMessage.value;
    return;
  }

  const selection = pickImageFromDataTransfer(event.dataTransfer);
  if (!selection.file) {
    imageImportFeedback.value = feedbackForFailureReason(selection.reason ?? 'empty');
    return;
  }

  emitImageFile(selection.file);
};

const onImagePaste = (event: ClipboardEvent) => {
  resetImageDropZoneState();

  if (effectiveFileImportBlocked.value) {
    imageImportFeedback.value = effectiveFileImportBlockedMessage.value;
    return;
  }

  const selection = pickImageFromClipboard(event.clipboardData);
  if (!selection.file) {
    imageImportFeedback.value = feedbackForFailureReason(selection.reason ?? 'empty');
    return;
  }

  event.preventDefault();
  emitImageFile(selection.file);
};

const fullscreenActionLabel = computed(() => {
  if (!props.state.isFullscreen && props.state.fullscreenIntentActive) {
    return 'Reactivar fullscreen';
  }

  return 'Solicitar fullscreen';
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
        :class="[
          isImageDropZoneActive ? 'image-drop-zone--active' : '',
          effectiveFileImportBlocked ? 'image-drop-zone--disabled' : ''
        ]"
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

    <div class="grid gap-3 md:grid-cols-2">
      <div class="surface-panel">
        <p class="section-kicker-muted mb-2 text-[11px]">Rotacion</p>
        <div class="grid grid-cols-2 gap-2">
          <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'rotate', value: -90 })">
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
        <button class="control-btn btn-with-icon" type="button" @click="emit('transform', monitorId, { type: 'move', value: { y: -40 } })">
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

    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="btn-with-icon btn-sm btn-indigo-soft"
        @click="emit('requestFullscreen', monitorId)"
      >
        <ArrowsPointingOutIcon aria-hidden="true" class="btn-icon" />
        {{ fullscreenActionLabel }}
      </button>

      <button
        type="button"
        class="btn-with-icon btn-sm btn-rose-soft"
        @click="emit('closeWindow', monitorId)"
      >
        <XMarkIcon aria-hidden="true" class="btn-icon" />
        Cerrar ventana
      </button>
    </div>

    <p class="text-xs text-slate-300/80">
      Transform: scale {{ state.transform.scale.toFixed(2) }} | rotate {{ state.transform.rotate }}deg | x {{ state.transform.translateX }} | y {{ state.transform.translateY }}
    </p>
  </div>
</template>
