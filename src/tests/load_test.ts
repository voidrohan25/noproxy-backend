// ==============================================================================
// NOPROXY PERFORMANCE, CONCURRENCY & LOAD TEST SUITE
// Simulates 10, 25, 50, and 100 concurrent virtual users across critical workflows
// ==============================================================================

import { db } from '../lib/db/mock-db';
import { generateQRChallenge } from '../lib/qr/token';
import { generateBatchAttendanceExcel } from '../lib/excel/generator';

interface LoadTestMetrics {
  scenarioName: string;
  concurrencyLevel: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  errorRate: number;
  durationMs: number;
  throughputReqSec: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export async function runLoadTests(): Promise<LoadTestMetrics[]> {
  console.log('\n================================================================');
  console.log('       NOPROXY PERFORMANCE & CONCURRENT LOAD BENCHMARK          ');
  console.log('================================================================');

  const allMetrics: LoadTestMetrics[] = [];
  const concurrencyLevels = [10, 25, 50, 100];
  const instId = '11111111-1111-1111-1111-111111111111';

  // Benchmark 1: Concurrent Student Dashboard & Batch Retrieval
  console.log('\n--- Load Scenario 1: Concurrent Student Dashboard & Batch Retrieval ---');
  for (const concurrency of concurrencyLevels) {
    const latencies: number[] = [];
    let success = 0;
    let failed = 0;

    const startTime = performance.now();

    // Create virtual users
    const promises = Array.from({ length: concurrency }).map(async (_, idx) => {
      const studentId = '44444444-4444-4444-4444-444444444441';
      const reqStart = performance.now();
      try {
        const batches = db.getStudentEnrolledBatches(studentId);
        const profile = db.profiles.get(studentId);
        const attendance = Array.from(db.attendance.values()).filter((a) => a.studentId === studentId);
        if (batches.length > 0 && profile) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      } finally {
        latencies.push(performance.now() - reqStart);
      }
    });

    await Promise.all(promises);
    const durationMs = performance.now() - startTime;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const metric: LoadTestMetrics = {
      scenarioName: 'Student Dashboard Fetch',
      concurrencyLevel: concurrency,
      totalRequests: concurrency,
      successfulRequests: success,
      failedRequests: failed,
      errorRate: (failed / concurrency) * 100,
      durationMs,
      throughputReqSec: Number(((concurrency / durationMs) * 1000).toFixed(1)),
      p50Ms: Number(p50.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      p99Ms: Number(p99.toFixed(2)),
    };

    allMetrics.push(metric);
    console.log(
      `  [${concurrency} VUs] Total: ${metric.totalRequests} reqs | Success: ${metric.successfulRequests} | p50: ${metric.p50Ms}ms | p95: ${metric.p95Ms}ms | Throughput: ${metric.throughputReqSec} req/s`
    );
  }

  // Benchmark 2: Concurrent Dynamic QR Validation & Attendance Submissions (Classroom Rush Hour)
  console.log('\n--- Load Scenario 2: Concurrent QR Attendance Submissions (Rush Hour) ---');
  for (const concurrency of concurrencyLevels) {
    const latencies: number[] = [];
    let success = 0;
    let failed = 0;

    // Create a dedicated active session for this load test
    const loadSessionId = `session-load-${concurrency}-${Date.now()}`;
    const batchId = '77777777-7777-7777-7777-777777777771';
    db.sessions.set(loadSessionId, {
      id: loadSessionId,
      institutionId: instId,
      batchId,
      subjectId: '66666666-6666-6666-6666-666666666661',
      createdBy: '33333333-3333-3333-3333-333333333331',
      title: `Load Test Session (${concurrency} VUs)`,
      sessionDate: '2026-10-30',
      startTime: '10:00:00',
      endTime: '12:00:00',
      mode: 'OFFLINE',
      sessionStatus: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create N unique enrolled students for this session
    const studentUserIds: string[] = [];
    for (let i = 0; i < concurrency; i++) {
      const vStudentId = `load-student-${concurrency}-${i}`;
      studentUserIds.push(vStudentId);
      db.profiles.set(vStudentId, {
        id: vStudentId,
        displayName: `Virtual Student ${i + 1}`,
        email: `vstudent.${concurrency}.${i}@loadtest.edu`,
        accountStatus: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      db.studentProfiles.set(vStudentId, {
        id: `sp-${vStudentId}`,
        userId: vStudentId,
        institutionId: instId,
        studentIdNumber: `VU-${concurrency}-${i}`,
        fullName: `Virtual Student ${i + 1}`,
        isVerified: true,
        verificationStatus: 'VERIFIED',
        registeredAt: new Date().toISOString(),
      });
      db.enrollStudentInBatch({
        institutionId: instId,
        studentId: vStudentId,
        batchId,
        rollNumber: `VU-${concurrency}-${i}`,
      });
    }

    const startTime = performance.now();

    // Concurrent attendance scan requests
    const promises = studentUserIds.map(async (vStudentId) => {
      const reqStart = performance.now();
      try {
        const qr = generateQRChallenge(loadSessionId, instId, 20);
        const res = db.submitOfflineAttendance({
          authenticatedUserId: vStudentId,
          sessionId: loadSessionId,
          rawToken: qr.rawToken,
          studentCoords: { latitude: 19.0760, longitude: 72.8777, accuracy: 10 },
        });

        if (res.success) {
          success++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      } finally {
        latencies.push(performance.now() - reqStart);
      }
    });

    await Promise.all(promises);
    const durationMs = performance.now() - startTime;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const metric: LoadTestMetrics = {
      scenarioName: 'QR Attendance Submission',
      concurrencyLevel: concurrency,
      totalRequests: concurrency,
      successfulRequests: success,
      failedRequests: failed,
      errorRate: (failed / concurrency) * 100,
      durationMs,
      throughputReqSec: Number(((concurrency / durationMs) * 1000).toFixed(1)),
      p50Ms: Number(p50.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      p99Ms: Number(p99.toFixed(2)),
    };

    allMetrics.push(metric);
    console.log(
      `  [${concurrency} VUs] Total: ${metric.totalRequests} reqs | Success: ${metric.successfulRequests} | p50: ${metric.p50Ms}ms | p95: ${metric.p95Ms}ms | Throughput: ${metric.throughputReqSec} req/s`
    );
  }

  // Benchmark 3: Concurrent Excel Matrix Report Generation
  console.log('\n--- Load Scenario 3: Concurrent Excel Matrix (.xlsx) Report Generation ---');
  for (const concurrency of [10, 25]) {
    const latencies: number[] = [];
    let success = 0;
    let failed = 0;

    const batchId = '77777777-7777-7777-7777-777777777771';
    const exportData = db.getBatchExportData(batchId);

    const startTime = performance.now();

    const promises = Array.from({ length: concurrency }).map(async () => {
      const reqStart = performance.now();
      try {
        if (exportData) {
          const buffer = await generateBatchAttendanceExcel(exportData);
          if (buffer && buffer.length > 1000) {
            success++;
          } else {
            failed++;
          }
        }
      } catch {
        failed++;
      } finally {
        latencies.push(performance.now() - reqStart);
      }
    });

    await Promise.all(promises);
    const durationMs = performance.now() - startTime;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

    const metric: LoadTestMetrics = {
      scenarioName: 'Excel Report Generation',
      concurrencyLevel: concurrency,
      totalRequests: concurrency,
      successfulRequests: success,
      failedRequests: failed,
      errorRate: (failed / concurrency) * 100,
      durationMs,
      throughputReqSec: Number(((concurrency / durationMs) * 1000).toFixed(1)),
      p50Ms: Number(p50.toFixed(2)),
      p95Ms: Number(p95.toFixed(2)),
      p99Ms: Number(p99.toFixed(2)),
    };

    allMetrics.push(metric);
    console.log(
      `  [${concurrency} VUs] Total: ${metric.totalRequests} reqs | Success: ${metric.successfulRequests} | p50: ${metric.p50Ms}ms | p95: ${metric.p95Ms}ms | Throughput: ${metric.throughputReqSec} req/s`
    );
  }

  console.log('\n================================================================');
  console.log('       PERFORMANCE & LOAD BENCHMARK COMPLETED SUCCESSFULLY!     ');
  console.log('================================================================\n');

  return allMetrics;
}
