import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics for our application
export let errorRate = new Rate('errors');
export let authTime = new Trend('auth_duration', true);
export let swarmCreationTime = new Trend('swarm_creation_duration', true);
export let taskCreationTime = new Trend('task_creation_duration', true);
export let metricsTime = new Trend('metrics_duration', true);
export let analyticsTime = new Trend('analytics_duration', true);
export let activeUsers = new Rate('active_users');
export let systemThroughput = new Counter('system_throughput');

// Test configuration
export let options = {
  stages: [
    // Warm-up phase
    { duration: '2m', target: 10 },   // 10 users for 2 minutes
    { duration: '3m', target: 25 },   // Ramp up to 25 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users

    // Sustained load phase
    { duration: '10m', target: 50 },  // Sustained 50 users

    // Peak load phase
    { duration: '3m', target: 75 },   // Peak 75 users
    { duration: '5m', target: 100 },  // Peak 100 users

    // Cool-down phase
    { duration: '2m', target: 50 },   // Scale down
    { duration: '2m', target: 0 },    // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],     // Error rate under 5%
    http_reqs: ['rate>10'],             // Minimum 10 requests per second
    auth_duration: ['p(90)<500'],       // Auth under 500ms (90th percentile)
    swarm_creation_duration: ['p(90)<800'], // Swarm creation under 800ms (90th percentile)
    task_creation_duration: ['p(90)<600'], // Task creation under 600ms (90th percentile)
    metrics_duration: ['p(90)<200'],   // Metrics under 200ms (90th percentile)
    analytics_duration: ['p(90)<3000'], // Analytics under 3s (90th percentile)
  },
  discardResponseBodies: true,
  userAgent: 'TurboFlow-LoadTest/1.0',
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  noVUConnectionReuse: false,
  timeout: '30s',
  batch: 20,
  batchPerHost: 6,
};

const BASE_URL = 'http://localhost:3000/api';
const THINK_TIME = 1; // seconds

export default function () {
  // Track active user
  activeUsers.add(1);

  // Simulate typical user workflow
  const workflows = [
    executeAuthWorkflow,
    executeSwarmCreationWorkflow,
    executeTaskSubmissionWorkflow,
    executeMetricsWorkflow,
    executeAnalyticsWorkflow,
    executeMixedOperationsWorkflow
  ];

  const workflow = workflows[__VU % workflows.length];

  try {
    workflow();
    errorRate.add(0);
    systemThroughput.add(1);

  } catch (error) {
    console.error(`VU ${__VU} error: ${error.message}`);
    errorRate.add(1);
  }

  sleep(THINK_TIME + Math.random() * 2); // Random think time 1-3 seconds
}

function executeAuthWorkflow() {
  const payload = {
    email: `user${__VU}@test.com`,
    password: 'testpassword123'
  };

  const response = http.post(`${BASE_URL}/auth/login`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(response, {
    'auth status is 200': (r) => r.status === 200,
    'auth time < 500ms': (r) => r.timings.duration < 500,
    'auth response has token': (r) => r.json('token') !== undefined,
  });

  authTime.add(response.timings.duration);
}

function executeSwarmCreationWorkflow() {
  const payload = {
    name: `Load Test Swarm ${__VU}-${Date.now()}`,
    topology: ['MESH', 'HIERARCHICAL', 'RING'][__VU % 3],
    agentCount: (__VU % 10) + 1,
  };

  const response = http.post(`${BASE_URL}/swarms`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(response, {
    'swarm creation status is 201': (r) => r.status === 201,
    'swarm creation time < 800ms': (r) => r.timings.duration < 800,
    'swarm response is valid': (r) => r.json('id') !== undefined,
  });

  swarmCreationTime.add(response.timings.duration);
}

function executeTaskSubmissionWorkflow() {
  const swarmId = `swarm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const payload = {
    type: ['CODE_GENERATION', 'TESTING', 'DOCUMENTATION'][__VU % 3],
    priority: ['LOW', 'MEDIUM', 'HIGH'][__VU % 3],
    data: {
      description: `Load test task from VU ${__VU}`,
      complexity: Math.floor(Math.random() * 10) + 1
    }
  };

  const response = http.post(`${BASE_URL}/swarms/${swarmId}/tasks`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(response, {
    'task submission status is 201': (r) => r.status === 201,
    'task submission time < 600ms': (r) => r.timings.duration < 600,
    'task response is valid': (r) => r.json('id') !== undefined,
  });

  taskCreationTime.add(response.timings.duration);
}

function executeMetricsWorkflow() {
  const response = http.get(`${BASE_URL}/metrics`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  check(response, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics time < 200ms': (r) => r.timings.duration < 200,
    'metrics response is valid': (r) => r.json('requests') !== undefined,
  });

  metricsTime.add(response.timings.duration);
}

function executeAnalyticsWorkflow() {
  const response = http.get(`${BASE_URL}/analytics`, {
    headers: {
      'Accept': 'application/json',
    },
  });

  check(response, {
    'analytics status is 200': (r) => r.status === 200,
    'analytics time < 3s': (r) => r.timings.duration < 3000,
    'analytics response is valid': (r) => r.json('analytics') !== undefined,
  });

  analyticsTime.add(response.timings.duration);
}

function executeMixedOperationsWorkflow() {
  // Mix of different operations
  const operations = [
    () => http.get(`${BASE_URL}/health`),
    () => http.get(`${BASE_URL}/swarms`),
    () => http.get(`${BASE_URL}/tasks`),
    () => executeAuthWorkflow(),
  ];

  // Randomly select operation
  const randomOp = operations[Math.floor(Math.random() * operations.length)];
  randomOp();
}

export function handleSummary(data) {
  return {
    'basic-load-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}