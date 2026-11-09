import { readFile } from 'node:fs/promises';

// Vite only. The screenshot script draws its own PNG into a temporary file.
export default {
  name: 'r11-plan-fixture',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== '/api/v1/media/1/r11-fixture.png' || !process.env.ORTAQ_R11_PLAN_FIXTURE) return next();
      if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
      readFile(process.env.ORTAQ_R11_PLAN_FIXTURE).then(data => {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.end(data);
      }).catch(() => { res.statusCode = 404; res.end(); });
    });
  },
};
