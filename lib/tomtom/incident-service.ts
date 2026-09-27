import { MonitoredSegment } from '../segments';
import { TomTomIncident } from './types';

/**
 * Incident service disabled — telemetry engine operates exclusively on live vector flow data.
 */
export async function fetchCorridorIncidentsSDK(
  _segments: MonitoredSegment[] = []
): Promise<TomTomIncident[]> {
  return [];
}

