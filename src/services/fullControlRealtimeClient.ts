import { io, type Socket } from 'socket.io-client';
import type { FoundationRealtimeServerEvent, SystemStatusResponse } from '../types/fullControlApi';

export interface FullControlRealtimeClient {
  connect: () => void;
  disconnect: () => void;
  requestStatus: () => void;
  ping: () => Promise<SystemStatusResponse>;
  onServerEvent: (handler: (event: FoundationRealtimeServerEvent) => void) => () => void;
  onConnectionError: (handler: (message: string) => void) => () => void;
}

interface FullControlRealtimeClientOptions {
  baseUrl: string;
  apiKey: string;
}

export const createFullControlRealtimeClient = (
  options: FullControlRealtimeClientOptions
): FullControlRealtimeClient => {
  const socket = io(`${options.baseUrl.replace(/\/+$/, '')}/realtime/v1`, {
    autoConnect: false,
    transports: ['websocket'],
    auth: {
      apiKey: options.apiKey
    }
  });

  return buildClientFromSocket(socket);
};

const buildClientFromSocket = (socket: Socket): FullControlRealtimeClient => ({
  connect: () => {
    if (!socket.connected) {
      socket.connect();
    }
  },
  disconnect: () => {
    if (socket.connected) {
      socket.disconnect();
    }
  },
  requestStatus: () => {
    socket.emit('system:request-status');
  },
  ping: () =>
    new Promise((resolve, reject) => {
      socket.emit('system:ping', {}, (ack: unknown) => {
        const candidate = ack as { ok?: boolean; status?: SystemStatusResponse };
        if (candidate?.ok && candidate.status) {
          resolve(candidate.status);
          return;
        }

        reject(new Error('Invalid realtime ping acknowledgement.'));
      });
    }),
  onServerEvent: (handler) => {
    const onHello = (event: FoundationRealtimeServerEvent) => handler(event);
    const onStatus = (event: FoundationRealtimeServerEvent) => handler(event);

    socket.on('system:hello', onHello);
    socket.on('system:status', onStatus);

    return () => {
      socket.off('system:hello', onHello);
      socket.off('system:status', onStatus);
    };
  },
  onConnectionError: (handler) => {
    const onError = (error: Error) => {
      const message = typeof error?.message === 'string' && error.message.length > 0
        ? error.message
        : 'Realtime connection error';
      handler(message);
    };

    socket.on('connect_error', onError);
    return () => {
      socket.off('connect_error', onError);
    };
  }
});
