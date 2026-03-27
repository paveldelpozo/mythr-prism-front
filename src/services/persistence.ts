import { DEFAULT_TRANSFORM, type MonitorTransform } from '../types/broadcaster';
import { cloneSerializable } from '../utils/cloneSerializable';

export const SESSION_STORAGE_KEY = 'mythr-prism.session';
export const SESSION_SCHEMA_VERSION = 1;

const MIN_SCALE = 0.05;

export interface PersistedMonitorState {
  transform: MonitorTransform;
  imageDataUrl: string | null;
}

export type PersistedMonitorStateMap = Record<string, PersistedMonitorState>;

export interface PersistedUiState {
  showOnlyProjectable: boolean;
  panelPreferences: Record<string, boolean>;
}

export interface PersistedSessionV1 {
  version: typeof SESSION_SCHEMA_VERSION;
  ui: PersistedUiState;
  monitors: PersistedMonitorStateMap;
}

const createDefaultSession = (): PersistedSessionV1 => ({
  version: SESSION_SCHEMA_VERSION,
  ui: {
    showOnlyProjectable: true,
    panelPreferences: {}
  },
  monitors: {}
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFiniteNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
};

const sanitizeTransform = (value: unknown): MonitorTransform => {
  if (!isRecord(value)) {
    return { ...DEFAULT_TRANSFORM };
  }

  const scale = Math.max(MIN_SCALE, toFiniteNumber(value.scale, DEFAULT_TRANSFORM.scale));

  return {
    rotate: toFiniteNumber(value.rotate, DEFAULT_TRANSFORM.rotate),
    scale,
    translateX: toFiniteNumber(value.translateX, DEFAULT_TRANSFORM.translateX),
    translateY: toFiniteNumber(value.translateY, DEFAULT_TRANSFORM.translateY)
  };
};

const sanitizeImageDataUrl = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const sanitizeMonitorState = (value: unknown): PersistedMonitorState => {
  if (!isRecord(value)) {
    return {
      transform: { ...DEFAULT_TRANSFORM },
      imageDataUrl: null
    };
  }

  return {
    transform: sanitizeTransform(value.transform),
    imageDataUrl: sanitizeImageDataUrl(value.imageDataUrl)
  };
};

const sanitizeMonitorStateMap = (value: unknown): PersistedMonitorStateMap => {
  if (!isRecord(value)) {
    return {};
  }

  const map: PersistedMonitorStateMap = {};

  Object.entries(value).forEach(([monitorId, monitorState]) => {
    if (typeof monitorId !== 'string' || monitorId.length === 0) {
      return;
    }

    map[monitorId] = sanitizeMonitorState(monitorState);
  });

  return map;
};

const sanitizePanelPreferences = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) {
    return {};
  }

  const panelPreferences: Record<string, boolean> = {};

  Object.entries(value).forEach(([key, panelEnabled]) => {
    if (typeof key !== 'string' || typeof panelEnabled !== 'boolean') {
      return;
    }

    panelPreferences[key] = panelEnabled;
  });

  return panelPreferences;
};

const sanitizeUiState = (value: unknown): PersistedUiState => {
  if (!isRecord(value)) {
    return createDefaultSession().ui;
  }

  return {
    showOnlyProjectable:
      typeof value.showOnlyProjectable === 'boolean'
        ? value.showOnlyProjectable
        : createDefaultSession().ui.showOnlyProjectable,
    panelPreferences: sanitizePanelPreferences(value.panelPreferences)
  };
};

const parseLegacySession = (value: Record<string, unknown>): PersistedSessionV1 | null => {
  const hasModernKeys = 'ui' in value || 'monitors' in value;
  const hasLegacyKeys = 'showOnlyProjectable' in value || 'monitorStates' in value;

  if (hasModernKeys) {
    return {
      version: SESSION_SCHEMA_VERSION,
      ui: sanitizeUiState(value.ui),
      monitors: sanitizeMonitorStateMap(value.monitors)
    };
  }

  if (!hasLegacyKeys) {
    return null;
  }

  return {
    version: SESSION_SCHEMA_VERSION,
    ui: sanitizeUiState({
      showOnlyProjectable: value.showOnlyProjectable,
      panelPreferences: {}
    }),
    monitors: sanitizeMonitorStateMap(value.monitorStates)
  };
};

const sanitizePersistedSession = (value: unknown): PersistedSessionV1 => {
  if (!isRecord(value)) {
    return createDefaultSession();
  }

  if (value.version === SESSION_SCHEMA_VERSION) {
    return {
      version: SESSION_SCHEMA_VERSION,
      ui: sanitizeUiState(value.ui),
      monitors: sanitizeMonitorStateMap(value.monitors)
    };
  }

  const legacySession = parseLegacySession(value);
  if (legacySession) {
    return legacySession;
  }

  return createDefaultSession();
};

const writeSession = (session: PersistedSessionV1) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const safeSession = cloneSerializable(session);
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeSession));
  } catch {
    return;
  }
};

export const loadPersistedSession = (): PersistedSessionV1 => {
  const fallback = createDefaultSession();

  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    return sanitizePersistedSession(parsed);
  } catch {
    try {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      return fallback;
    }
    return fallback;
  }
};

export const createDebouncedSessionSaver = (debounceMs = 250) => {
  let timerId: number | null = null;
  let pendingSession: PersistedSessionV1 | null = null;

  const flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }

    if (!pendingSession) {
      return;
    }

    writeSession(pendingSession);
    pendingSession = null;
  };

  const schedule = (session: PersistedSessionV1) => {
    pendingSession = sanitizePersistedSession(session);

    if (typeof window === 'undefined') {
      flush();
      return;
    }

    if (timerId !== null) {
      clearTimeout(timerId);
    }

    timerId = window.setTimeout(() => {
      flush();
    }, debounceMs);
  };

  return {
    schedule,
    flush
  };
};
