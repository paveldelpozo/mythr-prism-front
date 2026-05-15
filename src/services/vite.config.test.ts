import path from 'node:path';
import viteConfigFactory from '../../vite.config';

describe('vite.config multi-page inputs', () => {
  it('incluye index.html y slave.html en el build', () => {
    const config = viteConfigFactory({
      mode: 'test',
      command: 'build',
      isSsrBuild: false,
      isPreview: false
    });

    const buildInputs = config.build?.rollupOptions?.input as Record<string, string>;

    expect(buildInputs.main).toBe(path.resolve(process.cwd(), 'index.html'));
    expect(buildInputs.slave).toBe(path.resolve(process.cwd(), 'slave.html'));
  });
});
