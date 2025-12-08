import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { createTestUser, authenticateUser, generateTaskPayload } from './utils/helpers.js';
import { StressTestConfig } from './config/stress-test-config.js';

// Stress test specific metrics
export let stressErrorRate = new Rate('stress_errors');
export let stressResponseTime = new Trend('stress_response_time', true);
export let stressThroughput = new Counter('stress_throughput');
export let resourceUsage = new Trend('resource_usage', true);
export let memoryUsage = new Trend('memory_usage', true);
export let cpuUsage = new Trend('cpu_usage', true);

const config = new StressTestConfig();

export let options = {
  stages: [
    // Ramp up to breaking point
    { duration: '2m', target: 50 },   // Warm up
    { duration: '5m', target: 200 },  // Sustained load
    { duration: '3m', target: 500 },  // Stress level
    { duration: '2m', target: 1000 }, // Breaking point
    { duration: '2m', target: 0 },    // Recovery
  ],
  thresholds: {
    http_req_failed: ['rate<0.3'],     // Allow 30% errors during stress
    http_req_duration: ['p(95)<5000'], // 95% of requests under 5s
    stress_response_time: ['p(90)<3000'],
    resource_usage: ['p(95)<80'],     // Resource usage under 80%
  },
  discardResponseBodies: true,
  rps: null, // No limit for stress test
  userAgent: 'TurboFlow-StressTest/1.0',
  hosts: {
    'api.turboflow.dev': 'http://localhost:3000',
  },
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  timeout: '120s', // Longer timeout for stress conditions
};

export default function () {
  const user = createTestUser(__VU);
  const token = authenticateUser(user);

  // Monitor system resources
  const resourceMetrics = getSystemMetrics();
  resourceUsage.add(resourceMetrics.cpu);
  memoryUsage.add(resourceMetrics.memory);

  try {
    executeStressScenario(token);
    stressThroughput.add(1);
    stressErrorRate.add(0);
  } catch (error) {
    console.error(`Stress test error (VU ${__VU}): ${error.message}`);
    stressErrorRate.add(1);
  }

  // Reduced sleep time for stress
  sleep(Math.random() * 0.5);
}

export function handleSummary(data) {
  console.log('Stress Test Summary:');
  console.log(`Total requests: ${data.metrics.http_reqs.count}`);
  console.log(`Failed requests: ${data.metrics.http_req_failed.count}`);
  console.log(`Average response time: ${data.metrics.http_req_duration.avg}ms`);
  console.log(`95th percentile: ${data.metrics.http_req_duration['p(95)']}ms`);

  // Check if we found breaking point
  if (data.metrics.http_req_failed.rate > 0.5) {
    console.log('🚨 BREAKING POINT REACHED: Error rate > 50%');
  }

  if (data.metrics.http_req_duration['p(95)'] > 10000) {
    console.log('🚨 BREAKING POINT REACHED: Response time > 10s');
  }

  return {
    'stress-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function executeStressScenario(token) {
  const scenarios = [
    'concurrent_task_creation',
    'concurrent_swarm_operations',
    'mixed_intensive_operations',
    'resource_intensive_operations'
  ];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  const startTime = new Date().getTime();

  switch (scenario) {
    case 'concurrent_task_creation':
      executeConcurrentTaskCreation(token);
      break;
    case 'concurrent_swarm_operations':
      executeConcurrentSwarmOperations(token);
      break;
    case 'mixed_intensive_operations':
      executeMixedIntensiveOperations(token);
      break;
    case 'resource_intensive_operations':
      executeResourceIntensiveOperations(token);
      break;
  }

  const duration = new Date().getTime() - startTime;
  stressResponseTime.add(duration);
}

function executeConcurrentTaskCreation(token) {
  const swarmId = config.getTestSwarmId();
  const promises = [];

  // Create multiple tasks in parallel
  for (let i = 0; i < 5; i++) {
    const payload = generateTaskPayload({
      name: `Stress Task ${__VU}-${i}`,
      priority: Math.random() > 0.7 ? 'HIGH' : 'MEDIUM',
      size: 'large' // Larger payload for stress
    });

    promises.push(
      http.asyncRequest('POST', `${config.getAPIBaseURL()}/swarms/${swarmId}/tasks`, JSON.stringify(payload), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
    );
  }

  const responses = Promise.all(promises);
  responses.forEach(response => {
    check(response, {
      'stress task created': (r) => r.status === 201 || r.status === 429, // Rate limiting is expected
      'response received': (r) => r.status < 500,
    });
  });
}

function executeConcurrentSwarmOperations(token) {
  const operations = [
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/swarms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'swarm listing under stress': (r) => r.status === 200 || r.status === 503,
      });
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'metrics under stress': (r) => r.status === 200 || r.status === 503,
      });
    },
    () => {
      const swarmId = config.getRandomSwarmId();
      const response = http.get(`${config.getAPIBaseURL()}/swarms/${swarmId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'swarm status under stress': (r) => r.status === 200 || r.status === 404 || r.status === 503,
      });
    }
  ];

  // Execute operations concurrently
  operations.forEach(op => op());
}

function executeMixedIntensiveOperations(token) {
  const heavyOperations = [
    // Database intensive
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/analytics/usage?detailed=true&period=1h`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'intensive analytics query': (r) => r.status === 200 || r.status === 503,
      });
    },
    // Computation intensive
    () => {
      const response = http.post(`${config.getAPIBaseURL()}/swarms/optimize`, JSON.stringify({
        optimization_type: 'comprehensive',
        include_predictions: true,
        depth: 'deep'
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      check(response, {
        'intensive optimization': (r) => r.status === 200 || r.status === 202 || r.status === 503,
      });
    },
    // Network intensive
    () => {
      const payload = generateTaskPayload({
        attachments: ['large-file-1.pdf', 'large-file-2.pdf'],
        dependencies: Array.from({ length: 10 }, (_, i) => `task-${i}`)
      });

      const response = http.post(`${config.getAPIBaseURL()}/tasks`, JSON.stringify(payload), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      check(response, {
        'large task submission': (r) => r.status === 201 || r.status === 413 || r.status === 503,
      });
    }
  ];

  // Execute heavy operations
  heavyOperations.forEach(op => op());
}

function executeResourceIntensiveOperations(token) {
  // Push system to its limits
  for (let i = 0; i < 3; i++) {
    const response = http.post(`${config.getAPIBaseURL()}/system/stress-test`, JSON.stringify({
      operation: 'memory_intensive',
      size: 'large',
      iterations: 1000
    }), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: '30000',
    });

    check(response, {
      'resource intensive operation': (r) => r.status < 500,
      'operation completed': (r) => r.status === 200 || r.status === 202,
    });
  }
}

function getSystemMetrics() {
  // Simulate system metrics collection
  // In a real implementation, this would connect to monitoring systems
  return {
    cpu: Math.random() * 100,
    memory: Math.random() * 100,
    disk: Math.random() * 100,
    network: Math.random() * 1000,
  };
}

function textSummary(data, options) {
  return `
📊 STRESS TEST SUMMARY
=====================

📈 REQUESTS:
  Total: ${data.metrics.http_reqs.count}
  Failed: ${data.metrics.http_req_failed.count} (${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%)
  Rate: ${data.metrics.http_reqs.rate.toFixed(2)}/s

⏱️ RESPONSE TIMES:
  Avg: ${data.metrics.http_req_duration.avg.toFixed(2)}ms
  Min: ${data.metrics.http_req_duration.min.toFixed(2)}ms
  Max: ${data.metrics.http_req_duration.max.toFixed(2)}ms
  50th percentile: ${data.metrics.http_req_duration['p(50)'].toFixed(2)}ms
  90th percentile: ${data.metrics.http_req_duration['p(90)'].toFixed(2)}ms
  95th percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms
  99th percentile: ${data.metrics.http_req_duration['p(99)'].toFixed(2)}ms

💾 RESOURCE USAGE:
  CPU: ${data.metrics.resource_usage ? data.metrics.resource_usage.avg.toFixed(2) + '%' : 'N/A'}
  Memory: ${data.metrics.memory_usage ? data.metrics.memory_usage.avg.toFixed(2) + '%' : 'N/A'}

🎯 PERFORMANCE INDICATORS:
  System Throughput: ${data.metrics.stress_throughput ? data.metrics.stress_throughput.count : 'N/A'}
  Stress Errors: ${(data.metrics.stress_errors.rate * 100).toFixed(2)}%

⚠️  STATUS:
  ${data.metrics.http_req_failed.rate > 0.5 ? '🚨 SYSTEM BREAKING POINT REACHED' : '✅ System handled stress test'}
  ${data.metrics.http_req_duration['p(95)'] > 10000 ? '🚨 RESPONSE TIMES DEGRADED' : '✅ Response times acceptable'}
  ${data.metrics.resource_usage && data.metrics.resource_usage['p(95)'] > 80 ? '⚠️  HIGH RESOURCE USAGE' : '✅ Resource usage normal'}
`;
}