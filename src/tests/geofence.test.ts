// ==============================================================================
// TEST SUITE: CLASSROOM GPS GEOFENCE CALCULATION
// ==============================================================================

import { verifyClassroomGeofence, calculateHaversineDistance } from '../lib/geo/haversine';

export function runGeofenceTests() {
  console.log('\n--- 3. Testing Classroom GPS Geofencing (Haversine Formula) ---');

  // Classroom: Lab 402 coordinates
  const labCoords = { latitude: 19.0760, longitude: 72.8777 };
  const allowedRadiusMeters = 50.0;
  const maxAllowedAccuracy = 35.0;

  // Test 1: Student inside classroom (10 meters away)
  const studentInside = {
    latitude: 19.07605,
    longitude: 72.87775,
    accuracy: 12.0,
  };
  const resInside = verifyClassroomGeofence(studentInside, labCoords, allowedRadiusMeters, maxAllowedAccuracy);
  if (resInside.valid && resInside.distanceMeters <= allowedRadiusMeters) {
    console.log(`  [PASS] Student inside classroom verified (${resInside.distanceMeters}m <= ${allowedRadiusMeters}m).`);
  } else {
    throw new Error('Geofence test failed: Student inside classroom should be valid.');
  }

  // Test 2: Student outside classroom (e.g. 500m away in another building or at home)
  const studentOutside = {
    latitude: 19.0810,
    longitude: 72.8820,
    accuracy: 15.0,
  };
  const resOutside = verifyClassroomGeofence(studentOutside, labCoords, allowedRadiusMeters, maxAllowedAccuracy);
  if (!resOutside.valid && resOutside.reason?.includes('outside classroom geofence')) {
    console.log(`  [PASS] Student outside geofence correctly REJECTED (${resOutside.distanceMeters}m > ${allowedRadiusMeters}m).`);
  } else {
    throw new Error('Geofence test failed: Student outside should be rejected.');
  }

  // Test 3: Poor GPS Accuracy threshold check
  const studentInaccurate = {
    latitude: 19.07601,
    longitude: 72.87771,
    accuracy: 80.0, // Device reported poor accuracy of 80m
  };
  const resInaccurate = verifyClassroomGeofence(studentInaccurate, labCoords, allowedRadiusMeters, maxAllowedAccuracy);
  if (!resInaccurate.valid && resInaccurate.reason?.includes('accuracy too poor')) {
    console.log('  [PASS] Inaccurate GPS device fix was correctly REJECTED.');
  } else {
    throw new Error('Geofence test failed: Inaccurate GPS should be rejected.');
  }

  return true;
}
