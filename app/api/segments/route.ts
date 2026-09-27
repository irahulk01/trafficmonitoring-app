import { NextResponse } from 'next/server';
import { getLatestSegmentData } from '@/lib/tomtom';
import { monitoredSegments } from '@/lib/segments';
import { fetchSegmentTrafficSDK } from '@/lib/tomtom/flow-service';

export const dynamic = 'force-dynamic';

// In-memory cache for serverless environments (prevents hitting TomTom rate limits on concurrent requests)
let serverlessCache: { data: unknown[]; timestamp: number } = { data: [], timestamp: 0 };

export async function GET() {
  const latestData = getLatestSegmentData();

  if (latestData && latestData.length > 0) {
    return NextResponse.json({
      success: true,
      count: latestData.length,
      data: latestData,
      source: 'live_telemetry_cache',
      engine: 'Live Telemetry SDK',
      timestamp: new Date().toISOString(),
    });
  }

  // Serverless fallback for Vercel: serve from 10s memory cache or fetch on-demand via TomTom SDK
  const now = Date.now();
  if (serverlessCache.data.length > 0 && now - serverlessCache.timestamp < 10000) {
    return NextResponse.json({
      success: true,
      count: serverlessCache.data.length,
      data: serverlessCache.data,
      source: 'serverless_cache',
      engine: 'Live Telemetry SDK',
      timestamp: new Date(serverlessCache.timestamp).toISOString(),
    });
  }

  try {
    const results = await Promise.allSettled(
      monitoredSegments.map((segment) => fetchSegmentTrafficSDK(segment))
    );
    const liveSegments = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    if (liveSegments.length > 0) {
      serverlessCache = { data: liveSegments, timestamp: now };
      return NextResponse.json({
        success: true,
        count: liveSegments.length,
        data: liveSegments,
        source: 'serverless_live_fetch',
        engine: 'TomTom SDK On-Demand',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('[API segments] Serverless on-demand fetch failed:', err);
  }

  // Fallback before first live poll completes
  return NextResponse.json({
    success: true,
    count: monitoredSegments.length,
    data: monitoredSegments.map((s) => ({
      ...s,
      currentSpeed: 0,
      freeFlowSpeed: 0,
      severityScore: 0,
      isDeveloping: false,
      status: 'normal',
      trend: 'stable',
      segmentLengthMeters: 0,
      jamLengthMeters: 0,
      coordinates: [],
      lastUpdated: new Date().toISOString(),
    })),
    source: 'monitored_segments_initial',
    timestamp: new Date().toISOString(),
  });
}

