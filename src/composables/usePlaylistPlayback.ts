import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import type { MultimediaItem, PlaylistPlaybackState } from '../types/playlist';

interface UsePlaylistPlaybackOptions {
  items: Ref<MultimediaItem[]>;
  playback: Ref<PlaylistPlaybackState>;
  applyItemToMonitor: (monitorId: string, item: MultimediaItem | null) => boolean;
  isMonitorReady: (monitorId: string) => boolean;
}

const DEFAULT_FEEDBACK = 'Lista para reproducir playlist.';

const resolveAdvanceDelayMs = (item: MultimediaItem, fallbackIntervalSeconds: number): number => {
  if (item.kind === 'image') {
    return Math.max(1000, Math.round(item.durationMs));
  }

  if (item.endAtMs !== null && item.endAtMs > item.startAtMs) {
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
  isMonitorReady
}: UsePlaylistPlaybackOptions) => {
  const isPlaying = ref(false);
  const feedback = ref<string>(DEFAULT_FEEDBACK);
  let timerId: number | null = null;

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

  const applyCurrentItem = (): boolean => {
    const blockedReason = ensureReadyToApply();
    if (blockedReason) {
      feedback.value = blockedReason;
      return false;
    }

    const targetMonitorIds = resolveSelectedMonitorIds(playback.value.targetMonitorIds);
    const item = activeItem.value;
    if (targetMonitorIds.length === 0 || !item) {
      feedback.value = 'No se pudo resolver el item activo.';
      return false;
    }

    let appliedCount = 0;
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
    });

    if (appliedCount === 0) {
      feedback.value = 'No se pudo aplicar el item activo en los monitores seleccionados.';
      return false;
    }

    const warnings = unavailableMonitorIds.length + failedMonitorIds.length;
    if (warnings > 0) {
      feedback.value = `Aplicando #${playback.value.currentIndex + 1}: ${item.name} en ${appliedCount} destino(s). ${warnings} destino(s) no disponibles.`;
      return true;
    }

    feedback.value = `Aplicando #${playback.value.currentIndex + 1}: ${item.name} en ${appliedCount} destino(s).`;
    return true;
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
    if (!applyCurrentItem()) {
      isPlaying.value = false;
      clearTimer();
      return;
    }

    isPlaying.value = true;
    scheduleAutoAdvance();
  };

  const pause = () => {
    if (!isPlaying.value) {
      return;
    }

    isPlaying.value = false;
    clearTimer();
    feedback.value = 'Reproduccion pausada.';
  };

  const stop = () => {
    isPlaying.value = false;
    clearTimer();

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
    const applied = applyCurrentItem();
    if (!applied) {
      isPlaying.value = false;
      clearTimer();
      return;
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
    const applied = applyCurrentItem();
    if (!applied) {
      isPlaying.value = false;
      clearTimer();
      return;
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
