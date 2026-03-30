<script setup lang="ts">
import {
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import MonitorList from './components/MonitorList.vue';
import PlaylistManager from './components/PlaylistManager.vue';
import { useMultiMonitorBroadcaster } from './composables/useMultiMonitorBroadcaster';
import { usePlaylistPlayback } from './composables/usePlaylistPlayback';
import {
  createDebouncedSessionSaver,
  loadPersistedSession,
  SESSION_SCHEMA_VERSION,
  type PersistedLayout,
  type PersistedMonitorState,
  type PersistedMonitorStateMap,
  type PersistedSessionV1
} from './services/persistence';
import { DEFAULT_TRANSFORM } from './types/broadcaster';
import { sanitizeMirrorModeConfig, type MirrorModeConfig } from './types/mirrorMode';
import type { MultimediaItem, PlaylistPlaybackState } from './types/playlist';
import { buildVideoSyncPlan } from './types/videoSync';

const persistedSession = loadPersistedSession();

const clampPlaylistIndex = (index: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  if (index < 0) {
    return 0;
  }

  if (index >= total) {
    return total - 1;
  }

  return index;
};

const sanitizeTargetMonitorIds = (monitorIds: readonly string[]): string[] => {
  const deduped = new Set<string>();

  monitorIds.forEach((monitorId) => {
    const trimmed = monitorId.trim();
    if (trimmed.length === 0) {
      return;
    }

    deduped.add(trimmed);
  });

  return Array.from(deduped);
};

const normalizePlaybackByPlaylist = (
  playback: PlaylistPlaybackState,
  playlistLength: number
): PlaylistPlaybackState => ({
  ...playback,
  targetMonitorIds: sanitizeTargetMonitorIds(playback.targetMonitorIds),
  currentIndex: clampPlaylistIndex(playback.currentIndex, playlistLength),
  autoplay: playlistLength > 0 ? playback.autoplay : false
});

const {
  applyTransform,
  closeAllWindows,
  closeWindow,
  globalError,
  hasDetectedMonitors,
  isLoadingMonitors,
  isWindowManagementSupported,
  monitorStates,
  mirrorConfig,
  mirrorStatus,
  monitors,
  persistableMonitorStates,
  loadMonitors,
  openWindowForMonitor,
  requestFullscreen,
  sendVideoSyncCommand,
  setMirrorEnabled,
  setMirrorSourceMonitorId,
  setMirrorTargetMonitorIds,
  setImageForMonitor,
  setPlaylistItemForMonitor
} = useMultiMonitorBroadcaster({
  initialMonitorStateById: persistedSession.monitors,
  initialMirrorMode: persistedSession.mirror
});

const showOnlyProjectable = ref(persistedSession.ui.showOnlyProjectable);
const panelPreferences = ref(persistedSession.ui.panelPreferences);
const playlistItems = ref<MultimediaItem[]>(persistedSession.playlist);
const layouts = ref<PersistedLayout[]>(persistedSession.layouts);
const selectedLayoutId = ref<string | null>(persistedSession.layouts[0]?.id ?? null);
const layoutDraftName = ref<string>(persistedSession.layouts[0]?.name ?? '');
const layoutFeedback = ref<string | null>(
  persistedSession.layouts.length === 0
    ? 'No hay layouts guardados todavia. Guarda uno para reutilizar configuraciones.'
    : null
);
type MainViewTab = 'monitors' | 'playlist';
const activeMainViewTab = ref<MainViewTab>('monitors');
const playlistPlaybackState = ref<PlaylistPlaybackState>(
  normalizePlaybackByPlaylist(persistedSession.playback, persistedSession.playlist.length)
);
const sessionSaver = createDebouncedSessionSaver();

const {
  feedback: playlistPlaybackFeedback,
  isPlaying: isPlaylistPlaying,
  next: playNext,
  pause: pausePlaylist,
  previous: playPrevious,
  start: startPlaylist,
  stop: stopPlaylist
} = usePlaylistPlayback({
  items: playlistItems,
  playback: playlistPlaybackState,
  applyItemToMonitor: setPlaylistItemForMonitor,
  isMonitorReady: (monitorId: string) => Boolean(monitorStates[monitorId]?.isWindowOpen),
  sendVideoSyncCommand
});

const buildPersistablePanelPreferences = (): Record<string, boolean> => {
  const nextPreferences: Record<string, boolean> = {};

  Object.entries(panelPreferences.value).forEach(([key, enabled]) => {
    if (key.length > 0 && typeof enabled === 'boolean') {
      nextPreferences[key] = enabled;
    }
  });

  return nextPreferences;
};

const buildPersistableMonitorStateMap = (): PersistedMonitorStateMap => {
  const nextMap: PersistedMonitorStateMap = {};

  Object.entries(persistableMonitorStates.value).forEach(([monitorId, state]) => {
    if (monitorId.length === 0) {
      return;
    }

    nextMap[monitorId] = {
      transform: {
        rotate: state.transform.rotate,
        scale: state.transform.scale,
        translateX: state.transform.translateX,
        translateY: state.transform.translateY
      },
      imageDataUrl: typeof state.imageDataUrl === 'string' ? state.imageDataUrl : null
    };
  });

  return nextMap;
};

const buildPersistablePlaylist = (): MultimediaItem[] =>
  playlistItems.value
    .map((item): MultimediaItem | null => {
      if (
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.source !== 'string'
      ) {
        return null;
      }

      if (item.kind === 'image') {
        if (typeof item.durationMs !== 'number' || !Number.isFinite(item.durationMs)) {
          return null;
        }

        return {
          id: item.id,
          kind: 'image',
          name: item.name,
          source: item.source,
          durationMs: item.durationMs
        };
      }

      if (
        typeof item.startAtMs !== 'number' ||
        !Number.isFinite(item.startAtMs) ||
        typeof item.muted !== 'boolean' ||
        (item.endAtMs !== null &&
          (typeof item.endAtMs !== 'number' || !Number.isFinite(item.endAtMs)))
      ) {
        return null;
      }

      return {
        id: item.id,
        kind: 'video',
        name: item.name,
        source: item.source,
        startAtMs: item.startAtMs,
        endAtMs: item.endAtMs,
        muted: item.muted
      };
    })
    .filter((item): item is MultimediaItem => item !== null);

const buildPersistableMirrorMode = (): MirrorModeConfig =>
  sanitizeMirrorModeConfig(mirrorConfig.value);

const buildPersistableLayouts = (): PersistedLayout[] =>
  layouts.value.map((layout) => ({
    id: layout.id,
    name: layout.name,
    createdAt: layout.createdAt,
    updatedAt: layout.updatedAt,
    snapshot: {
      monitors: Object.entries(layout.snapshot.monitors).reduce<PersistedMonitorStateMap>(
        (nextMonitors, [monitorId, monitorState]) => {
          if (monitorId.length === 0) {
            return nextMonitors;
          }

          nextMonitors[monitorId] = {
            transform: {
              rotate: monitorState.transform.rotate,
              scale: monitorState.transform.scale,
              translateX: monitorState.transform.translateX,
              translateY: monitorState.transform.translateY
            },
            imageDataUrl:
              typeof monitorState.imageDataUrl === 'string' ? monitorState.imageDataUrl : null
          };

          return nextMonitors;
        },
        {}
      ),
      playback: {
        targetMonitorIds: sanitizeTargetMonitorIds(layout.snapshot.playback.targetMonitorIds),
        currentIndex: Math.max(0, Math.round(layout.snapshot.playback.currentIndex)),
        autoplay: layout.snapshot.playback.autoplay,
        intervalSeconds: Math.max(1, Math.round(layout.snapshot.playback.intervalSeconds))
      }
    }
  }));

const buildSessionSnapshot = (): PersistedSessionV1 => ({
  version: SESSION_SCHEMA_VERSION,
  ui: {
    showOnlyProjectable: showOnlyProjectable.value,
    panelPreferences: buildPersistablePanelPreferences()
  },
  monitors: buildPersistableMonitorStateMap(),
  playlist: buildPersistablePlaylist(),
  playback: {
    targetMonitorIds: sanitizeTargetMonitorIds(playlistPlaybackState.value.targetMonitorIds),
    currentIndex: Math.max(0, Math.round(playlistPlaybackState.value.currentIndex)),
    autoplay: playlistPlaybackState.value.autoplay,
    intervalSeconds: Math.max(1, Math.round(playlistPlaybackState.value.intervalSeconds))
  },
  mirror: buildPersistableMirrorMode(),
  layouts: buildPersistableLayouts()
});

const visibleMonitors = computed(() => {
  if (!showOnlyProjectable.value) {
    return monitors.value;
  }

  return monitors.value.filter((monitor) => !monitor.isMasterAppScreen);
});

const knownMonitorIds = computed(() => new Set(monitors.value.map((monitor) => monitor.id)));

const selectedTargetMonitorIds = computed(() =>
  sanitizeTargetMonitorIds(playlistPlaybackState.value.targetMonitorIds)
);

const hasAnyTargetMonitorWindowOpen = computed(() =>
  selectedTargetMonitorIds.value.some((monitorId) => Boolean(monitorStates[monitorId]?.isWindowOpen))
);

const openSlaveWindowsCount = computed(() =>
  Object.values(monitorStates).reduce(
    (total, state) => total + (state.isWindowOpen ? 1 : 0),
    0
  )
);

const canCloseAllWindows = computed(() => openSlaveWindowsCount.value > 0);

const openSelectedSlaveMonitorIds = computed(() =>
  selectedTargetMonitorIds.value.filter((monitorId) => Boolean(monitorStates[monitorId]?.isWindowOpen))
);

const availableLayouts = computed(() =>
  layouts.value
    .map((layout) => ({
      id: layout.id,
      name: layout.name,
      createdAt: layout.createdAt,
      updatedAt: layout.updatedAt
    }))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
);

const videoSyncPlan = computed(() =>
  buildVideoSyncPlan({
    openMonitorIds: openSelectedSlaveMonitorIds.value,
    preferredHostMonitorId: selectedTargetMonitorIds.value[0] ?? null
  })
);

const uploadImage = (monitorId: string, file: File) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = event.target?.result;
    if (typeof data === 'string') {
      setImageForMonitor(monitorId, data);
    }
  };
  reader.onerror = () => {
    setImageForMonitor(monitorId, null);
  };
  reader.readAsDataURL(file);
};

const createLayoutId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `layout-${Date.now()}-${Math.round(Math.random() * 1000)}`;
};

const applyPersistedMonitorState = (monitorId: string, state: PersistedMonitorState) => {
  applyTransform(monitorId, { type: 'reset' });

  if (state.transform.rotate !== 0) {
    applyTransform(monitorId, { type: 'rotate', value: state.transform.rotate });
  }

  if (state.transform.scale !== DEFAULT_TRANSFORM.scale) {
    applyTransform(monitorId, {
      type: 'scale',
      value: Number((state.transform.scale - DEFAULT_TRANSFORM.scale).toFixed(2))
    });
  }

  if (state.transform.translateX !== 0 || state.transform.translateY !== 0) {
    applyTransform(monitorId, {
      type: 'move',
      value: {
        x: state.transform.translateX,
        y: state.transform.translateY
      }
    });
  }

  setImageForMonitor(monitorId, state.imageDataUrl);
};

const saveCurrentLayout = () => {
  const name = layoutDraftName.value.trim();
  if (name.length === 0) {
    layoutFeedback.value = 'Ingresa un nombre para guardar el layout.';
    return;
  }

  const normalizedName = name.toLocaleLowerCase();
  const now = new Date().toISOString();
  const matchingLayout = layouts.value.find(
    (layout) => layout.name.toLocaleLowerCase() === normalizedName
  );

  if (matchingLayout && matchingLayout.id !== selectedLayoutId.value) {
    const shouldOverwrite =
      typeof window === 'undefined'
        ? true
        : window.confirm(
            `Ya existe un layout llamado "${matchingLayout.name}". ¿Deseas sobrescribirlo?`
          );

    if (!shouldOverwrite) {
      layoutFeedback.value = 'Guardado cancelado para evitar sobrescritura accidental.';
      return;
    }
  }

  const nextSnapshot = {
    monitors: buildPersistableMonitorStateMap(),
    playback: normalizePlaybackByPlaylist(playlistPlaybackState.value, playlistItems.value.length)
  };

  if (matchingLayout) {
    layouts.value = layouts.value.map((layout) =>
      layout.id === matchingLayout.id
        ? {
            ...layout,
            name,
            updatedAt: now,
            snapshot: nextSnapshot
          }
        : layout
    );
    selectedLayoutId.value = matchingLayout.id;
    layoutFeedback.value = `Layout "${name}" actualizado.`;
    return;
  }

  const id = createLayoutId();
  const createdLayout: PersistedLayout = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    snapshot: nextSnapshot
  };

  layouts.value = [createdLayout, ...layouts.value];
  selectedLayoutId.value = id;
  layoutFeedback.value = `Layout "${name}" guardado correctamente.`;
};

const loadSelectedLayout = () => {
  if (layouts.value.length === 0) {
    layoutFeedback.value = 'No hay layouts guardados para cargar.';
    return;
  }

  if (!selectedLayoutId.value) {
    layoutFeedback.value = 'Selecciona un layout para cargar.';
    return;
  }

  const selectedLayout = layouts.value.find((layout) => layout.id === selectedLayoutId.value);
  if (!selectedLayout) {
    layoutFeedback.value = 'El layout seleccionado ya no existe.';
    return;
  }

  if (isPlaylistPlaying.value) {
    pausePlaylist();
  }

  const loadedPlaybackState = normalizePlaybackByPlaylist(
    selectedLayout.snapshot.playback,
    playlistItems.value.length
  );

  const monitorIdsToApply = Array.from(knownMonitorIds.value);
  monitorIdsToApply.forEach((monitorId) => {
    const state = selectedLayout.snapshot.monitors[monitorId] ?? {
      transform: { ...DEFAULT_TRANSFORM },
      imageDataUrl: null
    };

    applyPersistedMonitorState(monitorId, state);
  });

  playlistPlaybackState.value = loadedPlaybackState;
  layoutDraftName.value = selectedLayout.name;
  layoutFeedback.value = `Layout "${selectedLayout.name}" restaurado.`;
};

const deleteSelectedLayout = () => {
  if (layouts.value.length === 0) {
    layoutFeedback.value = 'No hay layouts guardados para eliminar.';
    return;
  }

  if (!selectedLayoutId.value) {
    layoutFeedback.value = 'Selecciona un layout para eliminar.';
    return;
  }

  const selectedLayout = layouts.value.find((layout) => layout.id === selectedLayoutId.value);
  if (!selectedLayout) {
    layoutFeedback.value = 'El layout seleccionado ya no existe.';
    return;
  }

  const shouldDelete =
    typeof window === 'undefined'
      ? true
      : window.confirm(`¿Eliminar el layout "${selectedLayout.name}"? Esta accion no se puede deshacer.`);
  if (!shouldDelete) {
    layoutFeedback.value = 'Eliminacion cancelada.';
    return;
  }

  layouts.value = layouts.value.filter((layout) => layout.id !== selectedLayout.id);

  if (layouts.value.length === 0) {
    selectedLayoutId.value = null;
    layoutDraftName.value = '';
    layoutFeedback.value = `Layout "${selectedLayout.name}" eliminado. No quedan layouts guardados.`;
    return;
  }

  const fallbackLayout = layouts.value[0];
  selectedLayoutId.value = fallbackLayout?.id ?? null;
  layoutDraftName.value = fallbackLayout?.name ?? '';
  layoutFeedback.value = `Layout "${selectedLayout.name}" eliminado.`;
};

const onLayoutSelectionChange = (layoutId: string | null) => {
  selectedLayoutId.value = layoutId;

  if (!layoutId) {
    return;
  }

  const selectedLayout = layouts.value.find((layout) => layout.id === layoutId);
  if (selectedLayout) {
    layoutDraftName.value = selectedLayout.name;
    layoutFeedback.value = `Layout "${selectedLayout.name}" seleccionado.`;
  }
};

const onMirrorEnabledChange = (enabled: boolean) => {
  setMirrorEnabled(enabled);
};

const onMirrorSourceMonitorChange = (sourceMonitorId: string | null) => {
  setMirrorSourceMonitorId(sourceMonitorId);
};

const onMirrorTargetMonitorIdsChange = (targetMonitorIds: string[]) => {
  setMirrorTargetMonitorIds(targetMonitorIds);
};

watch(
  [
    showOnlyProjectable,
    panelPreferences,
    persistableMonitorStates,
    playlistItems,
    playlistPlaybackState,
    mirrorConfig,
    layouts
  ],
  () => {
    sessionSaver.schedule(buildSessionSnapshot());
  },
  {
    deep: true,
    immediate: true
  }
);

watch(
  [() => playlistItems.value.length, () => playlistPlaybackState.value.currentIndex, () => playlistPlaybackState.value.autoplay],
  () => {
    const normalized = normalizePlaybackByPlaylist(
      playlistPlaybackState.value,
      playlistItems.value.length
    );

    if (
      normalized.currentIndex === playlistPlaybackState.value.currentIndex
      && normalized.autoplay === playlistPlaybackState.value.autoplay
    ) {
      return;
    }

    playlistPlaybackState.value = normalized;
  },
  { immediate: true }
);

watch(
  [selectedTargetMonitorIds, hasDetectedMonitors, knownMonitorIds],
  ([targetMonitorIds, monitorsDetected, monitorIds]) => {
    if (!monitorsDetected) {
      return;
    }

    const validMonitorIds = targetMonitorIds.filter((monitorId) => monitorIds.has(monitorId));
    if (validMonitorIds.length === targetMonitorIds.length) {
      return;
    }

    playlistPlaybackState.value = {
      ...playlistPlaybackState.value,
      targetMonitorIds: validMonitorIds
    };
  }
);

watch(
  [selectedTargetMonitorIds, isPlaylistPlaying, hasAnyTargetMonitorWindowOpen],
  ([targetMonitorIds, playing, hasOpenTarget]) => {
    if (targetMonitorIds.length === 0 || !playing || hasOpenTarget) {
      return;
    }

    pausePlaylist();
  }
);

watch(layouts, (nextLayouts) => {
  if (nextLayouts.length === 0) {
    selectedLayoutId.value = null;
    return;
  }

  if (selectedLayoutId.value && nextLayouts.some((layout) => layout.id === selectedLayoutId.value)) {
    return;
  }

  selectedLayoutId.value = nextLayouts[0]?.id ?? null;
}, { deep: true });

const flushSessionSaver = () => {
  sessionSaver.flush();
};

onMounted(() => {
  window.addEventListener('beforeunload', flushSessionSaver);

  if (!isWindowManagementSupported) {
    return;
  }

  void loadMonitors();
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushSessionSaver);
  flushSessionSaver();
});
</script>

<template>
  <main class="app-shell">
    <div class="app-bg-shape app-bg-shape--one" />
    <div class="app-bg-shape app-bg-shape--two" />

    <div class="app-shell-content">
      <AppHeader
        :active-main-view-tab="activeMainViewTab"
        @update:active-main-view-tab="activeMainViewTab = $event"
      />

      <section
        id="panel-monitors"
        data-testid="panel-monitors"
        role="tabpanel"
        aria-labelledby="tab-monitors"
        v-show="activeMainViewTab === 'monitors'"
        class="space-y-6"
      >
        <section
          v-if="!isWindowManagementSupported"
          class="app-alert app-alert--rose p-5"
        >
          <p class="text-sm font-semibold">
            Este navegador no soporta Window Management API (`getScreenDetails`).
          </p>
          <p class="mt-1 text-sm text-rose-100/90">
            Usa Chrome/Edge actualizados y concede permiso para deteccion de pantallas.
          </p>
        </section>

        <section
          v-else-if="!hasDetectedMonitors"
          class="glass-panel flex flex-col items-center gap-5 px-6 py-16 text-center"
        >
          <p class="max-w-xl text-sm text-slate-200/90">
            Detecta pantallas para iniciar la sesion multi-monitor. Se solicitara permiso del navegador para acceder al detalle de monitores.
          </p>
          <button
            type="button"
            class="btn-with-icon btn-lg border border-indigo-300/35 bg-indigo-500/25 text-indigo-50 hover:bg-indigo-500/35"
            :disabled="isLoadingMonitors"
            @click="loadMonitors"
          >
            <MagnifyingGlassIcon aria-hidden="true" class="btn-icon" />
            {{ isLoadingMonitors ? 'Detectando monitores...' : 'Detectar pantallas' }}
          </button>
        </section>

        <MonitorList
          v-else
          :monitors="visibleMonitors"
          :states="monitorStates"
          :show-only-projectable="showOnlyProjectable"
          :total-monitors="monitors.length"
          :can-close-all-windows="canCloseAllWindows"
          :layouts="availableLayouts"
          :layout-draft-name="layoutDraftName"
          :selected-layout-id="selectedLayoutId"
          :layout-feedback="layoutFeedback"
          :mirror-enabled="mirrorConfig.enabled"
          :mirror-source-monitor-id="mirrorConfig.sourceMonitorId"
          :mirror-target-monitor-ids="mirrorConfig.targetMonitorIds"
          :mirror-active-target-count="mirrorStatus.activeTargetCount"
          :mirror-unavailable-target-ids="mirrorStatus.unavailableTargetIds"
          :mirror-last-error="mirrorStatus.lastError"
          @update:show-only-projectable="showOnlyProjectable = $event"
          @update:layout-draft-name="layoutDraftName = $event"
          @update:selected-layout-id="onLayoutSelectionChange"
          @update:mirror-enabled="onMirrorEnabledChange"
          @update:mirror-source-monitor-id="onMirrorSourceMonitorChange"
          @update:mirror-target-monitor-ids="onMirrorTargetMonitorIdsChange"
          @save-layout="saveCurrentLayout"
          @load-layout="loadSelectedLayout"
          @delete-layout="deleteSelectedLayout"
          @close-all="closeAllWindows"
          @open-window="openWindowForMonitor"
          @close-window="closeWindow"
          @request-fullscreen="requestFullscreen"
          @upload-image="uploadImage"
          @clear-image="(id) => setImageForMonitor(id, null)"
          @transform="applyTransform"
        />
      </section>

      <section
        id="panel-playlist"
        data-testid="panel-playlist"
        role="tabpanel"
        aria-labelledby="tab-playlist"
        v-show="activeMainViewTab === 'playlist'"
      >
        <PlaylistManager
          v-model:items="playlistItems"
          v-model:playback-state="playlistPlaybackState"
          :monitors="visibleMonitors"
          :monitor-states="monitorStates"
          :video-sync-plan="videoSyncPlan"
          :playback-feedback="playlistPlaybackFeedback"
          :is-playing="isPlaylistPlaying"
          @playback:start="startPlaylist"
          @playback:pause="pausePlaylist"
          @playback:next="playNext"
          @playback:previous="playPrevious"
          @playback:stop="stopPlaylist"
        />
      </section>

      <section
        v-if="globalError"
        class="app-alert app-alert--amber"
      >
        {{ globalError }}
      </section>
    </div>
  </main>
</template>
