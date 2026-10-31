// ==============================================================================
// NOPROXY COMPREHENSIVE AUTOMATED TEST RUNNER
// ==============================================================================

import { runAttendanceStatusTests } from './attendance_status.test';
import { runStudentEnrollmentScenariosTests } from './student_enrollment_scenarios.test';
import { runQRSecurityTests } from './qr_security.test';
import { runGeofenceTests } from './geofence.test';
import { runExcelRegisterTests } from './excel_register.test';
import { runMultiBatchEnrollmentTests } from './multi_batch_enrollment.test';
import { runAdminLocationSecurityTests } from './admin_location_security.test';
import { runEndToEndJourneysTests } from './e2e_journeys.test';
import { runAdversarialSecurityAudit } from './adversarial_security_audit.test';
import { runLoadTests } from './load_test';

async function main() {
  console.log('================================================================');
  console.log('       NOPROXY AUTOMATED VERIFICATION TEST SUITE                ');
  console.log('================================================================');

  try {
    runAttendanceStatusTests();
    runStudentEnrollmentScenariosTests();
    runQRSecurityTests();
    runGeofenceTests();
    await runExcelRegisterTests();
    runMultiBatchEnrollmentTests();
    runAdminLocationSecurityTests();
    await runEndToEndJourneysTests();
    await runAdversarialSecurityAudit();
    await runLoadTests();

    console.log('\n================================================================');
    console.log('  ALL AUTOMATED TESTS & BENCHMARKS PASSED! (10/10 TEST SUITES)  ');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n[FATAL TEST FAILURE]:', err.message);
    process.exit(1);
  }
}

main();

