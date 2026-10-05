import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, proxy: { '/api': 'http://127.0.0.1:3000', '/admin': 'http://127.0.0.1:3000' } },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
