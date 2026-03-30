export interface VideoSyncStrategyConfig {
  commandLeadMs: number;
  driftToleranceMs: number;
  resyncIntervalMs: number;
}

export interface VideoSyncPlan {
  strategy: VideoSyncStrategyConfig;
  hostMonitorId: string | null;
  clientMonitorIds: string[];
  eligibleMonitorIds: string[];
  canSynchronize: boolean;
  reason: 'ok' | 'no-open-monitors' | 'single-open-monitor';
}

const MIN_COMMAND_LEAD_MS = 100;
const MAX_COMMAND_LEAD_MS = 8000;
const MIN_DRIFT_TOLERANCE_MS = 16;
const MAX_DRIFT_TOLERANCE_MS = 1500;
const MIN_RESYNC_INTERVAL_MS = 500;
const MAX_RESYNC_INTERVAL_MS = 30000;

export const DEFAULT_VIDEO_SYNC_STRATEGY: VideoSyncStrategyConfig = {
  commandLeadMs: 800,
  driftToleranceMs: 80,
  resyncIntervalMs: 4000
};

const clampRounded = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) {
    return min;
  }

  const rounded = Math.round(value);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }

  return rounded;
};

const normalizeMonitorIds = (monitorIds: readonly string[]): string[] => {
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

export const sanitizeVideoSyncStrategy = (
  value: Partial<VideoSyncStrategyConfig> | null | undefined
): VideoSyncStrategyConfig => ({
  commandLeadMs: clampRounded(
    value?.commandLeadMs ?? DEFAULT_VIDEO_SYNC_STRATEGY.commandLeadMs,
    MIN_COMMAND_LEAD_MS,
    MAX_COMMAND_LEAD_MS
  ),
  driftToleranceMs: clampRounded(
    value?.driftToleranceMs ?? DEFAULT_VIDEO_SYNC_STRATEGY.driftToleranceMs,
    MIN_DRIFT_TOLERANCE_MS,
    MAX_DRIFT_TOLERANCE_MS
  ),
  resyncIntervalMs: clampRounded(
    value?.resyncIntervalMs ?? DEFAULT_VIDEO_SYNC_STRATEGY.resyncIntervalMs,
    MIN_RESYNC_INTERVAL_MS,
    MAX_RESYNC_INTERVAL_MS
  )
});

interface BuildVideoSyncPlanParams {
  openMonitorIds: readonly string[];
  preferredHostMonitorId: string | null;
  strategy?: Partial<VideoSyncStrategyConfig>;
}

export const buildVideoSyncPlan = ({
  openMonitorIds,
  preferredHostMonitorId,
  strategy
}: BuildVideoSyncPlanParams): VideoSyncPlan => {
  const eligibleMonitorIds = normalizeMonitorIds(openMonitorIds);
  const safeStrategy = sanitizeVideoSyncStrategy(strategy);

  if (eligibleMonitorIds.length === 0) {
    return {
      strategy: safeStrategy,
      hostMonitorId: null,
      clientMonitorIds: [],
      eligibleMonitorIds,
      canSynchronize: false,
      reason: 'no-open-monitors'
    };
  }

  const preferredHost = preferredHostMonitorId?.trim() ?? '';
  const hostMonitorId =
    preferredHost.length > 0 && eligibleMonitorIds.includes(preferredHost)
      ? preferredHost
      : eligibleMonitorIds[0] ?? null;

  if (!hostMonitorId) {
    return {
      strategy: safeStrategy,
      hostMonitorId: null,
      clientMonitorIds: [],
      eligibleMonitorIds,
      canSynchronize: false,
      reason: 'no-open-monitors'
    };
  }

  const clientMonitorIds = eligibleMonitorIds.filter((monitorId) => monitorId !== hostMonitorId);

  return {
    strategy: safeStrategy,
    hostMonitorId,
    clientMonitorIds,
    eligibleMonitorIds,
    canSynchronize: clientMonitorIds.length > 0,
    reason: clientMonitorIds.length > 0 ? 'ok' : 'single-open-monitor'
  };
};
