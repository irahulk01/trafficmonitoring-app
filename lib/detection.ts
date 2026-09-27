export interface DetectionResult {
  severityScore: number;
  isDeveloping: boolean;
  status: 'normal' | 'moderate' | 'heavy';
  segmentLengthMeters: number;
  jamLengthMeters: number;
  trend: 'improving' | 'worsening' | 'stable';
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculates distance in meters between two lat/lon points using the Haversine formula
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates total road length from segment geometry coordinates
 */
export function calculateSegmentLength(coordinates: Coordinate[]): number {
  if (!coordinates || coordinates.length < 2) return 0;
  let totalMeters = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalMeters += haversineDistanceMeters(
      coordinates[i].latitude,
      coordinates[i].longitude,
      coordinates[i + 1].latitude,
      coordinates[i + 1].longitude
    );
  }
  return Math.round(totalMeters);
}

/**
 * Calculates congestion severity score, developing trend detection,
 * and jam length derived from segment geometry.
 */
export function calculateSeverity(
  segmentId: string,
  currentSpeed: number,
  freeFlowSpeed: number,
  history: Record<string, number[]>,
  coordinates: Coordinate[] = []
): DetectionResult {
  // Congestion Severity Score: 1 - currentSpeed / freeFlowSpeed
  let severityScore = 0;
  if (freeFlowSpeed > 0) {
    severityScore = Math.max(0, Math.min(1, 1 - currentSpeed / freeFlowSpeed));
  }

  // History tracking for trend and "developing" detection (up to last 5 readings)
  if (!history[segmentId]) {
    history[segmentId] = [];
  }
  history[segmentId].push(severityScore);
  if (history[segmentId].length > 5) {
    history[segmentId].shift();
  }

  const recent = history[segmentId];
  let isDeveloping = false;
  let trend: 'improving' | 'worsening' | 'stable' = 'stable';

  if (recent.length >= 2) {
    const diff = recent[recent.length - 1] - recent[recent.length - 2];
    if (diff > 0.05) trend = 'worsening';
    else if (diff < -0.05) trend = 'improving';
  }

  // "Developing" flag: N consecutive rising readings with noticeable congestion
  if (recent.length >= 3) {
    const rising1 = recent[recent.length - 1] > recent[recent.length - 2];
    const rising2 = recent[recent.length - 2] > recent[recent.length - 3];
    isDeveloping = rising1 && rising2 && severityScore > 0.2;
  }

  // Qualitative status classification
  let status: 'normal' | 'moderate' | 'heavy' = 'normal';
  if (severityScore >= 0.6) {
    status = 'heavy';
  } else if (severityScore >= 0.25) {
    status = 'moderate';
  }

  // Geometry: Segment length & jam length from segment coordinates
  const segmentLengthMeters = calculateSegmentLength(coordinates);
  // Jam length: proportional to severity score along the congested segment
  const jamLengthMeters =
    severityScore > 0.15 ? Math.round(segmentLengthMeters * severityScore) : 0;

  return {
    severityScore,
    isDeveloping,
    status,
    segmentLengthMeters,
    jamLengthMeters,
    trend,
  };
}
