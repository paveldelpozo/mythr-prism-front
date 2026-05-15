import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createFullControlApiClient, FullControlApiError } from '../services/fullControlApiClient';
import { createFullControlRealtimeClient } from '../services/fullControlRealtimeClient';
import type { FoundationRealtimeServerEvent, SystemStatusResponse } from '../types/fullControlApi';
import { resolveFullControlApiKey, resolveFullControlApiUrl } from '../utils/fullControlBackend';

export const useFullControlFoundationDiagnostics = () => {
  const status = ref<SystemStatusResponse | null>(null);
  const monitorCount = ref<number | null>(null);
  const realtimeConnected = ref(false);
  const lastRealtimeEvent = ref<FoundationRealtimeServerEvent | null>(null);
  const error = ref<string | null>(null);
  const isEnabled = ref(false);

  let unsubscribeServerEvents: (() => void) | null = null;
  let unsubscribeConnectionErrors: (() => void) | null = null;
  let disconnectRealtime: (() => void) | null = null;

  const loadDiagnostics = async (): Promise<void> => {
    const apiKey = resolveFullControlApiKey();
    if (!apiKey) {
      isEnabled.value = false;
      error.value = 'Set VITE_FULL_CONTROL_API_KEY to enable V2 API foundation diagnostics.';
      return;
    }

    const baseUrl = resolveFullControlApiUrl();
    const apiClient = createFullControlApiClient({ baseUrl, apiKey });
    const realtimeClient = createFullControlRealtimeClient({ baseUrl, apiKey });

    isEnabled.value = true;
    error.value = null;

    unsubscribeServerEvents = realtimeClient.onServerEvent((event) => {
      lastRealtimeEvent.value = event;
      realtimeConnected.value = true;

      if (event.type === 'system:hello') {
        status.value = event.payload.status;
        return;
      }

      status.value = event.payload;
    });

    unsubscribeConnectionErrors = realtimeClient.onConnectionError((message) => {
      realtimeConnected.value = false;
      error.value = `Realtime error: ${message}`;
    });

    realtimeClient.connect();
    disconnectRealtime = () => realtimeClient.disconnect();

    try {
      const [systemStatus, monitors] = await Promise.all([
        apiClient.getSystemStatus(),
        apiClient.getMonitors()
      ]);

      status.value = systemStatus;
      monitorCount.value = monitors.length;
      error.value = null;

      const pingStatus = await realtimeClient.ping();
      status.value = pingStatus;
      realtimeConnected.value = true;
    } catch (caughtError) {
      const message = caughtError instanceof FullControlApiError
        ? `${caughtError.code}: ${caughtError.message}`
        : 'Failed to load V2 API foundation diagnostics.';
      error.value = message;
    }
  };

  const cleanup = () => {
    unsubscribeServerEvents?.();
    unsubscribeServerEvents = null;
    unsubscribeConnectionErrors?.();
    unsubscribeConnectionErrors = null;
    disconnectRealtime?.();
    disconnectRealtime = null;
    realtimeConnected.value = false;
  };

  onMounted(() => {
    void loadDiagnostics();
  });

  onBeforeUnmount(() => {
    cleanup();
  });

  return {
    error,
    isEnabled,
    lastRealtimeEvent,
    monitorCount,
    realtimeConnected,
    status
  };
};
