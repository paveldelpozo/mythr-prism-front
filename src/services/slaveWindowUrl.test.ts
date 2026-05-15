import { describe, expect, it } from 'vitest';
import { buildSlaveWindowUrl, resolveSlaveWindowPath, SLAVE_WINDOW_PATH } from './slaveWindowUrl';

describe('services/slaveWindowUrl', () => {
  it('construye URL same-origin con monitorId e instanceToken', () => {
    const url = buildSlaveWindowUrl({
      monitorId: 'monitor-1',
      instanceToken: 'token-1'
    });

    expect(url.startsWith(`${SLAVE_WINDOW_PATH}?`)).toBe(true);
    expect(url).toContain('monitorId=monitor-1');
    expect(url).toContain('instanceToken=token-1');
    expect(url.startsWith('blob:')).toBe(false);
  });

  it('respeta BASE_URL para evitar abrir index principal en subpath', () => {
    expect(resolveSlaveWindowPath('/mythr-prism/')).toBe('/mythr-prism/slave.html');
    expect(resolveSlaveWindowPath('/mythr-prism')).toBe('/mythr-prism/slave.html');
    expect(resolveSlaveWindowPath('mythr-prism/')).toBe('/mythr-prism/slave.html');
  });
});
