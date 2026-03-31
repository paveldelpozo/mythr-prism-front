import type { MultimediaItem } from './playlist';

export interface MonitorTransform {
  rotate: number;
  scale: number;
  translateX: number;
  translateY: number;
}

export interface MonitorDescriptor {
  id: string;
  label: string;
  width: number;
  height: number;
  left: number;
  top: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary: boolean;
  isMasterAppScreen: boolean;
  raw: ScreenDetailed;
}

export interface MonitorRuntimeState {
  transform: MonitorTransform;
  imageDataUrl: string | null;
  activeMediaItem: MultimediaItem | null;
  isWindowOpen: boolean;
  isSlaveReady: boolean;
  isFullscreen: boolean;
  fullscreenIntentActive: boolean;
  lostFullscreenUnexpectedly: boolean;
  lastFullscreenExitAtMs: number | null;
  requiresFullscreenInteraction: boolean;
  lastError: string | null;
}

export interface MonitorThumbnailState {
  imageDataUrl: string | null;
  capturedAtMs: number | null;
}

export type MonitorThumbnailStateMap = Record<string, MonitorThumbnailState>;

export type MonitorStateMap = Record<string, MonitorRuntimeState>;

export const DEFAULT_TRANSFORM: MonitorTransform = {
  rotate: 0,
  scale: 1,
  translateX: 0,
  translateY: 0
};

export const createDefaultMonitorState = (): MonitorRuntimeState => ({
  transform: { ...DEFAULT_TRANSFORM },
  imageDataUrl: null,
  activeMediaItem: null,
  isWindowOpen: false,
  isSlaveReady: false,
  isFullscreen: false,
  fullscreenIntentActive: false,
  lostFullscreenUnexpectedly: false,
  lastFullscreenExitAtMs: null,
  requiresFullscreenInteraction: true,
  lastError: null
});
