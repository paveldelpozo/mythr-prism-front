import type { MasterToSlaveMessage } from './messages';

export type RemoteConnectionState = 'connecting' | 'paired' | 'reconnecting' | 'down';

export interface RemoteMonitorDescriptor {
  id: string;
  label: string;
  state: RemoteConnectionState;
  socketId: string;
}

export interface PairingRoomInfo {
  roomId: string;
  pairCode: string;
  expiresAtMs: number;
  joinUrl: string;
}

export interface RemoteControlEnvelope {
  remoteMonitorId: string;
  message: MasterToSlaveMessage;
}
