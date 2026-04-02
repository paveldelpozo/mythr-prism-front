export const MEDIA_ITEM_KINDS = ['image', 'video', 'external-url'] as const;

export type MediaItemKind = (typeof MEDIA_ITEM_KINDS)[number];

interface MultimediaItemBase {
  id: string;
  kind: MediaItemKind;
  name: string;
  source: string;
}

export interface ImageMultimediaItem extends MultimediaItemBase {
  kind: 'image';
  durationMs: number;
}

export interface VideoMultimediaItem extends MultimediaItemBase {
  kind: 'video';
  startAtMs: number;
  endAtMs: number | null;
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
    value.source.length > 0
  );
};

export const isMultimediaItem = (value: unknown): value is MultimediaItem => {
  if (!isBaseItemShape(value)) {
    return false;
  }

  const raw = value as unknown as Record<string, unknown>;

  if (value.kind === 'image') {
    return (
      typeof raw.durationMs === 'number' &&
      Number.isFinite(raw.durationMs) &&
      raw.durationMs > 0
    );
  }

  if (value.kind === 'external-url') {
    return true;
  }

  return (
    typeof raw.startAtMs === 'number' &&
    Number.isFinite(raw.startAtMs) &&
    raw.startAtMs >= 0 &&
    (raw.endAtMs === null ||
      (typeof raw.endAtMs === 'number' &&
        Number.isFinite(raw.endAtMs) &&
        raw.endAtMs >= raw.startAtMs)) &&
    typeof raw.muted === 'boolean'
  );
};
