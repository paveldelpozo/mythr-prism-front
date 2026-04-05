import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_REMOTE_BACKEND_URL?.trim() || 'http://localhost:3000';

  return {
    plugins: [vue()],
    server: {
      host: true,
      allowedHosts: [
        '.trycloudflare.com',
        '.ngrok-free.app'
      ],
      proxy: {
        '/socket.io': {
          target: 'http://localhost:3000',
          ws: true
        }
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html']
      }
    }
  };
});
