import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { createSlaveWindowHtml } from '../services/slaveWindowHtml';
import {
  createDefaultMonitorState,
  DEFAULT_TRANSFORM,
  type MonitorDescriptor,
  type MonitorRuntimeState,
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

type TransformAction =
  | { type: 'rotate'; value: number }
  | { type: 'scale'; value: number }
  | { type: 'move'; value: { x?: number; y?: number } }
  | { type: 'reset' };

interface WindowRegistryEntry {
  ref: Window;
  blobUrl: string;
  instanceToken: string;
}

interface UseMultiMonitorBroadcasterOptions {
  initialMonitorStateById?: PersistedMonitorStateMap;
  initialMirrorMode?: MirrorModeConfig;
}

type VideoSyncCommandType = 'VIDEO_SYNC_PLAY' | 'VIDEO_SYNC_PAUSE' | 'VIDEO_SYNC_SEEK' | 'VIDEO_SYNC_TIME';

type VideoSyncPayloadByType = {
  VIDEO_SYNC_PLAY: VideoSyncPlayPayload;
  VIDEO_SYNC_PAUSE: VideoSyncPausePayload;
  VIDEO_SYNC_SEEK: VideoSyncSeekPayload;
  VIDEO_SYNC_TIME: VideoSyncTimePayload;
};

const MIN_SCALE = 0.05;
const LIFE_CHECK_INTERVAL_MS = 1000;

const toMonitorId = (screen: ScreenDetailed, index: number): string =>
  `${index}-${screen.left}-${screen.top}-${screen.width}x${screen.height}`;

const createDescriptor = (
  screen: ScreenDetailed,
  index: number,
  isMasterAppScreen: boolean
): MonitorDescriptor => ({
  id: toMonitorId(screen, index),
  label: screen.label?.trim() || `Monitor ${index + 1}`,
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
  const windowsRegistry = new Map<string, WindowRegistryEntry>();
  const initialMonitorStateById = options.initialMonitorStateById ?? {};
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
    state.imageDataUrl = persistedState.imageDataUrl;
  };

  const getMonitorState = (monitorId: string) => {
    if (!monitorStates[monitorId]) {
      monitorStates[monitorId] = createDefaultMonitorState();
      applyPersistedState(monitorId);
    }
    return monitorStates[monitorId];
  };

  const persistableMonitorStates = computed<PersistedMonitorStateMap>(() => {
    const serializableStates: PersistedMonitorStateMap = {};

    Object.entries(monitorStates).forEach(([monitorId, state]) => {
      serializableStates[monitorId] = {
        transform: { ...state.transform },
        imageDataUrl: state.imageDataUrl
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

      const clearMessage = buildMasterMessage(targetMonitorId, 'SET_IMAGE', {
        imageDataUrl: null
      });

      if (!clearMessage) {
        return;
      }

      const sent = sendToSlave(targetMonitorId, clearMessage);
      if (sent) {
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

    URL.revokeObjectURL(entry.blobUrl);
    windowsRegistry.delete(monitorId);

    const state = getMonitorState(monitorId);
    state.isWindowOpen = false;
    state.isSlaveReady = false;
    state.isFullscreen = false;
    state.requiresFullscreenInteraction = true;
  };

  const closeWindow = (monitorId: string) => {
    const entry = windowsRegistry.get(monitorId);
    if (!entry) {
      return;
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
    });

    Object.keys(monitorStates).forEach((monitorId) => {
      if (nextIds.has(monitorId)) {
        return;
      }

      closeWindow(monitorId);
      delete monitorStates[monitorId];
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
    state: MonitorRuntimeState
  ): Extract<MasterToSlaveMessage, { type: 'SET_IMAGE' | 'SET_MEDIA' }> | null => {
    if (state.activeMediaItem) {
      return buildMasterMessage(monitorId, 'SET_MEDIA', {
        item: state.activeMediaItem
      });
    }

    return buildMasterMessage(monitorId, 'SET_IMAGE', {
      imageDataUrl: state.imageDataUrl
    });
  };

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
      targetState.imageDataUrl = sourceState.imageDataUrl;
      targetState.activeMediaItem = sourceState.activeMediaItem;

      const transformMessage = buildMasterMessage(targetMonitorId, 'SET_TRANSFORM', {
        transform: targetState.transform
      });
      const contentMessage = buildContentMessage(targetMonitorId, targetState);

      const hasReadyWindow = transformMessage !== null && contentMessage !== null;

      if (!hasReadyWindow) {
        unavailableTargetIds.push(targetMonitorId);
        setMonitorError(targetMonitorId, 'Destino espejo no disponible: abre la ventana del monitor destino.');
        return;
      }

      const sentTransform = sendToSlave(targetMonitorId, transformMessage);
      const sentContent = sendToSlave(targetMonitorId, contentMessage);

      if (!sentTransform || !sentContent) {
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
      state.isFullscreen = message.payload.active;
      state.requiresFullscreenInteraction = message.payload.requiresInteraction;
      state.lastError = message.payload.message ?? null;
      return;
    }

    if (message.type === 'SLAVE_CLOSING') {
      cleanupMonitorWindow(monitorId);
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

  const onPageHide = () => {
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

    const nextMonitors = screens.map((screen, index) =>
      createDescriptor(screen, index, index === masterScreenIndex)
    );
    monitors.value = nextMonitors;
    syncMonitorStateShape(nextMonitors);
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
    const html = createSlaveWindowHtml({
      monitorId,
      instanceToken
    });

    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const features = [
      'popup=yes',
      `left=${monitor.availLeft}`,
      `top=${monitor.availTop}`,
      `width=${monitor.availWidth}`,
      `height=${monitor.availHeight}`
    ].join(',');

    const win = window.open(blobUrl, '_blank', features);

    if (!win) {
      URL.revokeObjectURL(blobUrl);
      setMonitorError(monitorId, 'El navegador bloqueo la ventana emergente. Habilita popups para continuar.');
      return;
    }

    windowsRegistry.set(monitorId, {
      ref: win,
      blobUrl,
      instanceToken
    });

    const state = getMonitorState(monitorId);
    state.isWindowOpen = true;
    state.isSlaveReady = false;
    state.isFullscreen = false;
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

  const setImageForMonitor = (monitorId: string, imageDataUrl: string | null) => {
    const state = getMonitorState(monitorId);
    state.imageDataUrl = imageDataUrl;
    state.activeMediaItem = null;

    const message = buildMasterMessage(monitorId, 'SET_IMAGE', {
      imageDataUrl
    });
    if (message) {
      sendToSlave(monitorId, message);
    }

    replicateSourceToMirrorTargets(monitorId);
  };

  const setPlaylistItemForMonitor = (monitorId: string, item: MultimediaItem | null): boolean => {
    const state = getMonitorState(monitorId);
    state.activeMediaItem = item;

    const message = buildMasterMessage(monitorId, 'SET_MEDIA', {
      item
    });
    if (!message) {
      replicateSourceToMirrorTargets(monitorId);
      return false;
    }

    const sent = sendToSlave(monitorId, message);
    replicateSourceToMirrorTargets(monitorId);
    return sent;
  };

  const requestFullscreen = (monitorId: string) => {
    const message = buildMasterMessage(monitorId, 'REQUEST_FULLSCREEN', {
      reason: 'Operator requested from control panel'
    });
    if (message) {
      sendToSlave(monitorId, message);
    }

    const state = getMonitorState(monitorId);
    state.lastError = 'Se envio la solicitud. Debes hacer clic en la ventana esclava para activar fullscreen.';
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

  window.addEventListener('message', onMessageFromSlave);
  window.addEventListener('beforeunload', onBeforeUnload);
  window.addEventListener('pagehide', onPageHide);

  onBeforeUnmount(() => {
    window.removeEventListener('message', onMessageFromSlave);
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('pagehide', onPageHide);

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
    sendVideoSyncCommand,
    setMirrorEnabled,
    setMirrorSourceMonitorId,
    setMirrorTargetMonitorIds,
    setImageForMonitor,
    setPlaylistItemForMonitor
  };
};
