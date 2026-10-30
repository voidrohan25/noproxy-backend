// ==============================================================================
// HAVERSINE GEOFENCE ENGINE
// Calculates spherical distance between device and classroom coordinates
// Transparently handles accuracy radii and boundary tolerances
// ==============================================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number; // Reported device accuracy in meters (e.g. from Geolocation API)
}

export interface GeofenceResult {
  valid: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  reportedAccuracyMeters?: number;
  reason?: string;
}

/**
 * Calculates distance in meters between two lat/lng coordinates using the Haversine formula.
 * Earth mean radius: 6371000 meters.
 */
export function calculateHaversineDistance(
  coord1: { latitude: number; longitude: number },
  coord2: { latitude: number; longitude: number }
): number {
  const R = 6371000; // Radius of Earth in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 100) / 100; // Round to 2 decimal places
}

/**
 * Verifies whether student device coordinates satisfy the classroom geofence and accuracy criteria.
 */
export function verifyClassroomGeofence(
  studentCoords: Coordinates,
  classroomCoords: { latitude: number; longitude: number },
  geofenceRadiusMeters: number,
  requiredGpsAccuracyMeters: number = 50.0
): GeofenceResult {
  // Validate coordinate values
  if (
    typeof studentCoords.latitude !== 'number' ||
    typeof studentCoords.longitude !== 'number' ||
    isNaN(studentCoords.latitude) ||
    isNaN(studentCoords.longitude)
  ) {
    return {
      valid: false,
      distanceMeters: -1,
      allowedRadiusMeters: geofenceRadiusMeters,
      reason: 'Invalid or missing GPS coordinates from student device.',
    };
  }

  // Check reported device accuracy
  if (studentCoords.accuracy && studentCoords.accuracy > requiredGpsAccuracyMeters) {
    return {
      valid: false,
      distanceMeters: -1,
      allowedRadiusMeters: geofenceRadiusMeters,
      reportedAccuracyMeters: studentCoords.accuracy,
      reason: `GPS accuracy too poor (${studentCoords.accuracy}m > required ${requiredGpsAccuracyMeters}m). Please move closer to a window or re-enable high accuracy mode.`,
    };
  }

  const distance = calculateHaversineDistance(studentCoords, classroomCoords);

  if (distance > geofenceRadiusMeters) {
    return {
      valid: false,
      distanceMeters: distance,
      allowedRadiusMeters: geofenceRadiusMeters,
      reportedAccuracyMeters: studentCoords.accuracy,
      reason: `Location outside classroom geofence (${distance}m away; maximum permitted radius is ${geofenceRadiusMeters}m).`,
    };
  }

  return {
    valid: true,
    distanceMeters: distance,
    allowedRadiusMeters: geofenceRadiusMeters,
    reportedAccuracyMeters: studentCoords.accuracy,
  };
}
