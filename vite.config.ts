import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'separate-admin-project',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        if (/^\/(?:admin(?:\/|$)|api\/admin(?:\/|$)|admin-management-ui\.js$)/.test(path)) {
          res.statusCode = 404;
          res.end('El administrador se abre en http://localhost:3000/');
          return;
        }
        next();
      });
    },
  }],
  server: { host: true, port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
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
