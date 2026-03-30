import { describe, expect, it, vi } from 'vitest';
import { cloneSerializable } from './cloneSerializable';

describe('utils/cloneSerializable', () => {
  it('clona objetos serializables sin compartir referencia', () => {
    const source = {
      id: 'session-1',
      nested: {
        enabled: true,
        values: [1, 2, 3]
      }
    };

    const clone = cloneSerializable(source);
    clone.nested.values.push(4);

    expect(clone).not.toBe(source);
    expect(source.nested.values).toEqual([1, 2, 3]);
  });

  it('usa fallback cuando structuredClone falla por datos no clonables', () => {
    const originalStructuredClone = globalThis.structuredClone;
    const failingStructuredClone = vi.fn(() => {
      throw new DOMException('cannot clone', 'DataCloneError');
    });

    Object.defineProperty(globalThis, 'structuredClone', {
      configurable: true,
      writable: true,
      value: failingStructuredClone
    });

    try {
      const cyclical: Record<string, unknown> = {
        name: 'unsafe',
        fn: () => null,
        map: new Map<string, string>(),
        keep: {
          a: 1
        }
      };
      cyclical.self = cyclical;

      const clone = cloneSerializable(cyclical) as Record<string, unknown>;

      expect(clone.name).toBe('unsafe');
      expect(clone.fn).toBeUndefined();
      expect(clone.map).toBeUndefined();
      expect(clone.keep).toEqual({ a: 1 });
      expect(clone.self).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis, 'structuredClone', {
        configurable: true,
        writable: true,
        value: originalStructuredClone
      });
    }
  });
});
