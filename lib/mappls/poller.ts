/**
 * lib/mappls/poller.ts
 *
 * Drop-in replacement for lib/tomtom/poller.ts.
 *
 * Runs a continuous server-side polling loop that:
 *   1. Fetches live traffic telemetry for all monitored segments via the
 *      Mappls Routing API (see flow-service.ts).
 *   2. Caches the result in two globalThis vars that the REST fallback
 *      route (/api/segments) reads when no WebSocket client is connected.
 *   3. Broadcasts a TRAFFIC_UPDATE message to all connected WebSocket clients.
 *   4. Handles new client connections by immediately replaying the last
 *      known state so clients see data instantly.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { monitoredSegments } from '../segments';
import { LiveSegmentData, TrafficIncident, TrafficTelemetryState } from './types';
import { fetchSegmentTrafficMappls } from './flow-service';

declare global {
  // eslint-disable-next-line no-var
  var __trafficLatestSegmentData: LiveSegmentData[] | undefined;
  // eslint-disable-next-line no-var
  var __trafficLatestTelemetry: TrafficTelemetryState | undefined;
}

// ─── Accessors (used by /api/segments and /api/incidents routes) ──────────────

export function getLatestSegmentData(): LiveSegmentData[] {
  return (
    globalThis.__trafficLatestTelemetry?.segments ||
    globalThis.__trafficLatestSegmentData ||
    []
  );
}

export function getLatestIncidents(): TrafficIncident[] {
  return globalThis.__trafficLatestTelemetry?.incidents || [];
}

// ─── Poll & Broadcast ─────────────────────────────────────────────────────────

/**
 * Executes one full poll cycle: fetches telemetry for every monitored segment
 * via Mappls, updates the global cache, then pushes to all WS clients.
 */
export async function pollAndBroadcast(wss: WebSocketServer): Promise<void> {
  try {
    const segmentResults = await Promise.allSettled(
      monitoredSegments.map((seg) => fetchSegmentTrafficMappls(seg))
    );

    const successfulSegments: LiveSegmentData[] = [];

    segmentResults.forEach((res, i) => {
      if (res.status === 'fulfilled') {
        successfulSegments.push(res.value);
      } else {
        console.error(
          `[Mappls Monitor] Segment "${monitoredSegments[i].name}" failed:`,
          res.reason?.message || res.reason
        );
        // Keep the last known value so the UI doesn't lose the card
        const prev = getLatestSegmentData().find(
          (s) => s.id === monitoredSegments[i].id
        );
        if (prev) successfulSegments.push(prev);
      }
    });

    // No incidents endpoint for Mappls in this integration — empty array
    const incidents: TrafficIncident[] = [];

    if (successfulSegments.length > 0) {
      const now = new Date().toISOString();

      globalThis.__trafficLatestSegmentData = successfulSegments;
      globalThis.__trafficLatestTelemetry = {
        segments: successfulSegments,
        incidents,
        lastUpdated: now,
      };

      const payload = JSON.stringify({
        type: 'TRAFFIC_UPDATE',
        timestamp: now,
        data: successfulSegments,
        incidents,
        engine: 'Mappls Routing API',
      });

      let broadcastCount = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
          broadcastCount++;
        }
      });

      console.log(
        `📡 [Mappls] Broadcasted ${successfulSegments.length} segment(s) to ${broadcastCount} client(s).`
      );
    }
  } catch (err) {
    console.error('❌ [Mappls Monitor] Polling loop error:', err);
  }
}

// ─── Start Polling Loop ───────────────────────────────────────────────────────

/**
 * Starts the continuous Mappls polling loop and registers the WebSocket
 * connection handler.
 *
 * Returns the interval ID so the caller can cancel it on shutdown.
 */
export function startMapplsPolling(wss: WebSocketServer): NodeJS.Timeout {
  const pollInterval = parseInt(
    process.env.POLL_INTERVAL_MS || '60000',
    10
  );

  // On each new client connection → immediately replay the last known state
  wss.on('connection', (ws: WebSocket) => {
    console.log(
      '🟢 [WebSocket] Client connected. Active clients:',
      wss.clients.size
    );

    const telemetry = globalThis.__trafficLatestTelemetry;
    if (telemetry && telemetry.segments.length > 0) {
      ws.send(
        JSON.stringify({
          type: 'TRAFFIC_UPDATE',
          timestamp: telemetry.lastUpdated,
          data: telemetry.segments,
          incidents: telemetry.incidents,
          engine: 'Mappls Routing API',
        })
      );
    }

    ws.on('close', () => {
      console.log(
        '🔴 [WebSocket] Client disconnected. Active clients:',
        wss.clients.size
      );
    });

    ws.on('error', (err) => {
      console.error('⚠️ [WebSocket] Client error:', err.message);
    });
  });

  // First poll immediately on startup
  pollAndBroadcast(wss).catch((err) => {
    console.error('[Mappls] Initial poll error:', err);
  });

  // Continuous background polling
  const intervalId = setInterval(() => {
    pollAndBroadcast(wss).catch((err) => {
      console.error('[Mappls] Periodic poll error:', err);
    });
  }, pollInterval);

  console.log(
    `⏱️ [Mappls Engine] Polling scheduled every ${pollInterval / 1000}s`
  );

  return intervalId;
}
