import { beforeEach, describe, expect, it, vi } from 'vitest';

const socketMock = {
  connected: false,
  connect: vi.fn(() => {
    socketMock.connected = true;
  }),
  disconnect: vi.fn(() => {
    socketMock.connected = false;
  }),
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socketMock)
}));

import { createFullControlRealtimeClient } from './fullControlRealtimeClient';

describe('fullControlRealtimeClient', () => {
  beforeEach(() => {
    socketMock.connected = false;
    socketMock.connect.mockClear();
    socketMock.disconnect.mockClear();
    socketMock.emit.mockClear();
    socketMock.on.mockClear();
    socketMock.off.mockClear();
  });

  it('connects and requests status on demand', () => {
    const client = createFullControlRealtimeClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key'
    });

    client.connect();
    client.requestStatus();

    expect(socketMock.connect).toHaveBeenCalled();
    expect(socketMock.emit).toHaveBeenCalledWith('system:request-status');
  });

  it('resolves ping with acknowledgement status', async () => {
    socketMock.emit.mockImplementation((eventName: string, _payload: unknown, ack?: (value: unknown) => void) => {
      if (eventName === 'system:ping') {
        ack?.({
          ok: true,
          status: {
            service: 'mythr-prism-back',
            apiVersion: 'v1',
            status: 'ok',
            secureMode: false,
            timestamp: '2026-04-05T12:00:00.000Z'
          }
        });
      }
    });

    const client = createFullControlRealtimeClient({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key'
    });

    const status = await client.ping();
    expect(status.apiVersion).toBe('v1');
  });
});
