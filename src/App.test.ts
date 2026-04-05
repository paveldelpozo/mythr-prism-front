import { mount } from '@vue/test-utils';
import { computed, defineComponent, nextTick, reactive, ref, type PropType } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MonitorDescriptor } from './types/broadcaster';
import { createDefaultFilterPipeline } from './types/filters';
import type { PersistedSessionV1 } from './services/persistence';
import type { PairingRoomInfo, RemoteMonitorDescriptor } from './types/remoteSync';

const buildBaseMonitors = (): MonitorDescriptor[] => ([
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

const mockMonitors = ref<MonitorDescriptor[]>(buildBaseMonitors());

const mockMonitorStates = reactive({
  master: {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    contentTransition: { type: 'cut', durationMs: 450 },
    filterPipeline: createDefaultFilterPipeline(),
    filterPresets: [],
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    fullscreenIntentActive: false,
    lostFullscreenUnexpectedly: false,
    lastFullscreenExitAtMs: null,
    requiresFullscreenInteraction: false,
    isExternalAppCapturePending: false,
    isExternalAppCaptureActive: false,
    lastError: null
  },
  projector: {
    transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
    contentTransition: { type: 'cut', durationMs: 450 },
    filterPipeline: createDefaultFilterPipeline(),
    filterPresets: [],
    imageDataUrl: null,
    activeMediaItem: null,
    isWindowOpen: true,
    isSlaveReady: true,
    isFullscreen: false,
    fullscreenIntentActive: false,
    lostFullscreenUnexpectedly: false,
    lastFullscreenExitAtMs: null,
    requiresFullscreenInteraction: false,
    isExternalAppCapturePending: false,
    isExternalAppCaptureActive: false,
    lastError: null
  }
});

const applyTransformSpy = vi.fn();
const setImageForMonitorSpy = vi.fn();
const setMirrorEnabledSpy = vi.fn();
const setMirrorSourceMonitorIdSpy = vi.fn();
const setMirrorTargetMonitorIdsSpy = vi.fn();
const setMonitorCustomNameSpy = vi.fn();
const setContentTransitionForMonitorSpy = vi.fn();
const setFilterPipelineForMonitorSpy = vi.fn();
const saveFilterPresetForMonitorSpy = vi.fn();
const applyFilterPresetForMonitorSpy = vi.fn(() => true);
const deleteFilterPresetForMonitorSpy = vi.fn(() => true);
const setExternalUrlForMonitorSpy = vi.fn(() => true);
const startExternalAppCaptureForMonitorSpy = vi.fn(async () => true);
const stopExternalAppCaptureForMonitorSpy = vi.fn();
const clearExternalUrlForMonitorSpy = vi.fn();
const reloadExternalUrlForMonitorSpy = vi.fn(() => true);
const navigateExternalUrlForMonitorSpy = vi.fn(() => true);
const setWhiteboardStateForMonitorSpy = vi.fn();
const clearWhiteboardForMonitorSpy = vi.fn();
const undoWhiteboardForMonitorSpy = vi.fn();
const sessionSaverScheduleSpy = vi.fn();
const createPairingRoomSpy = vi.fn(async () => undefined);
const approveClientSpy = vi.fn(async () => undefined);
const sendControlMessageSpy = vi.fn();
const disconnectRemoteMonitorSpy = vi.fn();

const mockRemotePairingRoom = ref<PairingRoomInfo | null>(null);
const mockRemotePendingApprovals = ref<Array<{ clientSocketId: string; requestedAtMs: number }>>([]);
const mockRemoteMonitors = ref<RemoteMonitorDescriptor[]>([]);
const mockRemoteRoomExpiresInMs = ref(0);
const mockRemoteIsConnecting = ref(false);
const mockRemotePairingError = ref<string | null>(null);

const closeRemotePairingRoomSpy = vi.fn(() => {
  mockRemotePairingRoom.value = null;
  mockRemotePendingApprovals.value = [];
  mockRemoteMonitors.value = [];
  mockRemoteRoomExpiresInMs.value = 0;
});

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
        contentTransition: { type: 'cut', durationMs: 450 },
        filterPipeline: createDefaultFilterPipeline(),
        filterPresets: [],
        imageDataUrl: null,
        externalUrl: null,
        customName: null
      },
      projector: {
        transform: { rotate: 0, scale: 1, translateX: 0, translateY: 0 },
        contentTransition: { type: 'cut', durationMs: 450 },
        filterPipeline: createDefaultFilterPipeline(),
        filterPresets: [],
        imageDataUrl: null,
        externalUrl: null,
        customName: null
      }
    })),
    loadMonitors: vi.fn(async () => undefined),
    setVirtualMonitors: (virtualMonitors: MonitorDescriptor[]) => {
      mockMonitors.value = [...buildBaseMonitors(), ...virtualMonitors];
    },
    openWindowForMonitor: vi.fn(),
    requestFullscreen: vi.fn(),
    flashMonitorId: vi.fn(() => true),
    sendVideoSyncCommand: vi.fn(() => true),
    setMirrorEnabled: setMirrorEnabledSpy,
    setMirrorSourceMonitorId: setMirrorSourceMonitorIdSpy,
    setMirrorTargetMonitorIds: setMirrorTargetMonitorIdsSpy,
    setMonitorCustomName: setMonitorCustomNameSpy,
    setContentTransitionForMonitor: setContentTransitionForMonitorSpy,
    setFilterPipelineForMonitor: setFilterPipelineForMonitorSpy,
    saveFilterPresetForMonitor: saveFilterPresetForMonitorSpy,
    applyFilterPresetForMonitor: applyFilterPresetForMonitorSpy,
    deleteFilterPresetForMonitor: deleteFilterPresetForMonitorSpy,
    setExternalUrlForMonitor: setExternalUrlForMonitorSpy,
    startExternalAppCaptureForMonitor: startExternalAppCaptureForMonitorSpy,
    stopExternalAppCaptureForMonitor: stopExternalAppCaptureForMonitorSpy,
    clearExternalUrlForMonitor: clearExternalUrlForMonitorSpy,
    reloadExternalUrlForMonitor: reloadExternalUrlForMonitorSpy,
    navigateExternalUrlForMonitor: navigateExternalUrlForMonitorSpy,
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

vi.mock('./composables/useRemoteHostSync', () => ({
  useRemoteHostSync: () => ({
    room: mockRemotePairingRoom,
    roomExpiresInMs: mockRemoteRoomExpiresInMs,
    isConnecting: mockRemoteIsConnecting,
    pairingError: mockRemotePairingError,
    pendingApprovals: mockRemotePendingApprovals,
    remoteMonitors: mockRemoteMonitors,
    createPairingRoom: createPairingRoomSpy,
    approveClient: approveClientSpy,
    sendControlMessage: sendControlMessageSpy,
    disconnectRemoteMonitor: disconnectRemoteMonitorSpy,
    closeRoom: closeRemotePairingRoomSpy
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
    'openRemotePairing',
    'disconnectRemote',
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
      <button data-testid="monitor-open-remote-pairing" @click="$emit('openRemotePairing')">open-remote-pairing</button>
    </div>
  `
});

const RemotePairingModalStub = defineComponent({
  name: 'RemotePairingModalStub',
  props: {
    open: { type: Boolean, required: true },
    room: {
      type: Object as PropType<PairingRoomInfo | null>,
      default: null
    },
    pendingApprovals: {
      type: Array as PropType<Array<{ clientSocketId: string; requestedAtMs: number }>>,
      required: true
    },
    isConnecting: { type: Boolean, required: true },
    expiresInMs: { type: Number, required: true },
    error: {
      type: String,
      default: null
    }
  },
  emits: ['close', 'createRoom', 'approveClient'],
  template: `
    <div>
      <div v-if="open" data-testid="remote-modal-visible">
        <p data-testid="remote-modal-room-id">{{ room ? room.roomId : 'none' }}</p>
        <button data-testid="remote-modal-close" @click="$emit('close')">close</button>
        <button v-if="!room" data-testid="remote-modal-create-room" @click="$emit('createRoom')">create-room</button>
      </div>
    </div>
  `
});

describe('App integration base', () => {
  beforeEach(() => {
    mockPersistedSession = buildPersistedSession();
    mockMonitors.value = buildBaseMonitors();
    applyTransformSpy.mockReset();
    setImageForMonitorSpy.mockReset();
    setMirrorEnabledSpy.mockReset();
    setMirrorSourceMonitorIdSpy.mockReset();
    setMirrorTargetMonitorIdsSpy.mockReset();
    setMonitorCustomNameSpy.mockReset();
    setContentTransitionForMonitorSpy.mockReset();
    setExternalUrlForMonitorSpy.mockReset();
    startExternalAppCaptureForMonitorSpy.mockReset();
    stopExternalAppCaptureForMonitorSpy.mockReset();
    clearExternalUrlForMonitorSpy.mockReset();
    reloadExternalUrlForMonitorSpy.mockReset();
    navigateExternalUrlForMonitorSpy.mockReset();
    setWhiteboardStateForMonitorSpy.mockReset();
    clearWhiteboardForMonitorSpy.mockReset();
    undoWhiteboardForMonitorSpy.mockReset();
    sessionSaverScheduleSpy.mockReset();
    createPairingRoomSpy.mockClear();
    approveClientSpy.mockClear();
    sendControlMessageSpy.mockClear();
    disconnectRemoteMonitorSpy.mockClear();
    closeRemotePairingRoomSpy.mockClear();
    mockRemotePairingRoom.value = null;
    mockRemotePendingApprovals.value = [];
    mockRemoteMonitors.value = [];
    mockRemoteRoomExpiresInMs.value = 0;
    mockRemoteIsConnecting.value = false;
    mockRemotePairingError.value = null;
    vi.restoreAllMocks();
  });

  it('inicia con showOnlyProjectable activo por defecto', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
                contentTransition: { type: 'wipe', durationMs: 800 },
                filterPipeline: createDefaultFilterPipeline(),
                filterPresets: [],
                imageDataUrl: 'data:image/png;base64,abc',
                externalUrl: null,
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
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
    expect(setContentTransitionForMonitorSpy).toHaveBeenCalledWith('projector', {
      type: 'wipe',
      durationMs: 800
    });
    expect(setImageForMonitorSpy).toHaveBeenCalledWith('projector', 'data:image/png;base64,abc');
  });

  it('informa feedback cuando no hay layouts para cargar', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
        }
      }
    });

    await wrapper.get('[data-testid="monitor-rename-trigger"]').trigger('click');

    expect(setMonitorCustomNameSpy).toHaveBeenCalledWith('projector', 'Pantalla escenario');
  });

  it('cerrar el modal de pairing no limpia monitores remotos activos', async () => {
    mockRemotePairingRoom.value = {
      roomId: 'room-existing',
      pairCode: 'ABCD-1234-EFGH',
      joinUrl: 'https://mythr.app/remote?roomId=room-existing&pairingCode=ABCD-1234-EFGH',
      expiresAtMs: Date.now() + 300000
    };
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
        }
      }
    });

    mockRemoteMonitors.value = [
      {
        id: 'remote-1',
        label: 'Remoto 1',
        state: 'paired',
        socketId: 'socket-1',
        isFullscreenSupported: true,
        isFullscreenAvailable: true
      }
    ];
    await nextTick();

    expect(wrapper.get('[data-testid="monitorlist-visible-monitors"]').text()).toBe('2');
    await wrapper.get('[data-testid="monitor-open-remote-pairing"]').trigger('click');
    await wrapper.get('[data-testid="remote-modal-close"]').trigger('click');
    await nextTick();

    expect(closeRemotePairingRoomSpy).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="monitorlist-visible-monitors"]').text()).toBe('2');
  });

  it('reabrir modal conserva sala vigente y no exige crear una nueva', async () => {
    mockRemotePairingRoom.value = {
      roomId: 'room-existing',
      pairCode: 'ABCD-1234-EFGH',
      joinUrl: 'https://mythr.app/remote?roomId=room-existing&pairingCode=ABCD-1234-EFGH',
      expiresAtMs: Date.now() + 300000
    };

    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
        }
      }
    });

    await wrapper.get('[data-testid="monitor-open-remote-pairing"]').trigger('click');
    expect(wrapper.get('[data-testid="remote-modal-room-id"]').text()).toBe('room-existing');
    expect(wrapper.find('[data-testid="remote-modal-create-room"]').exists()).toBe(false);

    await wrapper.get('[data-testid="remote-modal-close"]').trigger('click');
    await nextTick();
    await wrapper.get('[data-testid="monitor-open-remote-pairing"]').trigger('click');
    await nextTick();

    expect(wrapper.get('[data-testid="remote-modal-room-id"]').text()).toBe('room-existing');
    expect(wrapper.find('[data-testid="remote-modal-create-room"]').exists()).toBe(false);
  });

  it('permite activar/desactivar modo espejo y configurar origen/destinos', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          MonitorList: MonitorListStub,
          PlaylistManager: PlaylistManagerStub,
          RemotePairingModal: RemotePairingModalStub
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
