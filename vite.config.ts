import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, proxy: { '/api': 'http://localhost:3000', '/admin': 'http://localhost:3000' } },
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
