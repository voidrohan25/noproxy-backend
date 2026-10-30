// ==============================================================================
// TEST SUITE: ADMIN-ONLY INSTITUTE LOCATION & NETWORK CONFIGURATION SECURITY
// ==============================================================================

import { db } from '../lib/db/mock-db';

export function runAdminLocationSecurityTests() {
  console.log('\n--- 6. Testing Admin-Only Location & Network Settings Security ---');

  const institutionId = '11111111-1111-1111-1111-111111111111';
  const classroomId = '88888888-8888-8888-8888-888888888881';

  // Test 1: Administrator can access exact classroom coordinates and network CIDRs
  const adminRes = db.getClassroomAdmin(classroomId, 'ADMIN');
  if (adminRes.success && adminRes.classroom?.latitude && adminRes.classroom?.allowedNetworkCidrs) {
    console.log('  [PASS] Administrator successfully retrieved full GPS coordinates and network CIDRs.');
  } else {
    throw new Error('Admin location access failure.');
  }

  // Test 2: Trainer is strictly blocked from accessing exact coordinates
  const trainerRes = db.getClassroomAdmin(classroomId, 'TRAINER');
  if (!trainerRes.success && trainerRes.error?.toLowerCase().includes('denied')) {
    console.log('  [PASS] Trainer access to raw coordinates and CIDRs was strictly BLOCKED.');
  } else {
    throw new Error('Security failure: Trainer was allowed to view private classroom coordinates.');
  }

  // Test 3: Student is strictly blocked from accessing exact coordinates
  const studentRes = db.getClassroomAdmin(classroomId, 'STUDENT');
  if (!studentRes.success && studentRes.error?.toLowerCase().includes('denied')) {
    console.log('  [PASS] Student access to raw coordinates and CIDRs was strictly BLOCKED.');
  } else {
    throw new Error('Security failure: Student was allowed to view private classroom coordinates.');
  }

  // Test 4: Public classroom view masks/sanitizes coordinates
  const publicList = db.listClassroomsPublic(institutionId);
  const samplePublic = publicList[0];
  const hasLeakedCoordinates = 'latitude' in samplePublic || 'longitude' in samplePublic || 'allowedNetworkCidrs' in samplePublic;

  if (!hasLeakedCoordinates && samplePublic.name && samplePublic.id) {
    console.log('  [PASS] Public classroom listing safely masks coordinates and network secrets.');
  } else {
    throw new Error('Information disclosure failure: Coordinates leaked in public classroom listing.');
  }

  // Test 5: Only Admin can update classroom coordinates and geofence radius
  const trainerUpdate = db.updateClassroomSettings({
    classroomId,
    userRole: 'TRAINER',
    actorId: 'trainer-id',
    latitude: 19.1000,
    longitude: 72.9000,
    geofenceRadiusMeters: 80,
    requiredGpsAccuracyMeters: 30,
    allowedNetworkCidrs: ['10.10.0.0/16'],
    gpsVerificationEnabled: true,
    gpsMandatory: true,
    networkVerificationEnabled: false,
    networkMandatory: false,
  });

  if (!trainerUpdate.success && trainerUpdate.error?.toLowerCase().includes('violation')) {
    console.log('  [PASS] Unauthorized geofence update attempt by trainer was REJECTED.');
  } else {
    throw new Error('Security failure: Trainer was permitted to update geofence parameters.');
  }

  // Test 6: Admin successfully updates coordinates with mandatory audit reason
  const adminUpdate = db.updateClassroomSettings({
    classroomId,
    userRole: 'ADMIN',
    actorId: 'admin-id',
    latitude: 19.0762,
    longitude: 72.8779,
    geofenceRadiusMeters: 65,
    requiredGpsAccuracyMeters: 30,
    allowedNetworkCidrs: ['192.168.1.0/24', '10.0.0.0/16', '172.16.0.0/12'],
    gpsVerificationEnabled: true,
    gpsMandatory: true,
    networkVerificationEnabled: true,
    networkMandatory: false,
    reason: 'Updated lab coordinates and added guest Wi-Fi CIDR for campus testing',
  });

  if (adminUpdate.success && adminUpdate.classroom?.geofenceRadiusMeters === 65) {
    console.log('  [PASS] Administrator successfully updated classroom geofence with audit trail.');
  } else {
    throw new Error(`Admin update failure: ${adminUpdate.error}`);
  }

  return true;
}
