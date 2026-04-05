import { mount } from '@vue/test-utils';
import { defineComponent } from 'vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRemoteHostSync } from './useRemoteHostSync';

class FakeDataChannel {
  readyState: RTCDataChannelState = 'open';
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  close = vi.fn();
  send = vi.fn();
}

class FakePeerConnection {
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;

  createDataChannel = vi.fn(() => new FakeDataChannel() as unknown as RTCDataChannel);
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'fake-offer' }) as RTCSessionDescriptionInit);
  setLocalDescription = vi.fn(async () => {});
  setRemoteDescription = vi.fn(async () => {});
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();
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
    if (event === 'pairing:create-room') {
      ack?.(mockSocketState.createRoomResult());
      return;
    }

    if (event === 'pairing:approve-client') {
      ack?.({ ok: true, payload });
    }
  }

  trigger(event: string, payload?: unknown): void {
    this.handlers[event]?.forEach((handler) => {
      handler(payload);
    });
  }
}

const mockSocketState = vi.hoisted(() => ({
  sockets: [] as FakeSocket[],
  createRoomResult: () => ({
    ok: true,
    roomId: 'room-default',
    pairCode: 'ABC123',
    expiresAtMs: Date.now() + (5 * 60 * 1000)
  })
}));

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const socket = new FakeSocket();
    mockSocketState.sockets.push(socket);
    return socket;
  })
}));

vi.mock('../utils/remoteBackend', () => ({
  resolveRemoteBackendUrl: () => 'ws://localhost:9999',
  resolveRemotePublicUrl: () => 'https://frontend.local'
}));

const createHarness = () => {
  let api!: ReturnType<typeof useRemoteHostSync>;

  const Host = defineComponent({
    setup() {
      api = useRemoteHostSync();
      return () => null;
    }
  });

  const wrapper = mount(Host);
  return { api, wrapper };
};

describe('composables/useRemoteHostSync', () => {
  afterEach(() => {
    mockSocketState.sockets = [];
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('actualiza la cuenta regresiva cada segundo', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00.000Z'));
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection as unknown as typeof RTCPeerConnection);

    mockSocketState.createRoomResult = () => ({
      ok: true,
      roomId: 'room-1',
      pairCode: 'CODE1',
      expiresAtMs: Date.now() + (5 * 60 * 1000)
    });

    const { api, wrapper } = createHarness();

    await api.createPairingRoom();
    expect(api.roomExpiresInMs.value).toBe(300000);
    expect(api.room.value?.joinUrl).toBe('https://frontend.local/remote?roomId=room-1&pairingCode=CODE1');

    vi.advanceTimersByTime(1000);
    expect(api.roomExpiresInMs.value).toBe(299000);

    vi.advanceTimersByTime(2000);
    expect(api.roomExpiresInMs.value).toBe(297000);

    wrapper.unmount();
  });

  it('detiene la cuenta regresiva cuando un cliente inicia pairing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00.000Z'));
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection as unknown as typeof RTCPeerConnection);

    mockSocketState.createRoomResult = () => ({
      ok: true,
      roomId: 'room-2',
      pairCode: 'CODE2',
      expiresAtMs: Date.now() + (5 * 60 * 1000)
    });

    const { api, wrapper } = createHarness();

    await api.createPairingRoom();
    vi.advanceTimersByTime(2000);

    const socket = mockSocketState.sockets.at(-1);
    expect(socket).toBeDefined();

    socket?.trigger('pairing:client-paired', {
      remoteMonitorId: 'remote-1',
      clientSocketId: 'client-1'
    });

    await Promise.resolve();

    const frozenCountdown = api.roomExpiresInMs.value;
    vi.advanceTimersByTime(5000);

    expect(api.roomExpiresInMs.value).toBe(frozenCountdown);

    wrapper.unmount();
  });

  it('al expirar resetea estado de sala y deja cuenta en cero', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00.000Z'));
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection as unknown as typeof RTCPeerConnection);

    mockSocketState.createRoomResult = () => ({
      ok: true,
      roomId: 'room-3',
      pairCode: 'CODE3',
      expiresAtMs: Date.now() + 3000
    });

    const { api, wrapper } = createHarness();

    await api.createPairingRoom();
    expect(api.room.value?.roomId).toBe('room-3');

    vi.advanceTimersByTime(3000);

    expect(api.room.value).toBeNull();
    expect(api.pendingApprovals.value).toEqual([]);
    expect(api.remoteMonitors.value).toEqual([]);
    expect(api.roomExpiresInMs.value).toBe(0);
    expect(api.pairingError.value).toContain('expiro por inactividad');

    wrapper.unmount();
  });

  it('limpia timers al cerrar sala y al desmontar composable', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-03T10:00:00.000Z'));
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection as unknown as typeof RTCPeerConnection);

    mockSocketState.createRoomResult = () => ({
      ok: true,
      roomId: 'room-4',
      pairCode: 'CODE4',
      expiresAtMs: Date.now() + (5 * 60 * 1000)
    });

    const { api, wrapper } = createHarness();
    await api.createPairingRoom();

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    api.closeRoom();
    expect(vi.getTimerCount()).toBe(0);

    await api.createPairingRoom();
    const socket = mockSocketState.sockets.at(-1);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    wrapper.unmount();

    expect(socket?.disconnect).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('el host puede desconectar un remoto y limpiar su estado', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection as unknown as typeof RTCPeerConnection);

    const { api, wrapper } = createHarness();
    await api.createPairingRoom();

    const socket = mockSocketState.sockets.at(-1);
    socket?.trigger('pairing:client-paired', {
      remoteMonitorId: 'remote-1',
      clientSocketId: 'client-1'
    });
    await Promise.resolve();

    expect(api.remoteMonitors.value).toHaveLength(1);

    api.disconnectRemoteMonitor('remote-1');

    expect(api.remoteMonitors.value).toEqual([]);
    wrapper.unmount();
  });

  it('elimina monitor remoto de la lista cuando backend informa desconexion', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection as unknown as typeof RTCPeerConnection);

    const { api, wrapper } = createHarness();
    await api.createPairingRoom();

    const socket = mockSocketState.sockets.at(-1);
    socket?.trigger('pairing:client-paired', {
      remoteMonitorId: 'remote-1',
      clientSocketId: 'client-1'
    });
    await Promise.resolve();

    socket?.trigger('remote:disconnected', { clientSocketId: 'client-1' });

    expect(api.remoteMonitors.value).toEqual([]);
    wrapper.unmount();
  });
});
