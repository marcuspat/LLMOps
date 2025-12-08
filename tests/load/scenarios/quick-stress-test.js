import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import http from 'k6/http';

// Custom metrics
export let errorRate = new Rate('errors');
export let responseTime = new Trend('response_time', true);

// Quick stress test - 5 minutes total
export let options = {
  stages: [
    { duration: '1m', target: 50 },   // Ramp up to 50 users
    { duration: '2m', target: 100 },  // Peak 100 users
    { duration: '1m', target: 200 },  // Push to 200 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // More lenient
    http_req_failed: ['rate<0.10'],     // Allow 10% errors
  },
  discardResponseBodies: true,
  userAgent: 'TurboFlow-QuickStress/1.0',
  timeout: '30s',
};

const BASE_URL = 'http://localhost:3000/api';

export default function () {
  // Test different endpoints
  const endpoints = [
    () => http.get(`${BASE_URL}/health`),
    () => http.get(`${BASE_URL}/metrics`),
    () => http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: `stress${__VU}@test.com`,
      password: 'test123'
    }), { headers: { 'Content-Type': 'application/json' } }),
    () => http.get(`${BASE_URL}/swarms`),
    () => http.get(`${BASE_URL}/tasks`),
  ];

  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  try {
    const startTime = Date.now();
    const response = randomEndpoint();
    const endTime = Date.now();

    check(response, {
      'status is < 500': (r) => r.status < 500,
      'response time < 5s': (r) => r.timings.duration < 5000,
    });

    responseTime.add(endTime - startTime);
    errorRate.add(0);

  } catch (error) {
    console.error(`VU ${__VU} error: ${error.message}`);
    errorRate.add(1);
  }

  sleep(0.5 + Math.random()); // Short sleep
}

export function handleSummary(data) {
  return {
    'quick-stress-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}