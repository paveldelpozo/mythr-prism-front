export interface MirrorModeConfig {
  enabled: boolean;
  sourceMonitorId: string | null;
  targetMonitorIds: string[];
}

export interface MirrorModeStatus {
  activeTargetCount: number;
  unavailableTargetIds: string[];
  lastReplicatedAtMs: number | null;
  lastError: string | null;
}

export const DEFAULT_MIRROR_MODE_CONFIG: MirrorModeConfig = {
  enabled: false,
  sourceMonitorId: null,
  targetMonitorIds: []
};

export const DEFAULT_MIRROR_MODE_STATUS: MirrorModeStatus = {
  activeTargetCount: 0,
  unavailableTargetIds: [],
  lastReplicatedAtMs: null,
  lastError: null
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toMonitorId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeTargetMonitorIds = (
  value: unknown,
  sourceMonitorId: string | null,
  knownMonitorIds?: ReadonlySet<string>
): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Set<string>();

  value.forEach((candidate) => {
    const monitorId = toMonitorId(candidate);
    if (!monitorId) {
      return;
    }

    if (monitorId === sourceMonitorId) {
      return;
    }

    if (knownMonitorIds && !knownMonitorIds.has(monitorId)) {
      return;
    }

    deduped.add(monitorId);
  });

  return Array.from(deduped);
};

export const sanitizeMirrorModeConfig = (
  value: unknown,
  options?: {
    knownMonitorIds?: ReadonlySet<string>;
  }
): MirrorModeConfig => {
  if (!isRecord(value)) {
    return { ...DEFAULT_MIRROR_MODE_CONFIG };
  }

  const knownMonitorIds = options?.knownMonitorIds;
  const sourceMonitorIdCandidate = toMonitorId(value.sourceMonitorId);
  const sourceMonitorId =
    sourceMonitorIdCandidate && (!knownMonitorIds || knownMonitorIds.has(sourceMonitorIdCandidate))
      ? sourceMonitorIdCandidate
      : null;

  return {
    enabled: Boolean(value.enabled),
    sourceMonitorId,
    targetMonitorIds: normalizeTargetMonitorIds(value.targetMonitorIds, sourceMonitorId, knownMonitorIds)
  };
};
