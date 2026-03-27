import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { createSlaveWindowHtml } from '../services/slaveWindowHtml';
import {
  createDefaultMonitorState,
  DEFAULT_TRANSFORM,
  type MonitorDescriptor,
  type MonitorStateMap,
  type MonitorTransform
} from '../types/broadcaster';
import {
  isKnownEnvelope,
  type MasterToSlaveMessage,
  MESSAGE_CHANNEL,
  type SlaveToMasterMessage
} from '../types/messages';
import { cloneSerializable } from '../utils/cloneSerializable';

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

const MIN_SCALE = 0.05;
const LIFE_CHECK_INTERVAL_MS = 1000;

const toMonitorId = (screen: ScreenDetailed, index: number): string =>
  `${index}-${screen.left}-${screen.top}-${screen.width}x${screen.height}`;

const createDescriptor = (screen: ScreenDetailed, index: number): MonitorDescriptor => ({
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
  raw: screen
});

const createInstanceToken = (monitorId: string): string =>
  `${monitorId}-${crypto.randomUUID()}`;

export const useMultiMonitorBroadcaster = () => {
  const monitors = ref<MonitorDescriptor[]>([]);
  const monitorStates = reactive<MonitorStateMap>({});
  const windowsRegistry = new Map<string, WindowRegistryEntry>();

  const isLoadingMonitors = ref(false);
  const globalError = ref<string | null>(null);
  const isWindowManagementSupported = typeof window.getScreenDetails === 'function';
  const hasDetectedMonitors = computed(() => monitors.value.length > 0);

  let screenDetailsRef: ScreenDetails | null = null;
  let lifecycleIntervalId: number | null = null;

  const getMonitorState = (monitorId: string) => {
    if (!monitorStates[monitorId]) {
      monitorStates[monitorId] = createDefaultMonitorState();
    }
    return monitorStates[monitorId];
  };

  const setMonitorError = (monitorId: string, message: string | null) => {
    const state = getMonitorState(monitorId);
    state.lastError = message;
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

    if (!entry.ref.closed) {
      entry.ref.close();
    }

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

  const pushCurrentStateToSlave = (monitorId: string) => {
    const state = getMonitorState(monitorId);

    const transformMsg = buildMasterMessage(monitorId, 'SET_TRANSFORM', {
      transform: state.transform
    });
    const imageMsg = buildMasterMessage(monitorId, 'SET_IMAGE', {
      imageDataUrl: state.imageDataUrl
    });

    if (transformMsg) {
      sendToSlave(monitorId, transformMsg);
    }
    if (imageMsg) {
      sendToSlave(monitorId, imageMsg);
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

  const onBeforeUnload = () => {
    closeAllWindows();
    stopLifecycleWatchdog();
  };

  const refreshMonitorList = () => {
    if (!screenDetailsRef) {
      return;
    }

    const nextMonitors = screenDetailsRef.screens.map(createDescriptor);
    monitors.value = nextMonitors;
    syncMonitorStateShape(nextMonitors);
  };

  const loadMonitors = async () => {
    globalError.value = null;

    if (!isWindowManagementSupported) {
      globalError.value =
        'La API Window Management no esta disponible en este navegador. Prueba Chrome/Edge reciente con permisos habilitados.';
      return;
    }

    isLoadingMonitors.value = true;
    try {
      screenDetailsRef?.removeEventListener('screenschange', refreshMonitorList);
      screenDetailsRef?.removeEventListener('currentscreenchange', refreshMonitorList);

      screenDetailsRef = await window.getScreenDetails?.();

      if (!screenDetailsRef) {
        globalError.value = 'No se pudo obtener detalle de pantallas.';
        return;
      }

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
  };

  const setImageForMonitor = (monitorId: string, imageDataUrl: string | null) => {
    const state = getMonitorState(monitorId);
    state.imageDataUrl = imageDataUrl;

    const message = buildMasterMessage(monitorId, 'SET_IMAGE', {
      imageDataUrl
    });
    if (message) {
      sendToSlave(monitorId, message);
    }
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

  window.addEventListener('message', onMessageFromSlave);
  window.addEventListener('beforeunload', onBeforeUnload);

  onBeforeUnmount(() => {
    window.removeEventListener('message', onMessageFromSlave);
    window.removeEventListener('beforeunload', onBeforeUnload);

    screenDetailsRef?.removeEventListener('screenschange', refreshMonitorList);
    screenDetailsRef?.removeEventListener('currentscreenchange', refreshMonitorList);

    closeAllWindows();
    stopLifecycleWatchdog();
  });

  return {
    globalError,
    hasDetectedMonitors,
    isLoadingMonitors,
    isWindowManagementSupported,
    monitorStates,
    monitors,
    applyTransform,
    closeAllWindows,
    closeWindow,
    loadMonitors,
    openWindowForMonitor,
    requestFullscreen,
    setImageForMonitor
  };
};
