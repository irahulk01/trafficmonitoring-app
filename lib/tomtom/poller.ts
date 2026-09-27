import { WebSocket, WebSocketServer } from 'ws';
import { monitoredSegments } from '../segments';
import { LiveSegmentData, TomTomIncident, TrafficTelemetryState } from './types';
import { fetchSegmentTrafficSDK } from './flow-service';

declare global {
  // eslint-disable-next-line no-var
  var __trafficLatestSegmentData: LiveSegmentData[] | undefined;
  // eslint-disable-next-line no-var
  var __trafficLatestTelemetry: TrafficTelemetryState | undefined;
}

export function getLatestSegmentData(): LiveSegmentData[] {
  return globalThis.__trafficLatestTelemetry?.segments || globalThis.__trafficLatestSegmentData || [];
}

export function getLatestIncidents(): TomTomIncident[] {
  return globalThis.__trafficLatestTelemetry?.incidents || [];
}

/**
 * Execute a synchronized poll cycle across all segments and corridors via official TomTom SDKs
 */
export async function pollAndBroadcast(wss: WebSocketServer): Promise<void> {
  try {
    // 1. Fetch Segment Flow Telemetry via SDK
    const segmentResults = await Promise.allSettled(
      monitoredSegments.map((segment) => fetchSegmentTrafficSDK(segment))
    );

    const successfulSegments: LiveSegmentData[] = [];

    segmentResults.forEach((res, index) => {
      if (res.status === 'fulfilled') {
        successfulSegments.push(res.value);
      } else {
        console.error(
          `[TomTom SDK Monitor] Segment "${monitoredSegments[index].name}" failed:`,
          res.reason?.message || res.reason
        );
        const existing = getLatestSegmentData().find((s) => s.id === monitoredSegments[index].id);
        if (existing) {
          successfulSegments.push(existing);
        }
      }
    });

    // Incidents fetching disabled (not configured/needed)
    const incidents: TomTomIncident[] = [];

    if (successfulSegments.length > 0) {
      const now = new Date().toISOString();

      // Update global telemetry cache
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
        engine: 'Live Telemetry SDK',
      });

      let broadcastCount = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
          broadcastCount++;
        }
      });

      console.log(
        `📡 [TomTom SDK] Broadcasted ${successfulSegments.length} segment(s) and ${incidents.length} incident(s) to ${broadcastCount} client(s).`
      );
    }
  } catch (err) {
    console.error('❌ [TomTom SDK Monitor] Polling loop error:', err);
  }
}

/**
 * Start the continuous server-side polling loop and client connection handler
 */
export function startTomTomPolling(wss: WebSocketServer): NodeJS.Timeout {
  const pollInterval = parseInt(process.env.POLL_INTERVAL_MS || '60000', 10);

  // Send latest cached state immediately when any client connects
  wss.on('connection', (ws: WebSocket) => {
    console.log('🟢 [WebSocket] Client connected. Active clients:', wss.clients.size);
    const telemetry = globalThis.__trafficLatestTelemetry;
    if (telemetry && telemetry.segments.length > 0) {
      ws.send(
        JSON.stringify({
          type: 'TRAFFIC_UPDATE',
          timestamp: telemetry.lastUpdated,
          data: telemetry.segments,
          incidents: telemetry.incidents,
          engine: 'Live Telemetry SDK',
        })
      );
    }

    ws.on('close', () => {
      console.log('🔴 [WebSocket] Client disconnected. Active clients:', wss.clients.size);
    });

    ws.on('error', (err) => {
      console.error('⚠️ [WebSocket] Client error:', err.message);
    });
  });

  // Execute first poll immediately on server start
  pollAndBroadcast(wss).catch((err) => {
    console.error('Initial TomTom SDK poll error:', err);
  });

  // Schedule continuous background polling
  const intervalId = setInterval(() => {
    pollAndBroadcast(wss).catch((err) => {
      console.error('Periodic TomTom SDK poll error:', err);
    });
  }, pollInterval);

  console.log(`⏱️ [TomTom SDK Engine] Polling scheduled every ${pollInterval / 1000}s`);
  return intervalId;
}
