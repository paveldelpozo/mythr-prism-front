import { DEFAULT_TRANSFORM, type MonitorTransform } from '../types/broadcaster';
import {
  DEFAULT_MIRROR_MODE_CONFIG,
  type MirrorModeConfig,
  sanitizeMirrorModeConfig
} from '../types/mirrorMode';
import { isMultimediaItem, type MultimediaItem, type PlaylistPlaybackState } from '../types/playlist';
import { cloneSerializable } from '../utils/cloneSerializable';

export const SESSION_STORAGE_KEY = 'mythr-prism.session';
export const SESSION_SCHEMA_VERSION = 1;

const MIN_SCALE = 0.05;

export interface PersistedMonitorState {
  transform: MonitorTransform;
  imageDataUrl: string | null;
  customName: string | null;
}

export type PersistedMonitorStateMap = Record<string, PersistedMonitorState>;

export interface PersistedUiState {
  showOnlyProjectable: boolean;
  panelPreferences: Record<string, boolean>;
}

export interface PersistedLayoutSnapshot {
  monitors: PersistedMonitorStateMap;
  playback: PlaylistPlaybackState;
}

export interface PersistedLayout {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: PersistedLayoutSnapshot;
}

export interface PersistedSessionV1 {
  version: typeof SESSION_SCHEMA_VERSION;
  ui: PersistedUiState;
  monitors: PersistedMonitorStateMap;
  playlist: MultimediaItem[];
  playback: PlaylistPlaybackState;
  mirror: MirrorModeConfig;
  layouts: PersistedLayout[];
}

const DEFAULT_PLAYBACK_INTERVAL_SECONDS = 5;
const DEFAULT_LAYOUT_TIMESTAMP = '1970-01-01T00:00:00.000Z';

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
    targetMonitorIds: [],
    currentIndex: 0,
    autoplay: false,
    intervalSeconds: DEFAULT_PLAYBACK_INTERVAL_SECONDS
  },
  mirror: { ...DEFAULT_MIRROR_MODE_CONFIG },
  layouts: []
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

const sanitizeMonitorCustomName = (value: unknown): string | null => {
  const safeName = toNonEmptyString(value);
  if (!safeName) {
    return null;
  }

  return safeName.slice(0, 80);
};

const sanitizeMonitorState = (value: unknown): PersistedMonitorState => {
  if (!isRecord(value)) {
    return {
      transform: { ...DEFAULT_TRANSFORM },
      imageDataUrl: null,
      customName: null
    };
  }

  return {
    transform: sanitizeTransform(value.transform),
    imageDataUrl: sanitizeImageDataUrl(value.imageDataUrl),
    customName: sanitizeMonitorCustomName(value.customName)
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

  const sanitizeTargetMonitorIds = (): string[] => {
    if (Array.isArray(value.targetMonitorIds)) {
      const deduped = new Set<string>();

      value.targetMonitorIds.forEach((monitorId) => {
        if (typeof monitorId !== 'string') {
          return;
        }

        const trimmed = monitorId.trim();
        if (trimmed.length === 0) {
          return;
        }

        deduped.add(trimmed);
      });

      if (deduped.size > 0) {
        return Array.from(deduped);
      }
    }

    const legacyTargetMonitorId =
      typeof value.targetMonitorId === 'string' && value.targetMonitorId.trim().length > 0
        ? value.targetMonitorId.trim()
        : null;

    return legacyTargetMonitorId ? [legacyTargetMonitorId] : [];
  };

  return {
    targetMonitorIds: sanitizeTargetMonitorIds(),
    currentIndex,
    autoplay:
      playlistLength > 0 && typeof value.autoplay === 'boolean' ? value.autoplay : fallback.autoplay,
    intervalSeconds
  };
};

const sanitizeLayoutPlaybackState = (value: unknown): PlaylistPlaybackState => {
  const fallback = createDefaultSession().playback;

  if (!isRecord(value)) {
    return fallback;
  }

  const targetMonitorIds = Array.isArray(value.targetMonitorIds)
    ? value.targetMonitorIds
        .filter((monitorId): monitorId is string => typeof monitorId === 'string')
        .map((monitorId) => monitorId.trim())
        .filter((monitorId) => monitorId.length > 0)
    : [];

  const dedupedTargets = Array.from(new Set(targetMonitorIds));

  return {
    targetMonitorIds: dedupedTargets,
    currentIndex: Math.max(0, toFiniteInteger(value.currentIndex, fallback.currentIndex)),
    autoplay: typeof value.autoplay === 'boolean' ? value.autoplay : fallback.autoplay,
    intervalSeconds: Math.max(1, toFiniteInteger(value.intervalSeconds, fallback.intervalSeconds))
  };
};

const sanitizeIsoDateString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
};

const sanitizeLayoutSnapshot = (value: unknown): PersistedLayoutSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  return {
    monitors: sanitizeMonitorStateMap(value.monitors),
    playback: sanitizeLayoutPlaybackState(value.playback)
  };
};

const sanitizeLayout = (value: unknown): PersistedLayout | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = toNonEmptyString(value.id);
  const name = toNonEmptyString(value.name);
  const snapshot = sanitizeLayoutSnapshot(value.snapshot);

  if (!id || !name || !snapshot) {
    return null;
  }

  return {
    id,
    name,
    createdAt: sanitizeIsoDateString(value.createdAt) ?? DEFAULT_LAYOUT_TIMESTAMP,
    updatedAt: sanitizeIsoDateString(value.updatedAt) ?? DEFAULT_LAYOUT_TIMESTAMP,
    snapshot
  };
};

const sanitizeLayouts = (value: unknown): PersistedLayout[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const layouts: PersistedLayout[] = [];
  const existingIds = new Set<string>();

  value.forEach((layoutValue) => {
    const layout = sanitizeLayout(layoutValue);
    if (!layout || existingIds.has(layout.id)) {
      return;
    }

    existingIds.add(layout.id);
    layouts.push(layout);
  });

  return layouts;
};

const extractLegacyPlaybackState = (value: Record<string, unknown>): unknown => {
  if (isRecord(value.playback)) {
    return value.playback;
  }

  if (isRecord(value.playlistPlayback)) {
    return value.playlistPlayback;
  }

  if (
    'targetMonitorIds' in value
    ||
    'targetMonitorId' in value
    || 'targetScreenId' in value
    || 'currentIndex' in value
    || 'autoplay' in value
    || 'intervalSeconds' in value
  ) {
    return {
      targetMonitorIds: value.targetMonitorIds,
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
      playback: sanitizePlaybackState(extractLegacyPlaybackState(value), playlist.length),
      mirror: sanitizeMirrorModeConfig(value.mirror),
      layouts: sanitizeLayouts(value.layouts)
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
    playback: sanitizePlaybackState(extractLegacyPlaybackState(value), playlist.length),
    mirror: { ...DEFAULT_MIRROR_MODE_CONFIG },
    layouts: []
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
      playback: sanitizePlaybackState(extractLegacyPlaybackState(value), playlist.length),
      mirror: sanitizeMirrorModeConfig(value.mirror),
      layouts: sanitizeLayouts(value.layouts)
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
