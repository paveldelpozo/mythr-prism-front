export const FILTER_STAGE_IDS = ['brightness', 'contrast', 'saturate', 'grayscale', 'blur'] as const;

export type FilterStageId = (typeof FILTER_STAGE_IDS)[number];

export interface FilterStageConfig {
  id: FilterStageId;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
}

export interface MonitorFilterStage {
  id: FilterStageId;
  enabled: boolean;
  value: number;
}

export interface MonitorFilterPipeline {
  enabled: boolean;
  stages: MonitorFilterStage[];
}

export interface MonitorFilterPreset {
  id: string;
  name: string;
  pipeline: MonitorFilterPipeline;
  createdAt: string;
  updatedAt: string;
}

export const FILTER_STAGE_CONFIG: Record<FilterStageId, FilterStageConfig> = {
  brightness: {
    id: 'brightness',
    label: 'Brillo',
    min: 0,
    max: 3,
    step: 0.05,
    defaultValue: 1
  },
  contrast: {
    id: 'contrast',
    label: 'Contraste',
    min: 0,
    max: 3,
    step: 0.05,
    defaultValue: 1
  },
  saturate: {
    id: 'saturate',
    label: 'Saturacion',
    min: 0,
    max: 3,
    step: 0.05,
    defaultValue: 1
  },
  grayscale: {
    id: 'grayscale',
    label: 'Escala de grises',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0
  },
  blur: {
    id: 'blur',
    label: 'Desenfoque',
    min: 0,
    max: 20,
    step: 0.5,
    defaultValue: 0
  }
};

const FILTER_STAGE_ID_SET = new Set<FilterStageId>(FILTER_STAGE_IDS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clampValue = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const roundByStep = (value: number, step: number): number => {
  const precision = step >= 1 ? 0 : String(step).split('.')[1]?.length ?? 0;
  return Number((Math.round(value / step) * step).toFixed(precision));
};

const sanitizeStageId = (value: unknown): FilterStageId | null =>
  typeof value === 'string' && FILTER_STAGE_ID_SET.has(value as FilterStageId)
    ? (value as FilterStageId)
    : null;

export const createDefaultFilterPipeline = (): MonitorFilterPipeline => ({
  enabled: false,
  stages: FILTER_STAGE_IDS.map((id) => ({
    id,
    enabled: true,
    value: FILTER_STAGE_CONFIG[id].defaultValue
  }))
});

export const sanitizeFilterStage = (
  value: unknown,
  fallbackStageId: FilterStageId
): MonitorFilterStage => {
  const config = FILTER_STAGE_CONFIG[fallbackStageId];
  if (!isRecord(value)) {
    return {
      id: fallbackStageId,
      enabled: true,
      value: config.defaultValue
    };
  }

  const stageId = sanitizeStageId(value.id) ?? fallbackStageId;
  const stageConfig = FILTER_STAGE_CONFIG[stageId];
  const rawValue = typeof value.value === 'number' && Number.isFinite(value.value)
    ? value.value
    : stageConfig.defaultValue;

  return {
    id: stageId,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    value: roundByStep(clampValue(rawValue, stageConfig.min, stageConfig.max), stageConfig.step)
  };
};

export const sanitizeFilterPipeline = (value: unknown): MonitorFilterPipeline => {
  const fallback = createDefaultFilterPipeline();
  if (!isRecord(value)) {
    return fallback;
  }

  const stageById = new Map<FilterStageId, MonitorFilterStage>();
  if (Array.isArray(value.stages)) {
    value.stages.forEach((stageValue) => {
      const stageId = isRecord(stageValue) ? sanitizeStageId(stageValue.id) : null;
      if (!stageId || stageById.has(stageId)) {
        return;
      }

      stageById.set(stageId, sanitizeFilterStage(stageValue, stageId));
    });
  }

  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    stages: FILTER_STAGE_IDS.map((id) => stageById.get(id) ?? sanitizeFilterStage(null, id))
  };
};

const sanitizePresetId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizePresetName = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return trimmed.slice(0, 60);
};

const sanitizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toISOString();
};

export const sanitizeFilterPreset = (value: unknown): MonitorFilterPreset | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = sanitizePresetId(value.id);
  const name = sanitizePresetName(value.name);
  if (!id || !name) {
    return null;
  }

  const nowIso = new Date(0).toISOString();

  return {
    id,
    name,
    pipeline: sanitizeFilterPipeline(value.pipeline),
    createdAt: sanitizeIsoDate(value.createdAt) ?? nowIso,
    updatedAt: sanitizeIsoDate(value.updatedAt) ?? nowIso
  };
};

export const sanitizeFilterPresetList = (value: unknown): MonitorFilterPreset[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();
  const presets: MonitorFilterPreset[] = [];

  value.forEach((item) => {
    const preset = sanitizeFilterPreset(item);
    if (!preset || seenIds.has(preset.id)) {
      return;
    }

    seenIds.add(preset.id);
    presets.push(preset);
  });

  return presets;
};

const formatStage = (stage: MonitorFilterStage): string | null => {
  if (!stage.enabled) {
    return null;
  }

  if (stage.id === 'brightness' || stage.id === 'contrast' || stage.id === 'saturate') {
    return `${stage.id}(${stage.value})`;
  }

  if (stage.id === 'grayscale') {
    return `grayscale(${stage.value})`;
  }

  return `blur(${stage.value}px)`;
};

export const buildCssFilterFromPipeline = (pipeline: MonitorFilterPipeline): string => {
  const sanitized = sanitizeFilterPipeline(pipeline);
  if (!sanitized.enabled) {
    return 'none';
  }

  const stages = sanitized.stages
    .map(formatStage)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return stages.length > 0 ? stages.join(' ') : 'none';
};
