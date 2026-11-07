import express from 'express';
import path from 'path';
import app from './src/server/app.ts';

/**
 * Long-running server for local development and `npm start`. On Vercel the same Express app runs as
 * a function (src/server/vercelHandler.ts) and the CDN serves the client files.
 */
const PORT = Number(process.env.PORT) || 3000;

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CircuitCraft 3D Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
