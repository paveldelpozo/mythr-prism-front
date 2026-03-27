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
  raw: ScreenDetailed;
}

export interface MonitorRuntimeState {
  transform: MonitorTransform;
  imageDataUrl: string | null;
  isWindowOpen: boolean;
  isSlaveReady: boolean;
  isFullscreen: boolean;
  requiresFullscreenInteraction: boolean;
  lastError: string | null;
}

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
  isWindowOpen: false,
  isSlaveReady: false,
  isFullscreen: false,
  requiresFullscreenInteraction: true,
  lastError: null
});
