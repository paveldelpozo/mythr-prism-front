import { mount } from '@vue/test-utils';
import { computed, defineComponent, nextTick, reactive, ref, type PropType } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitorDescriptor } from './types/broadcaster';
import type { PersistedSessionV1 } from './services/persistence';

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
    fullscreenIntentActive: false,
    lostFullscreenUnexpectedly: false,
    lastFullscreenExitAtMs: null,
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
    fullscreenIntentActive: false,
    lostFullscreenUnexpectedly: false,
    lastFullscreenExitAtMs: null,
    requiresFullscreenInteraction: false,
    lastError: null
  }
});

const applyTransformSpy = vi.fn();
const setImageForMonitorSpy = vi.fn();
const setMirrorEnabledSpy = vi.fn();
const setMirrorSourceMonitorIdSpy = vi.fn();
const setMirrorTargetMonitorIdsSpy = vi.fn();
const setMonitorCustomNameSpy = vi.fn();
const setWhiteboardStateForMonitorSpy = vi.fn();
const clearWhiteboardForMonitorSpy = vi.fn();
const undoWhiteboardForMonitorSpy = vi.fn();
const sessionSaverScheduleSpy = vi.fn();

const buildPersistedSession = (
  overrides: Partial<PersistedSessionV1> = {}
): PersistedSessionV1 => ({
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
  },
  mirror: {
    enabled: false,
    sourceMonitorId: null,
    targetMonitorIds: []
  },
  layouts: [],
  ...overrides
});

let mockPersistedSession: PersistedSessionV1 = buildPersistedSession();

vi.mock('./composables/useMultiMonitorBroadcaster', () => ({
  useMultiMonitorBroadcaster: () => ({
    applyTransform: applyTransformSpy,
    closeAllWindows: vi.fn(),
    clearWhiteboardForMonitor: clearWhiteboardForMonitorSpy,
    closeWindow: vi.fn(),
    globalError: ref<string | null>(null),
    hasDetectedMonitors: computed(() => mockMonitors.value.length > 0),
    isLoadingMonitors: ref(false),
    isWindowManagementSupported: true,
    monitorStates: mockMonitorStates,
    monitorWhiteboards: reactive({
      master: { strokes: [] },
      projector: { strokes: [] }
    }),
    mirrorConfig: ref({
      enabled: false,
      sourceMonitorId: null,
      targetMonitorIds: []
    }),
    mirrorStatus: ref({
      activeTargetCount: 0,
      unavailableTargetIds: [],
      lastReplicatedAtMs: null,
      lastError: null
    }),
    monitors: mockMonitors,
    persistableMonitorStates: computed(() => ({
      master: {
        transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
        imageDataUrl: null,
        customName: null
      },
      projector: {
        transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
        imageDataUrl: null,
        customName: null
      }
    })),
    loadMonitors: vi.fn(async () => undefined),
    openWindowForMonitor: vi.fn(),
    requestFullscreen: vi.fn(),
    flashMonitorId: vi.fn(() => true),
    sendVideoSyncCommand: vi.fn(() => true),
    setMirrorEnabled: setMirrorEnabledSpy,
    setMirrorSourceMonitorId: setMirrorSourceMonitorIdSpy,
    setMirrorTargetMonitorIds: setMirrorTargetMonitorIdsSpy,
    setMonitorCustomName: setMonitorCustomNameSpy,
    setImageForMonitor: setImageForMonitorSpy,
    setWhiteboardStateForMonitor: setWhiteboardStateForMonitorSpy,
    undoWhiteboardForMonitor: undoWhiteboardForMonitorSpy,
    setPlaylistItemForMonitor: vi.fn()
  })
}));

vi.mock('./services/persistence', () => ({
  SESSION_SCHEMA_VERSION: 1,
  loadPersistedSession: () => mockPersistedSession,
  createDebouncedSessionSaver: () => ({
    schedule: sessionSaverScheduleSpy,
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
    showOnlyProjectable: { type: Boolean, required: true },
    canCloseAllWindows: { type: Boolean, required: true },
    layouts: {
      type: Array as PropType<Array<{ id: string; name: string }>>,
      required: true
    },
    selectedLayoutId: {
      type: String,
      default: null
    },
    layoutFeedback: {
      type: String,
      default: null
    },
    layoutDraftName: {
      type: String,
      default: ''
    },
    mirrorEnabled: {
      type: Boolean,
      required: true
    },
    mirrorSourceMonitorId: {
      type: String,
      default: null
    },
    mirrorTargetMonitorIds: {
      type: Array as PropType<string[]>,
      required: true
    }
  },
  emits: [
    'update:layoutDraftName',
    'update:selectedLayoutId',
    'update:mirrorEnabled',
    'update:mirrorSourceMonitorId',
    'update:mirrorTargetMonitorIds',
    'openWhiteboard',
    'renameMonitor',
    'saveLayout',
    'loadLayout',
    'deleteLayout'
  ],
  template: `
    <div>
      <p data-testid="monitorlist-visible-monitors">{{ monitors.length }}</p>
      <p data-testid="monitorlist-filter-enabled">{{ showOnlyProjectable ? 'true' : 'false' }}</p>
      <p data-testid="monitorlist-can-close-all">{{ canCloseAllWindows ? 'true' : 'false' }}</p>
      <p data-testid="monitorlist-layout-count">{{ layouts.length }}</p>
      <p data-testid="monitorlist-layout-feedback">{{ layoutFeedback ?? 'null' }}</p>
      <p data-testid="monitorlist-layout-draft">{{ layoutDraftName }}</p>
      <p data-testid="monitorlist-mirror-enabled">{{ mirrorEnabled ? 'true' : 'false' }}</p>
      <button
        data-testid="layout-set-name"
        @click="$emit('update:layoutDraftName', 'Escena principal')"
      >
        set-layout-name
      </button>
      <button
        data-testid="layout-select-first"
        :disabled="layouts.length === 0"
        @click="$emit('update:selectedLayoutId', layouts[0]?.id ?? null)"
      >
        select-layout
      </button>
      <button data-testid="layout-save-trigger" @click="$emit('saveLayout')">save-layout</button>
      <button data-testid="layout-load-trigger" @click="$emit('loadLayout')">load-layout</button>
      <button data-testid="layout-delete-trigger" @click="$emit('deleteLayout')">delete-layout</button>
      <button data-testid="mirror-enable-trigger" @click="$emit('update:mirrorEnabled', true)">enable-mirror</button>
      <button data-testid="mirror-disable-trigger" @click="$emit('update:mirrorEnabled', false)">disable-mirror</button>
      <button data-testid="mirror-source-trigger" @click="$emit('update:mirrorSourceMonitorId', 'master')">source-mirror</button>
      <button data-testid="mirror-targets-trigger" @click="$emit('update:mirrorTargetMonitorIds', ['projector'])">targets-mirror</button>
      <button data-testid="monitor-rename-trigger" @click="$emit('renameMonitor', 'projector', 'Pantalla escenario')">rename-monitor</button>
    </div>
  `
});

describe('App integration base', () => {
  beforeEach(() => {
    mockPersistedSession = buildPersistedSession();
    applyTransformSpy.mockReset();
    setImageForMonitorSpy.mockReset();
    setMirrorEnabledSpy.mockReset();
    setMirrorSourceMonitorIdSpy.mockReset();
    setMirrorTargetMonitorIdsSpy.mockReset();
    setMonitorCustomNameSpy.mockReset();
    setWhiteboardStateForMonitorSpy.mockReset();
    clearWhiteboardForMonitorSpy.mockReset();
    undoWhiteboardForMonitorSpy.mockReset();
    sessionSaverScheduleSpy.mockReset();
    vi.restoreAllMocks();
  });

  it('inicia con showOnlyProjectable activo por defecto', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
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
    expect(wrapper.get('[data-testid="monitorlist-can-close-all"]').text()).toBe('true');
    expect(wrapper.get('[data-testid="monitorlist-visible-monitors"]').text()).toBe('1');
    expect(wrapper.get('[data-testid="playlist-visible-monitors"]').text()).toBe('1');
  });

  it('permite cambiar entre tabs y muestra el panel correcto', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
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

  it('guarda un layout desde UI y muestra feedback', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="layout-set-name"]').trigger('click');
    await wrapper.get('[data-testid="layout-save-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="monitorlist-layout-count"]').text()).toBe('1');
    expect(wrapper.get('[data-testid="monitorlist-layout-feedback"]').text()).toContain('guardado correctamente');
    expect(wrapper.get('[data-testid="monitorlist-layout-draft"]').text()).toBe('Escena principal');
  });

  it('carga un layout guardado y aplica snapshot de playback y monitores', async () => {
    mockPersistedSession = buildPersistedSession({
      layouts: [
        {
          id: 'layout-a',
          name: 'Layout A',
          createdAt: '2026-03-30T10:00:00.000Z',
          updatedAt: '2026-03-30T10:00:00.000Z',
          snapshot: {
            monitors: {
              projector: {
                transform: { rotate: 15, scale: 1.25, translateX: 30, translateY: -12 },
                imageDataUrl: 'data:image/png;base64,abc',
                customName: null
              }
            },
            playback: {
              targetMonitorIds: ['projector'],
              currentIndex: 2,
              autoplay: true,
              intervalSeconds: 9
            }
          }
        }
      ]
    });

    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="layout-select-first"]').trigger('click');
    await wrapper.get('[data-testid="layout-load-trigger"]').trigger('click');
    await nextTick();
    await nextTick();

    expect(wrapper.get('[data-testid="monitorlist-layout-feedback"]').text()).toContain('restaurado');
    expect(wrapper.get('[data-testid="playlist-target"]').text()).toBe('projector');
    expect(applyTransformSpy).toHaveBeenCalled();
    expect(setImageForMonitorSpy).toHaveBeenCalledWith('projector', 'data:image/png;base64,abc');
  });

  it('informa feedback cuando no hay layouts para cargar', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="layout-load-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="monitorlist-layout-feedback"]').text()).toContain(
      'No hay layouts guardados para cargar'
    );
  });

  it('elimina un layout desde UI y actualiza estado', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockPersistedSession = buildPersistedSession({
      layouts: [
        {
          id: 'layout-a',
          name: 'Layout A',
          createdAt: '2026-03-30T10:00:00.000Z',
          updatedAt: '2026-03-30T10:00:00.000Z',
          snapshot: {
            monitors: {},
            playback: {
              targetMonitorIds: [],
              currentIndex: 0,
              autoplay: false,
              intervalSeconds: 5
            }
          }
        }
      ]
    });

    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="layout-select-first"]').trigger('click');
    await wrapper.get('[data-testid="layout-delete-trigger"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="monitorlist-layout-count"]').text()).toBe('0');
    expect(wrapper.get('[data-testid="monitorlist-layout-feedback"]').text()).toContain('eliminado');
  });

  it('propaga renombrado de monitor hacia el broadcaster', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="monitor-rename-trigger"]').trigger('click');

    expect(setMonitorCustomNameSpy).toHaveBeenCalledWith('projector', 'Pantalla escenario');
  });

  it('permite activar/desactivar modo espejo y configurar origen/destinos', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub
        }
      }
    });

    await wrapper.get('[data-testid="mirror-enable-trigger"]').trigger('click');
    await wrapper.get('[data-testid="mirror-source-trigger"]').trigger('click');
    await wrapper.get('[data-testid="mirror-targets-trigger"]').trigger('click');
    await wrapper.get('[data-testid="mirror-disable-trigger"]').trigger('click');

    expect(setMirrorEnabledSpy).toHaveBeenNthCalledWith(1, true);
    expect(setMirrorSourceMonitorIdSpy).toHaveBeenCalledWith('master');
    expect(setMirrorTargetMonitorIdsSpy).toHaveBeenCalledWith(['projector']);
    expect(setMirrorEnabledSpy).toHaveBeenNthCalledWith(2, false);
  });
});
