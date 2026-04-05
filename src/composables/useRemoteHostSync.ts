import { computed, onBeforeUnmount, ref } from 'vue';
import { io, type Socket } from 'socket.io-client';
import type { MasterToSlaveMessage } from '../types/messages';
import { MESSAGE_CHANNEL } from '../types/messages';
import { resolveRemoteBackendUrl, resolveRemotePublicUrl } from '../utils/remoteBackend';
import { buildRemoteJoinUrl } from '../utils/remotePairing';
import type {
  PairingRoomInfo,
  RemoteConnectionState,
  RemoteControlEnvelope,
  RemoteHostChannelMessage,
  RemoteMonitorDescriptor
} from '../types/remoteSync';

interface HostPeerEntry {
  peer: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  clientSocketId: string;
}

export const useRemoteHostSync = () => {
  const socket = ref<Socket | null>(null);
  const room = ref<PairingRoomInfo | null>(null);
  const nowMs = ref(Date.now());
  const isConnecting = ref(false);
  const pairingError = ref<string | null>(null);
  const pendingApprovals = ref<Array<{ clientSocketId: string; requestedAtMs: number }>>([]);
  const remoteMonitors = ref<RemoteMonitorDescriptor[]>([]);

  const peerByRemoteMonitorId = new Map<string, HostPeerEntry>();
  const remoteMonitorIdByClientSocketId = new Map<string, string>();
  let roomCountdownIntervalId: ReturnType<typeof window.setInterval> | null = null;

  const stopRoomCountdown = (): void => {
    if (roomCountdownIntervalId === null) {
      return;
    }

    window.clearInterval(roomCountdownIntervalId);
    roomCountdownIntervalId = null;
  };

  const closeRoom = (): void => {
    stopRoomCountdown();
    room.value = null;
    pendingApprovals.value = [];
    remoteMonitors.value = [];

    peerByRemoteMonitorId.forEach((entry) => {
      entry.dataChannel?.close();
      entry.peer.close();
    });
    peerByRemoteMonitorId.clear();
    remoteMonitorIdByClientSocketId.clear();
  };

  const removeRemoteMonitor = (remoteMonitorId: string): void => {
    const entry = peerByRemoteMonitorId.get(remoteMonitorId);
    if (entry) {
      entry.dataChannel?.close();
      entry.peer.close();
      peerByRemoteMonitorId.delete(remoteMonitorId);
    }

    remoteMonitors.value = remoteMonitors.value.filter((monitor) => monitor.id !== remoteMonitorId);

    Array.from(remoteMonitorIdByClientSocketId.entries()).forEach(([clientSocketId, mappedRemoteMonitorId]) => {
      if (mappedRemoteMonitorId === remoteMonitorId) {
        remoteMonitorIdByClientSocketId.delete(clientSocketId);
      }
    });
  };

  const updateRemoteFullscreenCapability = (
    remoteMonitorId: string,
    payload: { supported: boolean; available: boolean }
  ): void => {
    remoteMonitors.value = remoteMonitors.value.map((monitor) =>
      monitor.id === remoteMonitorId
        ? {
            ...monitor,
            isFullscreenSupported: payload.supported,
            isFullscreenAvailable: payload.supported && payload.available
          }
        : monitor
    );
  };

  const isRemoteHostChannelMessage = (value: unknown): value is RemoteHostChannelMessage => {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const raw = value as Record<string, unknown>;
    if (raw.type !== 'REMOTE_FULLSCREEN_CAPABILITY') {
      return false;
    }

    if (!raw.payload || typeof raw.payload !== 'object') {
      return false;
    }

    const payload = raw.payload as Record<string, unknown>;
    return typeof payload.supported === 'boolean' && typeof payload.available === 'boolean';
  };

  const expireRoom = (): void => {
    if (!room.value) {
      return;
    }

    closeRoom();
    pairingError.value = 'La sala remota expiro por inactividad (5 minutos).';
  };

  const tickRoomCountdown = (): void => {
    nowMs.value = Date.now();
    if (!room.value) {
      stopRoomCountdown();
      return;
    }

    if (nowMs.value >= room.value.expiresAtMs) {
      expireRoom();
    }
  };

  const startRoomCountdown = (): void => {
    stopRoomCountdown();
    tickRoomCountdown();
    if (!room.value) {
      return;
    }

    roomCountdownIntervalId = window.setInterval(() => {
      tickRoomCountdown();
    }, 1000);
  };

  const ensureSocket = (): Socket => {
    if (socket.value) {
      return socket.value;
    }

    const nextSocket = io(resolveRemoteBackendUrl(), {
      transports: ['websocket', 'polling']
    });

    nextSocket.on('connect_error', () => {
      pairingError.value = 'No se pudo conectar con el backend remoto.';
    });

    nextSocket.on('pairing:approval-requested', (payload: { clientSocketId: string; requestedAtMs: number }) => {
      stopRoomCountdown();
      pendingApprovals.value = [
        ...pendingApprovals.value.filter((entry) => entry.clientSocketId !== payload.clientSocketId),
        payload
      ];
    });

    nextSocket.on('pairing:client-paired', async (payload: { remoteMonitorId: string; clientSocketId: string }) => {
      stopRoomCountdown();
      remoteMonitorIdByClientSocketId.set(payload.clientSocketId, payload.remoteMonitorId);
      pendingApprovals.value = pendingApprovals.value.filter(
        (entry) => entry.clientSocketId !== payload.clientSocketId
      );

      remoteMonitors.value = [
        ...remoteMonitors.value,
        {
          id: payload.remoteMonitorId,
          label: `Remoto ${remoteMonitors.value.length + 1}`,
          state: 'connecting',
          socketId: payload.clientSocketId,
          isFullscreenSupported: false,
          isFullscreenAvailable: false
        }
      ];

      await createPeerForRemote(payload.remoteMonitorId, payload.clientSocketId);
    });

    nextSocket.on('remote:state-updated', (payload: { remoteMonitorId: string; state: RemoteConnectionState }) => {
      remoteMonitors.value = remoteMonitors.value.map((monitor) =>
        monitor.id === payload.remoteMonitorId
          ? { ...monitor, state: payload.state }
          : monitor
      );
    });

    nextSocket.on('remote:disconnected', (payload: { clientSocketId: string }) => {
      const remoteMonitorId = remoteMonitorIdByClientSocketId.get(payload.clientSocketId);
      if (!remoteMonitorId) {
        return;
      }

      removeRemoteMonitor(remoteMonitorId);
    });

    nextSocket.on('room:expired', () => {
      expireRoom();
    });

    nextSocket.on('signal:answer', async (payload: { fromSocketId: string; payload: RTCSessionDescriptionInit }) => {
      const remoteMonitorId = remoteMonitorIdByClientSocketId.get(payload.fromSocketId);
      if (!remoteMonitorId) {
        return;
      }

      const peer = peerByRemoteMonitorId.get(remoteMonitorId)?.peer;
      if (!peer) {
        return;
      }

      await peer.setRemoteDescription(new RTCSessionDescription(payload.payload));
    });

    nextSocket.on('signal:ice-candidate', async (payload: { fromSocketId: string; payload: RTCIceCandidateInit }) => {
      const remoteMonitorId = remoteMonitorIdByClientSocketId.get(payload.fromSocketId);
      if (!remoteMonitorId) {
        return;
      }

      const peer = peerByRemoteMonitorId.get(remoteMonitorId)?.peer;
      if (!peer) {
        return;
      }

      await peer.addIceCandidate(new RTCIceCandidate(payload.payload));
    });

    socket.value = nextSocket;
    return nextSocket;
  };

  const createPeerForRemote = async (remoteMonitorId: string, clientSocketId: string): Promise<void> => {
    const activeSocket = ensureSocket();
    const peer = new RTCPeerConnection();
    const dataChannel = peer.createDataChannel('remote-control', { ordered: true });

    peer.onicecandidate = (event) => {
      if (!event.candidate || !room.value) {
        return;
      }

      activeSocket.emit('signal:ice-candidate', {
        roomId: room.value.roomId,
        targetSocketId: clientSocketId,
        payload: event.candidate.toJSON(),
        sentAtMs: Date.now()
      });
    };

    dataChannel.onopen = () => {
      remoteMonitors.value = remoteMonitors.value.map((monitor) =>
        monitor.id === remoteMonitorId
          ? { ...monitor, state: 'paired' }
          : monitor
      );
    };

    dataChannel.onclose = () => {
      remoteMonitors.value = remoteMonitors.value.map((monitor) =>
        monitor.id === remoteMonitorId
          ? { ...monitor, state: 'reconnecting' }
          : monitor
      );
    };

    dataChannel.onmessage = (event) => {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(String(event.data));
      } catch {
        return;
      }

      if (!isRemoteHostChannelMessage(parsed)) {
        return;
      }

      if (parsed.type === 'REMOTE_FULLSCREEN_CAPABILITY') {
        updateRemoteFullscreenCapability(remoteMonitorId, {
          supported: parsed.payload.supported,
          available: parsed.payload.available
        });
      }
    };

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    activeSocket.emit('signal:offer', {
      roomId: room.value?.roomId,
      targetSocketId: clientSocketId,
      payload: offer,
      sentAtMs: Date.now()
    });

    peerByRemoteMonitorId.set(remoteMonitorId, {
      peer,
      dataChannel,
      clientSocketId
    });
  };

  const createPairingRoom = async (): Promise<void> => {
    isConnecting.value = true;
    pairingError.value = null;
    const activeSocket = ensureSocket();

    await new Promise<void>((resolve) => {
      activeSocket.emit('pairing:create-room', {}, (result: { ok: boolean; roomId?: string; pairCode?: string; expiresAtMs?: number }) => {
        if (!result.ok || !result.roomId || !result.pairCode || !result.expiresAtMs) {
          pairingError.value = 'No se pudo crear la sala de pairing.';
          isConnecting.value = false;
          resolve();
          return;
        }

        room.value = {
          roomId: result.roomId,
          pairCode: result.pairCode,
          expiresAtMs: result.expiresAtMs,
          joinUrl: buildRemoteJoinUrl({
            baseUrl: resolveRemotePublicUrl(),
            roomId: result.roomId,
            pairCode: result.pairCode
          })
        };
        startRoomCountdown();
        isConnecting.value = false;
        resolve();
      });
    });
  };

  const approveClient = async (clientSocketId: string): Promise<void> => {
    const activeRoom = room.value;
    const activeSocket = ensureSocket();
    if (!activeRoom) {
      return;
    }

    await new Promise<void>((resolve) => {
      activeSocket.emit('pairing:approve-client', {
        roomId: activeRoom.roomId,
        clientSocketId
      }, () => resolve());
    });
  };

  const sendControlMessage = (payload: RemoteControlEnvelope): void => {
    const entry = peerByRemoteMonitorId.get(payload.remoteMonitorId);
    if (entry?.dataChannel && entry.dataChannel.readyState === 'open') {
      entry.dataChannel.send(JSON.stringify(payload.message));
      return;
    }

    const activeRoom = room.value;
    const activeSocket = socket.value;
    if (!activeSocket || !activeRoom || !entry) {
      return;
    }

    activeSocket.emit('remote:control-message', {
      roomId: activeRoom.roomId,
      targetSocketId: entry.clientSocketId,
      message: payload.message
    });
  };

  const disconnectRemoteMonitor = (remoteMonitorId: string): void => {
    const entry = peerByRemoteMonitorId.get(remoteMonitorId);
    if (!entry) {
      removeRemoteMonitor(remoteMonitorId);
      return;
    }

    sendControlMessage({
      remoteMonitorId,
      message: {
        channel: MESSAGE_CHANNEL,
        type: 'REQUEST_CLOSE',
        instanceToken: `${remoteMonitorId}-host-disconnect-${Date.now()}`,
        monitorId: remoteMonitorId,
        payload: {
          reason: 'Host requested remote disconnect'
        }
      } as MasterToSlaveMessage
    });

    removeRemoteMonitor(remoteMonitorId);
  };

  const roomExpiresInMs = computed(() => {
    const activeRoom = room.value;
    if (!activeRoom) {
      return 0;
    }

    return Math.max(0, activeRoom.expiresAtMs - nowMs.value);
  });

  onBeforeUnmount(() => {
    closeRoom();
    socket.value?.disconnect();
  });

  return {
    room,
    roomExpiresInMs,
    isConnecting,
    pairingError,
    pendingApprovals,
    remoteMonitors,
    createPairingRoom,
    approveClient,
    sendControlMessage,
    disconnectRemoteMonitor,
    closeRoom
  };
};
