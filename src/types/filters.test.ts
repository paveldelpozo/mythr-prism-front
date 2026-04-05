import { describe, expect, it } from 'vitest';
import {
  buildCssFilterFromPipeline,
  createDefaultFilterPipeline,
  sanitizeFilterPipeline,
  sanitizeFilterPresetList
} from './filters';

describe('types/filters', () => {
  it('sanea pipeline con clamp de valores y orden estable de etapas', () => {
    const sanitized = sanitizeFilterPipeline({
      enabled: true,
      stages: [
        { id: 'blur', enabled: true, value: 99 },
        { id: 'brightness', enabled: true, value: -2 },
        { id: 'contrast', enabled: true, value: 1.37 },
        { id: 'contrast', enabled: true, value: 2.2 }
      ]
    });

    expect(sanitized.enabled).toBe(true);
    expect(sanitized.stages.map((stage) => stage.id)).toEqual([
      'brightness',
      'contrast',
      'saturate',
      'grayscale',
      'blur'
    ]);
    expect(sanitized.stages.find((stage) => stage.id === 'brightness')?.value).toBe(0);
    expect(sanitized.stages.find((stage) => stage.id === 'contrast')?.value).toBe(1.35);
    expect(sanitized.stages.find((stage) => stage.id === 'blur')?.value).toBe(20);
  });

  it('construye CSS filter para pipeline habilitado y none cuando esta apagado', () => {
    const pipeline = createDefaultFilterPipeline();
    pipeline.enabled = true;
    pipeline.stages = [
      { id: 'brightness', enabled: true, value: 1.1 },
      { id: 'contrast', enabled: true, value: 1.2 },
      { id: 'saturate', enabled: false, value: 2 },
      { id: 'grayscale', enabled: true, value: 0.25 },
      { id: 'blur', enabled: true, value: 3 }
    ];

    expect(buildCssFilterFromPipeline(pipeline)).toBe(
      'brightness(1.1) contrast(1.2) grayscale(0.25) blur(3px)'
    );

    expect(buildCssFilterFromPipeline({ ...pipeline, enabled: false })).toBe('none');
  });

  it('descarta presets invalidos y duplicados', () => {
    const presets = sanitizeFilterPresetList([
      {
        id: 'preset-1',
        name: ' Escena principal ',
        pipeline: {
          enabled: true,
          stages: [{ id: 'brightness', enabled: true, value: 1.4 }]
        },
        createdAt: '2026-04-05T10:00:00.000Z',
        updatedAt: '2026-04-05T10:30:00.000Z'
      },
      {
        id: 'preset-1',
        name: 'Duplicado',
        pipeline: {
          enabled: true,
          stages: []
        }
      },
      {
        id: '',
        name: 'Invalido',
        pipeline: {
          enabled: true,
          stages: []
        }
      }
    ]);

    expect(presets).toHaveLength(1);
    expect(presets[0]?.id).toBe('preset-1');
    expect(presets[0]?.name).toBe('Escena principal');
    expect(presets[0]?.pipeline.enabled).toBe(true);
  });
});
