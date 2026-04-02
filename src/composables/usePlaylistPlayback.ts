import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { MultimediaItem, PlaylistPlaybackState } from '../types/playlist';
import {
  buildVideoSyncPlan,
  resolveExpectedVideoTimeMs,
  type VideoSyncAnchor,
  type VideoSyncStrategyConfig
} from '../types/videoSync';
import type {
  VideoSyncPausePayload,
  VideoSyncPlayPayload,
  VideoSyncSeekPayload,
  VideoSyncTimePayload
} from '../types/messages';

interface UsePlaylistPlaybackOptions {
  items: Ref<MultimediaItem[]>;
  playback: Ref<PlaylistPlaybackState>;
  applyItemToMonitor: (monitorId: string, item: MultimediaItem | null) => boolean;
  isMonitorReady: (monitorId: string) => boolean;
  sendVideoSyncCommand?: <TType extends VideoSyncCommandType>(
    monitorId: string,
    type: TType,
    payload: VideoSyncPayloadByType[TType]
  ) => boolean;
}

const DEFAULT_FEEDBACK = 'Lista para reproducir playlist.';
const MAX_PAUSE_LEAD_MS = 200;

type VideoSyncCommandType = 'VIDEO_SYNC_PLAY' | 'VIDEO_SYNC_PAUSE' | 'VIDEO_SYNC_SEEK' | 'VIDEO_SYNC_TIME';

type VideoSyncPayloadByType = {
  VIDEO_SYNC_PLAY: VideoSyncPlayPayload;
  VIDEO_SYNC_PAUSE: VideoSyncPausePayload;
  VIDEO_SYNC_SEEK: VideoSyncSeekPayload;
  VIDEO_SYNC_TIME: VideoSyncTimePayload;
};

interface ApplyCurrentItemResult {
  ok: boolean;
  appliedMonitorIds: string[];
  item: MultimediaItem | null;
}

interface VideoSyncRuntimeContext {
  strategy: VideoSyncStrategyConfig;
  synchronizedMonitorIds: string[];
  clientMonitorIds: string[];
  hostMonitorId: string;
  anchor: VideoSyncAnchor;
}

const resolveAdvanceDelayMs = (item: MultimediaItem, fallbackIntervalSeconds: number): number => {
  if (item.kind === 'image') {
    return Math.max(1000, Math.round(item.durationMs));
  }

  if (item.kind === 'video' && item.endAtMs !== null && item.endAtMs > item.startAtMs) {
    return Math.max(1000, Math.round(item.endAtMs - item.startAtMs));
  }

  return Math.max(1000, Math.round(fallbackIntervalSeconds * 1000));
};

const normalizeIndex = (index: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }

  const raw = index % total;
  return raw >= 0 ? raw : raw + total;
};

const resolveSelectedMonitorIds = (monitorIds: readonly string[]): string[] => {
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

export const usePlaylistPlayback = ({
  items,
  playback,
  applyItemToMonitor,
  isMonitorReady,
  sendVideoSyncCommand
}: UsePlaylistPlaybackOptions) => {
  const isPlaying = ref(false);
  const feedback = ref<string>(DEFAULT_FEEDBACK);
  let timerId: number | null = null;
  let videoSyncIntervalId: number | null = null;
  let videoSyncContext: VideoSyncRuntimeContext | null = null;

  const activeItem = computed<MultimediaItem | null>(() => {
    if (items.value.length === 0) {
      return null;
    }

    const index = normalizeIndex(playback.value.currentIndex, items.value.length);
    return items.value[index] ?? null;
  });

  const clearTimer = () => {
    if (timerId === null) {
      return;
    }

    window.clearTimeout(timerId);
    timerId = null;
  };

  const clearVideoSyncLoop = () => {
    if (videoSyncIntervalId === null) {
      return;
    }

    window.clearInterval(videoSyncIntervalId);
    videoSyncIntervalId = null;
  };

  const dispatchVideoSyncCommand = <TType extends VideoSyncCommandType>(
    monitorIds: readonly string[],
    type: TType,
    payload: VideoSyncPayloadByType[TType]
  ): { sentMonitorIds: string[]; failedMonitorIds: string[] } => {
    if (!sendVideoSyncCommand) {
      return {
        sentMonitorIds: [],
        failedMonitorIds: []
      };
    }

    const sentMonitorIds: string[] = [];
    const failedMonitorIds: string[] = [];

    monitorIds.forEach((monitorId) => {
      const sent = sendVideoSyncCommand(monitorId, type, payload);
      if (sent) {
        sentMonitorIds.push(monitorId);
        return;
      }

      failedMonitorIds.push(monitorId);
    });

    return {
      sentMonitorIds,
      failedMonitorIds
    };
  };

  const startVideoSyncLoop = () => {
    clearVideoSyncLoop();

    if (!videoSyncContext || videoSyncContext.clientMonitorIds.length === 0) {
      return;
    }

    videoSyncIntervalId = window.setInterval(() => {
      if (!videoSyncContext || !isPlaying.value) {
        return;
      }

      const expectedMediaTimeMs = resolveExpectedVideoTimeMs(videoSyncContext.anchor);
      const result = dispatchVideoSyncCommand(videoSyncContext.clientMonitorIds, 'VIDEO_SYNC_TIME', {
        anchorWallClockMs: Date.now(),
        anchorMediaTimeMs: expectedMediaTimeMs,
        driftToleranceMs: videoSyncContext.strategy.driftToleranceMs
      });

      if (result.failedMonitorIds.length > 0) {
        feedback.value = `Sync video activo con degradacion. Fallo resync en ${result.failedMonitorIds.length} destino(s).`;
      }
    }, videoSyncContext.strategy.resyncIntervalMs);
  };

  const activateVideoSync = (item: MultimediaItem, appliedMonitorIds: string[]) => {
    clearVideoSyncLoop();
    videoSyncContext = null;

    if (item.kind !== 'video') {
      return;
    }

    const syncPlan = buildVideoSyncPlan({
      openMonitorIds: appliedMonitorIds,
      preferredHostMonitorId: appliedMonitorIds[0] ?? null
    });

    if (!syncPlan.canSynchronize || !syncPlan.hostMonitorId) {
      return;
    }

    const synchronizedMonitorIds = [syncPlan.hostMonitorId, ...syncPlan.clientMonitorIds];
    const scheduledAtMs = Date.now() + syncPlan.strategy.commandLeadMs;
    const seekResult = dispatchVideoSyncCommand(synchronizedMonitorIds, 'VIDEO_SYNC_SEEK', {
      scheduledAtMs,
      mediaTimeMs: item.startAtMs
    });
    const playResult = dispatchVideoSyncCommand(synchronizedMonitorIds, 'VIDEO_SYNC_PLAY', {
      scheduledAtMs,
      mediaTimeMs: item.startAtMs
    });

    const failedMonitorIds = new Set([...seekResult.failedMonitorIds, ...playResult.failedMonitorIds]);

    videoSyncContext = {
      strategy: syncPlan.strategy,
      synchronizedMonitorIds,
      clientMonitorIds: syncPlan.clientMonitorIds,
      hostMonitorId: syncPlan.hostMonitorId,
      anchor: {
        anchorWallClockMs: scheduledAtMs,
        anchorMediaTimeMs: item.startAtMs
      }
    };

    startVideoSyncLoop();

    if (failedMonitorIds.size > 0) {
      feedback.value = `Sync video host+clientes activo con degradacion (${failedMonitorIds.size} destino(s) sin sync).`;
      return;
    }

    feedback.value = `Sync video host+clientes activo. Host: ${syncPlan.hostMonitorId} · Clientes: ${syncPlan.clientMonitorIds.length}.`;
  };

  const setCurrentIndex = (nextIndex: number) => {
    const normalizedIndex = normalizeIndex(nextIndex, items.value.length);
    if (normalizedIndex === playback.value.currentIndex) {
      return;
    }

    playback.value = {
      ...playback.value,
      currentIndex: normalizedIndex
    };
  };

  const ensureReadyToApply = (): string | null => {
    if (items.value.length === 0) {
      return 'No hay items en la playlist.';
    }

    const targetMonitorIds = resolveSelectedMonitorIds(playback.value.targetMonitorIds);
    if (targetMonitorIds.length === 0) {
      return 'Selecciona al menos un monitor objetivo para la playlist.';
    }

    const hasReadyMonitor = targetMonitorIds.some((monitorId) => isMonitorReady(monitorId));
    if (!hasReadyMonitor) {
      return 'Ningun monitor objetivo tiene ventana activa. Abre al menos una ventana antes de reproducir.';
    }

    return null;
  };

  const applyCurrentItem = (): ApplyCurrentItemResult => {
    const blockedReason = ensureReadyToApply();
    if (blockedReason) {
      feedback.value = blockedReason;
      return {
        ok: false,
        appliedMonitorIds: [],
        item: null
      };
    }

    const targetMonitorIds = resolveSelectedMonitorIds(playback.value.targetMonitorIds);
    const item = activeItem.value;
    if (targetMonitorIds.length === 0 || !item) {
      feedback.value = 'No se pudo resolver el item activo.';
      return {
        ok: false,
        appliedMonitorIds: [],
        item
      };
    }

    let appliedCount = 0;
    const appliedMonitorIds: string[] = [];
    const unavailableMonitorIds: string[] = [];
    const failedMonitorIds: string[] = [];

    targetMonitorIds.forEach((monitorId) => {
      if (!isMonitorReady(monitorId)) {
        unavailableMonitorIds.push(monitorId);
        return;
      }

      const sent = applyItemToMonitor(monitorId, item);
      if (!sent) {
        failedMonitorIds.push(monitorId);
        return;
      }

      appliedCount += 1;
      appliedMonitorIds.push(monitorId);
    });

    if (appliedCount === 0) {
      feedback.value = 'No se pudo aplicar el item activo en los monitores seleccionados.';
      return {
        ok: false,
        appliedMonitorIds,
        item
      };
    }

    const warnings = unavailableMonitorIds.length + failedMonitorIds.length;
    if (warnings > 0) {
      feedback.value = `Aplicando #${playback.value.currentIndex + 1}: ${item.name} en ${appliedCount} destino(s). ${warnings} destino(s) no disponibles.`;
      return {
        ok: true,
        appliedMonitorIds,
        item
      };
    }

    feedback.value = `Aplicando #${playback.value.currentIndex + 1}: ${item.name} en ${appliedCount} destino(s).`;
    return {
      ok: true,
      appliedMonitorIds,
      item
    };
  };

  const scheduleAutoAdvance = () => {
    clearTimer();

    if (!isPlaying.value || !playback.value.autoplay) {
      return;
    }

    const item = activeItem.value;
    if (!item) {
      return;
    }

    timerId = window.setTimeout(() => {
      next();
    }, resolveAdvanceDelayMs(item, playback.value.intervalSeconds));
  };

  const start = () => {
    const result = applyCurrentItem();
    if (!result.ok) {
      isPlaying.value = false;
      clearTimer();
      clearVideoSyncLoop();
      videoSyncContext = null;
      return;
    }

    if (result.item) {
      activateVideoSync(result.item, result.appliedMonitorIds);
    }
    isPlaying.value = true;
    scheduleAutoAdvance();
  };

  const pause = () => {
    if (!isPlaying.value) {
      return;
    }

    if (videoSyncContext) {
      const pauseLeadMs = Math.min(videoSyncContext.strategy.commandLeadMs, MAX_PAUSE_LEAD_MS);
      dispatchVideoSyncCommand(videoSyncContext.synchronizedMonitorIds, 'VIDEO_SYNC_PAUSE', {
        scheduledAtMs: Date.now() + pauseLeadMs
      });
    }

    isPlaying.value = false;
    clearTimer();
    clearVideoSyncLoop();
    feedback.value = 'Reproduccion pausada.';
  };

  const stop = () => {
    isPlaying.value = false;
    clearTimer();
    clearVideoSyncLoop();
    videoSyncContext = null;

    resolveSelectedMonitorIds(playback.value.targetMonitorIds).forEach((monitorId) => {
      applyItemToMonitor(monitorId, null);
    });

    feedback.value = 'Reproduccion detenida.';
  };

  const next = () => {
    if (items.value.length === 0) {
      feedback.value = 'No hay items para avanzar.';
      return;
    }

    setCurrentIndex(playback.value.currentIndex + 1);
    const result = applyCurrentItem();
    if (!result.ok) {
      isPlaying.value = false;
      clearTimer();
      clearVideoSyncLoop();
      videoSyncContext = null;
      return;
    }

    if (result.item) {
      activateVideoSync(result.item, result.appliedMonitorIds);
    }

    if (isPlaying.value) {
      scheduleAutoAdvance();
    }
  };

  const previous = () => {
    if (items.value.length === 0) {
      feedback.value = 'No hay items para retroceder.';
      return;
    }

    setCurrentIndex(playback.value.currentIndex - 1);
    const result = applyCurrentItem();
    if (!result.ok) {
      isPlaying.value = false;
      clearTimer();
      clearVideoSyncLoop();
      videoSyncContext = null;
      return;
    }

    if (result.item) {
      activateVideoSync(result.item, result.appliedMonitorIds);
    }

    if (isPlaying.value) {
      scheduleAutoAdvance();
    }
  };

  watch(
    [items, () => playback.value.intervalSeconds, () => playback.value.autoplay],
    () => {
      if (items.value.length === 0) {
        setCurrentIndex(0);
      } else if (playback.value.currentIndex >= items.value.length) {
        setCurrentIndex(0);
      }

      if (isPlaying.value) {
        scheduleAutoAdvance();
      }
    },
    { deep: true }
  );

  watch(
    () => playback.value.targetMonitorIds,
    (nextMonitorIds) => {
      const targetMonitorIds = resolveSelectedMonitorIds(nextMonitorIds);
      if (targetMonitorIds.length === 0) {
        if (isPlaying.value) {
          pause();
        }
        feedback.value = 'Selecciona al menos un monitor objetivo para comenzar.';
        return;
      }

      const hasReadyMonitor = targetMonitorIds.some((monitorId) => isMonitorReady(monitorId));
      if (isPlaying.value && !hasReadyMonitor) {
        pause();
        feedback.value = 'Ninguno de los monitores objetivo tiene ventana abierta.';
      }
    },
    { deep: true }
  );

  onBeforeUnmount(() => {
    clearTimer();
    clearVideoSyncLoop();
  });

  return {
    activeItem,
    feedback,
    isPlaying,
    next,
    pause,
    previous,
    start,
    stop
  };
};
