import { NextResponse } from 'next/server';
import { getLatestIncidents } from '@/lib/tomtom';

export const dynamic = 'force-dynamic';

export async function GET() {
  const incidents = getLatestIncidents();

  return NextResponse.json({
    success: true,
    count: incidents.length,
    data: incidents,
    source: 'tomtom_sdk_incidents',
    engine: 'TomTom Maps & Services SDK',
    timestamp: new Date().toISOString(),
  });
}
