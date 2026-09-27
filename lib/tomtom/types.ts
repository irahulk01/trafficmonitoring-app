import { Coordinate } from '../detection';
import { MonitoredSegment } from '../segments';

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

export interface TomTomIncident {
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

export interface TrafficTelemetryState {
  segments: LiveSegmentData[];
  incidents: TomTomIncident[];
  lastUpdated: string;
}
