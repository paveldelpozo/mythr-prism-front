import {
  CONTENT_TRANSITION_TYPES,
  DEFAULT_CONTENT_TRANSITION,
  type ContentTransition
} from './transitions';

export const MEDIA_ITEM_KINDS = ['image', 'video', 'external-url'] as const;

export type MediaItemKind = (typeof MEDIA_ITEM_KINDS)[number];

interface MultimediaItemBase {
  id: string;
  kind: MediaItemKind;
  name: string;
  source: string;
  durationMs: number;
  startAtMs: number;
  endAtMs: number | null;
  transition: ContentTransition;
}

export interface ImageMultimediaItem extends MultimediaItemBase {
  kind: 'image';
}

export interface VideoMultimediaItem extends MultimediaItemBase {
  kind: 'video';
  muted: boolean;
}

export interface ExternalUrlMultimediaItem extends MultimediaItemBase {
  kind: 'external-url';
}

export type MultimediaItem =
  | ImageMultimediaItem
  | VideoMultimediaItem
  | ExternalUrlMultimediaItem;

export interface PlaylistPlaybackState {
  targetMonitorIds: string[];
  currentIndex: number;
  autoplay: boolean;
  intervalSeconds: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isTransitionShape = (value: unknown): value is ContentTransition => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === 'string' &&
    CONTENT_TRANSITION_TYPES.includes(value.type as ContentTransition['type']) &&
    typeof value.durationMs === 'number' &&
    Number.isFinite(value.durationMs) &&
    value.durationMs > 0
  );
};

const isMediaItemKind = (value: unknown): value is MediaItemKind =>
  typeof value === 'string' && MEDIA_ITEM_KINDS.includes(value as MediaItemKind);

const isBaseItemShape = (value: unknown): value is MultimediaItemBase => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    isMediaItemKind(value.kind) &&
    typeof value.name === 'string' &&
    value.name.length > 0 &&
    typeof value.source === 'string' &&
    value.source.length > 0 &&
    typeof value.durationMs === 'number' &&
    Number.isFinite(value.durationMs) &&
    value.durationMs > 0 &&
    typeof value.startAtMs === 'number' &&
    Number.isFinite(value.startAtMs) &&
    value.startAtMs >= 0 &&
    (value.endAtMs === null ||
      (typeof value.endAtMs === 'number' &&
        Number.isFinite(value.endAtMs) &&
        value.endAtMs >= value.startAtMs)) &&
    isTransitionShape(value.transition)
  );
};

export const isMultimediaItem = (value: unknown): value is MultimediaItem => {
  if (!isBaseItemShape(value)) {
    return false;
  }

  const raw = value as unknown as Record<string, unknown>;

  if (value.kind === 'image' || value.kind === 'external-url') {
    return true;
  }

  return typeof raw.muted === 'boolean';
};

export const DEFAULT_PLAYLIST_ITEM_TRANSITION: ContentTransition = {
  ...DEFAULT_CONTENT_TRANSITION
};
