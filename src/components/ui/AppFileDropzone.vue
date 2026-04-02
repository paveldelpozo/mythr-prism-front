<script setup lang="ts">
import {
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon
} from '@heroicons/vue/24/outline';
import { computed, onBeforeUnmount, ref, useAttrs } from 'vue';

defineOptions({
  inheritAttrs: false
});

type FileSource = 'file-picker' | 'drag-drop' | 'paste';
type DragState = 'idle' | 'valid' | 'invalid';

interface SelectedFileEntry {
  id: string;
  file: File;
}

const props = withDefaults(defineProps<{
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  disablePicker?: boolean;
  allowPaste?: boolean;
  maxFiles?: number;
  dragText?: string;
  selectButtonText?: string;
  pasteHintText?: string;
  formatNotAllowedText?: string;
  pickButtonTestId?: string;
}>(), {
  accept: '',
  multiple: false,
  disabled: false,
  disablePicker: false,
  allowPaste: true,
  maxFiles: undefined,
  dragText: 'Arrastra aquí tus archivos',
  selectButtonText: 'Seleccionar archivo',
  pasteHintText: 'Haz clic en esta zona y pega con Ctrl/Cmd+V',
  formatNotAllowedText: 'Formato no permitido',
  pickButtonTestId: undefined
});

const emit = defineEmits<{
  filesSelected: [files: File[], source: FileSource];
  fileRemoved: [file: File, index: number];
  cleared: [];
  error: [message: string];
  focusPaste: [];
}>();

const hiddenInputRef = ref<HTMLInputElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const attrs = useAttrs();
const selectedEntries = ref<SelectedFileEntry[]>([]);
const previewUrlByEntryId = ref<Record<string, string>>({});
const dragState = ref<DragState>('idle');
const activeForPaste = ref(false);
const localError = ref<string | null>(null);
const dragDepth = ref(0);

const selectedFiles = computed(() => selectedEntries.value.map((entry) => entry.file));

const canInteract = computed(() => !props.disabled);

const fileInputAccept = computed(() => props.accept.trim());

const dropzoneClass = computed(() => {
  if (activeForPaste.value) {
    return 'app-file-dropzone--paste-active';
  }

  if (dragState.value === 'valid') {
    return 'app-file-dropzone--drag-valid';
  }

  if (dragState.value === 'invalid') {
    return 'app-file-dropzone--drag-invalid';
  }

  return 'app-file-dropzone--idle';
});

const toEntryId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `drop-${Date.now()}-${Math.round(Math.random() * 1000)}`;
};

const resetDragState = () => {
  dragDepth.value = 0;
  dragState.value = 'idle';
};

const setError = (message: string) => {
  localError.value = message;
  emit('error', message);
};

const clearError = () => {
  localError.value = null;
};

const parseAcceptTokens = (): string[] =>
  fileInputAccept.value
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0);

const toFileExtension = (fileName: string): string => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) {
    return '';
  }

  return fileName.slice(dotIndex).toLowerCase();
};

const isFileAccepted = (file: File): boolean => {
  const tokens = parseAcceptTokens();
  if (tokens.length === 0) {
    return true;
  }

  const fileType = file.type.toLowerCase();
  const fileExtension = toFileExtension(file.name);

  return tokens.some((token) => {
    if (token.startsWith('.')) {
      return fileExtension === token;
    }

    if (token.endsWith('/*')) {
      const mimeGroup = token.slice(0, token.length - 1);
      return fileType.startsWith(mimeGroup);
    }

    return fileType === token;
  });
};

const toIncomingFiles = (list: FileList | null | undefined): File[] => {
  if (!list) {
    return [];
  }

  return Array.from(list);
};

const toFilesFromDataTransfer = (dataTransfer: DataTransfer | null): File[] => {
  if (!dataTransfer) {
    return [];
  }

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const files = Array.from(dataTransfer.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => file instanceof File);
    if (files.length > 0) {
      return files;
    }
  }

  return toIncomingFiles(dataTransfer.files);
};

const validateIncoming = (files: File[]): { validFiles: File[]; errorMessage: string | null } => {
  if (files.length === 0) {
    return {
      validFiles: [],
      errorMessage: 'No se detectaron archivos para importar.'
    };
  }

  if (!props.multiple && files.length > 1) {
    return {
      validFiles: [],
      errorMessage: 'Solo se permite un archivo. Recibiste multiples archivos y se rechazaron todos.'
    };
  }

  const disallowed = files.some((file) => !isFileAccepted(file));
  if (disallowed) {
    return {
      validFiles: [],
      errorMessage: props.formatNotAllowedText
    };
  }

  return {
    validFiles: files,
    errorMessage: null
  };
};

const revokeEntryPreview = (entryId: string) => {
  const existingUrl = previewUrlByEntryId.value[entryId];
  if (!existingUrl) {
    return;
  }

  if (typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(existingUrl);
  }
  const nextPreviewUrls = { ...previewUrlByEntryId.value };
  delete nextPreviewUrls[entryId];
  previewUrlByEntryId.value = nextPreviewUrls;
};

const ensureImagePreview = (entry: SelectedFileEntry): string | null => {
  if (!entry.file.type.startsWith('image/')) {
    return null;
  }

  if (typeof URL.createObjectURL !== 'function') {
    return null;
  }

  const existingUrl = previewUrlByEntryId.value[entry.id];
  if (existingUrl) {
    return existingUrl;
  }

  const createdUrl = URL.createObjectURL(entry.file);
  previewUrlByEntryId.value = {
    ...previewUrlByEntryId.value,
    [entry.id]: createdUrl
  };
  return createdUrl;
};

const applyFiles = (incoming: File[], source: FileSource) => {
  const validation = validateIncoming(incoming);
  if (validation.errorMessage) {
    setError(validation.errorMessage);
    return;
  }

  clearError();

  const limited = typeof props.maxFiles === 'number' && props.maxFiles > 0
    ? validation.validFiles.slice(0, props.maxFiles)
    : validation.validFiles;

  if (props.multiple) {
    const nextEntries = [...selectedEntries.value];
    for (const file of limited) {
      nextEntries.push({ id: toEntryId(), file });
    }
    selectedEntries.value = nextEntries;
  } else {
    selectedEntries.value.forEach((entry) => revokeEntryPreview(entry.id));
    selectedEntries.value = limited.slice(0, 1).map((file) => ({ id: toEntryId(), file }));
  }

  if (limited.length > 0) {
    emit('filesSelected', limited, source);
  }
};

const onContainerClick = (event: MouseEvent) => {
  event.preventDefault();

  if (!canInteract.value || !props.allowPaste) {
    return;
  }

  activeForPaste.value = true;
  clearError();
  containerRef.value?.focus();
  emit('focusPaste');
};

const onContainerBlur = () => {
  activeForPaste.value = false;
  resetDragState();
};

const onSelectButtonClick = () => {
  if (!canInteract.value || props.disablePicker) {
    return;
  }

  hiddenInputRef.value?.click();
};

const onInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  applyFiles(toIncomingFiles(target.files), 'file-picker');
  target.value = '';
};

const onDragEnter = (event: DragEvent) => {
  if (!canInteract.value) {
    return;
  }

  event.preventDefault();
  dragDepth.value += 1;
  const validation = validateIncoming(toFilesFromDataTransfer(event.dataTransfer));
  dragState.value = validation.errorMessage ? 'invalid' : 'valid';
};

const onDragOver = (event: DragEvent) => {
  if (!canInteract.value) {
    return;
  }

  event.preventDefault();
  const validation = validateIncoming(toFilesFromDataTransfer(event.dataTransfer));
  dragState.value = validation.errorMessage ? 'invalid' : 'valid';
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = validation.errorMessage ? 'none' : 'copy';
  }
};

const onDragLeave = (event: DragEvent) => {
  if (!canInteract.value) {
    return;
  }

  event.preventDefault();
  dragDepth.value = Math.max(0, dragDepth.value - 1);
  if (dragDepth.value === 0) {
    dragState.value = 'idle';
  }
};

const onDrop = (event: DragEvent) => {
  if (!canInteract.value) {
    return;
  }

  event.preventDefault();
  activeForPaste.value = false;
  resetDragState();
  applyFiles(toFilesFromDataTransfer(event.dataTransfer), 'drag-drop');
};

const onPaste = (event: ClipboardEvent) => {
  if (!canInteract.value || !props.allowPaste) {
    return;
  }

  activeForPaste.value = true;
  const files = toFilesFromDataTransfer(event.clipboardData);
  if (files.length > 0) {
    event.preventDefault();
    applyFiles(files, 'paste');
  }
};

const removeFile = (entryId: string) => {
  const index = selectedEntries.value.findIndex((entry) => entry.id === entryId);
  if (index < 0) {
    return;
  }

  const entry = selectedEntries.value[index];
  if (!entry) {
    return;
  }

  revokeEntryPreview(entryId);
  selectedEntries.value = selectedEntries.value.filter((item) => item.id !== entryId);
  emit('fileRemoved', entry.file, index);
  if (selectedEntries.value.length === 0) {
    emit('cleared');
  }
};

const toBadgeLabel = (file: File): string => {
  const extension = toFileExtension(file.name);
  const type = file.type.toLowerCase();
  if (type === 'application/pdf' || extension === '.pdf') {
    return 'PDF';
  }

  if (type === 'text/plain' || extension === '.txt' || extension === '.md') {
    return 'TXT';
  }

  if (
    type === 'application/msword'
    || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || extension === '.doc'
    || extension === '.docx'
  ) {
    return 'WORD';
  }

  return 'ARCHIVO';
};

onBeforeUnmount(() => {
  if (typeof URL.revokeObjectURL === 'function') {
    for (const previewUrl of Object.values(previewUrlByEntryId.value)) {
      URL.revokeObjectURL(previewUrl);
    }
  }
  previewUrlByEntryId.value = {};
});
</script>

<template>
  <div class="app-file-dropzone-wrap">
    <input
      ref="hiddenInputRef"
      :accept="fileInputAccept"
      :multiple="multiple"
      :disabled="disabled || disablePicker"
      type="file"
      class="sr-only"
      data-testid="app-file-dropzone-hidden-input"
      @change="onInputChange"
    />

    <div
      ref="containerRef"
      v-bind="attrs"
      :data-testid="typeof attrs['data-testid'] === 'string' ? attrs['data-testid'] : 'app-file-dropzone'"
      class="app-file-dropzone"
      :class="[dropzoneClass, disabled ? 'app-file-dropzone--disabled' : '']"
      tabindex="0"
      role="button"
      @click="onContainerClick"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @paste="onPaste"
      @blur="onContainerBlur"
    >
      <p class="text-xs font-semibold text-slate-100">{{ dragText }}</p>
      <p class="mt-1 text-[11px] text-slate-300/90">{{ pasteHintText }}</p>
      <button
        type="button"
        class="btn-with-icon btn-sm btn-indigo-soft mt-3"
        :disabled="disabled || disablePicker"
        :data-testid="pickButtonTestId"
        @click.stop="onSelectButtonClick"
      >
        {{ selectButtonText }}
      </button>
    </div>

    <p v-if="localError" data-testid="app-file-dropzone-error" class="mt-2 text-xs text-amber-200">
      {{ localError }}
    </p>

    <ul v-if="selectedEntries.length > 0" data-testid="app-file-dropzone-selected-list" class="mt-2 space-y-2">
      <li
        v-for="(entry, index) in selectedEntries"
        :key="entry.id"
        class="app-file-dropzone-item"
        :data-testid="`app-file-dropzone-item-${index}`"
      >
        <div class="app-file-dropzone-item-preview">
          <img
            v-if="entry.file.type.startsWith('image/')"
            :src="ensureImagePreview(entry) ?? ''"
            :alt="`Vista previa de ${entry.file.name}`"
            class="app-file-dropzone-thumb"
            data-testid="app-file-dropzone-image-preview"
          />
          <div v-else class="app-file-dropzone-badge-wrap" data-testid="app-file-dropzone-non-image-preview">
            <DocumentTextIcon
              v-if="toBadgeLabel(entry.file) === 'TXT'"
              aria-hidden="true"
              class="h-4 w-4 text-slate-200"
            />
            <DocumentIcon
              v-else
              aria-hidden="true"
              class="h-4 w-4 text-slate-200"
            />
            <span class="app-file-dropzone-badge">{{ toBadgeLabel(entry.file) }}</span>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <p class="truncate text-xs font-medium text-slate-100" :title="entry.file.name">{{ entry.file.name }}</p>
          <p class="text-[11px] text-slate-400">{{ Math.max(1, Math.round(entry.file.size / 1024)) }} KB</p>
        </div>

        <button
          type="button"
          class="btn-with-icon btn-sm btn-rose-soft"
          :data-testid="`app-file-dropzone-remove-${index}`"
          @click="removeFile(entry.id)"
        >
          Quitar
        </button>
      </li>
    </ul>

    <p v-else class="mt-2 flex items-center gap-1 text-[11px] text-slate-400">
      <PhotoIcon aria-hidden="true" class="h-3.5 w-3.5" />
      Sin archivos seleccionados.
    </p>
  </div>
</template>
