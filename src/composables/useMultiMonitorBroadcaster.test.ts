import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMultiMonitorBroadcaster } from './useMultiMonitorBroadcaster';
import type { MultimediaItem } from '../types/playlist';

type PopupWindowMock = Window & {
  postMessage: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  closed: boolean;
};

const videoItem = (id: string): MultimediaItem => ({
  id,
  kind: 'video',
  name: `Video ${id}`,
  source: `https://cdn/${id}.mp4`,
  startAtMs: 0,
  endAtMs: null,
  muted: true
});

const createHarness = () => {
  let api!: ReturnType<typeof useMultiMonitorBroadcaster>;

  const Host = defineComponent({
    setup() {
      api = useMultiMonitorBroadcaster();
      return () => null;
    }
  });

  mount(Host);
  return api;
};

const createHarnessWithUnmount = () => {
  let api!: ReturnType<typeof useMultiMonitorBroadcaster>;

  const Host = defineComponent({
    setup() {
      api = useMultiMonitorBroadcaster();
      return () => null;
    }
  });

  const wrapper = mount(Host);

  return {
    api,
    unmount: () => wrapper.unmount()
  };
};

const createMockScreen = (index: number): ScreenDetailed =>
  ({
    width: 1920,
    height: 1080,
    availWidth: 1920,
    availHeight: 1080,
    left: index * 1920,
    top: 0,
    availLeft: index * 1920,
    availTop: 0,
    isPrimary: index === 0,
    label: `Monitor ${index + 1}`
  } as unknown as ScreenDetailed);

const createMockScreenDetails = (screens: ScreenDetailed[]): ScreenDetails =>
  ({
    screens,
    currentScreen: screens[0],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  } as unknown as ScreenDetails);

const createPopupWindowMock = (): PopupWindowMock => {
  const popup = {
    postMessage: vi.fn(),
    close: vi.fn(),
    closed: false
  };

  popup.close.mockImplementation(() => {
    popup.closed = true;
  });

  return popup as unknown as PopupWindowMock;
};

const setupWindowManagementMocks = () => {
  const screens = [createMockScreen(0), createMockScreen(1), createMockScreen(2)];
  const popups: PopupWindowMock[] = [];

  vi.spyOn(window, 'open').mockImplementation(() => {
    const popup = createPopupWindowMock();
    popups.push(popup);
    return popup;
  });

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock-slave-window')
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => undefined)
  });

  Object.defineProperty(window, 'getScreenDetails', {
    configurable: true,
    writable: true,
    value: vi.fn(async () => createMockScreenDetails(screens))
  });

  return {
    popups,
    sourceMonitorId: '0-0-0-1920x1080',
    mirrorTargetId: '1-1920-0-1920x1080',
    unavailableTargetId: '2-3840-0-1920x1080'
  };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('composables/useMultiMonitorBroadcaster mirror mode', () => {
  it('replica contenido y transformaciones del origen hacia destinos', () => {
    const api = createHarness();

    api.setMirrorSourceMonitorId('source');
    api.setMirrorTargetMonitorIds(['dest-a', 'dest-b']);
    api.setMirrorEnabled(true);

    api.applyTransform('source', { type: 'rotate', value: 15 });
    api.applyTransform('source', { type: 'move', value: { x: 20, y: -10 } });
    api.setImageForMonitor('source', 'data:image/png;base64,AAA');
    api.setPlaylistItemForMonitor('source', videoItem('intro'));

    expect(api.monitorStates['dest-a']?.transform).toEqual(api.monitorStates.source?.transform);
    expect(api.monitorStates['dest-b']?.transform).toEqual(api.monitorStates.source?.transform);
    expect(api.monitorStates['dest-a']?.imageDataUrl).toBe('data:image/png;base64,AAA');
    expect(api.monitorStates['dest-a']?.activeMediaItem?.id).toBe('intro');
    expect(api.mirrorStatus.value.activeTargetCount).toBe(0);
  });

  it('previene ciclos al excluir origen de la lista de destinos', () => {
    const api = createHarness();

    api.setMirrorSourceMonitorId('m1');
    api.setMirrorTargetMonitorIds(['m1', 'm2', 'm2']);

    expect(api.mirrorConfig.value.targetMonitorIds).toEqual(['m2']);

    api.setMirrorSourceMonitorId('m2');

    expect(api.mirrorConfig.value.targetMonitorIds).toEqual([]);
  });

  it('degrada con destinos invalidos/no abiertos y reporta feedback operativo', () => {
    const api = createHarness();

    api.setMirrorSourceMonitorId('m1');
    api.setMirrorTargetMonitorIds(['m2', 'missing']);
    api.setMirrorEnabled(true);
    api.setPlaylistItemForMonitor('m1', videoItem('scene'));

    expect(api.mirrorStatus.value.unavailableTargetIds).toEqual(['m2', 'missing']);
    expect(api.mirrorStatus.value.lastError).toContain('degradacion');
  });

  it('replica imagen al destino espejo enviando SET_IMAGE sin limpiar con SET_MEDIA null', async () => {
    const { popups, sourceMonitorId, mirrorTargetId } = setupWindowManagementMocks();
    const api = createHarness();

    await api.loadMonitors();
    api.openWindowForMonitor(mirrorTargetId);
    const mirrorPopup = popups[0];

    api.setMirrorSourceMonitorId(sourceMonitorId);
    api.setMirrorTargetMonitorIds([mirrorTargetId]);
    api.setMirrorEnabled(true);

    mirrorPopup.postMessage.mockClear();

    const sourceImage = 'data:image/png;base64,MIRROR_IMAGE';
    api.setImageForMonitor(sourceMonitorId, sourceImage);

    const sentMessages = mirrorPopup.postMessage.mock.calls.map(([message]) => message);

    expect(sentMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SET_IMAGE',
          monitorId: mirrorTargetId,
          payload: {
            imageDataUrl: sourceImage
          }
        })
      ])
    );
    expect(sentMessages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SET_MEDIA',
          monitorId: mirrorTargetId,
          payload: {
            item: null
          }
        })
      ])
    );

    expect(api.monitorStates[mirrorTargetId]?.imageDataUrl).toBe(sourceImage);
  });

  it('mantiene visualizacion del origen mientras replica en destinos', async () => {
    const { popups, sourceMonitorId, mirrorTargetId } = setupWindowManagementMocks();
    const api = createHarness();

    await api.loadMonitors();
    api.openWindowForMonitor(sourceMonitorId);
    api.openWindowForMonitor(mirrorTargetId);

    const sourcePopup = popups[0];
    const mirrorPopup = popups[1];

    api.setMirrorSourceMonitorId(sourceMonitorId);
    api.setMirrorTargetMonitorIds([mirrorTargetId]);
    api.setMirrorEnabled(true);

    sourcePopup.postMessage.mockClear();
    mirrorPopup.postMessage.mockClear();

    const sourceImage = 'data:image/png;base64,SOURCE_VISIBLE';
    api.setImageForMonitor(sourceMonitorId, sourceImage);

    const sourceMessages = sourcePopup.postMessage.mock.calls.map(([message]) => message);
    const mirrorMessages = mirrorPopup.postMessage.mock.calls.map(([message]) => message);

    expect(sourceMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SET_IMAGE',
          monitorId: sourceMonitorId,
          payload: {
            imageDataUrl: sourceImage
          }
        })
      ])
    );
    expect(mirrorMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SET_IMAGE',
          monitorId: mirrorTargetId,
          payload: {
            imageDataUrl: sourceImage
          }
        })
      ])
    );
    expect(api.monitorStates[sourceMonitorId]?.imageDataUrl).toBe(sourceImage);
  });

  it('al desactivar espejo limpia destinos activos y resetea configuracion', async () => {
    const { popups, sourceMonitorId, mirrorTargetId } = setupWindowManagementMocks();
    const api = createHarness();

    await api.loadMonitors();
    api.openWindowForMonitor(mirrorTargetId);
    const mirrorPopup = popups[0];

    api.setMirrorSourceMonitorId(sourceMonitorId);
    api.setMirrorTargetMonitorIds([mirrorTargetId]);
    api.setMirrorEnabled(true);
    api.setImageForMonitor(sourceMonitorId, 'data:image/png;base64,TO_CLEAR');

    mirrorPopup.postMessage.mockClear();

    api.setMirrorEnabled(false);

    const sentMessages = mirrorPopup.postMessage.mock.calls.map(([message]) => message);

    expect(sentMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SET_IMAGE',
          monitorId: mirrorTargetId,
          payload: {
            imageDataUrl: null
          }
        })
      ])
    );
    expect(api.monitorStates[mirrorTargetId]?.imageDataUrl).toBeNull();
    expect(api.monitorStates[mirrorTargetId]?.activeMediaItem).toBeNull();
    expect(api.mirrorConfig.value).toEqual({
      enabled: false,
      sourceMonitorId: null,
      targetMonitorIds: []
    });
    expect(api.mirrorStatus.value).toEqual({
      activeTargetCount: 0,
      unavailableTargetIds: [],
      lastReplicatedAtMs: null,
      lastError: null
    });
  });

  it('al reactivar espejo exige seleccionar origen nuevamente', () => {
    const api = createHarness();

    api.setMirrorSourceMonitorId('m1');
    api.setMirrorTargetMonitorIds(['m2']);
    api.setMirrorEnabled(true);

    api.setMirrorEnabled(false);
    api.setMirrorEnabled(true);

    expect(api.mirrorConfig.value.sourceMonitorId).toBeNull();
    expect(api.mirrorConfig.value.targetMonitorIds).toEqual([]);
    expect(api.mirrorStatus.value.lastError).toContain('Selecciona un monitor origen');
  });

  it('mantiene degradacion parcial cuando un destino espejo no esta disponible', async () => {
    const { sourceMonitorId, mirrorTargetId, unavailableTargetId } = setupWindowManagementMocks();
    const api = createHarness();

    await api.loadMonitors();

    api.setMirrorSourceMonitorId(sourceMonitorId);
    api.setMirrorTargetMonitorIds([mirrorTargetId, unavailableTargetId]);
    api.setMirrorEnabled(true);
    api.setImageForMonitor(sourceMonitorId, 'data:image/png;base64,PARTIAL');

    expect(api.mirrorStatus.value.unavailableTargetIds).toEqual([mirrorTargetId, unavailableTargetId]);
    expect(api.mirrorStatus.value.lastError).toContain('degradacion');
  });
});

describe('composables/useMultiMonitorBroadcaster lifecycle cleanup', () => {
  it('cierra todas las ventanas al recibir beforeunload', async () => {
    const { popups, sourceMonitorId, mirrorTargetId } = setupWindowManagementMocks();
    const { api, unmount } = createHarnessWithUnmount();

    await api.loadMonitors();
    api.openWindowForMonitor(sourceMonitorId);
    api.openWindowForMonitor(mirrorTargetId);

    expect(popups).toHaveLength(2);

    expect(() => window.dispatchEvent(new Event('beforeunload'))).not.toThrow();

    expect(popups[0]?.close).toHaveBeenCalledTimes(1);
    expect(popups[1]?.close).toHaveBeenCalledTimes(1);
    expect(api.monitorStates[sourceMonitorId]?.isWindowOpen).toBe(false);
    expect(api.monitorStates[mirrorTargetId]?.isWindowOpen).toBe(false);

    unmount();
  });

  it('intenta cerrar todas las ventanas en pagehide aunque falle un close', async () => {
    const { popups, sourceMonitorId, mirrorTargetId } = setupWindowManagementMocks();
    const { api, unmount } = createHarnessWithUnmount();

    await api.loadMonitors();
    api.openWindowForMonitor(sourceMonitorId);
    api.openWindowForMonitor(mirrorTargetId);

    expect(popups).toHaveLength(2);

    popups[0]?.close.mockImplementation(() => {
      throw new Error('close blocked');
    });

    expect(() => window.dispatchEvent(new Event('pagehide'))).not.toThrow();

    expect(popups[0]?.close).toHaveBeenCalledTimes(1);
    expect(popups[1]?.close).toHaveBeenCalledTimes(1);
    expect(api.monitorStates[sourceMonitorId]?.isWindowOpen).toBe(false);
    expect(api.monitorStates[mirrorTargetId]?.isWindowOpen).toBe(false);

    unmount();
  });
});
