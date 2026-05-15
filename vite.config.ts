import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_REMOTE_BACKEND_URL?.trim() || 'http://localhost:3000';

  return {
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(projectRootDirectory, 'index.html'),
          slave: path.resolve(projectRootDirectory, 'slave.html')
        }
      }
    },
    server: {
      host: true,
      allowedHosts: [
        '.trycloudflare.com',
        '.ngrok-free.app'
      ],
      proxy: {
        '/api/v1': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/realtime/v1': {
          target: proxyTarget,
          changeOrigin: true,
          ws: true
        },
        '/socket.io': {
          target: proxyTarget,
          changeOrigin: true,
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
