import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { createTestUser, authenticateUser, generateTaskPayload } from './utils/helpers.js';

// Spike test specific metrics
export let spikeErrorRate = new Rate('spike_errors');
export let spikeResponseTime = new Trend('spike_response_time', true);
export let spikeThroughput = new Counter('spike_throughput');
export let recoveryTime = new Trend('recovery_time', true);

// Load test config for spike testing
import { LoadTestConfig } from '../config/load-test-config.js';

const config = new LoadTestConfig();

export let options = {
  stages: [
    // Baseline
    { duration: '2m', target: 10 },   // Baseline: 10 users
    { duration: '1m', target: 10 },   // Stable baseline

    // First spike
    { duration: '10s', target: 200 },  // Spike to 200 users
    { duration: '30s', target: 200 },  // Hold spike
    { duration: '10s', target: 10 },   // Back to baseline

    // Recovery period
    { duration: '2m', target: 10 },   // Recovery monitoring

    // Second spike (higher)
    { duration: '10s', target: 500 },  // Higher spike
    { duration: '20s', target: 500 },  // Hold higher spike
    { duration: '10s', target: 10 },   // Back to baseline

    // Extended recovery
    { duration: '3m', target: 10 },   // Extended recovery

    // Maximum spike
    { duration: '10s', target: 1000 }, // Maximum spike
    { duration: '30s', target: 1000 }, // Hold maximum
    { duration: '10s', target: 10 },   // Back to baseline

    // Final recovery
    { duration: '2m', target: 10 },   // Final recovery
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    // More lenient thresholds for spike testing
    http_req_duration: ['p(95)<5000'], // 95% under 5s during spikes
    http_req_failed: ['rate<0.3'],     // Allow up to 30% errors during spikes
    spike_response_time: ['p(90)<3000'], // 90% under 3s
    recovery_time: ['p(95)<60000'],    // Recovery under 60 seconds
  },
  discardResponseBodies: true,
  rps: null, // No RPS limit for spike testing
  userAgent: 'TurboFlow-SpikeTest/1.0',
  hosts: {
    'api.turboflow.dev': 'http://localhost:3000',
  },
  insecureSkipTLSVerify: true,
};

// Track spike phases
let currentPhase = 'baseline';
let spikeStartTime = null;
let baselineMetrics = null;

export default function () {
  const user = createTestUser(__VU);
  const token = authenticateUser(user);

  try {
    executeSpikeWorkflow(token);
    spikeThroughput.add(1);
    spikeErrorRate.add(0);
  } catch (error) {
    console.error(`Spike test error (VU ${__VU}): ${error.message}`);
    spikeErrorRate.add(1);
  }

  sleep(0.1); // Minimal sleep for spike testing
}

export function handleSummary(data) {
  console.log('🚀 SPIKE TEST SUMMARY');
  console.log('======================');
  console.log(`Total requests: ${data.metrics.http_reqs.count}`);
  console.log(`Failed requests: ${data.metrics.http_req_failed.count}`);
  console.log(`Error rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  console.log(`Average response time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms`);
  console.log(`95th percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
  console.log(`Peak users reached: ${Math.max(...data.data.map(d => d.vus))}`);

  // Analyze spike impact
  const spikeAnalysis = analyzeSpikeImpact(data);
  console.log('\n📊 SPIKE ANALYSIS');
  console.log('==================');
  console.log(`Spike recovery time: ${spikeAnalysis.recoveryTime}ms`);
  console.log(`Performance degradation: ${spikeAnalysis.performanceDegradation}%`);
  console.log(`Error spike severity: ${spikeAnalysis.errorSpikeSeverity}`);
  console.log(`System resilience: ${spikeAnalysis.resilienceGrade}`);

  return {
    'spike-test-summary.json': JSON.stringify({
      ...data,
      spikeAnalysis,
    }, null, 2),
    stdout: generateSpikeTestSummary(data, spikeAnalysis),
  };
}

function executeSpikeWorkflow(token) {
  const startTime = Date.now();

  // Determine current phase based on number of active VUs
  const activeVUs = __VU;
  const maxVUs = 1000; // Based on our configuration

  let currentTestPhase;
  if (activeVUs <= 10) {
    currentTestPhase = 'baseline';
  } else if (activeVUs <= 200) {
    currentTestPhase = 'spike_low';
  } else if (activeVUs <= 500) {
    currentTestPhase = 'spike_medium';
  } else {
    currentTestPhase = 'spike_high';
  }

  // Detect phase transitions
  if (currentPhase !== currentTestPhase) {
    handlePhaseTransition(currentPhase, currentTestPhase, token);
    currentPhase = currentTestPhase;
  }

  // Execute operations based on current phase
  switch (currentTestPhase) {
    case 'baseline':
      executeBaselineOperations(token);
      break;
    case 'spike_low':
      executeSpikeOperations(token, 'low');
      break;
    case 'spike_medium':
      executeSpikeOperations(token, 'medium');
      break;
    case 'spike_high':
      executeSpikeOperations(token, 'high');
      break;
  }

  const duration = Date.now() - startTime;
  spikeResponseTime.add(duration);
}

function handlePhaseTransition(fromPhase, toPhase, token) {
  console.log(`Phase transition: ${fromPhase} -> ${toPhase}`);

  if (toPhase.startsWith('spike')) {
    spikeStartTime = Date.now();
    baselineMetrics = collectCurrentMetrics(token);
  } else if (fromPhase.startsWith('spike') && toPhase === 'baseline') {
    // Calculate recovery time
    const recoveryDuration = Date.now() - spikeStartTime;
    recoveryTime.add(recoveryDuration);
    console.log(`Spike recovery time: ${recoveryDuration}ms`);
  }
}

function executeBaselineOperations(token) {
  // Normal operations during baseline
  const operations = [
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/swarms`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'baseline swarm listing': (r) => r.status === 200,
        'baseline response time < 500ms': (r) => r.timings.duration < 500,
      });
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      check(response, {
        'baseline metrics': (r) => r.status === 200,
        'baseline metrics time < 300ms': (r) => r.timings.duration < 300,
      });
    },
  ];

  // Execute baseline operations
  operations.forEach(op => op());
}

function executeSpikeOperations(token, intensity) {
  const swarmId = config.getTestSwarmId();

  switch (intensity) {
    case 'low':
      executeLowIntensitySpike(token, swarmId);
      break;
    case 'medium':
      executeMediumIntensitySpike(token, swarmId);
      break;
    case 'high':
      executeHighIntensitySpike(token, swarmId);
      break;
  }
}

function executeLowIntensitySpike(token, swarmId) {
  // Low intensity spike - moderate load
  const payload = generateTaskPayload({
    priority: 'MEDIUM',
    size: 'medium'
  });

  const response = http.post(
    `${config.getAPIBaseURL()}/swarms/${swarmId}/tasks`,
    JSON.stringify(payload),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: '5000',
    }
  );

  check(response, {
    'low spike task created': (r) => r.status === 201 || r.status === 429,
    'low spike response < 3s': (r) => r.timings.duration < 3000,
  });
}

function executeMediumIntensitySpike(token, swarmId) {
  // Medium intensity spike - high load
  const operations = [
    // Task creation
    () => {
      const payload = generateTaskPayload({
        priority: 'HIGH',
        size: 'large'
      });

      http.post(`${config.getAPIBaseURL()}/swarms/${swarmId}/tasks`, JSON.stringify(payload), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: '8000',
      });
    },
    // Status checks
    () => {
      http.get(`${config.getAPIBaseURL()}/swarms/${swarmId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '5000',
      });
    },
    // Metrics query
    () => {
      http.get(`${config.getAPIBaseURL()}/analytics/realtime`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '10000',
      });
    }
  ];

  // Execute multiple operations concurrently
  operations.forEach(op => op());
}

function executeHighIntensitySpike(token, swarmId) {
  // High intensity spike - maximum load
  const batchOperations = Array.from({ length: 3 }, (_, batchIndex) => {
    return () => {
      // Multiple concurrent requests in each batch
      const promises = Array.from({ length: 5 }, (_, requestIndex) => {
        const payload = generateTaskPayload({
          name: `Spike Task ${__VU}-${batchIndex}-${requestIndex}`,
          priority: 'HIGH',
          size: 'large',
          parameters: {
            stress_level: 'maximum',
            resource_intensive: true
          }
        });

        return http.asyncRequest('POST', `${config.getAPIBaseURL()}/swarms/${swarmId}/tasks`, JSON.stringify(payload), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          timeout: '15000',
        });
      });

      return Promise.allSettled(promises);
    };
  });

  // Execute batches
  batchOperations.forEach(batch => batch());
}

function collectCurrentMetrics(token) {
  try {
    const response = http.get(`${config.getAPIBaseURL()}/metrics/detailed`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (response.status === 200) {
      return response.json();
    }
  } catch (error) {
    console.warn('Could not collect baseline metrics:', error.message);
  }

  return null;
}

function analyzeSpikeImpact(data) {
  // Calculate spike impact metrics
  const maxResponseTime = data.metrics.http_req_duration.max;
  const avgResponseTime = data.metrics.http_req_duration.avg;
  const maxErrorRate = Math.max(...data.data.map(d => d.http_req_failed_rate || 0));

  // Estimate performance degradation
  const baselineResponseTime = 200; // Assumed baseline
  const performanceDegradation = ((avgResponseTime - baselineResponseTime) / baselineResponseTime) * 100;

  // Determine error spike severity
  let errorSpikeSeverity;
  if (maxErrorRate < 0.05) errorSpikeSeverity = 'minimal';
  else if (maxErrorRate < 0.15) errorSpikeSeverity = 'moderate';
  else if (maxErrorRate < 0.30) errorSpikeSeverity = 'significant';
  else errorSpikeSeverity = 'severe';

  // Calculate resilience grade
  let resilienceGrade;
  if (performanceDegradation < 50 && maxErrorRate < 0.1 && maxResponseTime < 3000) {
    resilienceGrade = 'A';
  } else if (performanceDegradation < 100 && maxErrorRate < 0.2 && maxResponseTime < 5000) {
    resilienceGrade = 'B';
  } else if (performanceDegradation < 200 && maxErrorRate < 0.3 && maxResponseTime < 8000) {
    resilienceGrade = 'C';
  } else if (performanceDegradation < 500 && maxErrorRate < 0.4) {
    resilienceGrade = 'D';
  } else {
    resilienceGrade = 'F';
  }

  // Estimate recovery time (simplified)
  const recoveryTime = data.metrics.recovery_time ? data.metrics.recovery_time.avg : 30000;

  return {
    performanceDegradation: Math.round(performanceDegradation),
    errorSpikeSeverity,
    resilienceGrade,
    recoveryTime: Math.round(recoveryTime),
    maxResponseTime: Math.round(maxResponseTime),
    avgResponseTime: Math.round(avgResponseTime),
    maxErrorRate: Math.round(maxErrorRate * 100) / 100,
  };
}

function generateSpikeTestSummary(data, spikeAnalysis) {
  return `
🚀 SPIKE TEST ANALYSIS REPORT
============================

📈 PERFORMANCE METRICS:
  Average Response Time: ${spikeAnalysis.avgResponseTime}ms
  Maximum Response Time: ${spikeAnalysis.maxResponseTime}ms
  Performance Degradation: ${spikeAnalysis.performanceDegradation}%
  Recovery Time: ${(spikeAnalysis.recoveryTime / 1000).toFixed(1)}s

🚨 ERROR ANALYSIS:
  Maximum Error Rate: ${(spikeAnalysis.maxErrorRate * 100).toFixed(2)}%
  Error Spike Severity: ${spikeAnalysis.errorSpikeSeverity}

🛡️ RESILIENCE ASSESSMENT:
  System Resilience Grade: ${spikeAnalysis.resilienceGrade}

💡 RECOMMENDATIONS:
${getSpikeTestRecommendations(spikeAnalysis)}

📊 LOAD PATTERNS:
  Baseline Users: 10
  Peak Users: ${Math.max(...data.data.map(d => d.vus))}
  Spike Intensity: ${Math.round((Math.max(...data.data.map(d => d.vus)) / 10) * 100)}% increase

⏱️ TEST SUMMARY:
  Total Duration: ${((data.testRunDuration || 600000) / 1000 / 60).toFixed(1)} minutes
  Total Requests: ${data.metrics.http_reqs.count}
  Requests/Second: ${data.metrics.http_reqs.rate.toFixed(2)}

${spikeAnalysis.resilienceGrade === 'A' ? '✅ EXCELLENT: System handled spikes gracefully' :
  spikeAnalysis.resilienceGrade === 'B' ? '✅ GOOD: System recovered well from spikes' :
  spikeAnalysis.resilienceGrade === 'C' ? '⚠️  FAIR: System showed stress but recovered' :
  spikeAnalysis.resilienceGrade === 'D' ? '❌ POOR: System struggled with spikes' :
  '❌ CRITICAL: System failed to handle spikes effectively'}
`;
}

function getSpikeTestRecommendations(spikeAnalysis) {
  const recommendations = [];

  if (spikeAnalysis.performanceDegradation > 100) {
    recommendations.push('- High performance degradation during spikes. Consider implementing caching and optimization.');
  }

  if (spikeAnalysis.errorSpikeSeverity === 'severe') {
    recommendations.push('- Severe error spikes detected. Implement circuit breakers and retry mechanisms.');
  }

  if (spikeAnalysis.recoveryTime > 60000) {
    recommendations.push('- Slow recovery time. Optimize resource cleanup and connection handling.');
  }

  if (spikeAnalysis.maxResponseTime > 5000) {
    recommendations.push('- Response times exceeded 5s during spikes. Profile and optimize bottlenecks.');
  }

  if (spikeAnalysis.resilienceGrade === 'A') {
    recommendations.push('- Excellent resilience! Consider increasing load limits to test higher thresholds.');
  }

  if (recommendations.length === 0) {
    recommendations.push('- System showed good resilience to traffic spikes. Continue monitoring.');
  }

  return recommendations.join('\n');
}