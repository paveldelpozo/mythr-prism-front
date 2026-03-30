import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MIRROR_MODE_CONFIG,
  sanitizeMirrorModeConfig
} from './mirrorMode';

describe('types/mirrorMode', () => {
  it('aplica fallback seguro para configuracion invalida', () => {
    expect(sanitizeMirrorModeConfig(null)).toEqual(DEFAULT_MIRROR_MODE_CONFIG);
  });

  it('previene ciclos removiendo origen de destinos y deduplica ids', () => {
    const sanitized = sanitizeMirrorModeConfig({
      enabled: true,
      sourceMonitorId: 'm1',
      targetMonitorIds: ['m1', 'm2', 'm2', '   ', 'm3']
    });

    expect(sanitized.sourceMonitorId).toBe('m1');
    expect(sanitized.targetMonitorIds).toEqual(['m2', 'm3']);
  });

  it('filtra ids fuera del set conocido cuando se provee', () => {
    const sanitized = sanitizeMirrorModeConfig(
      {
        enabled: true,
        sourceMonitorId: 'm9',
        targetMonitorIds: ['m1', 'm2', 'm3']
      },
      {
        knownMonitorIds: new Set(['m1', 'm2'])
      }
    );

    expect(sanitized.sourceMonitorId).toBeNull();
    expect(sanitized.targetMonitorIds).toEqual(['m1', 'm2']);
  });
});
