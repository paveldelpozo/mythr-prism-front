<script setup lang="ts">
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Bars3Icon,
  CheckIcon,
  ExclamationTriangleIcon,
  PencilSquareIcon,
  PhotoIcon,
  PlusIcon,
  QueueListIcon,
  TrashIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline';
import {
  BackwardIcon,
  ForwardIcon,
  PauseIcon,
  PlayIcon,
  StopIcon
} from '@heroicons/vue/24/solid';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRef, watch } from 'vue';
import AppCheckbox from './ui/AppCheckbox.vue';
import { usePlaylistThumbnails } from '../composables/usePlaylistThumbnails';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';
import type { MediaItemKind, MultimediaItem, PlaylistPlaybackState } from '../types/playlist';
import { buildVideoSyncPlan, type VideoSyncPlan } from '../types/videoSync';

const DEFAULT_IMAGE_DURATION_MS = 5000;
const IMAGE_DATA_URL_PREFIX = 'data:image/';
const MAX_SOURCE_PREVIEW_LENGTH = 96;
const SOURCE_PREVIEW_ELLIPSIS = '...';

const props = defineProps<{
  items: MultimediaItem[];
  monitors: MonitorDescriptor[];
  monitorStates: MonitorStateMap;
  playbackState: PlaylistPlaybackState;
  videoSyncPlan?: VideoSyncPlan;
  playbackFeedback: string;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  'update:items': [items: MultimediaItem[]];
  'update:playbackState': [state: PlaylistPlaybackState];
  'playback:start': [];
  'playback:pause': [];
  'playback:next': [];
  'playback:previous': [];
  'playback:stop': [];
}>();

const newItemKind = ref<MediaItemKind>('image');
const newItemName = ref('');
const newItemSource = ref('');
const newImageDurationMs = ref(DEFAULT_IMAGE_DURATION_MS);
const newVideoStartAtMs = ref(0);
const newVideoEndAtMs = ref<string>('');
const newVideoMuted = ref(true);
const formError = ref<string | null>(null);
const newImageFileFeedback = ref<string | null>(null);
const itemImageFileFeedback = ref<Record<string, string>>({});
const isAddModalOpen = ref(false);
const editingItemId = ref<string | null>(null);
const editingItemSnapshot = ref<MultimediaItem | null>(null);
const previewItemId = ref<string | null>(null);
const draggedItemId = ref<string | null>(null);
const dragOverItemId = ref<string | null>(null);
const reorderFeedback = ref<string>('Arrastra y suelta para reordenar en desktop.');
const addModalNameInput = ref<HTMLInputElement | null>(null);
const editModalNameInput = ref<HTMLInputElement | null>(null);
const bodyScrollSnapshot = ref<{ overflow: string; paddingRight: string } | null>(null);
const { getItemThumbnail } = usePlaylistThumbnails(toRef(props, 'items'));

const editingItem = computed<MultimediaItem | null>(() => {
  if (!editingItemId.value) {
    return null;
  }

  return props.items.find((item) => item.id === editingItemId.value) ?? null;
});

const previewItem = computed<MultimediaItem | null>(() => {
  if (!previewItemId.value) {
    return null;
  }

  return props.items.find((item) => item.id === previewItemId.value) ?? null;
});

const previewLabel = computed<string>(() => {
  if (!previewItem.value) {
    return '';
  }

  return previewItem.value.kind === 'image' ? 'Imagen' : 'Video';
});

const previewThumbnail = computed(() => {
  if (!previewItem.value) {
    return {
      status: 'error',
      source: null,
      message: 'No hay item seleccionado para previsualizar.'
    };
  }

  return getItemThumbnail(previewItem.value);
});

const createItemId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.round(Math.random() * 1000)}`;
};

const cloneMediaItem = (item: MultimediaItem): MultimediaItem =>
  item.kind === 'image'
    ? {
        id: item.id,
        kind: 'image',
        name: item.name,
        source: item.source,
        durationMs: item.durationMs
      }
    : {
        id: item.id,
        kind: 'video',
        name: item.name,
        source: item.source,
        startAtMs: item.startAtMs,
        endAtMs: item.endAtMs,
        muted: item.muted
      };

const toPositiveNumber = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.round(value);
};

const toNonNegativeNumber = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.round(value);
};

const toVideoEnd = (raw: string, startAtMs: number): number | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(startAtMs, Math.round(parsed));
};

const emitItems = (items: MultimediaItem[]) => {
  emit('update:items', items);
};

const updatePlaybackState = (patch: Partial<PlaylistPlaybackState>) => {
  emit('update:playbackState', {
    ...props.playbackState,
    ...patch
  });
};

const onTargetMonitorChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  const nextTargetMonitorId = value.length > 0 ? value : null;

  if (nextTargetMonitorId === props.playbackState.targetMonitorId) {
    return;
  }

  updatePlaybackState({
    targetMonitorId: nextTargetMonitorId
  });
};

const onCurrentIndexInput = (event: Event) => {
  updatePlaybackState({
    currentIndex: Math.max(0, Number((event.target as HTMLInputElement).value) || 0)
  });
};

const onIntervalInput = (event: Event) => {
  updatePlaybackState({
    intervalSeconds: Math.max(1, Math.round(Number((event.target as HTMLInputElement).value) || 1))
  });
};

const onAutoplayChange = (value: boolean) => {
  updatePlaybackState({
    autoplay: value
  });
};

const selectedMonitorReady = (): boolean => {
  const monitorId = props.playbackState.targetMonitorId;
  if (!monitorId) {
    return false;
  }

  const monitorState = props.monitorStates[monitorId];
  return Boolean(monitorState?.isWindowOpen);
};

const effectiveVideoSyncPlan = computed<VideoSyncPlan>(() => {
  if (props.videoSyncPlan) {
    return props.videoSyncPlan;
  }

  const openMonitorIds = Object.entries(props.monitorStates)
    .filter(([, state]) => state.isWindowOpen)
    .map(([monitorId]) => monitorId);

  return buildVideoSyncPlan({
    openMonitorIds,
    preferredHostMonitorId: props.playbackState.targetMonitorId
  });
});

const monitorLabelById = (monitorId: string | null): string => {
  if (!monitorId) {
    return 'sin host';
  }

  return props.monitors.find((monitor) => monitor.id === monitorId)?.label ?? monitorId;
};

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('No se pudo leer la imagen seleccionada.'));
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(new Error('Fallo la lectura del archivo seleccionado.'));
    };

    reader.onabort = () => {
      reject(new Error('La lectura del archivo fue cancelada.'));
    };

    reader.readAsDataURL(file);
  });

const fileSelectionToImage = (files: FileList | null): File | null => {
  if (!files || files.length === 0) {
    return null;
  }

  const file = files.item(0);
  if (!file) {
    return null;
  }

  if (!file.type.startsWith('image/')) {
    return null;
  }

  return file;
};

const toImageDataSource = async (file: File): Promise<string> => {
  const dataUrl = await readFileAsDataUrl(file);
  if (!dataUrl.startsWith(IMAGE_DATA_URL_PREFIX)) {
    throw new Error('El archivo seleccionado no es una imagen valida.');
  }

  return dataUrl;
};

const setItemImageFeedback = (itemId: string, message: string) => {
  itemImageFileFeedback.value = {
    ...itemImageFileFeedback.value,
    [itemId]: message
  };
};

const clearItemImageFeedback = (itemId: string) => {
  const nextFeedback = { ...itemImageFileFeedback.value };
  delete nextFeedback[itemId];
  itemImageFileFeedback.value = nextFeedback;
};

const resetNewItemForm = () => {
  newItemKind.value = 'image';
  newItemName.value = '';
  newItemSource.value = '';
  newImageDurationMs.value = DEFAULT_IMAGE_DURATION_MS;
  newVideoStartAtMs.value = 0;
  newVideoEndAtMs.value = '';
  newVideoMuted.value = true;
  formError.value = null;
  newImageFileFeedback.value = null;
};

const openAddModal = () => {
  isAddModalOpen.value = true;
};

const closeAddModal = () => {
  isAddModalOpen.value = false;
  resetNewItemForm();
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

const toSourcePreview = (source: string): string => {
  if (source.length <= MAX_SOURCE_PREVIEW_LENGTH) {
    return source;
  }

  return `${source.slice(0, MAX_SOURCE_PREVIEW_LENGTH - SOURCE_PREVIEW_ELLIPSIS.length)}${SOURCE_PREVIEW_ELLIPSIS}`;
};

const updateItem = (itemId: string, updater: (item: MultimediaItem) => MultimediaItem) => {
  const nextItems = props.items.map((item) => (item.id === itemId ? updater(item) : item));
  emitItems(nextItems);
};

const addItem = () => {
  formError.value = null;

  const name = newItemName.value.trim();
  const source = newItemSource.value.trim();

  if (name.length === 0 || source.length === 0) {
    formError.value = 'Completa nombre y source para agregar un item.';
    return;
  }

  const id = createItemId();
  const kind = newItemKind.value;

  const base = {
    id,
    kind,
    name,
    source
  };

  const item: MultimediaItem =
    kind === 'image'
      ? {
          ...base,
          kind: 'image',
          durationMs: toPositiveNumber(newImageDurationMs.value, DEFAULT_IMAGE_DURATION_MS)
        }
      : {
          ...base,
          kind: 'video',
          startAtMs: toNonNegativeNumber(newVideoStartAtMs.value, 0),
          endAtMs: toVideoEnd(
            newVideoEndAtMs.value,
            toNonNegativeNumber(newVideoStartAtMs.value, 0)
          ),
          muted: newVideoMuted.value
        };

  emitItems([...props.items, item]);
  resetNewItemForm();
  isAddModalOpen.value = false;
};

const openEditModal = (itemId: string) => {
  const item = props.items.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }

  editingItemId.value = itemId;
  editingItemSnapshot.value = cloneMediaItem(item);
  clearItemImageFeedback(itemId);
};

const closeEditModal = () => {
  editingItemId.value = null;
  editingItemSnapshot.value = null;
};

const openPreviewModal = (itemId: string) => {
  const item = props.items.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }

  previewItemId.value = itemId;
};

const closePreviewModal = () => {
  previewItemId.value = null;
};

const cancelEditModal = () => {
  if (editingItemId.value && editingItemSnapshot.value) {
    const snapshot = editingItemSnapshot.value;
    emitItems(
      props.items.map((item) => (item.id === editingItemId.value ? cloneMediaItem(snapshot) : item))
    );
  }

  closeEditModal();
};

const removeItem = (itemId: string) => {
  emitItems(props.items.filter((item) => item.id !== itemId));
};

const reorderItemsById = (sourceItemId: string, targetItemId: string): boolean => {
  const sourceIndex = props.items.findIndex((item) => item.id === sourceItemId);
  const targetIndex = props.items.findIndex((item) => item.id === targetItemId);

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return false;
  }

  const nextItems = [...props.items];
  const [sourceItem] = nextItems.splice(sourceIndex, 1);
  if (!sourceItem) {
    return false;
  }
  nextItems.splice(targetIndex, 0, sourceItem);
  emitItems(nextItems);
  return true;
};

const moveItem = (itemId: string, direction: 'up' | 'down') => {
  const index = props.items.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return;
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= props.items.length) {
    return;
  }

  const moved = reorderItemsById(itemId, props.items[targetIndex]?.id ?? '');
  if (moved) {
    reorderFeedback.value = `Item movido a la posicion ${targetIndex + 1}.`;
  }
};

const clearDragState = () => {
  draggedItemId.value = null;
  dragOverItemId.value = null;
};

const onItemDragStart = (itemId: string, event: DragEvent) => {
  draggedItemId.value = itemId;
  dragOverItemId.value = itemId;

  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
  }
};

const onItemDragOver = (itemId: string, event: DragEvent) => {
  if (!draggedItemId.value || draggedItemId.value === itemId) {
    return;
  }

  event.preventDefault();
  dragOverItemId.value = itemId;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
};

const onItemDrop = (targetItemId: string, event: DragEvent) => {
  event.preventDefault();
  const sourceItemId = draggedItemId.value ?? event.dataTransfer?.getData('text/plain') ?? '';

  if (!sourceItemId || sourceItemId === targetItemId) {
    clearDragState();
    return;
  }

  const moved = reorderItemsById(sourceItemId, targetItemId);
  if (moved) {
    const targetIndex = props.items.findIndex((item) => item.id === targetItemId);
    reorderFeedback.value = `Item movido a la posicion ${targetIndex + 1}.`;
  }

  clearDragState();
};

const onItemDragEnd = () => {
  clearDragState();
};

const updateItemKind = (itemId: string, kind: MediaItemKind) => {
  updateItem(itemId, (item) => {
    if (item.kind === kind) {
      return item;
    }

    if (kind === 'image') {
      return {
        id: item.id,
        kind: 'image',
        name: item.name,
        source: item.source,
        durationMs: DEFAULT_IMAGE_DURATION_MS
      };
    }

    return {
      id: item.id,
      kind: 'video',
      name: item.name,
      source: item.source,
      startAtMs: 0,
      endAtMs: null,
      muted: true
    };
  });
};

const updateItemName = (itemId: string, value: string) => {
  updateItem(itemId, (item) => ({ ...item, name: value }));
};

const updateItemSource = (itemId: string, value: string) => {
  updateItem(itemId, (item) => ({ ...item, source: value }));
};

const onNewImageFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  formError.value = null;

  const file = fileSelectionToImage(target.files);
  if (!file) {
    newImageFileFeedback.value =
      target.files && target.files.length > 0
        ? 'El archivo seleccionado no es una imagen valida.'
        : 'No se selecciono ninguna imagen.';
    target.value = '';
    return;
  }

  try {
    newItemSource.value = await toImageDataSource(file);
    newImageFileFeedback.value = 'Imagen convertida a data URI correctamente.';
  } catch (error) {
    newImageFileFeedback.value = error instanceof Error ? error.message : 'No se pudo procesar la imagen.';
  } finally {
    target.value = '';
  }
};

const onItemImageFileChange = async (itemId: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const item = props.items.find((entry) => entry.id === itemId);

  if (!item || item.kind !== 'image') {
    target.value = '';
    return;
  }

  const file = fileSelectionToImage(target.files);
  if (!file) {
    setItemImageFeedback(
      itemId,
      target.files && target.files.length > 0
        ? 'El archivo seleccionado no es una imagen valida.'
        : 'No se selecciono ninguna imagen.'
    );
    target.value = '';
    return;
  }

  try {
    const source = await toImageDataSource(file);
    updateItemSource(itemId, source);
    setItemImageFeedback(itemId, 'Imagen convertida a data URI correctamente.');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo procesar la imagen.';
    setItemImageFeedback(itemId, message);
  } finally {
    target.value = '';
  }
};

const updateImageDuration = (itemId: string, value: number) => {
  updateItem(itemId, (item) => {
    if (item.kind !== 'image') {
      return item;
    }

    return {
      ...item,
      durationMs: toPositiveNumber(value, item.durationMs)
    };
  });
};

const updateVideoStartAt = (itemId: string, value: number) => {
  updateItem(itemId, (item) => {
    if (item.kind !== 'video') {
      return item;
    }

    const nextStartAtMs = toNonNegativeNumber(value, item.startAtMs);
    const nextEndAtMs = item.endAtMs === null ? null : Math.max(nextStartAtMs, item.endAtMs);

    return {
      ...item,
      startAtMs: nextStartAtMs,
      endAtMs: nextEndAtMs
    };
  });
};

const updateVideoEndAt = (itemId: string, value: string) => {
  updateItem(itemId, (item) => {
    if (item.kind !== 'video') {
      return item;
    }

    return {
      ...item,
      endAtMs: toVideoEnd(value, item.startAtMs)
    };
  });
};

const updateVideoMuted = (itemId: string, value: boolean) => {
  updateItem(itemId, (item) => {
    if (item.kind !== 'video') {
      return item;
    }

    return {
      ...item,
      muted: value
    };
  });
};

const isMediaItemKind = (value: string): value is MediaItemKind =>
  value === 'image' || value === 'video';

const onItemKindChange = (itemId: string, event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (!isMediaItemKind(value)) {
    return;
  }

  updateItemKind(itemId, value);
};

const onItemNameInput = (itemId: string, event: Event) => {
  updateItemName(itemId, (event.target as HTMLInputElement).value);
};

const onItemSourceInput = (itemId: string, event: Event) => {
  clearItemImageFeedback(itemId);
  updateItemSource(itemId, (event.target as HTMLInputElement).value);
};

const onImageDurationInput = (itemId: string, event: Event) => {
  updateImageDuration(itemId, Number((event.target as HTMLInputElement).value));
};

const onVideoStartInput = (itemId: string, event: Event) => {
  updateVideoStartAt(itemId, Number((event.target as HTMLInputElement).value));
};

const onVideoEndInput = (itemId: string, event: Event) => {
  updateVideoEndAt(itemId, (event.target as HTMLInputElement).value);
};

const onVideoMutedChange = (itemId: string, value: boolean) => {
  updateVideoMuted(itemId, value);
};

const onEditingVideoMutedChange = (value: boolean) => {
  const item = editingItem.value;
  if (!item || item.kind !== 'video') {
    return;
  }

  onVideoMutedChange(item.id, value);
};

const onModalKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') {
    return;
  }

  if (previewItemId.value) {
    closePreviewModal();
    return;
  }

  if (editingItemId.value) {
    cancelEditModal();
    return;
  }

  if (isAddModalOpen.value) {
    closeAddModal();
  }
};

watch(isAddModalOpen, (isOpen) => {
  if (!isOpen) {
    return;
  }

  void nextTick(() => {
    addModalNameInput.value?.focus();
  });
});

watch(editingItemId, (itemId) => {
  if (!itemId) {
    return;
  }

  void nextTick(() => {
    editModalNameInput.value?.focus();
  });
});

watch(
  () => isAddModalOpen.value || Boolean(editingItemId.value) || Boolean(previewItemId.value),
  (isAnyModalOpen) => {
    if (isAnyModalOpen) {
      lockBodyScroll();
      return;
    }

    unlockBodyScroll();
  }
);

watch(
  () => props.items.map((item) => item.id),
  (itemIds) => {
    if (draggedItemId.value && !itemIds.includes(draggedItemId.value)) {
      clearDragState();
    }

    if (previewItemId.value && !itemIds.includes(previewItemId.value)) {
      closePreviewModal();
    }
  }
);

onMounted(() => {
  window.addEventListener('keydown', onModalKeydown);
});

onBeforeUnmount(() => {
  unlockBodyScroll();
  window.removeEventListener('keydown', onModalKeydown);
});
</script>

<template>
  <section class="glass-panel space-y-4 p-4">
    <header>
      <p class="section-kicker">Playlist multimedia</p>
      <h2 class="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <QueueListIcon aria-hidden="true" class="btn-icon" />
        Alta, edicion y orden de items
      </h2>
      <p class="text-sm text-slate-300/90">Carga items por URL o data URI. El orden de la lista define la reproduccion.</p>
    </header>

    <div class="playlist-engine-card">
      <p class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-200">Motor de reproduccion</p>

      <div class="grid gap-2 md:grid-cols-4">
        <label class="form-field md:col-span-2">
          Monitor objetivo
          <select
            :value="playbackState.targetMonitorId ?? ''"
            class="form-control"
            @change="onTargetMonitorChange"
          >
            <option value="">Seleccionar monitor...</option>
            <option v-for="monitor in monitors" :key="monitor.id" :value="monitor.id">
              {{ monitor.label }} {{ monitorStates[monitor.id]?.isWindowOpen ? '(ventana abierta)' : '(sin ventana)' }}
            </option>
          </select>
        </label>

        <label class="form-field">
          Item activo (indice)
          <input
            :value="playbackState.currentIndex"
            type="number"
            min="0"
            class="form-control"
            @input="onCurrentIndexInput"
          />
        </label>

        <label class="form-field">
          Intervalo auto (seg)
          <input
            :value="playbackState.intervalSeconds"
            type="number"
            min="1"
            class="form-control"
            @input="onIntervalInput"
          />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <AppCheckbox
          data-testid="autoplay-checkbox"
          :model-value="playbackState.autoplay"
          label="Avance automatico"
          @update:model-value="onAutoplayChange"
        />

        <span class="text-xs" :class="selectedMonitorReady() ? 'text-emerald-200' : 'text-amber-200'">
          {{ selectedMonitorReady() ? 'Monitor listo para reproducir.' : 'El monitor objetivo requiere ventana abierta.' }}
        </span>
      </div>

      <div
        data-testid="video-sync-strategy"
        class="sync-info-card"
      >
        <p class="font-semibold uppercase tracking-[0.12em] text-cyan-200/90">Sync host + clientes</p>
        <p v-if="effectiveVideoSyncPlan.reason === 'ok'" class="mt-1 text-cyan-100/95">
          Host: {{ monitorLabelById(effectiveVideoSyncPlan.hostMonitorId) }} · Clientes:
          {{ effectiveVideoSyncPlan.clientMonitorIds.length }} · Lead:
          {{ effectiveVideoSyncPlan.strategy.commandLeadMs }}ms · Drift max:
          {{ effectiveVideoSyncPlan.strategy.driftToleranceMs }}ms
        </p>
        <p v-else-if="effectiveVideoSyncPlan.reason === 'single-open-monitor'" class="mt-1 text-cyan-100/95">
          Solo hay una ventana abierta ({{ monitorLabelById(effectiveVideoSyncPlan.hostMonitorId) }}).
          Se usara como host hasta sumar clientes.
        </p>
        <p v-else class="mt-1 text-cyan-100/95">
          No hay ventanas abiertas para sincronizar. Abre al menos dos para activar host + clientes.
        </p>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="btn-with-icon btn-sm btn-emerald-soft border-emerald-300/35"
          @click="emit('playback:start')"
        >
          <PlayIcon aria-hidden="true" class="btn-icon" />
          Iniciar
        </button>
        <button
          type="button"
          class="btn-with-icon btn-sm btn-slate-soft"
          :disabled="!isPlaying || !playbackState.autoplay"
          @click="emit('playback:pause')"
        >
          <PauseIcon aria-hidden="true" class="btn-icon" />
          Pausar
        </button>
        <button
          type="button"
          class="btn-with-icon btn-sm btn-slate-soft"
          @click="emit('playback:previous')"
        >
          <BackwardIcon aria-hidden="true" class="btn-icon" />
          Anterior
        </button>
        <button
          type="button"
          class="btn-with-icon btn-sm btn-slate-soft"
          @click="emit('playback:next')"
        >
          <ForwardIcon aria-hidden="true" class="btn-icon" />
          Siguiente
        </button>
        <button
          type="button"
          class="btn-with-icon btn-sm btn-rose-soft"
          @click="emit('playback:stop')"
        >
          <StopIcon aria-hidden="true" class="btn-icon" />
          Detener
        </button>
      </div>

      <p class="mt-2 text-xs text-slate-300/90">
        {{ playbackFeedback }}
      </p>
    </div>

    <div class="surface-panel-xl flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="section-kicker-muted">Edicion avanzada</p>
        <p class="text-sm text-slate-300/90">Agrega o edita items en un cuadro modal para mantener limpia la vista principal.</p>
      </div>
      <button
        data-testid="open-add-item-modal"
        type="button"
        class="btn-with-icon btn-sm btn-emerald-soft border-emerald-300/35"
        @click="openAddModal"
      >
        <PlusIcon aria-hidden="true" class="btn-icon" />
        Agregar item
      </button>
    </div>

    <div
      class="playlist-queue-card"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="section-kicker">Items en cola</p>
          <p class="mt-1 text-sm text-slate-300/90">Arrastra un item para cambiar su posicion o usa Subir/Bajar como fallback.</p>
        </div>
        <div class="playlist-count-pill">
          {{ items.length }} {{ items.length === 1 ? 'item' : 'items' }}
        </div>
      </div>
      <p data-testid="playlist-reorder-feedback" aria-live="polite" class="mt-2 text-xs text-emerald-200/90">
        {{ reorderFeedback }}
      </p>
    </div>

    <div v-if="items.length === 0" class="empty-dashed-panel">
      La playlist esta vacia. Agrega el primer item para comenzar.
    </div>

    <ul v-else class="space-y-3" data-testid="playlist-items-list">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        :data-testid="`playlist-item-${item.id}`"
        :draggable="true"
        class="playlist-item-card"
        :class="[
          draggedItemId === item.id
            ? 'playlist-item-card--dragging'
            : '',
          dragOverItemId === item.id && draggedItemId !== item.id
            ? 'playlist-item-card--drag-over'
            : ''
        ]"
        @dragstart="onItemDragStart(item.id, $event)"
        @dragover="onItemDragOver(item.id, $event)"
        @drop="onItemDrop(item.id, $event)"
        @dragend="onItemDragEnd"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span
              aria-hidden="true"
              class="drag-handle"
              title="Arrastrar para reordenar"
            >
              <Bars3Icon class="h-4 w-4" />
            </span>
            <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/80">
              #{{ index + 1 }} · {{ item.kind === 'image' ? 'Imagen' : 'Video' }}
            </p>
          </div>

          <div
            :data-testid="`playlist-item-actions-${item.id}`"
            class="playlist-actions-row flex flex-nowrap overflow-x-auto"
          >
            <button
              type="button"
              class="btn-item-action btn-item-action--neutral"
              :disabled="index === 0"
              @click="moveItem(item.id, 'up')"
            >
              <ArrowUpIcon aria-hidden="true" class="btn-icon" />
              Subir
            </button>
            <button
              type="button"
              class="btn-item-action btn-item-action--neutral"
              :disabled="index === items.length - 1"
              @click="moveItem(item.id, 'down')"
            >
              <ArrowDownIcon aria-hidden="true" class="btn-icon" />
              Bajar
            </button>
            <button
              :data-testid="`open-edit-item-modal-${item.id}`"
              type="button"
              class="btn-item-action btn-item-action--indigo"
              @click="openEditModal(item.id)"
            >
              <PencilSquareIcon aria-hidden="true" class="btn-icon" />
              Editar
            </button>
            <button
              type="button"
              class="btn-item-action btn-item-action--rose"
              @click="removeItem(item.id)"
            >
              <TrashIcon aria-hidden="true" class="btn-icon" />
              Eliminar
            </button>
          </div>
        </div>

        <div class="mt-2 flex items-start gap-3">
          <button
            :data-testid="`item-thumbnail-${item.id}`"
            type="button"
            class="playlist-thumbnail-btn"
            :aria-label="`Ampliar previsualizacion de ${item.name}`"
            @click="openPreviewModal(item.id)"
          >
            <img
              v-if="getItemThumbnail(item).status === 'ready' && getItemThumbnail(item).source"
              :data-testid="`item-thumbnail-${item.kind}-${item.id}`"
              :src="getItemThumbnail(item).source ?? ''"
              :alt="`Thumbnail de ${item.name}`"
              class="h-full w-full object-cover"
            />
            <span
              v-else-if="getItemThumbnail(item).status === 'loading'"
              :data-testid="`item-thumbnail-loading-${item.id}`"
              class="px-2 text-center text-[11px] text-slate-400"
            >
              {{ getItemThumbnail(item).message }}
            </span>
            <span
              v-else
              :data-testid="`item-thumbnail-fallback-${item.id}`"
              class="flex flex-col items-center gap-1 px-2 text-center text-[11px] text-amber-200"
            >
              <ExclamationTriangleIcon aria-hidden="true" class="h-4 w-4" />
              <span>{{ getItemThumbnail(item).message }}</span>
            </span>
          </button>

          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-1.5 text-sm font-medium text-slate-100">
              <PhotoIcon aria-hidden="true" class="h-4 w-4 text-slate-400" />
              {{ item.name }}
            </p>
            <p
              :data-testid="`item-source-preview-${item.id}`"
              :title="item.source"
              class="mt-1 truncate text-xs text-slate-300/80"
            >
              {{ toSourcePreview(item.source) }}
            </p>
            <p v-if="item.kind === 'image'" class="mt-2 text-xs text-slate-300/85">Duracion: {{ item.durationMs }} ms</p>
            <p v-else class="mt-2 text-xs text-slate-300/85">
              Inicio: {{ item.startAtMs }} ms | Fin: {{ item.endAtMs ?? 'hasta final' }} | Mute: {{ item.muted ? 'si' : 'no' }}
            </p>
          </div>
        </div>
      </li>
    </ul>

    <Teleport to="body">
      <div
        v-if="previewItem"
        data-testid="preview-item-modal-overlay"
        class="app-modal-overlay fixed inset-0 items-center justify-center"
        @click.self="closePreviewModal"
      >
        <div
          data-testid="preview-item-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-item-modal-title"
          aria-describedby="preview-item-modal-description"
          class="app-modal-panel app-modal-panel--lg"
        >
          <header
            data-testid="preview-item-modal-header"
            class="app-modal-header sticky top-0"
          >
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Preview ampliada</p>
              <h3 id="preview-item-modal-title" class="mt-1 text-lg font-semibold text-slate-100">
                {{ previewItem.name }}
              </h3>
              <p id="preview-item-modal-description" class="mt-1 text-xs text-slate-300/85">Tipo: {{ previewLabel }}</p>
            </div>
            <button
              data-testid="close-preview-item-modal-header"
              type="button"
              class="app-modal-close-btn"
              aria-label="Cerrar preview"
              @click="closePreviewModal"
            >
              <XMarkIcon aria-hidden="true" class="h-4 w-4" />
            </button>
          </header>

          <div data-testid="preview-item-modal-body" class="app-modal-body min-h-0 flex-1 overflow-auto">
            <div class="flex min-h-[18rem] items-center justify-center overflow-auto rounded-xl border border-slate-700/70 bg-slate-950/55 p-3">
              <img
                v-if="previewThumbnail.status === 'ready' && previewThumbnail.source"
                data-testid="preview-item-modal-image"
                :src="previewThumbnail.source"
                :alt="`Preview ampliada de ${previewItem.name}`"
                class="h-auto max-h-[65vh] w-full object-contain"
              />
              <p
                v-else-if="previewThumbnail.status === 'loading'"
                data-testid="preview-item-modal-loading"
                class="text-center text-sm text-slate-300"
              >
                {{ previewThumbnail.message }}
              </p>
              <div
                v-else
                data-testid="preview-item-modal-fallback"
                class="flex flex-col items-center gap-2 text-center text-sm text-amber-200"
              >
                <ExclamationTriangleIcon aria-hidden="true" class="h-5 w-5" />
                <p class="font-semibold">No hay thumbnail disponible para este item.</p>
                <p class="text-xs text-amber-100/90">{{ previewThumbnail.message }}</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div
        v-if="isAddModalOpen"
        data-testid="add-item-modal-overlay"
        class="app-modal-overlay fixed inset-0 items-center justify-center"
        @click.self="closeAddModal"
      >
        <div
          data-testid="add-item-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-item-modal-title"
          class="app-modal-panel app-modal-panel--md"
        >
          <header
            data-testid="add-item-modal-header"
            class="app-modal-header sticky top-0"
          >
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Playlist multimedia</p>
              <h3 id="add-item-modal-title" class="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
                <PlusIcon aria-hidden="true" class="btn-icon" />
                Agregar item
              </h3>
            </div>
            <button
              data-testid="close-add-item-modal-header"
              type="button"
              class="app-modal-close-btn"
              aria-label="Cerrar dialogo de alta"
              @click="closeAddModal"
            >
              <XMarkIcon aria-hidden="true" class="h-4 w-4" />
            </button>
          </header>

        <div data-testid="add-item-modal-body" class="app-modal-body min-h-0 flex-1 overflow-auto">
          <div data-layout-group="primary" class="form-row">
          <label class="form-field">
            Titulo
            <input
              ref="addModalNameInput"
              v-model="newItemName"
              type="text"
              placeholder="Promo apertura"
              class="form-control"
            />
          </label>

          <label class="form-field">
            Tipo
            <select
              v-model="newItemKind"
              class="form-control"
            >
              <option value="image">Imagen</option>
              <option value="video">Video</option>
            </select>
          </label>
          </div>

          <div data-layout-group="source" class="form-row mt-2">
          <label class="form-field">
            Source (URL o data URI)
            <input
              v-model="newItemSource"
              type="text"
              placeholder="https://... o data:image/..."
              class="form-control"
              @input="newImageFileFeedback = null"
            />
          </label>

          <label class="form-field">
            Archivo local (imagen)
            <input
              type="file"
              accept="image/*"
              :disabled="newItemKind !== 'image'"
              class="form-file-control"
              @change="onNewImageFileChange"
            />
            <span v-if="newItemKind !== 'image'" class="mt-1 block text-[11px] text-slate-400">
              Disponible solo para items de imagen.
            </span>
          </label>
          </div>

          <div data-layout-group="timing" class="form-row--triple mt-2">
          <label class="form-field">
            Duracion (ms)
            <input
              v-model.number="newImageDurationMs"
              type="number"
              min="1"
              :disabled="newItemKind !== 'image'"
              class="form-control"
            />
          </label>

          <label class="form-field">
            Inicio (ms)
            <input
              v-model.number="newVideoStartAtMs"
              type="number"
              min="0"
              :disabled="newItemKind !== 'video'"
              class="form-control"
            />
          </label>

          <label class="form-field">
            Fin (ms, opcional)
            <input
              v-model="newVideoEndAtMs"
              type="text"
              placeholder="vacio = hasta el final"
              :disabled="newItemKind !== 'video'"
              class="form-control"
            />
          </label>
          </div>

          <p v-if="newImageFileFeedback && newItemKind === 'image'" class="mt-2 text-xs text-amber-200">
            {{ newImageFileFeedback }}
          </p>

          <div
            v-if="newItemKind === 'video'"
            data-layout-group="mute"
            class="form-inline-card"
          >
            <div class="flex flex-wrap items-center gap-2">
              <AppCheckbox v-model="newVideoMuted" data-testid="new-video-muted-checkbox" label="Iniciar en mute" />
              <p data-testid="new-video-muted-help" class="text-xs text-slate-400">
                Evita picos de audio al cargar el video en pantalla.
              </p>
            </div>
          </div>

          <p v-if="formError" class="mt-3 text-xs text-amber-200">{{ formError }}</p>
        </div>

        <footer
          data-testid="add-item-modal-footer"
          class="app-modal-footer sticky bottom-0"
        >
          <button
            data-testid="cancel-add-item-modal"
            type="button"
            class="btn-with-icon btn-sm btn-neutral"
            @click="closeAddModal"
          >
            <XMarkIcon aria-hidden="true" class="btn-icon" />
            Cancelar
          </button>
          <button
            data-testid="save-add-item-modal"
            type="button"
            class="btn-with-icon btn-sm btn-emerald-soft border-emerald-300/35"
            @click="addItem"
          >
            <CheckIcon aria-hidden="true" class="btn-icon" />
            Guardar
          </button>
        </footer>
        </div>
      </div>

      <div
        v-if="editingItem"
        data-testid="edit-item-modal-overlay"
        class="app-modal-overlay fixed inset-0 items-center justify-center"
        @click.self="cancelEditModal"
      >
        <div
          data-testid="edit-item-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-item-modal-title"
          class="app-modal-panel app-modal-panel--md"
        >
          <header
            data-testid="edit-item-modal-header"
            class="app-modal-header sticky top-0"
          >
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Playlist multimedia</p>
              <h3 id="edit-item-modal-title" class="mt-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
                <PencilSquareIcon aria-hidden="true" class="btn-icon" />
                Editar item
              </h3>
            </div>
            <button
              data-testid="close-edit-item-modal-header"
              type="button"
              class="app-modal-close-btn"
              aria-label="Cerrar dialogo de edicion"
              @click="cancelEditModal"
            >
              <XMarkIcon aria-hidden="true" class="h-4 w-4" />
            </button>
          </header>

        <div data-testid="edit-item-modal-body" class="app-modal-body min-h-0 flex-1 overflow-auto">
          <div data-layout-group="primary" class="form-row">
          <label class="form-field">
            Titulo
            <input
              ref="editModalNameInput"
              :value="editingItem.name"
              type="text"
               class="form-control"
              @input="onItemNameInput(editingItem.id, $event)"
            />
          </label>

          <label class="form-field">
            Tipo
            <select
              :value="editingItem.kind"
               class="form-control"
              @change="onItemKindChange(editingItem.id, $event)"
            >
              <option value="image">Imagen</option>
              <option value="video">Video</option>
            </select>
          </label>
          </div>

          <div data-layout-group="source" class="form-row mt-2">
          <label class="form-field">
            Source (URL o data URI)
            <input
              :value="editingItem.source"
              type="text"
               class="form-control"
              @input="onItemSourceInput(editingItem.id, $event)"
            />
          </label>

          <label class="form-field">
            Archivo local (imagen)
            <input
              type="file"
              accept="image/*"
              :disabled="editingItem.kind !== 'image'"
               class="form-file-control"
              @change="onItemImageFileChange(editingItem.id, $event)"
            />
            <span v-if="editingItem.kind !== 'image'" class="mt-1 block text-[11px] text-slate-400">
              Disponible solo para items de imagen.
            </span>
          </label>
          </div>

          <p v-if="editingItem.kind === 'image' && itemImageFileFeedback[editingItem.id]" class="mt-2 text-xs text-amber-200">
            {{ itemImageFileFeedback[editingItem.id] }}
          </p>

          <div data-layout-group="timing" class="form-row--triple mt-2">
          <label class="form-field">
            Duracion (ms)
            <input
              v-if="editingItem.kind === 'image'"
              :value="editingItem.durationMs"
              type="number"
              min="1"
               class="form-control"
              @input="onImageDurationInput(editingItem.id, $event)"
            />
            <input
              v-else
              type="number"
              min="1"
              disabled
               class="form-control"
            />
          </label>

          <label class="form-field">
            Inicio (ms)
            <input
              v-if="editingItem.kind === 'video'"
              :value="editingItem.startAtMs"
              type="number"
              min="0"
               class="form-control"
              @input="onVideoStartInput(editingItem.id, $event)"
            />
            <input
              v-else
              type="number"
              min="0"
              disabled
               class="form-control"
            />
          </label>

          <label class="form-field">
            Fin (ms, opcional)
            <input
              v-if="editingItem.kind === 'video'"
              :value="editingItem.endAtMs ?? ''"
              type="text"
               class="form-control"
              @input="onVideoEndInput(editingItem.id, $event)"
            />
            <input
              v-else
              type="text"
              disabled
               class="form-control"
            />
          </label>
          </div>

          <div
            v-if="editingItem.kind === 'video'"
            data-layout-group="mute"
            class="form-inline-card"
          >
            <div class="flex flex-wrap items-center gap-2">
              <AppCheckbox
                data-testid="edit-video-muted-checkbox"
                :model-value="editingItem.muted"
                label="Mute"
                @update:model-value="onEditingVideoMutedChange"
              />
              <p data-testid="edit-video-muted-help" class="text-xs text-slate-400">
                Silencia el audio durante el inicio para evitar sobresaltos.
              </p>
            </div>
          </div>
        </div>

        <footer
          data-testid="edit-item-modal-footer"
          class="app-modal-footer sticky bottom-0"
        >
          <button
            data-testid="cancel-edit-item-modal"
            type="button"
            class="btn-with-icon btn-sm btn-neutral"
            @click="cancelEditModal"
          >
            <XMarkIcon aria-hidden="true" class="btn-icon" />
            Cancelar
          </button>
          <button
            data-testid="save-edit-item-modal"
            type="button"
            class="btn-with-icon btn-sm btn-indigo-soft"
            @click="closeEditModal"
          >
            <CheckIcon aria-hidden="true" class="btn-icon" />
            Guardar
          </button>
        </footer>
        </div>
      </div>
    </Teleport>
  </section>
</template>
