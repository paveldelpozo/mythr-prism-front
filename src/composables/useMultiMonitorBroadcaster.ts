import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { buildSlaveWindowUrl } from '../services/slaveWindowUrl';
import {
  createDefaultMonitorState,
  DEFAULT_TRANSFORM,
  type MonitorDescriptor,
  type MonitorRuntimeState,
  type MonitorThumbnailStateMap,
  type MonitorStateMap,
  type MonitorTransform
} from '../types/broadcaster';
import {
  DEFAULT_MIRROR_MODE_CONFIG,
  DEFAULT_MIRROR_MODE_STATUS,
  sanitizeMirrorModeConfig,
  type MirrorModeConfig,
  type MirrorModeStatus
} from '../types/mirrorMode';
import {
  isKnownEnvelope,
  type MasterToSlaveMessage,
  MESSAGE_CHANNEL,
  type SlaveToMasterMessage,
  type VideoSyncPausePayload,
  type VideoSyncPlayPayload,
  type VideoSyncSeekPayload,
  type VideoSyncTimePayload
} from '../types/messages';
import type { PersistedMonitorStateMap } from '../services/persistence';
import { cloneSerializable } from '../utils/cloneSerializable';
import type { MultimediaItem } from '../types/playlist';
import {
  sanitizeContentTransition,
  type ContentTransition
} from '../types/transitions';
import {
  createEmptyWhiteboardState,
  sanitizeWhiteboardState,
  type MonitorWhiteboardStateMap,
  type WhiteboardState
} from '../types/whiteboard';
import { validateExternalUrl } from '../services/externalUrlPolicy';

type TransformAction =
  | { type: 'rotate'; value: number }
  | { type: 'scale'; value: number }
  | { type: 'move'; value: { x?: number; y?: number } }
  | { type: 'reset' };

interface WindowRegistryEntry {
  ref: Window;
  instanceToken: string;
}

interface UseMultiMonitorBroadcasterOptions {
  initialMonitorStateById?: PersistedMonitorStateMap;
  initialMirrorMode?: MirrorModeConfig;
}

interface SetImageForMonitorOptions {
  renderSource?: string | null;
  transition?: ContentTransition;
}

type ExternalUrlNavigationDirection = 'back' | 'forward';

type VideoSyncCommandType = 'VIDEO_SYNC_PLAY' | 'VIDEO_SYNC_PAUSE' | 'VIDEO_SYNC_SEEK' | 'VIDEO_SYNC_TIME';

type VideoSyncPayloadByType = {
  VIDEO_SYNC_PLAY: VideoSyncPlayPayload;
  VIDEO_SYNC_PAUSE: VideoSyncPausePayload;
  VIDEO_SYNC_SEEK: VideoSyncSeekPayload;
  VIDEO_SYNC_TIME: VideoSyncTimePayload;
};

const MIN_SCALE = 0.05;
const LIFE_CHECK_INTERVAL_MS = 1000;
const BLOB_URL_PREFIX = 'blob:';
const MONITOR_ID_FLASH_DURATION_MS = 2200;

const toMonitorId = (screen: ScreenDetailed, index: number): string =>
  `${index}-${screen.left}-${screen.top}-${screen.width}x${screen.height}`;

const createDescriptor = (
  screen: ScreenDetailed,
  index: number,
  isMasterAppScreen: boolean,
  customName: string | null
): MonitorDescriptor => ({
  id: toMonitorId(screen, index),
  label: (customName ?? screen.label?.trim()) || `Monitor ${index + 1}`,
  width: screen.width,
  height: screen.height,
  left: screen.left,
  top: screen.top,
  availLeft: screen.availLeft,
  availTop: screen.availTop,
  availWidth: screen.availWidth,
  availHeight: screen.availHeight,
  isPrimary: screen.isPrimary,
  isMasterAppScreen,
  raw: screen
});

const createInstanceToken = (monitorId: string): string =>
  `${monitorId}-${crypto.randomUUID()}`;

const createExternalUrlItem = (url: string): MultimediaItem => ({
  id: `external-url-${Date.now()}`,
  kind: 'external-url',
  name: `URL: ${url}`,
  source: url
});

const matchesDetailedScreen = (screen: ScreenDetailed, target: ScreenDetailed): boolean => {
  if (screen === target) {
    return true;
  }

  return (
    screen.left === target.left
    && screen.top === target.top
    && screen.width === target.width
    && screen.height === target.height
  );
};

const matchesFallbackScreen = (screen: ScreenDetailed, target: Screen): boolean => {
  const targetWithPlacement = target as Partial<ScreenDetailed>;
  const hasPlacementCoordinates =
    typeof targetWithPlacement.left === 'number' && typeof targetWithPlacement.top === 'number';

  if (hasPlacementCoordinates) {
    return (
      screen.left === targetWithPlacement.left
      && screen.top === targetWithPlacement.top
      && screen.width === target.width
      && screen.height === target.height
    );
  }

  return (
    screen.width === target.width
    && screen.height === target.height
    && screen.availWidth === target.availWidth
    && screen.availHeight === target.availHeight
  );
};

export const useMultiMonitorBroadcaster = (options: UseMultiMonitorBroadcasterOptions = {}) => {
  const monitors = ref<MonitorDescriptor[]>([]);
  const monitorStates = reactive<MonitorStateMap>({});
  const monitorThumbnails = reactive<MonitorThumbnailStateMap>({});
  const monitorWhiteboards = reactive<MonitorWhiteboardStateMap>({});
  const windowsRegistry = new Map<string, WindowRegistryEntry>();
  const monitorImageRenderSourceById = new Map<string, string | null>();
  const blobUrlUsageCountBySource = new Map<string, number>();
  const initialMonitorStateById = options.initialMonitorStateById ?? {};
  const monitorCustomNameById = reactive<Record<string, string>>({});

  Object.entries(initialMonitorStateById).forEach(([monitorId, state]) => {
    if (state.customName) {
      monitorCustomNameById[monitorId] = state.customName;
    }
  });
  const mirrorConfig = ref<MirrorModeConfig>(
    sanitizeMirrorModeConfig(options.initialMirrorMode ?? DEFAULT_MIRROR_MODE_CONFIG)
  );
  const mirrorStatus = ref<MirrorModeStatus>({ ...DEFAULT_MIRROR_MODE_STATUS });

  const isLoadingMonitors = ref(false);
  const globalError = ref<string | null>(null);
  const isWindowManagementSupported = typeof window.getScreenDetails === 'function';
  const hasDetectedMonitors = computed(() => monitors.value.length > 0);

  let screenDetailsRef: ScreenDetails | null = null;
  let lifecycleIntervalId: number | null = null;

  const applyPersistedState = (monitorId: string) => {
    const persistedState = initialMonitorStateById[monitorId];
    if (!persistedState) {
      return;
    }

    const state = monitorStates[monitorId];
    if (!state) {
      return;
    }

    state.transform = { ...persistedState.transform };
    state.contentTransition = sanitizeContentTransition(persistedState.contentTransition);
    state.imageDataUrl = persistedState.imageDataUrl;
    state.activeMediaItem = persistedState.externalUrl
      ? createExternalUrlItem(persistedState.externalUrl)
      : null;

    if (persistedState.customName) {
      monitorCustomNameById[monitorId] = persistedState.customName;
    }
  };

  const getMonitorState = (monitorId: string) => {
    if (!monitorStates[monitorId]) {
      monitorStates[monitorId] = createDefaultMonitorState();
      applyPersistedState(monitorId);
    }
    return monitorStates[monitorId];
  };

  const getMonitorThumbnail = (monitorId: string) => {
    if (!monitorThumbnails[monitorId]) {
      monitorThumbnails[monitorId] = {
        imageDataUrl: null,
        capturedAtMs: null
      };
    }

    return monitorThumbnails[monitorId];
  };

  const getMonitorWhiteboard = (monitorId: string): WhiteboardState => {
    if (!monitorWhiteboards[monitorId]) {
      monitorWhiteboards[monitorId] = createEmptyWhiteboardState();
    }

    return monitorWhiteboards[monitorId];
  };

  const setMonitorThumbnail = (monitorId: string, imageDataUrl: string | null, capturedAtMs: number | null) => {
    const thumbnail = getMonitorThumbnail(monitorId);
    thumbnail.imageDataUrl = imageDataUrl;
    thumbnail.capturedAtMs = capturedAtMs;
  };

  const persistableMonitorStates = computed<PersistedMonitorStateMap>(() => {
    const serializableStates: PersistedMonitorStateMap = {};

    Object.entries(monitorStates).forEach(([monitorId, state]) => {
      serializableStates[monitorId] = {
        transform: { ...state.transform },
        contentTransition: sanitizeContentTransition(state.contentTransition),
        imageDataUrl: state.imageDataUrl,
        externalUrl:
          state.activeMediaItem?.kind === 'external-url'
            ? state.activeMediaItem.source
            : null,
        customName: monitorCustomNameById[monitorId] ?? null
      };
    });

    return serializableStates;
  });

  const setMonitorError = (monitorId: string, message: string | null) => {
    const state = getMonitorState(monitorId);
    state.lastError = message;
  };

  const knownMonitorIdSet = (): Set<string> =>
    new Set(monitors.value.map((monitor) => monitor.id));

  const knownMonitorIdsForSanitization = (): ReadonlySet<string> | undefined => {
    const knownIds = knownMonitorIdSet();
    return knownIds.size > 0 ? knownIds : undefined;
  };

  const setMirrorConfig = (nextConfig: MirrorModeConfig) => {
    mirrorConfig.value = sanitizeMirrorModeConfig(nextConfig, {
      knownMonitorIds: knownMonitorIdsForSanitization()
    });
  };

  const clearMirrorTargets = (
    targetMonitorIds: readonly string[],
    sourceMonitorId: string | null
  ) => {
    targetMonitorIds.forEach((targetMonitorId) => {
      if (targetMonitorId === sourceMonitorId) {
        return;
      }

      const targetState = getMonitorState(targetMonitorId);
      targetState.imageDataUrl = null;
      targetState.activeMediaItem = null;
      monitorWhiteboards[targetMonitorId] = createEmptyWhiteboardState();
      setMonitorImageRenderSource(targetMonitorId, null);

      const clearMessage = buildMasterMessage(targetMonitorId, 'SET_IMAGE', {
        imageDataUrl: null
      });

      if (!clearMessage) {
        return;
      }

      const clearWhiteboardMessage = buildMasterMessage(targetMonitorId, 'WHITEBOARD_CLEAR', {
        reason: 'mirror-disabled'
      });

      const sent = sendToSlave(targetMonitorId, clearMessage);
      const sentWhiteboard = clearWhiteboardMessage ? sendToSlave(targetMonitorId, clearWhiteboardMessage) : true;
      if (sent && sentWhiteboard) {
        setMonitorError(targetMonitorId, null);
      }
    });
  };

  const setMirrorEnabled = (enabled: boolean) => {
    const previousConfig = sanitizeMirrorModeConfig(mirrorConfig.value, {
      knownMonitorIds: knownMonitorIdsForSanitization()
    });

    if (!enabled) {
      clearMirrorTargets(previousConfig.targetMonitorIds, previousConfig.sourceMonitorId);
      setMirrorConfig({ ...DEFAULT_MIRROR_MODE_CONFIG });
      mirrorStatus.value = {
        ...DEFAULT_MIRROR_MODE_STATUS,
        lastError: null
      };
      return;
    }

    setMirrorConfig({
      ...mirrorConfig.value,
      enabled
    });

    if (!mirrorConfig.value.sourceMonitorId) {
      mirrorStatus.value = {
        ...mirrorStatus.value,
        lastError: 'Selecciona un monitor origen para activar el modo espejo.'
      };
      return;
    }

    replicateSourceToMirrorTargets(mirrorConfig.value.sourceMonitorId);
  };

  const setMirrorSourceMonitorId = (sourceMonitorId: string | null) => {
    setMirrorConfig({
      ...mirrorConfig.value,
      sourceMonitorId
    });

    if (mirrorConfig.value.enabled && mirrorConfig.value.sourceMonitorId) {
      replicateSourceToMirrorTargets(mirrorConfig.value.sourceMonitorId);
    }
  };

  const setMirrorTargetMonitorIds = (targetMonitorIds: string[]) => {
    setMirrorConfig({
      ...mirrorConfig.value,
      targetMonitorIds
    });

    if (mirrorConfig.value.enabled && mirrorConfig.value.sourceMonitorId) {
      replicateSourceToMirrorTargets(mirrorConfig.value.sourceMonitorId);
    }
  };

  const cleanupMonitorWindow = (monitorId: string) => {
    const entry = windowsRegistry.get(monitorId);
    if (!entry) {
      return;
    }

    windowsRegistry.delete(monitorId);

    const state = getMonitorState(monitorId);
    state.isWindowOpen = false;
    state.isSlaveReady = false;
    state.isFullscreen = false;
    state.fullscreenIntentActive = false;
    state.lostFullscreenUnexpectedly = false;
    state.lastFullscreenExitAtMs = null;
    state.requiresFullscreenInteraction = true;
    setMonitorThumbnail(monitorId, null, null);
  };

  const closeWindow = (monitorId: string) => {
    const entry = windowsRegistry.get(monitorId);
    if (!entry) {
      return;
    }

    const closeMessage = buildMasterMessage(monitorId, 'REQUEST_CLOSE', {
      reason: 'Operator close command'
    });
    if (closeMessage) {
      sendToSlave(monitorId, closeMessage);
    }

    try {
      if (!entry.ref.closed) {
        entry.ref.close();
      }
    } catch {}

    cleanupMonitorWindow(monitorId);
  };

  const closeAllWindows = () => {
    Array.from(windowsRegistry.keys()).forEach(closeWindow);
  };

  const startLifecycleWatchdog = () => {
    if (lifecycleIntervalId !== null) {
      return;
    }

    lifecycleIntervalId = window.setInterval(() => {
      windowsRegistry.forEach((entry, monitorId) => {
        if (entry.ref.closed) {
          cleanupMonitorWindow(monitorId);
        }
      });
    }, LIFE_CHECK_INTERVAL_MS);
  };

  const stopLifecycleWatchdog = () => {
    if (lifecycleIntervalId === null) {
      return;
    }

    clearInterval(lifecycleIntervalId);
    lifecycleIntervalId = null;
  };

  const syncMonitorStateShape = (nextMonitors: MonitorDescriptor[]) => {
    const nextIds = new Set(nextMonitors.map((monitor) => monitor.id));

    nextMonitors.forEach((monitor) => {
      getMonitorState(monitor.id);
      getMonitorWhiteboard(monitor.id);
    });

    Object.keys(monitorStates).forEach((monitorId) => {
      if (nextIds.has(monitorId)) {
        return;
      }

      closeWindow(monitorId);
      setMonitorImageRenderSource(monitorId, null);
      delete monitorStates[monitorId];
      delete monitorThumbnails[monitorId];
      delete monitorWhiteboards[monitorId];
      delete monitorCustomNameById[monitorId];
    });

    mirrorConfig.value = sanitizeMirrorModeConfig(mirrorConfig.value, {
      knownMonitorIds: nextIds
    });
  };

  const sendToSlave = (monitorId: string, message: MasterToSlaveMessage): boolean => {
    const entry = windowsRegistry.get(monitorId);
    if (!entry || entry.ref.closed) {
      cleanupMonitorWindow(monitorId);
      setMonitorError(monitorId, 'La ventana esclava no esta disponible');
      return false;
    }

    try {
      const safeMessage = cloneSerializable(message);
      entry.ref.postMessage(safeMessage, '*');
      return true;
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Error al enviar mensaje';
      setMonitorError(monitorId, description);
      return false;
    }
  };

  const buildMasterMessage = <T extends MasterToSlaveMessage['type']>(
    monitorId: string,
    type: T,
    payload: Extract<MasterToSlaveMessage, { type: T }>['payload']
  ): Extract<MasterToSlaveMessage, { type: T }> | null => {
    const entry = windowsRegistry.get(monitorId);
    if (!entry) {
      return null;
    }

    return {
      channel: MESSAGE_CHANNEL,
      type,
      instanceToken: entry.instanceToken,
      monitorId,
      payload
    } as Extract<MasterToSlaveMessage, { type: T }>;
  };

  const buildContentMessage = (
    monitorId: string,
    state: MonitorRuntimeState,
    transitionOverride?: ContentTransition
  ): Extract<MasterToSlaveMessage, { type: 'SET_IMAGE' | 'SET_MEDIA' }> | null => {
    const transition = sanitizeContentTransition(transitionOverride ?? state.contentTransition);

    if (state.activeMediaItem) {
      return buildMasterMessage(monitorId, 'SET_MEDIA', {
        item: state.activeMediaItem,
        transition
      });
    }

    const renderSource = resolveImageRenderSource(monitorId, state);

    return buildMasterMessage(monitorId, 'SET_IMAGE', {
      imageDataUrl: renderSource,
      transition
    });
  };

  const buildWhiteboardStateMessage = (
    monitorId: string,
    state: WhiteboardState
  ): Extract<MasterToSlaveMessage, { type: 'WHITEBOARD_SET_STATE' }> | null =>
    buildMasterMessage(monitorId, 'WHITEBOARD_SET_STATE', {
      state: sanitizeWhiteboardState(state)
    });

  const shouldReplicateFromSource = (sourceMonitorId: string): boolean => {
    if (!mirrorConfig.value.enabled) {
      return false;
    }

    if (!mirrorConfig.value.sourceMonitorId) {
      return false;
    }

    return mirrorConfig.value.sourceMonitorId === sourceMonitorId;
  };

  const replicateSourceToMirrorTargets = (sourceMonitorId: string) => {
    if (!shouldReplicateFromSource(sourceMonitorId)) {
      return;
    }

    const sourceState = getMonitorState(sourceMonitorId);
    const sanitized = sanitizeMirrorModeConfig(mirrorConfig.value, {
      knownMonitorIds: knownMonitorIdsForSanitization()
    });
    mirrorConfig.value = sanitized;

    const unavailableTargetIds: string[] = [];
    let activeTargetCount = 0;

    sanitized.targetMonitorIds.forEach((targetMonitorId) => {
      if (targetMonitorId === sourceMonitorId) {
        return;
      }

      const targetState = getMonitorState(targetMonitorId);
      targetState.transform = { ...sourceState.transform };
      targetState.contentTransition = sanitizeContentTransition(sourceState.contentTransition);
      targetState.imageDataUrl = sourceState.imageDataUrl;
      targetState.activeMediaItem = sourceState.activeMediaItem;
      monitorWhiteboards[targetMonitorId] = sanitizeWhiteboardState(getMonitorWhiteboard(sourceMonitorId));
      setMonitorImageRenderSource(
        targetMonitorId,
        resolveImageRenderSource(sourceMonitorId, sourceState)
      );

      const transformMessage = buildMasterMessage(targetMonitorId, 'SET_TRANSFORM', {
        transform: targetState.transform
      });
      const contentMessage = buildContentMessage(targetMonitorId, targetState);
      const whiteboardMessage = buildWhiteboardStateMessage(
        targetMonitorId,
        monitorWhiteboards[targetMonitorId]
      );

      const hasReadyWindow =
        transformMessage !== null
        && contentMessage !== null
        && whiteboardMessage !== null;

      if (!hasReadyWindow) {
        unavailableTargetIds.push(targetMonitorId);
        setMonitorError(targetMonitorId, 'Destino espejo no disponible: abre la ventana del monitor destino.');
        return;
      }

      const sentTransform = sendToSlave(targetMonitorId, transformMessage);
      const sentContent = sendToSlave(targetMonitorId, contentMessage);
      const sentWhiteboard = sendToSlave(targetMonitorId, whiteboardMessage);

      if (!sentTransform || !sentContent || !sentWhiteboard) {
        unavailableTargetIds.push(targetMonitorId);
        return;
      }

      activeTargetCount += 1;
      setMonitorError(targetMonitorId, null);
    });

    mirrorStatus.value = {
      activeTargetCount,
      unavailableTargetIds,
      lastReplicatedAtMs: Date.now(),
      lastError:
        unavailableTargetIds.length > 0
          ? `Modo espejo con degradacion: ${unavailableTargetIds.length} destino(s) no disponibles.`
          : null
    };
  };

  const pushCurrentStateToSlave = (monitorId: string) => {
    const state = getMonitorState(monitorId);

    const transformMsg = buildMasterMessage(monitorId, 'SET_TRANSFORM', {
      transform: state.transform
    });
    const contentMsg = buildContentMessage(monitorId, state);

    if (transformMsg) {
      sendToSlave(monitorId, transformMsg);
    }
    if (contentMsg) {
      sendToSlave(monitorId, contentMsg);
    }

    const whiteboardMessage = buildWhiteboardStateMessage(
      monitorId,
      getMonitorWhiteboard(monitorId)
    );
    if (whiteboardMessage) {
      sendToSlave(monitorId, whiteboardMessage);
    }
  };

  const onMessageFromSlave = (event: MessageEvent<unknown>) => {
    if (!isKnownEnvelope(event.data)) {
      return;
    }

    const message = event.data as SlaveToMasterMessage;
    const monitorId = message.monitorId;
    const state = getMonitorState(monitorId);
    const entry = windowsRegistry.get(monitorId);

    if (!entry || event.source !== entry.ref || message.instanceToken !== entry.instanceToken) {
      return;
    }

    if (message.type === 'SLAVE_READY') {
      state.isWindowOpen = true;
      state.isSlaveReady = true;
      state.lastError = null;
      pushCurrentStateToSlave(monitorId);
      replicateSourceToMirrorTargets(monitorId);
      return;
    }

    if (message.type === 'FULLSCREEN_STATUS') {
      const wasFullscreenActive = state.isFullscreen;
      const intentActive = message.payload.intentActive ?? state.fullscreenIntentActive;
      const lostFullscreenUnexpectedly =
        Boolean(message.payload.unexpectedExit)
        || (wasFullscreenActive && !message.payload.active && intentActive);

      state.isFullscreen = message.payload.active;
      state.requiresFullscreenInteraction = message.payload.requiresInteraction;
      state.fullscreenIntentActive = intentActive || message.payload.active;
      state.lostFullscreenUnexpectedly = lostFullscreenUnexpectedly;
      state.lastFullscreenExitAtMs = lostFullscreenUnexpectedly ? Date.now() : null;
      state.lastError = message.payload.message ?? null;

      if (message.payload.active) {
        state.lostFullscreenUnexpectedly = false;
        state.lastFullscreenExitAtMs = null;
      }
      return;
    }

    if (message.type === 'SLAVE_CLOSING') {
      cleanupMonitorWindow(monitorId);
      return;
    }

    if (message.type === 'THUMBNAIL_SNAPSHOT') {
      const imageDataUrl = typeof message.payload.imageDataUrl === 'string'
        ? message.payload.imageDataUrl
        : null;
      const capturedAtMs = Number.isFinite(message.payload.capturedAtMs)
        ? Math.max(0, Math.round(message.payload.capturedAtMs))
        : Date.now();

      setMonitorThumbnail(monitorId, imageDataUrl, imageDataUrl ? capturedAtMs : null);
      return;
    }

    if (message.type === 'SLAVE_ERROR') {
      state.lastError = message.payload.message;
    }
  };

  const shutdownAllWindows = () => {
    closeAllWindows();
    stopLifecycleWatchdog();
  };

  const onBeforeUnload = () => {
    shutdownAllWindows();
  };

  const refreshMonitorList = () => {
    if (!screenDetailsRef) {
      return;
    }

    const screens = screenDetailsRef.screens;
    const currentScreen = screenDetailsRef.currentScreen;
    const currentScreenIndex = currentScreen
      ? screens.findIndex((screen) => matchesDetailedScreen(screen, currentScreen))
      : -1;
    const fallbackScreenIndex = screens.findIndex((screen) => matchesFallbackScreen(screen, window.screen));
    const masterScreenIndex = currentScreenIndex >= 0 ? currentScreenIndex : fallbackScreenIndex;

    const nextMonitors = screens.map((screen, index) => {
      const monitorId = toMonitorId(screen, index);
      const customName = monitorCustomNameById[monitorId] ?? null;

      return createDescriptor(screen, index, index === masterScreenIndex, customName);
    });
    monitors.value = nextMonitors;
    syncMonitorStateShape(nextMonitors);
  };

  const setMonitorCustomName = (monitorId: string, nextName: string) => {
    const safeName = nextName.trim().slice(0, 80);

    if (safeName.length === 0) {
      delete monitorCustomNameById[monitorId];
    } else {
      monitorCustomNameById[monitorId] = safeName;
    }

    const monitorIndex = monitors.value.findIndex((monitor) => monitor.id === monitorId);
    if (monitorIndex < 0) {
      return;
    }

    const monitor = monitors.value[monitorIndex];
    if (!monitor) {
      return;
    }

    const fallbackLabel = monitor.raw.label?.trim() || `Monitor ${monitorIndex + 1}`;
    monitors.value[monitorIndex] = {
      ...monitor,
      label: safeName.length > 0 ? safeName : fallbackLabel
    };
  };

  const loadMonitors = async () => {
    if (isLoadingMonitors.value) {
      return;
    }

    globalError.value = null;

    if (!isWindowManagementSupported) {
      globalError.value =
        'La API Window Management no esta disponible en este navegador. Prueba Chrome/Edge reciente con permisos habilitados.';
      return;
    }

    const getScreenDetails = window.getScreenDetails;
    if (!getScreenDetails) {
      globalError.value = 'La API Window Management no esta disponible en este navegador.';
      return;
    }

    isLoadingMonitors.value = true;
    try {
      screenDetailsRef?.removeEventListener('screenschange', refreshMonitorList);
      screenDetailsRef?.removeEventListener('currentscreenchange', refreshMonitorList);

      const nextScreenDetails = await getScreenDetails();
      if (!nextScreenDetails) {
        globalError.value = 'No se pudo obtener detalle de pantallas.';
        return;
      }

      screenDetailsRef = nextScreenDetails;

      screenDetailsRef.addEventListener('screenschange', refreshMonitorList);
      screenDetailsRef.addEventListener('currentscreenchange', refreshMonitorList);

      refreshMonitorList();
      startLifecycleWatchdog();
    } catch (error) {
      const defaultMessage = 'No se pudieron detectar las pantallas.';
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        globalError.value =
          'Permiso denegado para leer pantallas. Permite acceso a Window Management e intenta de nuevo.';
      } else {
        globalError.value = error instanceof Error ? error.message : defaultMessage;
      }
    } finally {
      isLoadingMonitors.value = false;
    }
  };

  const openWindowForMonitor = (monitorId: string) => {
    const monitor = monitors.value.find((item) => item.id === monitorId);
    if (!monitor) {
      return;
    }

    closeWindow(monitorId);

    const instanceToken = createInstanceToken(monitorId);
    const slaveWindowUrl = buildSlaveWindowUrl({
      monitorId,
      instanceToken
    });
    const features = [
      'popup=yes',
      `left=${monitor.availLeft}`,
      `top=${monitor.availTop}`,
      `width=${monitor.availWidth}`,
      `height=${monitor.availHeight}`
    ].join(',');

    const win = window.open(slaveWindowUrl, '_blank', features);

    if (!win) {
      setMonitorError(monitorId, 'El navegador bloqueo la ventana emergente. Habilita popups para continuar.');
      return;
    }

    windowsRegistry.set(monitorId, {
      ref: win,
      instanceToken
    });

    const state = getMonitorState(monitorId);
    state.isWindowOpen = true;
    state.isSlaveReady = false;
    state.isFullscreen = false;
    state.fullscreenIntentActive = true;
    state.lostFullscreenUnexpectedly = false;
    state.lastFullscreenExitAtMs = null;
    state.requiresFullscreenInteraction = true;
    state.lastError =
      'Abre la ventana esclava y pulsa "Activar Fullscreen" en esa pantalla para completar el modo proyeccion.';

    const initMessage = buildMasterMessage(monitorId, 'MASTER_INIT', {
      monitorLabel: monitor.label
    });
    if (initMessage) {
      sendToSlave(monitorId, initMessage);
    }

    const fullscreenMessage = buildMasterMessage(monitorId, 'REQUEST_FULLSCREEN', {
      reason: 'Initial open flow'
    });
    if (fullscreenMessage) {
      sendToSlave(monitorId, fullscreenMessage);
    }
  };

  const applyTransform = (monitorId: string, action: TransformAction) => {
    const state = getMonitorState(monitorId);
    const current = state.transform;

    let nextTransform: MonitorTransform = current;

    if (action.type === 'rotate') {
      nextTransform = { ...current, rotate: current.rotate + action.value };
    }
    if (action.type === 'scale') {
      nextTransform = {
        ...current,
        scale: Math.max(MIN_SCALE, Number((current.scale + action.value).toFixed(2)))
      };
    }
    if (action.type === 'move') {
      nextTransform = {
        ...current,
        translateX: current.translateX + (action.value.x ?? 0),
        translateY: current.translateY + (action.value.y ?? 0)
      };
    }
    if (action.type === 'reset') {
      nextTransform = { ...DEFAULT_TRANSFORM };
    }

    state.transform = nextTransform;

    const message = buildMasterMessage(monitorId, 'SET_TRANSFORM', {
      transform: nextTransform
    });
    if (message) {
      sendToSlave(monitorId, message);
    }

    replicateSourceToMirrorTargets(monitorId);
  };

  const isBlobUrl = (value: string): boolean =>
    value.startsWith(BLOB_URL_PREFIX);

  const incrementBlobUrlUsage = (source: string) => {
    if (!isBlobUrl(source)) {
      return;
    }

    const currentUsage = blobUrlUsageCountBySource.get(source) ?? 0;
    blobUrlUsageCountBySource.set(source, currentUsage + 1);
  };

  const decrementBlobUrlUsage = (source: string) => {
    if (!isBlobUrl(source)) {
      return;
    }

    const currentUsage = blobUrlUsageCountBySource.get(source) ?? 0;
    if (currentUsage <= 1) {
      blobUrlUsageCountBySource.delete(source);
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(source);
      }
      return;
    }

    blobUrlUsageCountBySource.set(source, currentUsage - 1);
  };

  const setMonitorImageRenderSource = (monitorId: string, nextSource: string | null) => {
    const previousSource = monitorImageRenderSourceById.get(monitorId) ?? null;
    if (previousSource === nextSource) {
      return;
    }

    if (typeof previousSource === 'string' && previousSource.length > 0) {
      decrementBlobUrlUsage(previousSource);
    }

    if (typeof nextSource === 'string' && nextSource.length > 0) {
      monitorImageRenderSourceById.set(monitorId, nextSource);
      incrementBlobUrlUsage(nextSource);
      return;
    }

    monitorImageRenderSourceById.delete(monitorId);
  };

  const resolveImageRenderSource = (monitorId: string, state: MonitorRuntimeState): string | null => {
    const renderSource = monitorImageRenderSourceById.get(monitorId);
    if (typeof renderSource === 'string' && renderSource.length > 0) {
      return renderSource;
    }

    return state.imageDataUrl;
  };

  const setImageForMonitorWithOptions = (
    monitorId: string,
    imageDataUrl: string | null,
    options: SetImageForMonitorOptions = {}
  ) => {
    const state = getMonitorState(monitorId);
    state.imageDataUrl = imageDataUrl;
    state.activeMediaItem = null;
    const transition = sanitizeContentTransition(options.transition ?? state.contentTransition);
    const renderSource = options.renderSource === undefined
      ? imageDataUrl
      : options.renderSource;

    setMonitorThumbnail(monitorId, null, null);
    setMonitorImageRenderSource(monitorId, renderSource);
    state.contentTransition = transition;

    const message = buildMasterMessage(monitorId, 'SET_IMAGE', {
      imageDataUrl: resolveImageRenderSource(monitorId, state),
      transition
    });
    if (message) {
      sendToSlave(monitorId, message);
    }

    replicateSourceToMirrorTargets(monitorId);
  };

  const setImageForMonitor = (
    monitorId: string,
    imageDataUrl: string | null,
    options: SetImageForMonitorOptions = {}
  ) => {
    setImageForMonitorWithOptions(monitorId, imageDataUrl, options);
  };

  const setPlaylistItemForMonitor = (
    monitorId: string,
    item: MultimediaItem | null,
    transitionOverride?: ContentTransition
  ): boolean => {
    const state = getMonitorState(monitorId);
    const transition = sanitizeContentTransition(transitionOverride ?? state.contentTransition);

    if (item?.kind === 'external-url') {
      const validation = validateExternalUrl(item.source);
      if (!validation.ok || !validation.normalizedUrl) {
        state.lastError = validation.message ?? 'La URL externa no cumple la politica de seguridad.';
        replicateSourceToMirrorTargets(monitorId);
        return false;
      }

      item = {
        ...item,
        source: validation.normalizedUrl
      };
    }

    state.activeMediaItem = item;
    setMonitorThumbnail(monitorId, null, null);

    const message = buildMasterMessage(monitorId, 'SET_MEDIA', {
      item,
      transition
    });
    if (!message) {
      replicateSourceToMirrorTargets(monitorId);
      return false;
    }

    const sent = sendToSlave(monitorId, message);
    replicateSourceToMirrorTargets(monitorId);
    return sent;
  };

  const setExternalUrlForMonitor = (monitorId: string, url: string): boolean => {
    const validation = validateExternalUrl(url);
    if (!validation.ok || !validation.normalizedUrl) {
      setMonitorError(
        monitorId,
        validation.message ?? 'La URL externa no cumple la politica de seguridad.'
      );
      return false;
    }

    const item = createExternalUrlItem(validation.normalizedUrl);
    const sent = setPlaylistItemForMonitor(monitorId, item);
    if (sent) {
      setMonitorError(monitorId, null);
    }
    return sent;
  };

  const clearExternalUrlForMonitor = (monitorId: string) => {
    const state = getMonitorState(monitorId);
    if (state.activeMediaItem?.kind !== 'external-url') {
      return;
    }

    state.activeMediaItem = null;
    setImageForMonitorWithOptions(monitorId, null, {
      renderSource: null,
      transition: state.contentTransition
    });
  };

  const reloadExternalUrlForMonitor = (monitorId: string): boolean => {
    const state = getMonitorState(monitorId);
    if (state.activeMediaItem?.kind !== 'external-url') {
      setMonitorError(monitorId, 'No hay una URL externa activa para recargar.');
      return false;
    }

    const message = buildMasterMessage(monitorId, 'EXTERNAL_URL_RELOAD', {
      reason: 'operator-reload'
    });

    if (!message) {
      setMonitorError(monitorId, 'No hay una ventana activa para recargar la URL externa.');
      return false;
    }

    return sendToSlave(monitorId, message);
  };

  const navigateExternalUrlForMonitor = (
    monitorId: string,
    direction: ExternalUrlNavigationDirection
  ): boolean => {
    const state = getMonitorState(monitorId);
    if (state.activeMediaItem?.kind !== 'external-url') {
      setMonitorError(monitorId, 'No hay una URL externa activa para navegar.');
      return false;
    }

    const message = direction === 'back'
      ? buildMasterMessage(monitorId, 'EXTERNAL_URL_BACK', { reason: 'operator-back' })
      : buildMasterMessage(monitorId, 'EXTERNAL_URL_FORWARD', { reason: 'operator-forward' });

    if (!message) {
      setMonitorError(monitorId, 'No hay una ventana activa para navegar la URL externa.');
      return false;
    }

    return sendToSlave(monitorId, message);
  };

  const requestFullscreen = (monitorId: string) => {
    const message = buildMasterMessage(monitorId, 'REQUEST_FULLSCREEN', {
      reason: 'Operator requested from control panel'
    });
    if (message) {
      sendToSlave(monitorId, message);
    }

    const state = getMonitorState(monitorId);
    state.fullscreenIntentActive = true;
    state.lostFullscreenUnexpectedly = false;
    state.lastError = 'Se envio la solicitud. Debes hacer clic en la ventana esclava para activar fullscreen.';
  };

  const flashMonitorId = (monitorId: string) => {
    const monitor = monitors.value.find((item) => item.id === monitorId);
    const state = getMonitorState(monitorId);

    if (!monitor || !state.isWindowOpen) {
      state.lastError = 'Abre la ventana del monitor para poder identificarla visualmente.';
      return false;
    }

    const message = buildMasterMessage(monitorId, 'FLASH_MONITOR_ID', {
      monitorLabel: monitor.label,
      durationMs: MONITOR_ID_FLASH_DURATION_MS
    });

    if (!message) {
      state.lastError = 'No hay una ventana activa para identificar este monitor.';
      return false;
    }

    return sendToSlave(monitorId, message);
  };

  const sendVideoSyncCommand = <TType extends VideoSyncCommandType>(
    monitorId: string,
    type: TType,
    payload: VideoSyncPayloadByType[TType]
  ): boolean => {
    let message: MasterToSlaveMessage | null = null;

    if (type === 'VIDEO_SYNC_PLAY') {
      message = buildMasterMessage(monitorId, 'VIDEO_SYNC_PLAY', payload as VideoSyncPlayPayload);
    }
    if (type === 'VIDEO_SYNC_PAUSE') {
      message = buildMasterMessage(monitorId, 'VIDEO_SYNC_PAUSE', payload as VideoSyncPausePayload);
    }
    if (type === 'VIDEO_SYNC_SEEK') {
      message = buildMasterMessage(monitorId, 'VIDEO_SYNC_SEEK', payload as VideoSyncSeekPayload);
    }
    if (type === 'VIDEO_SYNC_TIME') {
      message = buildMasterMessage(monitorId, 'VIDEO_SYNC_TIME', payload as VideoSyncTimePayload);
    }

    if (!message) {
      return false;
    }

    return sendToSlave(monitorId, message);
  };

  const setWhiteboardStateForMonitor = (monitorId: string, nextState: WhiteboardState) => {
    const sanitizedState = sanitizeWhiteboardState(nextState);
    monitorWhiteboards[monitorId] = sanitizedState;

    const message = buildWhiteboardStateMessage(monitorId, sanitizedState);
    if (message) {
      sendToSlave(monitorId, message);
    }

    replicateSourceToMirrorTargets(monitorId);
  };

  const setContentTransitionForMonitor = (monitorId: string, nextTransition: ContentTransition) => {
    const state = getMonitorState(monitorId);
    state.contentTransition = sanitizeContentTransition(nextTransition);
    replicateSourceToMirrorTargets(monitorId);
  };

  const clearWhiteboardForMonitor = (monitorId: string) => {
    monitorWhiteboards[monitorId] = createEmptyWhiteboardState();

    const message = buildMasterMessage(monitorId, 'WHITEBOARD_CLEAR', {
      reason: 'operator-clear'
    });

    if (message) {
      sendToSlave(monitorId, message);
    }

    replicateSourceToMirrorTargets(monitorId);
  };

  const undoWhiteboardForMonitor = (monitorId: string) => {
    const currentState = getMonitorWhiteboard(monitorId);
    if (currentState.strokes.length === 0) {
      return;
    }

    monitorWhiteboards[monitorId] = {
      strokes: currentState.strokes.slice(0, -1)
    };

    const message = buildMasterMessage(monitorId, 'WHITEBOARD_UNDO', {
      reason: 'operator-undo'
    });

    if (message) {
      sendToSlave(monitorId, message);
    }

    replicateSourceToMirrorTargets(monitorId);
  };

  window.addEventListener('message', onMessageFromSlave);
  window.addEventListener('beforeunload', onBeforeUnload);

  onBeforeUnmount(() => {
    window.removeEventListener('message', onMessageFromSlave);
    window.removeEventListener('beforeunload', onBeforeUnload);

    screenDetailsRef?.removeEventListener('screenschange', refreshMonitorList);
    screenDetailsRef?.removeEventListener('currentscreenchange', refreshMonitorList);

    shutdownAllWindows();
  });

  return {
    globalError,
    hasDetectedMonitors,
    isLoadingMonitors,
    isWindowManagementSupported,
    monitorStates,
    monitorThumbnails,
    monitorWhiteboards,
    mirrorConfig,
    mirrorStatus,
    persistableMonitorStates,
    monitors,
    applyTransform,
    closeAllWindows,
    closeWindow,
    loadMonitors,
    openWindowForMonitor,
    requestFullscreen,
    flashMonitorId,
    sendVideoSyncCommand,
    clearWhiteboardForMonitor,
    setMirrorEnabled,
    setMirrorSourceMonitorId,
    setMirrorTargetMonitorIds,
    setMonitorCustomName,
    setContentTransitionForMonitor,
    setImageForMonitor,
    setExternalUrlForMonitor,
    clearExternalUrlForMonitor,
    reloadExternalUrlForMonitor,
    navigateExternalUrlForMonitor,
    setWhiteboardStateForMonitor,
    undoWhiteboardForMonitor,
    setPlaylistItemForMonitor
  };
};
