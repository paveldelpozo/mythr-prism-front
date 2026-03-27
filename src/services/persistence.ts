import { DEFAULT_TRANSFORM, type MonitorTransform } from '../types/broadcaster';
import { isMultimediaItem, type MultimediaItem, type PlaylistPlaybackState } from '../types/playlist';
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
  playlist: MultimediaItem[];
  playback: PlaylistPlaybackState;
}

const DEFAULT_PLAYBACK_INTERVAL_SECONDS = 5;

const clampIndex = (index: number, total: number): number => {
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

const createDefaultSession = (): PersistedSessionV1 => ({
  version: SESSION_SCHEMA_VERSION,
  ui: {
    showOnlyProjectable: true,
    panelPreferences: {}
  },
  monitors: {},
  playlist: [],
  playback: {
    targetMonitorId: null,
    currentIndex: 0,
    autoplay: false,
    intervalSeconds: DEFAULT_PLAYBACK_INTERVAL_SECONDS
  }
});

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toFiniteNumberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

const toFiniteNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
};

const toFiniteInteger = (value: unknown, fallback: number): number => {
  const safeNumber = toFiniteNumber(value, fallback);
  return Math.round(safeNumber);
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

const sanitizePlaylistItem = (value: unknown): MultimediaItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = toNonEmptyString(value.id);
  const name = toNonEmptyString(value.name);
  const source = toNonEmptyString(value.source);
  const kind = value.kind === 'image' || value.kind === 'video' ? value.kind : null;

  if (!id || !name || !source || !kind) {
    return null;
  }

  if (kind === 'image') {
    const durationMs = toFiniteNumberOrNull(value.durationMs);
    if (durationMs === null || durationMs <= 0) {
      return null;
    }

    return {
      id,
      kind: 'image',
      name,
      source,
      durationMs
    };
  }

  const startAtMs = toFiniteNumberOrNull(value.startAtMs);
  if (startAtMs === null || startAtMs < 0) {
    return null;
  }

  const endAtMsRaw = value.endAtMs;
  const endAtMs = endAtMsRaw === null ? null : toFiniteNumberOrNull(endAtMsRaw);
  if (endAtMsRaw !== null && (endAtMs === null || endAtMs < startAtMs)) {
    return null;
  }

  if (typeof value.muted !== 'boolean') {
    return null;
  }

  return {
    id,
    kind: 'video',
    name,
    source,
    startAtMs,
    endAtMs,
    muted: value.muted
  };
};

const sanitizePlaylist = (value: unknown): MultimediaItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const playlist: MultimediaItem[] = [];

  value.forEach((item) => {
    const sanitized = sanitizePlaylistItem(item);
    if (sanitized && isMultimediaItem(sanitized)) {
      playlist.push(sanitized);
    }
  });

  return playlist;
};

const sanitizePlaybackState = (
  value: unknown,
  playlistLength: number
): PlaylistPlaybackState => {
  const fallback = createDefaultSession().playback;

  if (!isRecord(value)) {
    return fallback;
  }

  const intervalSeconds = Math.max(
    1,
    toFiniteInteger(value.intervalSeconds, fallback.intervalSeconds)
  );

  const currentIndex = clampIndex(
    Math.max(0, toFiniteInteger(value.currentIndex, fallback.currentIndex)),
    playlistLength
  );

  return {
    targetMonitorId:
      typeof value.targetMonitorId === 'string' && value.targetMonitorId.trim().length > 0
        ? value.targetMonitorId
        : null,
    currentIndex,
    autoplay:
      playlistLength > 0 && typeof value.autoplay === 'boolean' ? value.autoplay : fallback.autoplay,
    intervalSeconds
  };
};

const extractLegacyPlaybackState = (value: Record<string, unknown>): unknown => {
  if (isRecord(value.playback)) {
    return value.playback;
  }

  if (isRecord(value.playlistPlayback)) {
    return value.playlistPlayback;
  }

  if (
    'targetMonitorId' in value
    || 'targetScreenId' in value
    || 'currentIndex' in value
    || 'autoplay' in value
    || 'intervalSeconds' in value
  ) {
    return {
      targetMonitorId: value.targetMonitorId ?? value.targetScreenId,
      currentIndex: value.currentIndex,
      autoplay: value.autoplay,
      intervalSeconds: value.intervalSeconds
    };
  }

  return null;
};

const parseLegacySession = (value: Record<string, unknown>): PersistedSessionV1 | null => {
  const hasModernKeys = 'ui' in value || 'monitors' in value;
  const hasLegacyKeys = 'showOnlyProjectable' in value || 'monitorStates' in value;

  if (hasModernKeys) {
    const playlist = sanitizePlaylist(value.playlist);

    return {
      version: SESSION_SCHEMA_VERSION,
      ui: sanitizeUiState(value.ui),
      monitors: sanitizeMonitorStateMap(value.monitors),
      playlist,
      playback: sanitizePlaybackState(extractLegacyPlaybackState(value), playlist.length)
    };
  }

  if (!hasLegacyKeys) {
    return null;
  }

  const playlist = sanitizePlaylist(value.playlist);

  return {
    version: SESSION_SCHEMA_VERSION,
    ui: sanitizeUiState({
      showOnlyProjectable: value.showOnlyProjectable,
      panelPreferences: {}
    }),
    monitors: sanitizeMonitorStateMap(value.monitorStates),
    playlist,
    playback: sanitizePlaybackState(extractLegacyPlaybackState(value), playlist.length)
  };
};

const sanitizePersistedSession = (value: unknown): PersistedSessionV1 => {
  if (!isRecord(value)) {
    return createDefaultSession();
  }

  if (value.version === SESSION_SCHEMA_VERSION) {
    const playlist = sanitizePlaylist(value.playlist);

    return {
      version: SESSION_SCHEMA_VERSION,
      ui: sanitizeUiState(value.ui),
      monitors: sanitizeMonitorStateMap(value.monitors),
      playlist,
      playback: sanitizePlaybackState(extractLegacyPlaybackState(value), playlist.length)
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
