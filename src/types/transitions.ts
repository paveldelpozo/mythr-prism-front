export const CONTENT_TRANSITION_TYPES = ['cut', 'fade', 'wipe'] as const;

export type ContentTransitionType = (typeof CONTENT_TRANSITION_TYPES)[number];

export interface ContentTransition {
  type: ContentTransitionType;
  durationMs: number;
}

export const TRANSITION_DURATION_MIN_MS = 120;
export const TRANSITION_DURATION_MAX_MS = 5000;
export const DEFAULT_CONTENT_TRANSITION: ContentTransition = {
  type: 'cut',
  durationMs: 450
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isContentTransitionType = (value: unknown): value is ContentTransitionType =>
  typeof value === 'string' && CONTENT_TRANSITION_TYPES.includes(value as ContentTransitionType);

export const clampTransitionDurationMs = (durationMs: number): number =>
  Math.max(
    TRANSITION_DURATION_MIN_MS,
    Math.min(TRANSITION_DURATION_MAX_MS, Math.round(durationMs))
  );

export const sanitizeContentTransition = (value: unknown): ContentTransition => {
  if (!isRecord(value)) {
    return { ...DEFAULT_CONTENT_TRANSITION };
  }

  const type = isContentTransitionType(value.type)
    ? value.type
    : DEFAULT_CONTENT_TRANSITION.type;
  const durationMs = typeof value.durationMs === 'number' && Number.isFinite(value.durationMs)
    ? clampTransitionDurationMs(value.durationMs)
    : DEFAULT_CONTENT_TRANSITION.durationMs;

  return {
    type,
    durationMs
  };
};
