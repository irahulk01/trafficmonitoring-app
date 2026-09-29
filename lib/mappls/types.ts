import { Coordinate } from '../detection';
import { MonitoredSegment } from '../segments';

// ─── Core segment telemetry (API-agnostic, consumed by the entire app) ────────

export interface LiveSegmentData extends MonitoredSegment {
  currentSpeed: number;
  freeFlowSpeed: number;
  currentTravelTime?: number;
  freeFlowTravelTime?: number;
  confidence: number;
  roadClosure?: boolean;
  severityScore: number;
  isDeveloping: boolean;
  status: 'normal' | 'moderate' | 'heavy';
  trend: 'improving' | 'worsening' | 'stable';
  segmentLengthMeters: number;
  jamLengthMeters: number;
  coordinates: Coordinate[];
  lastUpdated: string;
}

// ─── Incident shape (provider-neutral rename of TomTomIncident) ───────────────

export interface TrafficIncident {
  id: string;
  category: string;
  magnitudeOfDelay: 'unknown' | 'minor' | 'moderate' | 'major' | 'indefinite';
  description: string;
  from?: string;
  to?: string;
  delaySeconds: number;
  lengthMeters: number;
  roadNumbers?: string[];
  coordinates: [number, number][]; // [lon, lat] pairs
  startTime?: string;
  endTime?: string;
}

// Keep TomTomIncident as an alias so existing imports continue to compile
// without requiring a global find-replace.
export type TomTomIncident = TrafficIncident;

// ─── Telemetry state ──────────────────────────────────────────────────────────

export interface TrafficTelemetryState {
  segments: LiveSegmentData[];
  incidents: TrafficIncident[];
  lastUpdated: string;
}

// ─── Mappls Routing API – raw response shapes ─────────────────────────────────

export interface MapplsRouteLeg {
  distance: number;   // metres
  duration: number;   // seconds (traffic-aware)
  steps?: unknown[];
}

export interface MapplsRoute {
  distance: number;
  duration: number;
  legs: MapplsRouteLeg[];
  geometry?: unknown;
}

export interface MapplsRoutingResponse {
  code: string;        // "Ok" on success
  routes: MapplsRoute[];
  waypoints?: unknown[];
}

// ─── Mappls OAuth token response ──────────────────────────────────────────────

export interface MapplsTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}
