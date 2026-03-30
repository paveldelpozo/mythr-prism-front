<script setup lang="ts">
import {
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import MonitorList from './components/MonitorList.vue';
import PlaylistManager from './components/PlaylistManager.vue';
import { useMultiMonitorBroadcaster } from './composables/useMultiMonitorBroadcaster';
import { usePlaylistPlayback } from './composables/usePlaylistPlayback';
import {
  createDebouncedSessionSaver,
  loadPersistedSession,
  SESSION_SCHEMA_VERSION,
  type PersistedMonitorStateMap,
  type PersistedSessionV1
} from './services/persistence';
import type { MultimediaItem, PlaylistPlaybackState } from './types/playlist';
import { buildVideoSyncPlan } from './types/videoSync';

const persistedSession = loadPersistedSession();

const clampPlaylistIndex = (index: number, total: number): number => {
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

const sanitizeTargetMonitorIds = (monitorIds: readonly string[]): string[] => {
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

const normalizePlaybackByPlaylist = (
  playback: PlaylistPlaybackState,
  playlistLength: number
): PlaylistPlaybackState => ({
  ...playback,
  targetMonitorIds: sanitizeTargetMonitorIds(playback.targetMonitorIds),
  currentIndex: clampPlaylistIndex(playback.currentIndex, playlistLength),
  autoplay: playlistLength > 0 ? playback.autoplay : false
});

const {
  applyTransform,
  closeAllWindows,
  closeWindow,
  globalError,
  hasDetectedMonitors,
  isLoadingMonitors,
  isWindowManagementSupported,
  monitorStates,
  monitors,
  persistableMonitorStates,
  loadMonitors,
  openWindowForMonitor,
  requestFullscreen,
  setImageForMonitor,
  setPlaylistItemForMonitor
} = useMultiMonitorBroadcaster({
  initialMonitorStateById: persistedSession.monitors
});

const showOnlyProjectable = ref(persistedSession.ui.showOnlyProjectable);
const panelPreferences = ref(persistedSession.ui.panelPreferences);
const playlistItems = ref<MultimediaItem[]>(persistedSession.playlist);
type MainViewTab = 'monitors' | 'playlist';
const activeMainViewTab = ref<MainViewTab>('monitors');
const playlistPlaybackState = ref<PlaylistPlaybackState>(
  normalizePlaybackByPlaylist(persistedSession.playback, persistedSession.playlist.length)
);
const sessionSaver = createDebouncedSessionSaver();

const {
  feedback: playlistPlaybackFeedback,
  isPlaying: isPlaylistPlaying,
  next: playNext,
  pause: pausePlaylist,
  previous: playPrevious,
  start: startPlaylist,
  stop: stopPlaylist
} = usePlaylistPlayback({
  items: playlistItems,
  playback: playlistPlaybackState,
  applyItemToMonitor: setPlaylistItemForMonitor,
  isMonitorReady: (monitorId: string) => Boolean(monitorStates[monitorId]?.isWindowOpen)
});

const buildPersistablePanelPreferences = (): Record<string, boolean> => {
  const nextPreferences: Record<string, boolean> = {};

  Object.entries(panelPreferences.value).forEach(([key, enabled]) => {
    if (key.length > 0 && typeof enabled === 'boolean') {
      nextPreferences[key] = enabled;
    }
  });

  return nextPreferences;
};

const buildPersistableMonitorStateMap = (): PersistedMonitorStateMap => {
  const nextMap: PersistedMonitorStateMap = {};

  Object.entries(persistableMonitorStates.value).forEach(([monitorId, state]) => {
    if (monitorId.length === 0) {
      return;
    }

    nextMap[monitorId] = {
      transform: {
        rotate: state.transform.rotate,
        scale: state.transform.scale,
        translateX: state.transform.translateX,
        translateY: state.transform.translateY
      },
      imageDataUrl: typeof state.imageDataUrl === 'string' ? state.imageDataUrl : null
    };
  });

  return nextMap;
};

const buildPersistablePlaylist = (): MultimediaItem[] =>
  playlistItems.value
    .map((item): MultimediaItem | null => {
      if (
        typeof item.id !== 'string' ||
        typeof item.name !== 'string' ||
        typeof item.source !== 'string'
      ) {
        return null;
      }

      if (item.kind === 'image') {
        if (typeof item.durationMs !== 'number' || !Number.isFinite(item.durationMs)) {
          return null;
        }

        return {
          id: item.id,
          kind: 'image',
          name: item.name,
          source: item.source,
          durationMs: item.durationMs
        };
      }

      if (
        typeof item.startAtMs !== 'number' ||
        !Number.isFinite(item.startAtMs) ||
        typeof item.muted !== 'boolean' ||
        (item.endAtMs !== null &&
          (typeof item.endAtMs !== 'number' || !Number.isFinite(item.endAtMs)))
      ) {
        return null;
      }

      return {
        id: item.id,
        kind: 'video',
        name: item.name,
        source: item.source,
        startAtMs: item.startAtMs,
        endAtMs: item.endAtMs,
        muted: item.muted
      };
    })
    .filter((item): item is MultimediaItem => item !== null);

const buildSessionSnapshot = (): PersistedSessionV1 => ({
  version: SESSION_SCHEMA_VERSION,
  ui: {
    showOnlyProjectable: showOnlyProjectable.value,
    panelPreferences: buildPersistablePanelPreferences()
  },
  monitors: buildPersistableMonitorStateMap(),
  playlist: buildPersistablePlaylist(),
  playback: {
    targetMonitorIds: sanitizeTargetMonitorIds(playlistPlaybackState.value.targetMonitorIds),
    currentIndex: Math.max(0, Math.round(playlistPlaybackState.value.currentIndex)),
    autoplay: playlistPlaybackState.value.autoplay,
    intervalSeconds: Math.max(1, Math.round(playlistPlaybackState.value.intervalSeconds))
  }
});

const visibleMonitors = computed(() => {
  if (!showOnlyProjectable.value) {
    return monitors.value;
  }

  return monitors.value.filter((monitor) => !monitor.isMasterAppScreen);
});

const knownMonitorIds = computed(() => new Set(monitors.value.map((monitor) => monitor.id)));

const selectedTargetMonitorIds = computed(() =>
  sanitizeTargetMonitorIds(playlistPlaybackState.value.targetMonitorIds)
);

const hasAnyTargetMonitorWindowOpen = computed(() =>
  selectedTargetMonitorIds.value.some((monitorId) => Boolean(monitorStates[monitorId]?.isWindowOpen))
);

const openSlaveWindowsCount = computed(() =>
  Object.values(monitorStates).reduce(
    (total, state) => total + (state.isWindowOpen ? 1 : 0),
    0
  )
);

const canCloseAllWindows = computed(() => openSlaveWindowsCount.value > 0);

const openSlaveMonitorIds = computed(() =>
  Object.entries(monitorStates)
    .filter(([, state]) => state.isWindowOpen)
    .map(([monitorId]) => monitorId)
);

const videoSyncPlan = computed(() =>
  buildVideoSyncPlan({
    openMonitorIds: openSlaveMonitorIds.value,
    preferredHostMonitorId: selectedTargetMonitorIds.value[0] ?? null
  })
);

const uploadImage = (monitorId: string, file: File) => {
  const reader = new FileReader();
  reader.onload = (event) => {
    const data = event.target?.result;
    if (typeof data === 'string') {
      setImageForMonitor(monitorId, data);
    }
  };
  reader.onerror = () => {
    setImageForMonitor(monitorId, null);
  };
  reader.readAsDataURL(file);
};

watch(
  [showOnlyProjectable, panelPreferences, persistableMonitorStates, playlistItems, playlistPlaybackState],
  () => {
    sessionSaver.schedule(buildSessionSnapshot());
  },
  {
    deep: true,
    immediate: true
  }
);

watch(
  [() => playlistItems.value.length, () => playlistPlaybackState.value.currentIndex, () => playlistPlaybackState.value.autoplay],
  () => {
    const normalized = normalizePlaybackByPlaylist(
      playlistPlaybackState.value,
      playlistItems.value.length
    );

    if (
      normalized.currentIndex === playlistPlaybackState.value.currentIndex
      && normalized.autoplay === playlistPlaybackState.value.autoplay
    ) {
      return;
    }

    playlistPlaybackState.value = normalized;
  },
  { immediate: true }
);

watch(
  [selectedTargetMonitorIds, hasDetectedMonitors, knownMonitorIds],
  ([targetMonitorIds, monitorsDetected, monitorIds]) => {
    if (!monitorsDetected) {
      return;
    }

    const validMonitorIds = targetMonitorIds.filter((monitorId) => monitorIds.has(monitorId));
    if (validMonitorIds.length === targetMonitorIds.length) {
      return;
    }

    playlistPlaybackState.value = {
      ...playlistPlaybackState.value,
      targetMonitorIds: validMonitorIds
    };
  }
);

watch(
  [selectedTargetMonitorIds, isPlaylistPlaying, hasAnyTargetMonitorWindowOpen],
  ([targetMonitorIds, playing, hasOpenTarget]) => {
    if (targetMonitorIds.length === 0 || !playing || hasOpenTarget) {
      return;
    }

    pausePlaylist();
  }
);

const flushSessionSaver = () => {
  sessionSaver.flush();
};

onMounted(() => {
  window.addEventListener('beforeunload', flushSessionSaver);

  if (!isWindowManagementSupported) {
    return;
  }

  void loadMonitors();
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', flushSessionSaver);
  flushSessionSaver();
});
</script>

<template>
  <main class="app-shell">
    <div class="app-bg-shape app-bg-shape--one" />
    <div class="app-bg-shape app-bg-shape--two" />

    <div class="app-shell-content">
      <AppHeader
        :active-main-view-tab="activeMainViewTab"
        @update:active-main-view-tab="activeMainViewTab = $event"
      />

      <section
        id="panel-monitors"
        data-testid="panel-monitors"
        role="tabpanel"
        aria-labelledby="tab-monitors"
        v-show="activeMainViewTab === 'monitors'"
        class="space-y-6"
      >
        <section
          v-if="!isWindowManagementSupported"
          class="app-alert app-alert--rose p-5"
        >
          <p class="text-sm font-semibold">
            Este navegador no soporta Window Management API (`getScreenDetails`).
          </p>
          <p class="mt-1 text-sm text-rose-100/90">
            Usa Chrome/Edge actualizados y concede permiso para deteccion de pantallas.
          </p>
        </section>

        <section
          v-else-if="!hasDetectedMonitors"
          class="glass-panel flex flex-col items-center gap-5 px-6 py-16 text-center"
        >
          <p class="max-w-xl text-sm text-slate-200/90">
            Detecta pantallas para iniciar la sesion multi-monitor. Se solicitara permiso del navegador para acceder al detalle de monitores.
          </p>
          <button
            type="button"
            class="btn-with-icon btn-lg border border-indigo-300/35 bg-indigo-500/25 text-indigo-50 hover:bg-indigo-500/35"
            :disabled="isLoadingMonitors"
            @click="loadMonitors"
          >
            <MagnifyingGlassIcon aria-hidden="true" class="btn-icon" />
            {{ isLoadingMonitors ? 'Detectando monitores...' : 'Detectar pantallas' }}
          </button>
        </section>

        <MonitorList
          v-else
          :monitors="visibleMonitors"
          :states="monitorStates"
          :show-only-projectable="showOnlyProjectable"
          :total-monitors="monitors.length"
          :can-close-all-windows="canCloseAllWindows"
          @update:show-only-projectable="showOnlyProjectable = $event"
          @close-all="closeAllWindows"
          @open-window="openWindowForMonitor"
          @close-window="closeWindow"
          @request-fullscreen="requestFullscreen"
          @upload-image="uploadImage"
          @clear-image="(id) => setImageForMonitor(id, null)"
          @transform="applyTransform"
        />
      </section>

      <section
        id="panel-playlist"
        data-testid="panel-playlist"
        role="tabpanel"
        aria-labelledby="tab-playlist"
        v-show="activeMainViewTab === 'playlist'"
      >
        <PlaylistManager
          v-model:items="playlistItems"
          v-model:playback-state="playlistPlaybackState"
          :monitors="visibleMonitors"
          :monitor-states="monitorStates"
          :video-sync-plan="videoSyncPlan"
          :playback-feedback="playlistPlaybackFeedback"
          :is-playing="isPlaylistPlaying"
          @playback:start="startPlaylist"
          @playback:pause="pausePlaylist"
          @playback:next="playNext"
          @playback:previous="playPrevious"
          @playback:stop="stopPlaylist"
        />
      </section>

      <section
        v-if="globalError"
        class="app-alert app-alert--amber"
      >
        {{ globalError }}
      </section>
    </div>
  </main>
</template>
