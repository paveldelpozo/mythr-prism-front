export type WhiteboardTool = 'draw' | 'line' | 'arrow' | 'rect' | 'circle' | 'erase';

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  tool: WhiteboardTool;
  color: string;
  width: number;
  points: WhiteboardPoint[];
}

export interface WhiteboardState {
  strokes: WhiteboardStroke[];
}

export type MonitorWhiteboardStateMap = Record<string, WhiteboardState>;

const DEFAULT_STROKE_WIDTH = 6;
const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 48;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const toFiniteNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return value;
};

const isKnownTool = (value: unknown): value is WhiteboardTool =>
  value === 'draw'
  || value === 'line'
  || value === 'arrow'
  || value === 'rect'
  || value === 'circle'
  || value === 'erase';

const sanitizeTool = (value: unknown): WhiteboardTool => (isKnownTool(value) ? value : 'draw');

const sanitizeColor = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '#ef4444';
  }

  const color = value.trim();
  return color.length > 0 ? color.slice(0, 32) : '#ef4444';
};

const sanitizePoint = (value: unknown): WhiteboardPoint | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    x: clamp01(toFiniteNumber(raw.x, 0)),
    y: clamp01(toFiniteNumber(raw.y, 0))
  };
};

const sanitizeStroke = (value: unknown): WhiteboardStroke | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const points = Array.isArray(raw.points)
    ? raw.points
      .map((point) => sanitizePoint(point))
      .filter((point): point is WhiteboardPoint => point !== null)
    : [];

  if (points.length < 2) {
    return null;
  }

  return {
    tool: sanitizeTool(raw.tool),
    color: sanitizeColor(raw.color),
    width: Math.max(
      MIN_STROKE_WIDTH,
      Math.min(MAX_STROKE_WIDTH, Math.round(toFiniteNumber(raw.width, DEFAULT_STROKE_WIDTH)))
    ),
    points
  };
};

export const createEmptyWhiteboardState = (): WhiteboardState => ({
  strokes: []
});

export const sanitizeWhiteboardState = (value: unknown): WhiteboardState => {
  if (!value || typeof value !== 'object') {
    return createEmptyWhiteboardState();
  }

  const raw = value as Record<string, unknown>;
  const strokes = Array.isArray(raw.strokes)
    ? raw.strokes
      .map((stroke) => sanitizeStroke(stroke))
      .filter((stroke): stroke is WhiteboardStroke => stroke !== null)
    : [];

  return {
    strokes
  };
};
