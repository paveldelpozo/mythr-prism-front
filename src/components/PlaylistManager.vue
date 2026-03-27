<script setup lang="ts">
import { ref } from 'vue';
import type { MonitorDescriptor, MonitorStateMap } from '../types/broadcaster';
import type { MediaItemKind, MultimediaItem, PlaylistPlaybackState } from '../types/playlist';

const DEFAULT_IMAGE_DURATION_MS = 5000;
const IMAGE_DATA_URL_PREFIX = 'data:image/';

const props = defineProps<{
  items: MultimediaItem[];
  monitors: MonitorDescriptor[];
  monitorStates: MonitorStateMap;
  playbackState: PlaylistPlaybackState;
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

const createItemId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.round(Math.random() * 1000)}`;
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

const onAutoplayChange = (event: Event) => {
  updatePlaybackState({
    autoplay: (event.target as HTMLInputElement).checked
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

  newItemName.value = '';
  newItemSource.value = '';
  newImageDurationMs.value = DEFAULT_IMAGE_DURATION_MS;
  newVideoStartAtMs.value = 0;
  newVideoEndAtMs.value = '';
  newVideoMuted.value = true;
  newImageFileFeedback.value = null;
};

const removeItem = (itemId: string) => {
  emitItems(props.items.filter((item) => item.id !== itemId));
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

  const nextItems = [...props.items];
  const [current] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, current);
  emitItems(nextItems);
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
    const message = error instanceof Error ? error.message : 'No se pudo procesar la imagen.';
    newImageFileFeedback.value = message;
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

const onVideoMutedChange = (itemId: string, event: Event) => {
  updateVideoMuted(itemId, (event.target as HTMLInputElement).checked);
};
</script>

<template>
  <section class="glass-panel space-y-4 p-4">
    <header>
      <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/85">Playlist multimedia</p>
      <h2 class="mt-1 text-lg font-semibold text-slate-100">Alta, edicion y orden de items</h2>
      <p class="text-sm text-slate-300/90">Carga items por URL o data URI. El orden de la lista define la reproduccion.</p>
    </header>

    <div class="rounded-xl border border-indigo-400/30 bg-indigo-950/20 p-3">
      <p class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-indigo-200">Motor de reproduccion</p>

      <div class="grid gap-2 md:grid-cols-4">
        <label class="text-xs text-slate-300 md:col-span-2">
          Monitor objetivo
          <select
            :value="playbackState.targetMonitorId ?? ''"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
            @change="onTargetMonitorChange"
          >
            <option value="">Seleccionar monitor...</option>
            <option v-for="monitor in monitors" :key="monitor.id" :value="monitor.id">
              {{ monitor.label }} {{ monitorStates[monitor.id]?.isWindowOpen ? '(ventana abierta)' : '(sin ventana)' }}
            </option>
          </select>
        </label>

        <label class="text-xs text-slate-300">
          Item activo (indice)
          <input
            :value="playbackState.currentIndex"
            type="number"
            min="0"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
            @input="onCurrentIndexInput"
          />
        </label>

        <label class="text-xs text-slate-300">
          Intervalo auto (seg)
          <input
            :value="playbackState.intervalSeconds"
            type="number"
            min="1"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
            @input="onIntervalInput"
          />
        </label>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-2 text-xs text-slate-300">
          <input :checked="playbackState.autoplay" type="checkbox" @change="onAutoplayChange" />
          Avance automatico
        </label>

        <span class="text-xs" :class="selectedMonitorReady() ? 'text-emerald-200' : 'text-amber-200'">
          {{ selectedMonitorReady() ? 'Monitor listo para reproducir.' : 'El monitor objetivo requiere ventana abierta.' }}
        </span>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
          @click="emit('playback:start')"
        >
          Iniciar
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-500/45 bg-slate-700/40 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700/55 disabled:opacity-60"
          :disabled="!isPlaying || !playbackState.autoplay"
          @click="emit('playback:pause')"
        >
          Pausar
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-500/45 bg-slate-700/40 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700/55"
          @click="emit('playback:previous')"
        >
          Anterior
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-500/45 bg-slate-700/40 px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-700/55"
          @click="emit('playback:next')"
        >
          Siguiente
        </button>
        <button
          type="button"
          class="rounded-lg border border-rose-300/35 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
          @click="emit('playback:stop')"
        >
          Detener
        </button>
      </div>

      <p class="mt-2 text-xs text-slate-300/90">
        {{ playbackFeedback }}
      </p>
    </div>

    <div class="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3">
      <p class="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Agregar item</p>
      <div class="grid gap-2 md:grid-cols-2">
        <label class="text-xs text-slate-300">
          Tipo
          <select
            v-model="newItemKind"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
          >
            <option value="image">Imagen</option>
            <option value="video">Video</option>
          </select>
        </label>

        <label class="text-xs text-slate-300">
          Titulo
          <input
            v-model="newItemName"
            type="text"
            placeholder="Promo apertura"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
          />
        </label>
      </div>

      <label class="mt-2 block text-xs text-slate-300">
        Source (URL o data URI)
        <input
          v-model="newItemSource"
          type="text"
          placeholder="https://... o data:image/..."
          class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
          @input="newImageFileFeedback = null"
        />
      </label>

      <div v-if="newItemKind === 'image'" class="mt-2 grid gap-2 md:grid-cols-2">
        <label class="text-xs text-slate-300">
          Duracion (ms)
          <input
            v-model.number="newImageDurationMs"
            type="number"
            min="1"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
          />
        </label>

        <label class="text-xs text-slate-300">
          Archivo local (imagen)
          <input
            type="file"
            accept="image/*"
            class="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100 file:mr-2 file:rounded-md file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-100"
            @change="onNewImageFileChange"
          />
        </label>
      </div>

      <p v-if="newImageFileFeedback && newItemKind === 'image'" class="mt-2 text-xs text-amber-200">
        {{ newImageFileFeedback }}
      </p>

      <div v-else class="mt-2 grid gap-2 md:grid-cols-3">
        <label class="text-xs text-slate-300">
          Inicio (ms)
          <input
            v-model.number="newVideoStartAtMs"
            type="number"
            min="0"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
          />
        </label>

        <label class="text-xs text-slate-300">
          Fin (ms, opcional)
          <input
            v-model="newVideoEndAtMs"
            type="text"
            placeholder="vacio = hasta el final"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
          />
        </label>

        <label class="mt-6 flex items-center gap-2 text-xs text-slate-300">
          <input v-model="newVideoMuted" type="checkbox" />
          Iniciar en mute
        </label>
      </div>

      <div class="mt-3 flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25"
          @click="addItem"
        >
          Agregar a playlist
        </button>
        <p v-if="formError" class="text-xs text-amber-200">{{ formError }}</p>
      </div>
    </div>

    <div v-if="items.length === 0" class="rounded-xl border border-slate-700/70 bg-slate-950/40 p-4 text-sm text-slate-300/90">
      La playlist esta vacia. Agrega el primer item para comenzar.
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="(item, index) in items"
        :key="item.id"
        class="rounded-xl border border-slate-700/70 bg-slate-950/40 p-3"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300/80">
            #{{ index + 1 }} · {{ item.kind === 'image' ? 'Imagen' : 'Video' }}
          </p>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-600/60 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700/60 disabled:opacity-50"
              :disabled="index === 0"
              @click="moveItem(item.id, 'up')"
            >
              Subir
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-600/60 px-2 py-1 text-xs text-slate-100 hover:bg-slate-700/60 disabled:opacity-50"
              :disabled="index === items.length - 1"
              @click="moveItem(item.id, 'down')"
            >
              Bajar
            </button>
            <button
              type="button"
              class="rounded-md border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20"
              @click="removeItem(item.id)"
            >
              Eliminar
            </button>
          </div>
        </div>

        <div class="grid gap-2 md:grid-cols-2">
          <label class="text-xs text-slate-300">
            Tipo
            <select
              :value="item.kind"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
              @change="onItemKindChange(item.id, $event)"
            >
              <option value="image">Imagen</option>
              <option value="video">Video</option>
            </select>
          </label>

          <label class="text-xs text-slate-300">
            Titulo
            <input
              :value="item.name"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
              @input="onItemNameInput(item.id, $event)"
            />
          </label>
        </div>

        <label class="mt-2 block text-xs text-slate-300">
          Source (URL o data URI)
          <input
            :value="item.source"
            type="text"
            class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
            @input="onItemSourceInput(item.id, $event)"
          />
        </label>

        <div v-if="item.kind === 'image'" class="mt-2 grid gap-2 md:grid-cols-2">
          <label class="text-xs text-slate-300">
            Duracion (ms)
            <input
              :value="item.durationMs"
              type="number"
              min="1"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
              @input="onImageDurationInput(item.id, $event)"
            />
          </label>

          <label class="text-xs text-slate-300">
            Archivo local (imagen)
            <input
              type="file"
              accept="image/*"
              class="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100 file:mr-2 file:rounded-md file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-100"
              @change="onItemImageFileChange(item.id, $event)"
            />
          </label>
        </div>

        <p v-if="item.kind === 'image' && itemImageFileFeedback[item.id]" class="mt-2 text-xs text-amber-200">
          {{ itemImageFileFeedback[item.id] }}
        </p>

        <div v-else class="mt-2 grid gap-2 md:grid-cols-3">
          <label class="text-xs text-slate-300">
            Inicio (ms)
            <input
              :value="item.startAtMs"
              type="number"
              min="0"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
              @input="onVideoStartInput(item.id, $event)"
            />
          </label>

          <label class="text-xs text-slate-300">
            Fin (ms, opcional)
            <input
              :value="item.endAtMs ?? ''"
              type="text"
              class="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/70 px-2 py-2 text-sm text-slate-100"
              @input="onVideoEndInput(item.id, $event)"
            />
          </label>

          <label class="mt-6 flex items-center gap-2 text-xs text-slate-300">
            <input
              :checked="item.muted"
              type="checkbox"
              @change="onVideoMutedChange(item.id, $event)"
            />
            Mute
          </label>
        </div>
      </li>
    </ul>
  </section>
</template>
