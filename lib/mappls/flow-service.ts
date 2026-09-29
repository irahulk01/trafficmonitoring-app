/**
 * lib/mappls/flow-service.ts
 *
 * Fetches live traffic telemetry for a monitored segment using the
 * Mappls Routing API (traffic-aware routing between two adjacent points
 * derived from the segment's own coordinates).
 *
 * ── Strategy ──────────────────────────────────────────────────────────────────
 *
 * Mappls does NOT expose a TomTom-style "Flow Segment Data" endpoint that
 * returns raw currentSpeed / freeFlowSpeed for a lat/lon point.  Instead we
 * derive equivalent metrics by calling the Routing API *twice* for each
 * monitored chowk:
 *
 *   1. A short self-to-nearby-fixed-point route WITH traffic  → currentDuration
 *   2. A same route WITHOUT traffic (optimistic)              → freeFlowDuration
 *
 * Because Mappls traffic-aware routing uses real-time traffic internally,
 * the ratio  currentDuration / freeFlowDuration  is equivalent to the
 * congestion index TomTom's flowSegmentData.currentSpeed / freeFlowSpeed.
 *
 * We then back-calculate pseudo speeds from the known segment distances so
 * the rest of the app (detection.ts, the dashboard cards, the map markers)
 * continues to work without any changes.
 *
 * ── Endpoint (Mappls Routing API v1) ──────────────────────────────────────────
 * GET https://apis.mappls.com/advancedmaps/v1/{rest_api_key}/route_adv/{profile}/{coordinates}
 *
 * Where:
 *   profile     = driving
 *   coordinates = lon1,lat1;lon2,lat2   (origin;destination)
 *
 * Query params:
 *   alternatives = false
 *   steps        = false
 *   overview     = false
 *
 * The Access Token is passed as Bearer in the Authorization header.
 */

import { MonitoredSegment } from '../segments';
import { calculateSeverity, Coordinate } from '../detection';
import { LiveSegmentData, MapplsRoutingResponse } from './types';
import { getAccessToken, getMapplsCredentials } from './auth';

// ─── In-memory sliding window for trend / developing detection ────────────────
const segmentHistory: Record<string, number[]> = {};

// ─── Routing API base URL ─────────────────────────────────────────────────────
const ROUTING_BASE = 'https://apis.mappls.com/advancedmaps/v1';

/**
 * For each monitored chowk we create a short "probe route" to a fixed
 * reference point ~500 m away (bearing: northeast) so the route is always
 * traversing a meaningful road segment rather than resolving to a single node.
 */
function probeDestination(lat: number, lon: number): { lat: number; lon: number } {
  // ~500 m northeast offset
  const deltaLat = 0.0045;
  const deltaLon = 0.0045;
  return { lat: lat + deltaLat, lon: lon + deltaLon };
}

/**
 * Calls the Mappls Routing API for a pair of coordinates.
 * Returns null if the request fails (caller handles gracefully).
 */
async function fetchRoute(
  restApiKey: string,
  token: string,
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  withTraffic: boolean
): Promise<MapplsRoutingResponse | null> {
  // Mappls routing: coordinates are lon,lat pairs separated by ;
  const coords = `${originLon},${originLat};${destLon},${destLat}`;
  const profile = 'driving';

  // traffic=1 enables real-time traffic-aware routing
  const trafficParam = withTraffic ? '&traffic=1' : '';

  const url =
    `${ROUTING_BASE}/${restApiKey}/route_adv/${profile}/${coords}` +
    `?alternatives=false&steps=false&overview=false${trafficParam}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `[Mappls Flow] Routing API returned ${res.status} for ${url}: ${body}`
    );
    return null;
  }

  return res.json() as Promise<MapplsRoutingResponse>;
}

/**
 * Computes pseudo speeds from durations and a fixed probe distance.
 * We use a fixed probe distance of ~500 m (0.5 km).
 * Speed = distance / time → m/s → multiply by 3.6 → km/h
 */
function durationToSpeed(durationSec: number, distanceMeters = 500): number {
  if (durationSec <= 0) return 0;
  const speedMs = distanceMeters / durationSec;
  return Math.round(speedMs * 3.6); // m/s → km/h
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Fetches real-time traffic telemetry for a specific monitored segment
 * using the Mappls Routing API and derives congestion metrics equivalent
 * to TomTom's flowSegmentData.
 */
export async function fetchSegmentTrafficMappls(
  segment: MonitoredSegment
): Promise<LiveSegmentData> {
  const { restApiKey, isConfigured } = getMapplsCredentials();
  if (!isConfigured) {
    throw new Error(
      '[Mappls Flow] MAPPLS_REST_API_KEY / MAPPLS_CLIENT_ID / MAPPLS_CLIENT_SECRET not configured'
    );
  }

  const token = await getAccessToken();
  const dest = probeDestination(segment.lat, segment.lon);

  // Fetch both routes in parallel to minimize wall-clock latency
  const [trafficRes, freeFlowRes] = await Promise.all([
    fetchRoute(restApiKey, token, segment.lat, segment.lon, dest.lat, dest.lon, true),
    fetchRoute(restApiKey, token, segment.lat, segment.lon, dest.lat, dest.lon, false),
  ]);

  // Validate responses
  if (!trafficRes || trafficRes.code !== 'Ok' || !trafficRes.routes?.length) {
    throw new Error(
      `[Mappls Flow] Traffic route failed for segment "${segment.name}": ` +
        (trafficRes ? `code=${trafficRes.code}` : 'null response')
    );
  }

  const trafficRoute = trafficRes.routes[0];
  const freeFlowRoute = freeFlowRes?.code === 'Ok' && freeFlowRes.routes?.length
    ? freeFlowRes.routes[0]
    : null;

  const currentDurationSec = trafficRoute.duration;
  const freeFlowDurationSec = freeFlowRoute
    ? Math.min(freeFlowRoute.duration, currentDurationSec) // free-flow ≤ live
    : currentDurationSec * 0.65; // conservative fallback if second call fails

  const probeDistanceM = trafficRoute.distance || 500;

  const currentSpeed = durationToSpeed(currentDurationSec, probeDistanceM);
  const freeFlowSpeed = durationToSpeed(freeFlowDurationSec, probeDistanceM);

  // ── Derive geometry: straight-line coordinate array for the probe segment ───
  const coordinates: Coordinate[] = [
    { latitude: segment.lat, longitude: segment.lon },
    { latitude: dest.lat, longitude: dest.lon },
  ];

  // ── Severity / trend detection (identical logic as TomTom path) ─────────────
  const detection = calculateSeverity(
    segment.id,
    currentSpeed,
    freeFlowSpeed,
    segmentHistory,
    coordinates
  );

  // Confidence: degrade if free-flow route failed
  const confidence = freeFlowRoute ? 0.9 : 0.6;

  // Road closure: Mappls indicates this as infinite (or very large) duration
  const roadClosure =
    currentDurationSec > 86_400 || // 24h+ travel → effectively closed
    (freeFlowDurationSec > 0 && currentDurationSec / freeFlowDurationSec > 10);

  return {
    // Spread base segment fields (id, name, lat, lon, description)
    ...segment,

    currentSpeed,
    freeFlowSpeed,
    currentTravelTime: Math.round(currentDurationSec),
    freeFlowTravelTime: Math.round(freeFlowDurationSec),
    confidence,
    roadClosure,

    severityScore: detection.severityScore,
    isDeveloping: detection.isDeveloping,
    status: detection.status,
    trend: detection.trend,
    segmentLengthMeters: Math.round(probeDistanceM),
    jamLengthMeters: detection.jamLengthMeters,
    coordinates,
    lastUpdated: new Date().toISOString(),
  };
}
