<script setup lang="ts">
import {
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import MonitorList from './components/MonitorList.vue';
import PlaylistManager from './components/PlaylistManager.vue';
import RemotePairingModal from './components/RemotePairingModal.vue';
import WhiteboardEditorModal from './components/WhiteboardEditorModal.vue';
import { useMultiMonitorBroadcaster } from './composables/useMultiMonitorBroadcaster';
import { usePlaylistPlayback } from './composables/usePlaylistPlayback';
import { useRemoteHostSync } from './composables/useRemoteHostSync';
import {
  createDebouncedSessionSaver,
  loadPersistedSession,
  SESSION_SCHEMA_VERSION,
  type PersistedLayout,
  type PersistedMonitorState,
  type PersistedMonitorStateMap,
  type PersistedSessionV1
} from './services/persistence';
import { DEFAULT_TRANSFORM, type MonitorDescriptor } from './types/broadcaster';
import { sanitizeMirrorModeConfig, type MirrorModeConfig } from './types/mirrorMode';
import type { MultimediaItem, PlaylistPlaybackState } from './types/playlist';
import {
  DEFAULT_CONTENT_TRANSITION,
  sanitizeContentTransition,
  type ContentTransition
} from './types/transitions';
import {
  createDefaultFilterPipeline,
  sanitizeFilterPipeline,
  sanitizeFilterPresetList,
  type MonitorFilterPipeline,
  type MonitorFilterPreset
} from './types/filters';
import { buildVideoSyncPlan } from './types/videoSync';
import type { WhiteboardState } from './types/whiteboard';
import type { RemoteMonitorDescriptor } from './types/remoteSync';

const FILE_IMPORT_BLOCK_MESSAGE = 'Para importar archivo, sal del fullscreen o usa Drag & Drop / pegar imagen.';

const persistedSession = loadPersistedSession();
const isRemotePairingModalOpen = ref(false);

const {
  room: remotePairingRoom,
  roomExpiresInMs,
  isConnecting: isRemoteRoomConnecting,
  pairingError: remotePairingError,
  pendingApprovals: remotePendingApprovals,
  remoteMonitors,
  createPairingRoom,
  approveClient,
  sendControlMessage,
  disconnectRemoteMonitor,
  closeRoom: closeRemotePairingRoom
} = useRemoteHostSync();

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

const toVirtualRemoteMonitorDescriptor = (
  remoteMonitor: RemoteMonitorDescriptor,
  index: number
): MonitorDescriptor => {
  const pseudoScreen = {
    width: 1920,
    height: 1080,
    left: 0,
    top: 0,
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
    label: remoteMonitor.label
  } as unknown as ScreenDetailed;

  return {
    id: remoteMonitor.id,
    label: remoteMonitor.label,
    width: 1920,
    height: 1080,
    left: 0,
    top: 0,
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
    isMasterAppScreen: false,
    raw: pseudoScreen
  };
};

const {
  applyTransform,
  closeAllWindows,
  clearWhiteboardForMonitor,
  closeWindow,
  globalError,
  hasDetectedMonitors,
  isLoadingMonitors,
  isWindowManagementSupported,
  monitorStates,
  monitorThumbnails,
  monitorWhiteboards,
  mirrorConfig,
  mirrorStatus,
  monitors,
  persistableMonitorStates,
  loadMonitors,
  setVirtualMonitors: setVirtualMonitorsFromBroadcaster = () => {},
  openWindowForMonitor,
  requestFullscreen,
  flashMonitorId,
  sendVideoSyncCommand,
  setMirrorEnabled,
  setMirrorSourceMonitorId,
  setMirrorTargetMonitorIds,
  setMonitorCustomName,
  setContentTransitionForMonitor,
  setFilterPipelineForMonitor,
  saveFilterPresetForMonitor,
  applyFilterPresetForMonitor,
  deleteFilterPresetForMonitor,
  setImageForMonitor,
  setExternalUrlForMonitor,
  startExternalAppCaptureForMonitor,
  stopExternalAppCaptureForMonitor,
  clearExternalUrlForMonitor,
  reloadExternalUrlForMonitor,
  navigateExternalUrlForMonitor,
  setWhiteboardStateForMonitor,
  undoWhiteboardForMonitor,
  setPlaylistItemForMonitor
} = useMultiMonitorBroadcaster({
  initialMonitorStateById: persistedSession.monitors,
  initialMirrorMode: persistedSession.mirror,
  remoteMessageDispatcher: (monitorId, message) => {
    const isRemoteMonitor = remoteMonitors.value.some((remoteMonitor) => remoteMonitor.id === monitorId);
    if (!isRemoteMonitor) {
      return false;
    }

    sendControlMessage({ remoteMonitorId: monitorId, message });
    return true;
  }
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
const activeWhiteboardMonitorId = ref<string | null>(null);

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
      contentTransition: sanitizeContentTransition(state.contentTransition),
      filterPipeline: sanitizeFilterPipeline(state.filterPipeline),
      filterPresets: sanitizeFilterPresetList(state.filterPresets),
      imageDataUrl: typeof state.imageDataUrl === 'string' ? state.imageDataUrl : null,
      externalUrl: typeof state.externalUrl === 'string' ? state.externalUrl : null,
      customName: typeof state.customName === 'string' ? state.customName : null
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
        if (
          typeof item.durationMs !== 'number' ||
          !Number.isFinite(item.durationMs) ||
          typeof item.startAtMs !== 'number' ||
          !Number.isFinite(item.startAtMs)
        ) {
          return null;
        }

        return {
          id: item.id,
          kind: 'image',
          name: item.name,
          source: item.source,
          durationMs: item.durationMs,
          startAtMs: 0,
          endAtMs: null,
          transition: sanitizeContentTransition(item.transition)
        };
      }

      if (item.kind === 'external-url') {
        return {
          id: item.id,
          kind: 'external-url',
          name: item.name,
          source: item.source,
          durationMs: item.durationMs,
          startAtMs: 0,
          endAtMs: null,
          transition: sanitizeContentTransition(item.transition)
        };
      }

      if (
        typeof item.durationMs !== 'number' ||
        !Number.isFinite(item.durationMs) ||
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
        durationMs: item.durationMs,
        startAtMs: item.startAtMs,
        endAtMs: item.endAtMs,
        transition: sanitizeContentTransition(item.transition),
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
            contentTransition: sanitizeContentTransition(monitorState.contentTransition),
            filterPipeline: sanitizeFilterPipeline(monitorState.filterPipeline),
            filterPresets: sanitizeFilterPresetList(monitorState.filterPresets),
            imageDataUrl:
              typeof monitorState.imageDataUrl === 'string' ? monitorState.imageDataUrl : null,
            externalUrl:
              typeof monitorState.externalUrl === 'string' ? monitorState.externalUrl : null,
            customName: typeof monitorState.customName === 'string' ? monitorState.customName : null
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
const remoteMonitorIdSet = computed(() => new Set(remoteMonitors.value.map((monitor) => monitor.id)));
const remoteMonitorMetaById = computed(() =>
  remoteMonitors.value.reduce<Record<string, {
    isConnected: boolean;
    isFullscreenSupported: boolean;
    isFullscreenAvailable: boolean;
  }>>((next, monitor) => {
    next[monitor.id] = {
      isConnected: monitor.state !== 'down',
      isFullscreenSupported: monitor.isFullscreenSupported,
      isFullscreenAvailable: monitor.isFullscreenAvailable
    };
    return next;
  }, {})
);

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

const hasActiveFullscreenSlave = computed(() =>
  Object.values(monitorStates).some((state) => state.isWindowOpen && state.isFullscreen)
);

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

const activeWhiteboardMonitor = computed(() =>
  monitors.value.find((monitor) => monitor.id === activeWhiteboardMonitorId.value) ?? null
);

const activeWhiteboardReferenceImage = computed(() => {
  const monitorId = activeWhiteboardMonitorId.value;
  if (!monitorId) {
    return null;
  }

  return monitorThumbnails[monitorId]?.imageDataUrl ?? null;
});

const activeWhiteboardState = computed(() => {
  const monitorId = activeWhiteboardMonitorId.value;
  if (!monitorId) {
    return { strokes: [] };
  }

  return monitorWhiteboards[monitorId] ?? { strokes: [] };
});

const openWhiteboardEditor = (monitorId: string) => {
  activeWhiteboardMonitorId.value = monitorId;
};

const closeWhiteboardEditor = () => {
  activeWhiteboardMonitorId.value = null;
};

const onWhiteboardStateChange = (monitorId: string, state: WhiteboardState) => {
  setWhiteboardStateForMonitor(monitorId, state);
};

const openRemotePairingModal = () => {
  isRemotePairingModalOpen.value = true;
};

const closeRemotePairingModal = () => {
  isRemotePairingModalOpen.value = false;
};

const createRemotePairingSession = async () => {
  await createPairingRoom();
};

const approveRemoteClientRequest = async (clientSocketId: string) => {
  await approveClient(clientSocketId);
};

const openWindowOnMonitor = (monitorId: string) => {
  if (remoteMonitorIdSet.value.has(monitorId)) {
    return;
  }

  openWindowForMonitor(monitorId);
};

const closeWindowOnMonitor = (monitorId: string) => {
  if (remoteMonitorIdSet.value.has(monitorId)) {
    return;
  }

  closeWindow(monitorId);
};

const disconnectRemoteMonitorFromHost = (monitorId: string) => {
  if (!remoteMonitorIdSet.value.has(monitorId)) {
    return;
  }

  disconnectRemoteMonitor(monitorId);
};

const requestFullscreenOnMonitor = (monitorId: string) => {
  const remoteMonitor = remoteMonitors.value.find((monitor) => monitor.id === monitorId) ?? null;
  if (!remoteMonitor) {
    requestFullscreen(monitorId);
    return;
  }

  if (!remoteMonitor.isFullscreenSupported) {
    if (monitorStates[monitorId]) {
      monitorStates[monitorId].lastError = null;
      monitorStates[monitorId].requiresFullscreenInteraction = false;
    }
    return;
  }

  if (!remoteMonitor.isFullscreenAvailable) {
    if (monitorStates[monitorId]) {
      monitorStates[monitorId].lastError = null;
      monitorStates[monitorId].requiresFullscreenInteraction = false;
    }
    return;
  }

  requestFullscreen(monitorId);
};

const uploadImage = (
  monitorId: string,
  file: File,
  source: 'file-picker' | 'drag-drop' | 'paste' = 'file-picker'
) => {
  if (source === 'file-picker' && hasActiveFullscreenSlave.value) {
    globalError.value = FILE_IMPORT_BLOCK_MESSAGE;
    return;
  }

  globalError.value = null;
  const runtimeBlobUrl = typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(file)
    : null;
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = event.target?.result;
    if (typeof data === 'string') {
      setImageForMonitor(monitorId, data, {
        renderSource: runtimeBlobUrl ?? data
      });
      return;
    }

    if (runtimeBlobUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(runtimeBlobUrl);
    }
    setImageForMonitor(monitorId, null);
  };
  reader.onerror = () => {
    if (runtimeBlobUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(runtimeBlobUrl);
    }
    setImageForMonitor(monitorId, null);
  };
  reader.onabort = () => {
    if (runtimeBlobUrl && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(runtimeBlobUrl);
    }
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

  setContentTransitionForMonitor(monitorId, sanitizeContentTransition(state.contentTransition));
  setFilterPipelineForMonitor(monitorId, sanitizeFilterPipeline(state.filterPipeline));
  if (monitorStates[monitorId]) {
    monitorStates[monitorId].filterPresets = sanitizeFilterPresetList(state.filterPresets);
  }
  if (state.externalUrl) {
    setExternalUrlForMonitor(monitorId, state.externalUrl);
  } else {
    setImageForMonitor(monitorId, state.imageDataUrl);
  }
  setMonitorCustomName(monitorId, state.customName ?? '');
};

const assignExternalUrlToMonitor = (monitorId: string, url: string) => {
  const applied = setExternalUrlForMonitor(monitorId, url);
  if (!applied) {
    return;
  }

  globalError.value = null;
};

const reloadExternalUrlOnMonitor = (monitorId: string) => {
  reloadExternalUrlForMonitor(monitorId);
};

const clearExternalUrlOnMonitor = (monitorId: string) => {
  clearExternalUrlForMonitor(monitorId);
};

const navigateExternalUrlOnMonitor = (
  monitorId: string,
  direction: 'back' | 'forward'
) => {
  navigateExternalUrlForMonitor(monitorId, direction);
};

const startExternalAppCaptureOnMonitor = async (monitorId: string) => {
  globalError.value = null;
  await startExternalAppCaptureForMonitor(monitorId);
};

const stopExternalAppCaptureOnMonitor = (monitorId: string) => {
  stopExternalAppCaptureForMonitor(monitorId, 'operator-stop');
};

const onMonitorTransitionChange = (monitorId: string, transition: ContentTransition) => {
  setContentTransitionForMonitor(monitorId, transition);
};

const onMonitorFilterPipelineChange = (monitorId: string, pipeline: MonitorFilterPipeline) => {
  setFilterPipelineForMonitor(monitorId, pipeline);
};

const onMonitorFilterPresetSave = (monitorId: string, presetName: string) => {
  saveFilterPresetForMonitor(monitorId, presetName);
};

const onMonitorFilterPresetApply = (monitorId: string, presetId: string) => {
  applyFilterPresetForMonitor(monitorId, presetId);
};

const onMonitorFilterPresetDelete = (monitorId: string, presetId: string) => {
  deleteFilterPresetForMonitor(monitorId, presetId);
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
      contentTransition: { ...DEFAULT_CONTENT_TRANSITION },
      filterPipeline: createDefaultFilterPipeline(),
      filterPresets: [] as MonitorFilterPreset[],
      imageDataUrl: null,
      externalUrl: null,
      customName: null
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

watch(remoteMonitors, (nextRemoteMonitors) => {
  setVirtualMonitorsFromBroadcaster(nextRemoteMonitors.map((remoteMonitor, index) =>
    toVirtualRemoteMonitorDescriptor(remoteMonitor, index)
  ));

  nextRemoteMonitors.forEach((remoteMonitor) => {
    if (!monitorStates[remoteMonitor.id]) {
      return;
    }

    monitorStates[remoteMonitor.id].isWindowOpen = remoteMonitor.state !== 'down';
    monitorStates[remoteMonitor.id].isSlaveReady = remoteMonitor.state === 'paired';
    if (!remoteMonitor.isFullscreenSupported || !remoteMonitor.isFullscreenAvailable) {
      monitorStates[remoteMonitor.id].requiresFullscreenInteraction = false;
      monitorStates[remoteMonitor.id].isFullscreen = false;
    }
    monitorStates[remoteMonitor.id].lastError =
      remoteMonitor.state === 'down'
        ? 'El monitor remoto perdio conexion.'
        : null;
  });
}, {
  deep: true,
  immediate: true
});

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

watch(monitors, (nextMonitors) => {
  if (!activeWhiteboardMonitorId.value) {
    return;
  }

  const stillExists = nextMonitors.some((monitor) => monitor.id === activeWhiteboardMonitorId.value);
  if (!stillExists) {
    activeWhiteboardMonitorId.value = null;
  }
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
  closeRemotePairingRoom();
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
          :thumbnails="monitorThumbnails"
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
          :remote-monitor-meta-by-id="remoteMonitorMetaById"
          :is-file-import-blocked="hasActiveFullscreenSlave"
          :file-import-blocked-message="FILE_IMPORT_BLOCK_MESSAGE"
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
          @open-window="openWindowOnMonitor"
          @close-window="closeWindowOnMonitor"
          @disconnect-remote="disconnectRemoteMonitorFromHost"
          @open-remote-pairing="openRemotePairingModal"
          @request-fullscreen="requestFullscreenOnMonitor"
          @flash-monitor-id="flashMonitorId"
          @upload-image="uploadImage"
          @clear-image="(id) => setImageForMonitor(id, null)"
          @assign-external-url="assignExternalUrlToMonitor"
          @reload-external-url="reloadExternalUrlOnMonitor"
          @clear-external-url="clearExternalUrlOnMonitor"
          @navigate-external-url="navigateExternalUrlOnMonitor"
          @start-external-app-capture="startExternalAppCaptureOnMonitor"
          @stop-external-app-capture="stopExternalAppCaptureOnMonitor"
          @open-whiteboard="openWhiteboardEditor"
          @rename-monitor="setMonitorCustomName"
          @set-content-transition="onMonitorTransitionChange"
          @set-filter-pipeline="onMonitorFilterPipelineChange"
          @save-filter-preset="onMonitorFilterPresetSave"
          @apply-filter-preset="onMonitorFilterPresetApply"
          @delete-filter-preset="onMonitorFilterPresetDelete"
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
          :is-file-import-blocked="hasActiveFullscreenSlave"
          :file-import-blocked-message="FILE_IMPORT_BLOCK_MESSAGE"
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

      <WhiteboardEditorModal
        v-if="activeWhiteboardMonitor"
        :monitor-id="activeWhiteboardMonitor.id"
        :monitor-label="activeWhiteboardMonitor.label"
        :monitor-resolution-label="`${activeWhiteboardMonitor.width}x${activeWhiteboardMonitor.height}`"
        :reference-image-data-url="activeWhiteboardReferenceImage"
        :state="activeWhiteboardState"
        @close="closeWhiteboardEditor"
        @state-change="onWhiteboardStateChange"
        @clear="clearWhiteboardForMonitor"
        @undo="undoWhiteboardForMonitor"
      />

      <RemotePairingModal
        :open="isRemotePairingModalOpen"
        :room="remotePairingRoom"
        :pending-approvals="remotePendingApprovals"
        :is-connecting="isRemoteRoomConnecting"
        :expires-in-ms="roomExpiresInMs"
        :error="remotePairingError"
        @close="closeRemotePairingModal"
        @create-room="createRemotePairingSession"
        @approve-client="approveRemoteClientRequest"
      />
    </div>
  </main>
</template>
