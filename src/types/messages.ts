import type { MonitorTransform } from './broadcaster';
import type { MultimediaItem } from './playlist';
import type { WhiteboardState } from './whiteboard';

export const MESSAGE_CHANNEL = 'MMIB_V3_CHANNEL';

export type MasterMessageType =
  | 'MASTER_INIT'
  | 'FLASH_MONITOR_ID'
  | 'SET_IMAGE'
  | 'SET_MEDIA'
  | 'VIDEO_SYNC_PLAY'
  | 'VIDEO_SYNC_PAUSE'
  | 'VIDEO_SYNC_SEEK'
  | 'VIDEO_SYNC_TIME'
  | 'SET_TRANSFORM'
  | 'WHITEBOARD_SET_STATE'
  | 'WHITEBOARD_CLEAR'
  | 'WHITEBOARD_UNDO'
  | 'REQUEST_FULLSCREEN'
  | 'REQUEST_CLOSE'
  | 'PING';

export type SlaveMessageType =
  | 'SLAVE_READY'
  | 'FULLSCREEN_STATUS'
  | 'THUMBNAIL_SNAPSHOT'
  | 'PONG'
  | 'SLAVE_CLOSING'
  | 'SLAVE_ERROR';

export interface MessageEnvelope<TType extends string, TPayload> {
  channel: typeof MESSAGE_CHANNEL;
  type: TType;
  instanceToken: string;
  monitorId: string;
  payload: TPayload;
}

export interface FullscreenStatusPayload {
  active: boolean;
  requiresInteraction: boolean;
  intentActive?: boolean;
  unexpectedExit?: boolean;
  message?: string;
}

export interface MasterInitPayload {
  monitorLabel: string;
}

export interface FlashMonitorIdPayload {
  monitorLabel: string;
  durationMs: number;
}

export interface ThumbnailSnapshotPayload {
  imageDataUrl: string | null;
  capturedAtMs: number;
}

export interface VideoSyncPlayPayload {
  scheduledAtMs: number;
  mediaTimeMs: number;
}

export interface VideoSyncPausePayload {
  scheduledAtMs: number;
}

export interface VideoSyncSeekPayload {
  scheduledAtMs: number;
  mediaTimeMs: number;
}

export interface VideoSyncTimePayload {
  anchorWallClockMs: number;
  anchorMediaTimeMs: number;
  driftToleranceMs: number;
}

export type MasterToSlaveMessage =
  | MessageEnvelope<'MASTER_INIT', MasterInitPayload>
  | MessageEnvelope<'FLASH_MONITOR_ID', FlashMonitorIdPayload>
  | MessageEnvelope<'SET_IMAGE', { imageDataUrl: string | null }>
  | MessageEnvelope<'SET_MEDIA', { item: MultimediaItem | null }>
  | MessageEnvelope<'VIDEO_SYNC_PLAY', VideoSyncPlayPayload>
  | MessageEnvelope<'VIDEO_SYNC_PAUSE', VideoSyncPausePayload>
  | MessageEnvelope<'VIDEO_SYNC_SEEK', VideoSyncSeekPayload>
  | MessageEnvelope<'VIDEO_SYNC_TIME', VideoSyncTimePayload>
  | MessageEnvelope<'SET_TRANSFORM', { transform: MonitorTransform }>
  | MessageEnvelope<'WHITEBOARD_SET_STATE', { state: WhiteboardState }>
  | MessageEnvelope<'WHITEBOARD_CLEAR', { reason: string }>
  | MessageEnvelope<'WHITEBOARD_UNDO', { reason: string }>
  | MessageEnvelope<'REQUEST_FULLSCREEN', { reason: string }>
  | MessageEnvelope<'REQUEST_CLOSE', { reason: string }>
  | MessageEnvelope<'PING', { timestamp: number }>;

export type SlaveToMasterMessage =
  | MessageEnvelope<'SLAVE_READY', { timestamp: number }>
  | MessageEnvelope<'FULLSCREEN_STATUS', FullscreenStatusPayload>
  | MessageEnvelope<'THUMBNAIL_SNAPSHOT', ThumbnailSnapshotPayload>
  | MessageEnvelope<'PONG', { timestamp: number }>
  | MessageEnvelope<'SLAVE_CLOSING', { timestamp: number }>
  | MessageEnvelope<'SLAVE_ERROR', { message: string }>;

export const isKnownEnvelope = (
  value: unknown
): value is MessageEnvelope<string, Record<string, unknown>> => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const raw = value as Record<string, unknown>;
  return (
    raw.channel === MESSAGE_CHANNEL &&
    typeof raw.type === 'string' &&
    typeof raw.instanceToken === 'string' &&
    typeof raw.monitorId === 'string' &&
    typeof raw.payload === 'object' &&
    raw.payload !== null
  );
};
