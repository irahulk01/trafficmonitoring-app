import { MonitoredSegment } from '../segments';
import { calculateSeverity, Coordinate } from '../detection';
import { LiveSegmentData } from './types';
import { initializeTomTomSDK, getTomTomLegacyServices } from './client';

// In-memory sliding window history of severity scores for developing trend detection
const segmentHistory: Record<string, number[]> = {};

/**
 * Fetch real-time traffic flow telemetry for a specific segment using official TomTom SDK
 */
export async function fetchSegmentTrafficSDK(segment: MonitoredSegment): Promise<LiveSegmentData> {
  const { apiKey, isConfigured } = initializeTomTomSDK();
  if (!isConfigured) {
    throw new Error('TomTom SDK is not configured: Missing TOMTOM_API_KEY');
  }

  const ttServices = getTomTomLegacyServices();

  // Call TomTom Flow Segment Data API via the official SDK
  // SDK expects point in GeoJSON order [longitude, latitude] or [lat, lon]
  const response = await ttServices.trafficFlowSegmentData({
    key: apiKey,
    point: [segment.lon, segment.lat],
    style: 'relative0',
    zoom: 18,
    unit: 'KMPH',
  });

  const flow = response.flowSegmentData;
  if (!flow) {
    throw new Error(`[TomTom SDK] No flowSegmentData returned for segment: ${segment.name}`);
  }

  // Parse coordinate geometry from SDK response (SDK returns array of { lat, lng })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawCoords: any[] = flow.coordinates?.coordinate || [];
  const coordinates: Coordinate[] = rawCoords.map((c) => ({
    latitude: typeof c.lat === 'number' ? c.lat : c.latitude,
    longitude: typeof c.lng === 'number' ? c.lng : c.longitude,
  }));

  const detection = calculateSeverity(
    segment.id,
    flow.currentSpeed,
    flow.freeFlowSpeed,
    segmentHistory,
    coordinates
  );

  return {
    ...segment,
    currentSpeed: flow.currentSpeed,
    freeFlowSpeed: flow.freeFlowSpeed,
    currentTravelTime: flow.currentTravelTime,
    freeFlowTravelTime: flow.freeFlowTravelTime,
    confidence: flow.confidence,
    roadClosure: flow.roadClosure,
    severityScore: detection.severityScore,
    isDeveloping: detection.isDeveloping,
    status: detection.status,
    trend: detection.trend,
    segmentLengthMeters: detection.segmentLengthMeters,
    jamLengthMeters: detection.jamLengthMeters,
    coordinates,
    lastUpdated: new Date().toISOString(),
  };
}
