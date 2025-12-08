import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { createTestUser, authenticateUser, generateTaskPayload, createTestSwarm } from './utils/helpers.js';
import { LoadTestConfig } from './config/load-test-config.js';

// Custom metrics for our application
export let errorRate = new Rate('errors');
export let taskCreationTime = new Trend('task_creation_duration', true);
export let swarmCreationTime = new Trend('swarm_creation_duration', true);
export let apiResponseTime = new Trend('api_response_duration', true);
export let activeUsers = new Rate('active_users');
export let systemThroughput = new Counter('system_throughput');

// Test configuration
const config = new LoadTestConfig();

export let options = {
  stages: config.getStages(),
  thresholds: config.getThresholds(),
  discardResponseBodies: true,
  rps: config.getRPSLimit(),
  userAgent: 'TurboFlow-LoadTest/1.0',
  cookies: {},
  hosts: {
    'api.turboflow.dev': 'http://localhost:3000',
  },
  insecureSkipTLSVerify: true,
  noConnectionReuse: false,
  noVUConnectionReuse: false,
  tlsAuth: [],
  tlsCipherSuites: null,
  tlsVersion: {
    min: 'tls1.2',
    max: 'tls1.3',
  },
  dns: {
    ttl: '1m',
    select: 'first',
    policy: 'preferIPv4',
  },
  blacklistIPs: [],
  timeout: '60s',
  localIPs: null,
  batch: 20,
  batchPerHost: 6,
};

export default function () {
  const user = createTestUser(__VU);
  const token = authenticateUser(user);

  // Track active user
  activeUsers.add(1);

  // Simulate typical user workflow
  const workflow = config.selectWorkflow(__VU);

  try {
    switch (workflow) {
      case 'swarm_creation':
        executeSwarmCreationWorkflow(token);
        break;
      case 'task_submission':
        executeTaskSubmissionWorkflow(token);
        break;
      case 'mixed_operations':
        executeMixedOperationsWorkflow(token);
        break;
      default:
        executeTaskSubmissionWorkflow(token);
    }

    errorRate.add(0);
    systemThroughput.add(1);

  } catch (error) {
    console.error(`VU ${__VU} error: ${error.message}`);
    errorRate.add(1);
  }

  sleep(config.getThinkTime());
}

export function teardown(data) {
  // Clean up any test data
  console.log('Load test completed');
}

function executeSwarmCreationWorkflow(token) {
  const startTime = new Date().getTime();

  const response = createTestSwarm(token);

  check(response, {
    'swarm creation status is 201': (r) => r.status === 201,
    'swarm creation time < 2s': (r) => r.timings.duration < 2000,
    'swarm response is valid': (r) => r.json('id') !== undefined,
  });

  swarmCreationTime.add(response.timings.duration);
  apiResponseTime.add(response.timings.duration);
}

function executeTaskSubmissionWorkflow(token) {
  const swarmId = config.getTestSwarmId();
  const payload = generateTaskPayload();

  const startTime = new Date().getTime();

  const response = http.post(
    `${config.getAPIBaseURL()}/swarms/${swarmId}/tasks`,
    JSON.stringify(payload),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  check(response, {
    'task submission status is 201': (r) => r.status === 201,
    'task submission time < 1s': (r) => r.timings.duration < 1000,
    'task response is valid': (r) => r.json('id') !== undefined,
  });

  taskCreationTime.add(response.timings.duration);
  apiResponseTime.add(response.timings.duration);
}

function executeMixedOperationsWorkflow(token) {
  // Mix of different operations
  const operations = [
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/swarms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'swarm listing status is 200': (r) => r.status === 200,
        'swarm listing time < 500ms': (r) => r.timings.duration < 500,
      });

      apiResponseTime.add(response.timings.duration);
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'metrics status is 200': (r) => r.status === 200,
        'metrics time < 300ms': (r) => r.timings.duration < 300,
      });

      apiResponseTime.add(response.timings.duration);
    },
    () => executeTaskSubmissionWorkflow(token),
  ];

  // Randomly select operation
  const randomOp = operations[Math.floor(Math.random() * operations.length)];
  randomOp();
}