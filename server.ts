import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { startTomTomPolling } from './lib/tomtom';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request:', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Attach WebSocket server using noServer: true to prevent intercepting Next.js HMR
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url || '', true);

    // Only handle traffic telemetry WebSocket connections, allowing Next.js HMR to handle /_next/
    if (pathname === '/ws' || pathname === '/api/ws' || pathname === '/') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  // Initialize continuous server-side TomTom polling
  startTomTomPolling(wss);

  server.listen(port, () => {
    console.log(`🚀 [TrafficApp] Server running on http://${hostname}:${port}`);
    console.log(`🔌 [TrafficApp] WebSocket endpoint ready at ws://${hostname}:${port}/ws`);
    console.log(`🛰️ [TrafficApp] Persistent TomTom polling active`);
  });
});
