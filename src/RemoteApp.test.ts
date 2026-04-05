import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import RemoteApp from './RemoteApp.vue';

class FakePeerConnection {
  onicecandidate: ((event: { candidate: RTCIceCandidate | null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: { channel: RTCDataChannel }) => void) | null = null;
  connectionState: RTCPeerConnectionState = 'new';

  close = vi.fn();
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'fake-sdp' } as RTCSessionDescriptionInit));
  setRemoteDescription = vi.fn(async () => undefined);
  setLocalDescription = vi.fn(async () => undefined);
  addIceCandidate = vi.fn(async () => undefined);
}

interface FakeSocketHandlerMap {
  [event: string]: Array<(payload?: unknown) => void>;
}

class FakeSocket {
  handlers: FakeSocketHandlerMap = {};
  disconnect = vi.fn();

  on(event: string, handler: (payload?: unknown) => void): void {
    this.handlers[event] ??= [];
    this.handlers[event].push(handler);
  }

  emit(event: string, payload?: unknown, ack?: (result?: unknown) => void): void {
    if (event === 'pairing:join-request') {
      mockSocketState.lastJoinRequestPayload = payload;
      ack?.({ ok: true });
    }
  }
}

const mockSocketState = vi.hoisted(() => ({
  sockets: [] as FakeSocket[],
  lastJoinRequestPayload: null as unknown
}));

const orientationState = vi.hoisted(() => ({
  isLandscape: true
}));

const orientationApiMock = vi.hoisted(() => ({
  lock: vi.fn(async () => undefined),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = new FakeSocket();
    mockSocketState.sockets.push(socket);
    return socket;
  })
}));

vi.mock('./utils/remoteBackend', () => ({
  resolveRemoteBackendUrl: () => 'ws://localhost:9999'
}));

const setRemoteUrl = (search: string): void => {
  window.history.replaceState({}, '', `/remote${search}`);
};

const setScreenOrientation = (value: unknown): void => {
  Object.defineProperty(window.screen, 'orientation', {
    configurable: true,
    value
  });
};

const setOrientationMode = async (mode: 'portrait' | 'landscape'): Promise<void> => {
  orientationState.isLandscape = mode === 'landscape';
  window.dispatchEvent(new Event('orientationchange'));
  await nextTick();
};

const enterRemoteViewer = async () => {
  setRemoteUrl('?roomId=sala-42&pairingCode=ABCD-EFGH-1234');
  const wrapper = mount(RemoteApp);
  await wrapper.get('button').trigger('click');

  const activeSocket = mockSocketState.sockets.at(0);
  const pairingApprovedHandlers = activeSocket?.handlers['pairing:approved'];
  expect(pairingApprovedHandlers).toHaveLength(1);

  await pairingApprovedHandlers?.[0]?.({
    roomId: 'sala-42',
    remoteMonitorId: 'monitor-remote-1',
    hostSocketId: 'host-1'
  });
  await nextTick();

  return wrapper;
};

describe('RemoteApp', () => {
  const originalMatchMedia = window.matchMedia;
  const originalScreenOrientation = window.screen.orientation;
  const originalRTCPeerConnection = window.RTCPeerConnection;

  beforeEach(() => {
    mockSocketState.sockets = [];
    mockSocketState.lastJoinRequestPayload = null;
    orientationState.isLandscape = true;
    orientationApiMock.lock.mockReset();
    orientationApiMock.lock.mockImplementation(async () => undefined);
    orientationApiMock.addEventListener.mockReset();
    orientationApiMock.removeEventListener.mockReset();

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query.includes('landscape') ? orientationState.isLandscape : !orientationState.isLandscape,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    setScreenOrientation(orientationApiMock);
    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      writable: true,
      value: FakePeerConnection
    });
    setRemoteUrl('');
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    });

    setScreenOrientation(originalScreenOrientation);
    Object.defineProperty(window, 'RTCPeerConnection', {
      configurable: true,
      writable: true,
      value: originalRTCPeerConnection
    });
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('autocompleta roomId y pairingCode desde URL y conecta con un click', async () => {
    setRemoteUrl('?roomId=sala-42&pairingCode=abcd-efgh-1234');
    const wrapper = mount(RemoteApp);

    const input = wrapper.get('#pair-code-input');
    expect((input.element as HTMLInputElement).value).toBe('ABCD-EFGH-1234');
    expect(mockSocketState.sockets).toHaveLength(0);

    await wrapper.get('button').trigger('click');

    expect(mockSocketState.sockets).toHaveLength(1);
    expect(mockSocketState.lastJoinRequestPayload).toEqual({
      roomId: 'sala-42',
      pairCode: 'ABCD-EFGH-1234'
    });
    expect(wrapper.text()).toContain('Solicitud enviada. Esperando validacion del host...');
    wrapper.unmount();
  });

  it('muestra feedback si pairingCode de URL es invalido y evita conectar', async () => {
    setRemoteUrl('?roomId=sala-42&pairingCode=ABCD');
    const wrapper = mount(RemoteApp);

    expect(wrapper.text()).toContain('El codigo de emparejamiento en la URL no tiene formato valido');

    await wrapper.get('button').trigger('click');

    expect(mockSocketState.sockets).toHaveLength(0);
    expect(wrapper.text()).toContain('El codigo de emparejamiento debe tener formato');
    wrapper.unmount();
  });

  it('bloquea el zoom en viewport remoto y restaura la configuracion al desmontar', () => {
    const originalViewport = document.createElement('meta');
    originalViewport.setAttribute('name', 'viewport');
    originalViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    document.head.append(originalViewport);

    const wrapper = mount(RemoteApp);
    const viewport = document.querySelector('meta[name="viewport"]');

    expect(viewport).not.toBeNull();
    expect(viewport?.getAttribute('content')).toContain('maximum-scale=1');
    expect(viewport?.getAttribute('content')).toContain('user-scalable=no');
    expect(wrapper.get('#pair-code-input').classes()).toContain('remote-pair-code-input');
    expect(orientationApiMock.lock).toHaveBeenCalledWith('landscape');

    wrapper.unmount();

    expect(originalViewport.getAttribute('content')).toBe('width=device-width, initial-scale=1.0');
    originalViewport.remove();
  });

  it('muestra aviso en portrait y atenua controles operativos', async () => {
    orientationState.isLandscape = false;
    const wrapper = mount(RemoteApp);
    await nextTick();

    expect(wrapper.text()).toContain('Gira el dispositivo a horizontal');
    expect(wrapper.get('section').classes()).toContain('pointer-events-none');
    wrapper.unmount();
  });

  it('recupera la vista normal al volver a landscape', async () => {
    orientationState.isLandscape = false;
    const wrapper = mount(RemoteApp);
    await nextTick();

    expect(wrapper.text()).toContain('Gira el dispositivo a horizontal');

    await setOrientationMode('landscape');

    expect(wrapper.text()).not.toContain('Gira el dispositivo a horizontal');
    expect(wrapper.get('section').classes()).not.toContain('pointer-events-none');
    wrapper.unmount();
  });

  it('maneja de forma segura cuando screen.orientation.lock no existe', () => {
    setScreenOrientation({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const wrapper = mount(RemoteApp);

    expect(wrapper.get('#pair-code-input').exists()).toBe(true);
    wrapper.unmount();
  });

  it('maneja de forma segura rechazos de screen.orientation.lock', async () => {
    orientationApiMock.lock.mockRejectedValueOnce(new Error('not_allowed_error'));

    const wrapper = mount(RemoteApp);
    await nextTick();

    expect(wrapper.get('#pair-code-input').exists()).toBe(true);
    expect(orientationApiMock.lock).toHaveBeenCalledWith('landscape');
    wrapper.unmount();
  });

  it('oculta la toolbar remota tras 10 segundos sin interaccion', async () => {
    vi.useFakeTimers();
    const wrapper = await enterRemoteViewer();
    const toolbar = wrapper.get('header.remote-viewer-toolbar');

    expect(toolbar.attributes('aria-hidden')).toBe('false');

    vi.advanceTimersByTime(10_000);
    vi.advanceTimersByTime(250);
    await nextTick();

    expect(toolbar.attributes('aria-hidden')).toBe('true');
    wrapper.unmount();
  });

  it('vuelve a mostrar la toolbar al interactuar y reinicia el temporizador', async () => {
    vi.useFakeTimers();
    const wrapper = await enterRemoteViewer();
    const toolbar = wrapper.get('header.remote-viewer-toolbar');

    vi.advanceTimersByTime(10_000);
    vi.advanceTimersByTime(250);
    await nextTick();
    expect(toolbar.attributes('aria-hidden')).toBe('true');

    window.dispatchEvent(new Event('click'));
    await nextTick();
    expect(toolbar.attributes('aria-hidden')).toBe('false');

    vi.advanceTimersByTime(9_999);
    await nextTick();
    expect(toolbar.attributes('aria-hidden')).toBe('false');

    vi.advanceTimersByTime(1);
    await nextTick();
    expect(toolbar.attributes('aria-hidden')).toBe('true');
    wrapper.unmount();
  });

  it('alinea la toolbar operativa a la derecha', async () => {
    const wrapper = await enterRemoteViewer();
    const toolbar = wrapper.get('header.remote-viewer-toolbar');

    expect(toolbar.classes()).toContain('remote-viewer-toolbar--right');
    wrapper.unmount();
  });

  it('limpia el timer de inactividad al desmontar el remoto', async () => {
    vi.useFakeTimers();
    const wrapper = await enterRemoteViewer();

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
