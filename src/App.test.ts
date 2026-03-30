import { mount } from '@vue/test-utils';
import { computed, defineComponent, nextTick, reactive, ref, type PropType } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { MonitorDescriptor } from './types/broadcaster';

const mockMonitors = ref<MonitorDescriptor[]>([
  {
    id: 'master',
    label: 'Master',
    width: 1920,
    height: 1080,
    left: 0,
    top: 0,
    availLeft: 0,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: true,
    isMasterAppScreen: true,
    raw: {} as ScreenDetailed
  },
  {
    id: 'projector',
    label: 'Projector',
    width: 1920,
    height: 1080,
    left: 1920,
    top: 0,
    availLeft: 1920,
    availTop: 0,
    availWidth: 1920,
    availHeight: 1080,
    isPrimary: false,
    isMasterAppScreen: false,
    raw: {} as ScreenDetailed
  }
]);

const mockMonitorStates = reactive({
  master: {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    requiresFullscreenInteraction: false,
    lastError: null
  },
  projector: {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    requiresFullscreenInteraction: false,
    lastError: null
  }
});

vi.mock('./composables/useMultiMonitorBroadcaster', () => ({
  useMultiMonitorBroadcaster: () => ({
    applyTransform: vi.fn(),
    closeAllWindows: vi.fn(),
    closeWindow: vi.fn(),
    globalError: ref<string | null>(null),
    hasDetectedMonitors: computed(() => mockMonitors.value.length > 0),
    isLoadingMonitors: ref(false),
    isWindowManagementSupported: true,
    monitorStates: mockMonitorStates,
    monitors: mockMonitors,
    persistableMonitorStates: computed(() => ({
      master: {
        transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
        imageDataUrl: null
      },
      projector: {
        transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
        imageDataUrl: null
      }
    })),
    loadMonitors: vi.fn(async () => undefined),
    openWindowForMonitor: vi.fn(),
    requestFullscreen: vi.fn(),
    setImageForMonitor: vi.fn(),
    setPlaylistItemForMonitor: vi.fn()
  })
}));

vi.mock('./services/persistence', () => ({
  SESSION_SCHEMA_VERSION: 1,
  loadPersistedSession: () => ({
    version: 1,
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
      intervalSeconds: 5
    }
  }),
  createDebouncedSessionSaver: () => ({
    schedule: vi.fn(),
    flush: vi.fn()
  })
}));

import App from './App.vue';

const PlaylistManagerStub = defineComponent({
  name: 'PlaylistManagerStub',
  props: {
    monitors: { type: Array as PropType<Array<{ id: string }>>, required: true },
    playbackState: {
      type: Object as PropType<{ targetMonitorIds: string[]; [key: string]: unknown }>,
      required: true
    }
  },
  emits: ['update:items', 'update:playbackState', 'playback:start', 'playback:pause', 'playback:next', 'playback:previous', 'playback:stop'],
  template: `
    <div>
      <p data-testid="playlist-visible-monitors">{{ monitors.length }}</p>
      <p data-testid="playlist-target">{{ playbackState.targetMonitorIds.length > 0 ? playbackState.targetMonitorIds.join(',') : 'null' }}</p>
      <button
        data-testid="set-invalid-target"
        @click="$emit('update:playbackState', { ...playbackState, targetMonitorIds: ['missing-monitor'] })"
      >
        invalid
      </button>
    </div>
  `
});

const MonitorListStub = defineComponent({
  name: 'MonitorListStub',
  props: {
    monitors: { type: Array as PropType<Array<{ id: string }>>, required: true },
    showOnlyProjectable: { type: Boolean, required: true }
  },
  template: `
    <div>
      <p data-testid="monitorlist-visible-monitors">{{ monitors.length }}</p>
      <p data-testid="monitorlist-filter-enabled">{{ showOnlyProjectable ? 'true' : 'false' }}</p>
    </div>
  `
});

describe('App integration base', () => {
  it('inicia con showOnlyProjectable activo por defecto', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          AppHeader: true,
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    expect(wrapper.get('[data-testid="tab-monitors"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[data-testid="tab-playlist"]').attributes('aria-selected')).toBe('false');
    expect(wrapper.get('[data-testid="panel-monitors"]').isVisible()).toBe(true);
    expect(wrapper.get('[data-testid="panel-playlist"]').isVisible()).toBe(false);
    expect(wrapper.get('[data-testid="monitorlist-filter-enabled"]').text()).toBe('true');
    expect(wrapper.get('[data-testid="monitorlist-visible-monitors"]').text()).toBe('1');
    expect(wrapper.get('[data-testid="playlist-visible-monitors"]').text()).toBe('1');
  });

  it('permite cambiar entre tabs y muestra el panel correcto', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          AppHeader: true,
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="tab-playlist"]').trigger('click');

    expect(wrapper.get('[data-testid="tab-monitors"]').attributes('aria-selected')).toBe('false');
    expect(wrapper.get('[data-testid="tab-playlist"]').attributes('aria-selected')).toBe('true');
    expect(wrapper.get('[data-testid="panel-monitors"]').isVisible()).toBe(false);
    expect(wrapper.get('[data-testid="panel-playlist"]').isVisible()).toBe(true);
    expect(wrapper.get('[data-testid="playlist-visible-monitors"]').text()).toBe('1');
  });

  it('normaliza target invalido sin recursion', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          AppHeader: true,
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="tab-playlist"]').trigger('click');
    await wrapper.get('[data-testid="set-invalid-target"]').trigger('click');
    await nextTick();
    await nextTick();

    expect(wrapper.get('[data-testid="playlist-target"]').text()).toBe('null');
  });
});
