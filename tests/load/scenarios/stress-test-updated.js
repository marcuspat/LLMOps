import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics for stress testing
export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time', true);
export let throughput = new Rate('throughput');
export let breakingPoint = new Counter('breaking_point');
export let recoveryTime = new Trend('recovery_time', true);

// Stress test configuration - aggressive ramp-up to find breaking point
export let options = {
  stages: [
    // Gradual ramp-up to find breaking point
    { duration: '2m', target: 50 },   // 50 users
    { duration: '2m', target: 100 },  // 100 users
    { duration: '2m', target: 200 },  // 200 users
    { duration: '2m', target: 400 },  // 400 users
    { duration: '2m', target: 800 },  // 800 users
    { duration: '2m', target: 1000 }, // 1000 users - potential breaking point
    { duration: '5m', target: 1000 }, // Sustain at peak

    // Recovery testing
    { duration: '2m', target: 500 },  // Scale down
    { duration: '2m', target: 100 },  // Further scale down
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // More lenient for stress test
    http_req_failed: ['rate<0.20'],     // Allow up to 20% errors before breaking
    http_reqs: ['rate>5'],              // Minimum throughput
  },
  discardResponseBodies: true,
  userAgent: 'TurboFlow-StressTest/1.0',
  insecureSkipTLSVerify: true,
  noConnectionReuse: true,  // No connection reuse for stress test
  noVUConnectionReuse: true,
  timeout: '60s',  // Longer timeout for stress conditions
  batch: 50,
  batchPerHost: 10,
};

const BASE_URL = 'http://localhost:3000/api';
const THINK_TIME = 0.5; // Minimal think time for stress test

export default function () {
  // Stress test with rapid requests
  const stressWorkflows = [
    executeRapidAuthWorkflow,
    executeHeavyAnalyticsWorkflow,
    executeConcurrentSwarmCreation,
    executeBurstTaskSubmission,
    executeResourceIntensiveOperations,
  ];

  // Select workflow based on VU ID and random factor
  const workflowIndex = (__VU + Math.floor(Math.random() * 5)) % stressWorkflows.length;
  const workflow = stressWorkflows[workflowIndex];

  try {
    const startTime = Date.now();
    workflow();
    const endTime = Date.now();

    // Track response times and success
    responseTime.add(endTime - startTime);
    throughput.add(1);
    errorRate.add(0);

  } catch (error) {
    console.error(`VU ${__VU} stress error: ${error.message}`);
    errorRate.add(1);
    breakingPoint.add(1);
  }

  // Minimal sleep for stress testing
  sleep(THINK_TIME);
}

function executeRapidAuthWorkflow() {
  // Multiple rapid authentication attempts
  for (let i = 0; i < 3; i++) {
    const payload = {
      email: `stressuser${__VU}_${i}@test.com`,
      password: 'stresspassword123'
    };

    const response = http.post(`${BASE_URL}/auth/login`, JSON.stringify(payload), {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s',
    });

    check(response, {
      'rapid auth status is 200': (r) => r.status === 200,
      'rapid auth time < 1s': (r) => r.timings.duration < 1000,
    });
  }
}

function executeHeavyAnalyticsWorkflow() {
  // Request analytics multiple times to stress CPU
  const responses = http.batch([
    ['GET', `${BASE_URL}/analytics`],
    ['GET', `${BASE_URL}/metrics`],
    ['GET', `${BASE_URL}/analytics`],
  ]);

  responses.forEach((response, index) => {
    check(response, {
      [`analytics batch ${index} status is 200`]: (r) => r.status === 200,
      [`analytics batch ${index} time < 5s`]: (r) => r.timings.duration < 5000,
    });
  });
}

function executeConcurrentSwarmCreation() {
  // Create multiple swarms concurrently
  const swarmPromises = [];

  for (let i = 0; i < 5; i++) {
    const payload = {
      name: `Stress Swarm ${__VU}-${i}-${Date.now()}`,
      topology: 'MESH',
      agentCount: 20, // Larger agent count for stress
    };

    swarmPromises.push(
      http.asyncRequest('POST', `${BASE_URL}/swarms`, JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '30s',
      })
    );
  }

  // Note: k6 doesn't have native Promise.all, so we'll simulate concurrent requests
  swarmPromises.forEach((promise, index) => {
    const response = promise;
    check(response, {
      [`concurrent swarm ${index} status is 201`]: (r) => r.status === 201,
      [`concurrent swarm ${index} time < 2s`]: (r) => r.timings.duration < 2000,
    });
  });
}

function executeBurstTaskSubmission() {
  // Submit burst of tasks
  const swarmId = `stress_swarm_${__VU}`;
  const taskBatch = [];

  for (let i = 0; i < 10; i++) {
    const payload = {
      type: 'CODE_GENERATION',
      priority: 'HIGH',
      data: {
        description: `Burst task ${__VU}-${i}`,
        largePayload: 'x'.repeat(1000), // Larger payload for stress
        complexity: 10
      }
    };

    taskBatch.push([
      'POST',
      `${BASE_URL}/swarms/${swarmId}/tasks`,
      JSON.stringify(payload),
      { headers: { 'Content-Type': 'application/json' } }
    ]);
  }

  // Execute batch
  const responses = http.batch(taskBatch);

  responses.forEach((response, index) => {
    check(response, {
      [`burst task ${index} status is 201`]: (r) => r.status === 201,
      [`burst task ${index} time < 1s`]: (r) => r.timings.duration < 1000,
    });
  });
}

function executeResourceIntensiveOperations() {
  // Mix of all operations to maximize resource usage
  const operations = [
    // Authentication
    () => {
      const response = http.post(`${BASE_URL}/auth/login`,
        JSON.stringify({
          email: `resource${__VU}@test.com`,
          password: 'resourcepassword123'
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response;
    },

    // Health check (should be fast)
    () => http.get(`${BASE_URL}/health`),

    // Metrics (moderate load)
    () => http.get(`${BASE_URL}/metrics`),

    // Swarms listing
    () => http.get(`${BASE_URL}/swarms`),

    // Tasks listing
    () => http.get(`${BASE_URL}/tasks`),

    // Analytics (heavy)
    () => http.get(`${BASE_URL}/analytics`),
  ];

  // Execute operations rapidly
  operations.forEach((operation, index) => {
    try {
      const response = operation();
      check(response, {
        [`resource op ${index} completed`]: (r) => r.status < 500, // Allow server errors during stress
      });
    } catch (error) {
      // Log but don't fail during stress test
      console.log(`Resource operation ${index} failed: ${error.message}`);
    }
  });
}

export function teardown(data) {
  // Clean up and report breaking point
  if (breakingPoint.count > 0) {
    console.log(`\n🚨 Breaking point detected at ${breakingPoint.count} failures`);
  }

  const avgResponseTime = responseTime.avg;
  const errorPercentage = errorRate.rate * 100;

  console.log(`\n📊 Stress Test Summary:`);
  console.log(`   Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
  console.log(`   Error Rate: ${errorPercentage.toFixed(2)}%`);
  console.log(`   Total Requests: ${throughput.count}`);
  console.log(`   Breaking Points: ${breakingPoint.count}`);
}

export function handleSummary(data) {
  return {
    'stress-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}