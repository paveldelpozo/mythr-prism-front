import { describe, expect, it } from 'vitest';
import { resolveRuntimeEntry } from './runtimeEntry';

describe('services/runtimeEntry', () => {
  it('resuelve slave para rutas de slave.html', () => {
    expect(resolveRuntimeEntry('/slave.html')).toBe('slave');
    expect(resolveRuntimeEntry('/mythr-prism/slave.html')).toBe('slave');
  });

  it('resuelve remote para ruta /remote', () => {
    expect(resolveRuntimeEntry('/remote')).toBe('remote');
  });

  it('resuelve master para cualquier otra ruta', () => {
    expect(resolveRuntimeEntry('/')).toBe('master');
    expect(resolveRuntimeEntry('/monitors')).toBe('master');
  });
});
