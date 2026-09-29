import { NextResponse } from 'next/server';
import { getLatestIncidents } from '@/lib/mappls';

export const dynamic = 'force-dynamic';

export async function GET() {
  const incidents = getLatestIncidents();

  return NextResponse.json({
    success: true,
    count: incidents.length,
    data: incidents,
    source: 'mappls_api_incidents',
    engine: 'Mappls Routing API',
    timestamp: new Date().toISOString(),
  });
}
