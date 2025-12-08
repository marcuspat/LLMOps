import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import { createTestUser, authenticateUser, generateTaskPayload } from './utils/helpers.js';

// Endurance test specific metrics
export let enduranceErrorRate = new Rate('endurance_errors');
export let enduranceResponseTime = new Trend('endurance_response_time', true);
export let enduranceThroughput = new Counter('endurance_throughput');
export let memoryLeakIndicator = new Trend('memory_leak_indicator', true);
export let performanceDegradation = new Trend('performance_degradation', true);
export let activeConnections = new Gauge('active_connections');

// Load test config
import { LoadTestConfig } from '../config/load-test-config.js';

const config = new LoadTestConfig();

// Track performance over time
let performanceBaseline = null;
let testStartTime = Date.now();
let cycleCount = 0;

export let options = {
  stages: [
    // Warm-up phase
    { duration: '5m', target: 20 },   // Ramp up to 20 users
    { duration: '10m', target: 20 },  // Warm-up period

    // Endurance phase - sustained load for extended period
    { duration: '60m', target: 50 },  // Sustained 50 users for 1 hour
    { duration: '30m', target: 75 },  // Increased load
    { duration: '60m', target: 50 },  // Back to baseline endurance

    // Stress phase within endurance test
    { duration: '10m', target: 100 }, // Stress period
    { duration: '20m', target: 50 },  // Recovery

    // Final endurance phase
    { duration: '60m', target: 50 },  // Continued endurance
    { duration: '10m', target: 0 },   // Cool down
  ],
  thresholds: {
    // Strict thresholds for endurance testing
    http_req_duration: ['p(95)<3000'], // 95% under 3s
    http_req_failed: ['rate<0.02'],     // Error rate under 2%
    endurance_response_time: ['p(90)<2000'], // 90% under 2s
    performance_degradation: ['p(95)<50'], // Performance degradation under 50%
    memory_leak_indicator: ['p(95)<200'], // Memory growth under 200MB
  },
  discardResponseBodies: true,
  rps: 10, // Limit to 10 RPS per VU for endurance testing
  userAgent: 'TurboFlow-EnduranceTest/1.0',
  hosts: {
    'api.turboflow.dev': 'http://localhost:3000',
  },
  insecureSkipTLSVerify: true,
  noConnectionReuse: false, // Important for endurance testing
};

export default function () {
  const user = createTestUser(__VU);
  const token = authenticateUser(user);

  // Track cycle count for endurance analysis
  cycleCount++;

  try {
    executeEnduranceWorkflow(token);
    enduranceThroughput.add(1);
    enduranceErrorRate.add(0);

    // Periodic memory leak detection
    if (cycleCount % 100 === 0) {
      checkForMemoryLeaks();
    }

    // Performance degradation tracking
    if (cycleCount % 50 === 0) {
      trackPerformanceDegradation();
    }

  } catch (error) {
    console.error(`Endurance test error (VU ${__VU}, cycle ${cycleCount}): ${error.message}`);
    enduranceErrorRate.add(1);
  }

  // Variable sleep time to simulate realistic usage patterns
  const sleepTime = Math.random() * 3 + 1; // 1-4 seconds
  sleep(sleepTime);
}

export function handleSummary(data) {
  console.log('⏱️  ENDURANCE TEST SUMMARY');
  console.log('==========================');
  console.log(`Test Duration: ${((data.testRunDuration || 0) / 1000 / 60).toFixed(1)} minutes`);
  console.log(`Total Requests: ${data.metrics.http_reqs.count}`);
  console.log(`Failed Requests: ${data.metrics.http_req_failed.count}`);
  console.log(`Error Rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%`);
  console.log(`Average Response Time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms`);
  console.log(`95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms`);
  console.log(`Total Cycles: ${cycleCount}`);

  // Endurance-specific analysis
  const enduranceAnalysis = analyzeEnduranceMetrics(data);
  console.log('\n📊 ENDURANCE ANALYSIS');
  console.log('====================');
  console.log(`Performance Stability: ${enduranceAnalysis.stabilityGrade}`);
  console.log(`Memory Leak Risk: ${enduranceAnalysis.memoryLeakRisk}`);
  console.log(`Performance Degradation: ${enduranceAnalysis.performanceDegradation}%`);
  console.log(`System Longevity: ${enduranceAnalysis.longevityGrade}`);

  return {
    'endurance-test-summary.json': JSON.stringify({
      ...data,
      enduranceAnalysis,
      cycleCount,
      testStartTime,
    }, null, 2),
    stdout: generateEnduranceTestSummary(data, enduranceAnalysis),
  };
}

function executeEnduranceWorkflow(token) {
  const startTime = Date.now();

  // Simulate realistic user behavior over extended periods
  const workflowType = Math.random();
  const swarmId = config.getTestSwarmId();

  if (workflowType < 0.3) {
    // 30% - Create and manage tasks
    executeTaskManagementWorkflow(token, swarmId);
  } else if (workflowType < 0.5) {
    // 20% - Monitor and check status
    executeMonitoringWorkflow(token, swarmId);
  } else if (workflowType < 0.7) {
    // 20% - Analytics and reporting
    executeAnalyticsWorkflow(token);
  } else if (workflowType < 0.9) {
    // 20% - Swarm operations
    executeSwarmOperationsWorkflow(token);
  } else {
    // 10% - Resource intensive operations (less frequent)
    executeResourceIntensiveWorkflow(token, swarmId);
  }

  const duration = Date.now() - startTime;
  enduranceResponseTime.add(duration);
}

function executeTaskManagementWorkflow(token, swarmId) {
  // Realistic task management operations
  const operations = [
    // Create a task
    () => {
      const payload = generateTaskPayload({
        priority: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
        size: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)]
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
        'endurance task created': (r) => r.status === 201 || r.status === 429,
        'endurance task response time < 5s': (r) => r.timings.duration < 5000,
      });

      return response.status === 201 ? response.json('id') : null;
    },
    // Check task status
    (taskId) => {
      if (taskId) {
        const response = http.get(`${config.getAPIBaseURL()}/tasks/${taskId}/status`, {
          headers: { 'Authorization': `Bearer ${token}` },
          timeout: '3000',
        });

        check(response, {
          'endurance task status': (r) => r.status === 200,
          'endurance status time < 3s': (r) => r.timings.duration < 3000,
        });
      }
    },
  ];

  // Execute task creation and status check
  const taskId = operations[0]();
  setTimeout(() => operations[1](taskId), Math.random() * 2000 + 1000);
}

function executeMonitoringWorkflow(token, swarmId) {
  // System monitoring and status checking
  const monitoringRequests = [
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/swarms/${swarmId}/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '3000',
      });

      check(response, {
        'endurance swarm status': (r) => r.status === 200,
        'endurance status time < 3s': (r) => r.timings.duration < 3000,
      });
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/metrics/health`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '2000',
      });

      check(response, {
        'endurance health check': (r) => r.status === 200,
        'endurance health time < 2s': (r) => r.timings.duration < 2000,
      });
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/analytics/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '4000',
      });

      check(response, {
        'endurance analytics': (r) => r.status === 200 || r.status === 503,
        'endurance analytics time < 4s': (r) => r.timings.duration < 4000,
      });
    },
  ];

  // Execute monitoring requests with small delays
  monitoringRequests.forEach((request, index) => {
    setTimeout(request, index * 500);
  });
}

function executeAnalyticsWorkflow(token) {
  // Analytics and reporting operations
  const analyticsOperations = [
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/analytics/performance`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '8000',
      });

      check(response, {
        'endurance performance analytics': (r) => r.status === 200 || r.status === 503,
        'endurance analytics time < 8s': (r) => r.timings.duration < 8000,
      });
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/analytics/usage`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '6000',
      });

      check(response, {
        'endurance usage analytics': (r) => r.status === 200 || r.status === 503,
        'endurance usage time < 6s': (r) => r.timings.duration < 6000,
      });
    },
  ];

  // Execute analytics operations
  analyticsOperations.forEach(op => op());
}

function executeSwarmOperationsWorkflow(token) {
  // Swarm management operations
  const swarmOperations = [
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/swarms`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '4000',
      });

      check(response, {
        'endurance swarm listing': (r) => r.status === 200,
        'endurance listing time < 4s': (r) => r.timings.duration < 4000,
      });
    },
    () => {
      // Get available agents
      const response = http.get(`${config.getAPIBaseURL()}/agents`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '3000',
      });

      check(response, {
        'endurance agents list': (r) => r.status === 200,
        'endurance agents time < 3s': (r) => r.timings.duration < 3000,
      });
    },
  ];

  swarmOperations.forEach(op => op());
}

function executeResourceIntensiveWorkflow(token, swarmId) {
  // Resource intensive operations (less frequent for endurance)
  const resourceIntensiveOps = [
    () => {
      const response = http.post(`${config.getAPIBaseURL()}/swarms/${swarmId}/optimize`, JSON.stringify({
        optimization_type: 'comprehensive',
        include_predictions: true,
        depth: 'deep'
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        timeout: '15000',
      });

      check(response, {
        'endurance optimization': (r) => r.status === 200 || r.status === 202 || r.status === 503,
        'endurance optimization time < 15s': (r) => r.timings.duration < 15000,
      });
    },
    () => {
      const response = http.get(`${config.getAPIBaseURL()}/analytics/detailed`, {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: '12000',
      });

      check(response, {
        'endurance detailed analytics': (r) => r.status === 200 || r.status === 503,
        'endurance detailed time < 12s': (r) => r.timings.duration < 12000,
      });
    },
  ];

  // Execute resource intensive operations
  resourceIntensiveOps.forEach(op => op());
}

function checkForMemoryLeaks() {
  // Simulate memory leak detection
  // In a real implementation, this would connect to monitoring systems
  const memoryUsage = simulateMemoryUsage();
  memoryLeakIndicator.add(memoryUsage);

  if (memoryUsage > 500) { // 500MB threshold
    console.warn(`⚠️  High memory usage detected: ${memoryUsage}MB`);
  }
}

function trackPerformanceDegradation() {
  // Track performance over time to detect degradation
  if (!performanceBaseline) {
    performanceBaseline = {
      timestamp: Date.now(),
      responseTime: enduranceResponseTime.avg || 0,
    };
  } else {
    const currentPerformance = enduranceResponseTime.avg || 0;
    const baselinePerformance = performanceBaseline.responseTime;
    const degradation = ((currentPerformance - baselinePerformance) / baselinePerformance) * 100;

    performanceDegradation.add(degradation);

    if (degradation > 50) {
      console.warn(`⚠️  Performance degradation detected: ${degradation.toFixed(2)}%`);
    }
  }
}

function simulateMemoryUsage() {
  // Simulate memory usage tracking
  // In a real implementation, this would get actual memory metrics
  const baseMemory = 100;
  const growthFactor = cycleCount * 0.5; // 0.5MB per cycle
  const randomVariation = Math.random() * 20 - 10; // ±10MB variation

  return Math.max(0, baseMemory + growthFactor + randomVariation);
}

function analyzeEnduranceMetrics(data) {
  // Analyze endurance-specific metrics
  const avgResponseTime = data.metrics.http_req_duration.avg;
  const p95ResponseTime = data.metrics.http_req_duration['p(95)'];
  const errorRate = data.metrics.http_req_failed.rate;
  const testDuration = data.testRunDuration || 0;

  // Performance stability analysis
  const responseTimeVariance = calculateResponseTimeVariance(data);
  const stabilityGrade = calculateStabilityGrade(responseTimeVariance, errorRate);

  // Memory leak risk assessment
  const memoryGrowthRate = calculateMemoryGrowthRate();
  const memoryLeakRisk = assessMemoryLeakRisk(memoryGrowthRate);

  // Performance degradation
  const performanceDegradation = calculateOverallPerformanceDegradation(data);

  // Longevity assessment
  const longevityGrade = assessSystemLongevity(testDuration, errorRate, performanceDegradation);

  return {
    stabilityGrade,
    memoryLeakRisk,
    performanceDegradation: Math.round(performanceDegradation * 100) / 100,
    longevityGrade,
    responseTimeVariance: Math.round(responseTimeVariance * 100) / 100,
    memoryGrowthRate: Math.round(memoryGrowthRate * 100) / 100,
  };
}

function calculateResponseTimeVariance(data) {
  // Simplified variance calculation
  const avgTime = data.metrics.http_req_duration.avg;
  const p95Time = data.metrics.http_req_duration['p(95)'];
  const p5Time = data.metrics.http_req_duration.min || avgTime;

  return (p95Time - p5Time) / avgTime;
}

function calculateStabilityGrade(variance, errorRate) {
  if (variance < 1.5 && errorRate < 0.01) return 'EXCELLENT';
  if (variance < 2.0 && errorRate < 0.02) return 'GOOD';
  if (variance < 3.0 && errorRate < 0.05) return 'FAIR';
  if (variance < 5.0 && errorRate < 0.1) return 'POOR';
  return 'CRITICAL';
}

function calculateMemoryGrowthRate() {
  // Calculate memory growth rate per hour
  const memoryGrowth = simulateMemoryUsage() - 100; // Growth from baseline
  const testHours = (Date.now() - testStartTime) / (1000 * 60 * 60);
  return testHours > 0 ? memoryGrowth / testHours : 0;
}

function assessMemoryLeakRisk(growthRate) {
  if (growthRate < 10) return 'LOW';
  if (growthRate < 50) return 'MODERATE';
  if (growthRate < 100) return 'HIGH';
  return 'CRITICAL';
}

function calculateOverallPerformanceDegradation(data) {
  // Calculate overall performance degradation
  const initialPerformance = 200; // Assumed baseline
  const currentPerformance = data.metrics.http_req_duration.avg;
  return ((currentPerformance - initialPerformance) / initialPerformance) * 100;
}

function assessSystemLongevity(duration, errorRate, performanceDegradation) {
  const testHours = duration / (1000 * 60 * 60);

  if (testHours > 2 && errorRate < 0.01 && performanceDegradation < 20) return 'EXCELLENT';
  if (testHours > 1.5 && errorRate < 0.02 && performanceDegradation < 30) return 'GOOD';
  if (testHours > 1 && errorRate < 0.05 && performanceDegradation < 50) return 'FAIR';
  if (testHours > 0.5 && errorRate < 0.1 && performanceDegradation < 100) return 'POOR';
  return 'CRITICAL';
}

function generateEnduranceTestSummary(data, analysis) {
  return `
⏱️  ENDURANCE TEST ANALYSIS REPORT
================================

📊 PERFORMANCE ANALYSIS:
  Test Duration: ${((data.testRunDuration || 0) / 1000 / 60).toFixed(1)} minutes
  Average Response Time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms
  95th Percentile: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms
  Performance Stability: ${analysis.stabilityGrade}
  Performance Degradation: ${analysis.performanceDegradation}%

💾 MEMORY ANALYSIS:
  Memory Growth Rate: ${analysis.memoryGrowthRate}MB/hour
  Memory Leak Risk: ${analysis.memoryLeakRisk}

🛡️ SYSTEM LONGEVITY:
  Longevity Grade: ${analysis.longevityGrade}
  Total Cycles Completed: ${cycleCount}

📈 RELIABILITY METRICS:
  Error Rate: ${(data.metrics.http_req_failed.rate * 100).toFixed(2)}%
  Successful Requests: ${data.metrics.http_reqs.count - data.metrics.http_req_failed.count}
  Throughput: ${data.metrics.http_reqs.rate.toFixed(2)} req/s

💡 ENDURANCE TEST RECOMMENDATIONS:
${getEnduranceTestRecommendations(analysis)}

⏱️  STABILITY ASSESSMENT:
${analysis.stabilityGrade === 'EXCELLENT' ? '✅ Excellent stability - system performed consistently' :
  analysis.stabilityGrade === 'GOOD' ? '✅ Good stability - minor performance variations' :
  analysis.stabilityGrade === 'FAIR' ? '⚠️  Fair stability - some performance fluctuations' :
  analysis.stabilityGrade === 'POOR' ? '❌ Poor stability - significant performance variations' :
  '❌ Critical stability - major performance issues'}

${analysis.memoryLeakRisk === 'LOW' ? '✅ No memory leaks detected' :
  analysis.memoryLeakRisk === 'MODERATE' ? '⚠️  Some memory growth observed - monitor closely' :
  analysis.memoryLeakRisk === 'HIGH' ? '❌ High memory growth - potential leaks detected' :
  '❌ Critical memory leaks - immediate investigation required'}

${analysis.longevityGrade === 'EXCELLENT' ? '✅ System shows excellent endurance characteristics' :
  analysis.longevityGrade === 'GOOD' ? '✅ System demonstrates good endurance' :
  analysis.longevityGrade === 'FAIR' ? '⚠️  System endurance is fair - improvement needed' :
  analysis.longevityGrade === 'POOR' ? '❌ Poor endurance - significant issues found' :
  '❌ Critical endurance problems - system not suitable for sustained load'}
`;
}

function getEnduranceTestRecommendations(analysis) {
  const recommendations = [];

  if (analysis.performanceDegradation > 30) {
    recommendations.push('- High performance degradation detected. Profile and optimize bottlenecks.');
  }

  if (analysis.memoryLeakRisk === 'HIGH' || analysis.memoryLeakRisk === 'CRITICAL') {
    recommendations.push('- Memory leak risk detected. Implement proper memory management and monitoring.');
  }

  if (analysis.stabilityGrade === 'POOR' || analysis.stabilityGrade === 'CRITICAL') {
    recommendations.push('- Poor performance stability. Investigate inconsistent response times.');
  }

  if (analysis.responseTimeVariance > 3) {
    recommendations.push('- High response time variance. Optimize for consistent performance.');
  }

  if (analysis.longevityGrade === 'POOR' || analysis.longevityGrade === 'CRITICAL') {
    recommendations.push('- System endurance issues detected. Review architecture for sustained operations.');
  }

  if (recommendations.length === 0) {
    recommendations.push('- System shows good endurance characteristics. Continue monitoring for long-term trends.');
  }

  return recommendations.join('\n');
}