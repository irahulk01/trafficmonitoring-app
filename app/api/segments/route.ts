import { NextResponse } from 'next/server';
import { getLatestSegmentData } from '@/lib/tomtom';
import { monitoredSegments } from '@/lib/segments';

export const dynamic = 'force-dynamic';

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
