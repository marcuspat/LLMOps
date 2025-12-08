/**
 * Stress Test Configuration
 * Configuration for stress testing to find system breaking points
 */

export class StressTestConfig {
  constructor() {
    this.baseURL = 'http://localhost:3000/api';
    this.testEnvironment = 'staging';
    this.testSwarmId = 'stress-test-swarm';

    // Stress test specific settings
    this.maxConcurrentUsers = 1000;
    this.breakingPointThreshold = 0.5; // 50% error rate indicates breaking point
    this.responseTimeThreshold = 10000; // 10 seconds response time indicates breaking point

    // Test data pools
    this.testSwarms = Array.from({ length: 10 }, (_, i) => `stress-swarm-${i}`);
    this.testUsers = [];
    this.testTasks = [];
  }

  getStages() {
    return [
      // Gradual ramp-up to find breaking point
      { duration: '1m', target: 50 },   // Start with 50 users
      { duration: '2m', target: 100 },  // Double load
      { duration: '3m', target: 200 },  // Significant load
      { duration: '2m', target: 300 },  // High load
      { duration: '2m', target: 400 },  // Stress level 1
      { duration: '2m', target: 500 },  // Stress level 2
      { duration: '2m', target: 600 },  // Stress level 3
      { duration: '2m', target: 700 },  // Stress level 4
      { duration: '1m', target: 800 },  // Approaching breaking point
      { duration: '1m', target: 900 },  // Near breaking point
      { duration: '2m', target: 1000 }, // Breaking point test
      { duration: '1m', target: 0 },    // Immediate drop to test recovery
    ];
  }

  getThresholds() {
    return {
      // More lenient thresholds for stress testing
      http_req_duration: ['p(95)<10000'], // 95% under 10 seconds
      http_req_failed: ['rate<0.7'],      // Allow up to 70% errors
      http_reqs: ['rate>5'],              // Minimum 5 requests per second

      // Stress-specific metrics
      stress_response_time: ['p(90)<8000'], // 90% under 8 seconds
      stress_errors: ['rate<0.6'],          // Allow up to 60% errors
      stress_throughput: ['count>100'],     // Minimum 100 operations

      // Resource usage (simulate monitoring)
      resource_usage: ['p(95)<95'],         // Allow high resource usage
      memory_usage: ['p(90)<90'],           // Memory usage under 90%
      cpu_usage: ['p(95)<95'],              // CPU usage under 95%
    };
  }

  getBreakingPointIndicators() {
    return {
      errorRate: {
        warning: 0.3,   // 30% errors - approaching breaking point
        critical: 0.5,  // 50% errors - breaking point reached
        severe: 0.7,    // 70% errors - system severely degraded
      },
      responseTime: {
        warning: 5000,  // 5 seconds
        critical: 10000, // 10 seconds
        severe: 20000,  // 20 seconds
      },
      throughput: {
        warning: 10,    // requests per second
        critical: 5,    // requests per second
        severe: 1,      // requests per second
      },
    };
  }

  getStressScenarios() {
    return {
      'memory_pressure': {
        description: 'Test system under memory pressure',
        parameters: {
          payloadSize: 'large',
          concurrentOperations: 50,
          operationType: 'memory_intensive',
          duration: '10m',
        },
      },
      'cpu_intensive': {
        description: 'Test system with CPU-intensive operations',
        parameters: {
          payloadSize: 'medium',
          concurrentOperations: 30,
          operationType: 'cpu_intensive',
          duration: '8m',
        },
      },
      'network_congestion': {
        description: 'Test system under network congestion',
        parameters: {
          payloadSize: 'large',
          concurrentOperations: 100,
          operationType: 'network_intensive',
          duration: '12m',
        },
      },
      'database_stress': {
        description: 'Test database under stress',
        parameters: {
          payloadSize: 'medium',
          concurrentOperations: 75,
          operationType: 'database_intensive',
          duration: '15m',
        },
      },
      'mixed_stress': {
        description: 'Combined stress factors',
        parameters: {
          payloadSize: 'variable',
          concurrentOperations: 150,
          operationType: 'mixed',
          duration: '20m',
        },
      },
    };
  }

  getTestSwarmId() {
    const swarmIndex = Math.floor(Math.random() * this.testSwarms.length);
    return this.testSwarms[swarmIndex];
  }

  getRandomSwarmId() {
    return this.getTestSwarmId();
  }

  getAPIBaseURL() {
    return this.baseURL;
  }

  // Recovery test scenarios
  getRecoveryTestStages() {
    return [
      { duration: '2m', target: 200 },  // Load to breaking point
      { duration: '1m', target: 0 },    // Immediate unload
      { duration: '3m', target: 50 },   // Recovery phase
      { duration: '2m', target: 100 },  // Gradual recovery
      { duration: '5m', target: 150 },  // Full recovery test
      { duration: '1m', target: 0 },    // Final recovery
    ];
  }

  // Spike test scenarios
  getSpikeTestStages() {
    return [
      { duration: '2m', target: 50 },   // Normal load
      { duration: '30s', target: 500 }, // Spike to 500 users
      { duration: '1m', target: 50 },   // Back to normal
      { duration: '30s', target: 800 }, // Higher spike
      { duration: '1m', target: 50 },   // Back to normal
      { duration: '30s', target: 1000 }, // Maximum spike
      { duration: '2m', target: 50 },   // Final recovery
    ];
  }

  // Endurance test scenarios
  getEnduranceTestStages() {
    return [
      { duration: '5m', target: 50 },   // Warm-up
      { duration: '30m', target: 100 }, // Sustained load
      { duration: '10m', target: 150 }, // Increased load
      { duration: '30m', target: 100 }, // Back to sustained
      { duration: '5m', target: 0 },    // Cool-down
    ];
  }

  // Test result analysis
  analyzeStressTestResults(results) {
    const breakingPoint = this.findBreakingPoint(results);
    const performanceMetrics = this.extractPerformanceMetrics(results);
    const recoveryMetrics = this.analyzeRecovery(results);

    return {
      breakingPoint,
      performanceMetrics,
      recoveryMetrics,
      recommendations: this.generateRecommendations(breakingPoint, performanceMetrics),
    };
  }

  findBreakingPoint(results) {
    const indicators = this.getBreakingPointIndicators();
    let breakingPoint = null;

    // Analyze error rate
    if (results.metrics.http_req_failed.rate >= indicators.errorRate.critical) {
      breakingPoint = {
        type: 'error_rate',
        value: results.metrics.http_req_failed.rate,
        threshold: indicators.errorRate.critical,
        timestamp: Date.now(),
      };
    }

    // Analyze response time
    if (results.metrics.http_req_duration['p(95)'] >= indicators.responseTime.critical) {
      breakingPoint = {
        type: 'response_time',
        value: results.metrics.http_req_duration['p(95)'],
        threshold: indicators.responseTime.critical,
        timestamp: Date.now(),
      };
    }

    // Analyze throughput
    if (results.metrics.http_reqs.rate <= indicators.throughput.critical) {
      breakingPoint = {
        type: 'throughput',
        value: results.metrics.http_reqs.rate,
        threshold: indicators.throughput.critical,
        timestamp: Date.now(),
      };
    }

    return breakingPoint;
  }

  extractPerformanceMetrics(results) {
    return {
      peakLoad: {
        maxUsers: Math.max(...results.data.map(d => d.vus)),
        maxRPS: results.metrics.http_reqs.rate,
        duration: results.testRunDuration,
      },
      resourceUtilization: {
        cpu: results.metrics.resource_usage ? results.metrics.resource_usage.avg : 0,
        memory: results.metrics.memory_usage ? results.metrics.memory_usage.avg : 0,
      },
      responseTimes: {
        avg: results.metrics.http_req_duration.avg,
        min: results.metrics.http_req_duration.min,
        max: results.metrics.http_req_duration.max,
        p50: results.metrics.http_req_duration['p(50)'],
        p90: results.metrics.http_req_duration['p(90)'],
        p95: results.metrics.http_req_duration['p(95)'],
        p99: results.metrics.http_req_duration['p(99)'],
      },
      errorAnalysis: {
        totalErrors: results.metrics.http_req_failed.count,
        errorRate: results.metrics.http_req_failed.rate,
        errorTypes: this.categorizeErrors(results),
      },
    };
  }

  analyzeRecovery(results) {
    // Analyze system recovery after load removal
    const recoveryData = results.data.slice(-10); // Last 10 data points
    const initialRecovery = recoveryData[0];
    const finalRecovery = recoveryData[recoveryData.length - 1];

    return {
      recoveryTime: this.calculateRecoveryTime(results),
      performanceRestoration: {
        initial: {
          responseTime: initialRecovery ? initialRegression.http_req_duration.avg : 0,
          errorRate: initialRecovery ? initialRecovery.http_req_failed.rate : 1,
        },
        final: {
          responseTime: finalRecovery ? finalRecovery.http_req_duration.avg : 0,
          errorRate: finalRecovery ? finalRecovery.http_req_failed.rate : 1,
        },
      },
      systemStability: this.assessSystemStability(recoveryData),
    };
  }

  generateRecommendations(breakingPoint, performanceMetrics) {
    const recommendations = [];

    if (breakingPoint) {
      switch (breakingPoint.type) {
        case 'error_rate':
          recommendations.push({
            priority: 'high',
            category: 'reliability',
            description: 'System shows high error rates under stress. Consider implementing circuit breakers and retry mechanisms.',
            action: 'Review error handling and implement graceful degradation.',
          });
          break;
        case 'response_time':
          recommendations.push({
            priority: 'medium',
            category: 'performance',
            description: 'Response times degrade significantly under load. Optimize slow operations.',
            action: 'Profile and optimize performance bottlenecks.',
          });
          break;
        case 'throughput':
          recommendations.push({
            priority: 'medium',
            category: 'scalability',
            description: 'System throughput drops under heavy load. Consider horizontal scaling.',
            action: 'Implement auto-scaling and load balancing.',
          });
          break;
      }
    }

    if (performanceMetrics.resourceUtilization.cpu > 80) {
      recommendations.push({
        priority: 'medium',
        category: 'capacity',
        description: 'High CPU utilization under stress. Consider vertical scaling or optimization.',
        action: 'Optimize CPU-intensive operations or scale up resources.',
      });
    }

    if (performanceMetrics.resourceUtilization.memory > 80) {
      recommendations.push({
        priority: 'medium',
        category: 'capacity',
        description: 'High memory utilization under stress. Check for memory leaks.',
        action: 'Optimize memory usage and implement proper garbage collection.',
      });
    }

    return recommendations;
  }

  // Helper methods
  calculateRecoveryTime(results) {
    // Simplified recovery time calculation
    return results.testRunDuration * 0.1; // 10% of test duration
  }

  assessSystemStability(recoveryData) {
    if (!recoveryData || recoveryData.length === 0) return 'unknown';

    const lastResponseTime = recoveryData[recoveryData.length - 1].http_req_duration.avg;
    const lastErrorRate = recoveryData[recoveryData.length - 1].http_req_failed.rate;

    if (lastResponseTime < 1000 && lastErrorRate < 0.01) return 'excellent';
    if (lastResponseTime < 2000 && lastErrorRate < 0.05) return 'good';
    if (lastResponseTime < 5000 && lastErrorRate < 0.1) return 'fair';
    return 'poor';
  }

  categorizeErrors(results) {
    // Placeholder for error categorization logic
    return {
      timeout: 0,
      connection: 0,
      server: results.metrics.http_req_failed.count * 0.7,
      client: results.metrics.http_req_failed.count * 0.3,
    };
  }

  // Export configuration
  exportConfig() {
    return {
      testEnvironment: this.testEnvironment,
      baseURL: this.baseURL,
      maxConcurrentUsers: this.maxConcurrentUsers,
      breakingPointThreshold: this.breakingPointThreshold,
      responseTimeThreshold: this.responseTimeThreshold,
      stages: this.getStages(),
      thresholds: this.getThresholds(),
      breakingPointIndicators: this.getBreakingPointIndicators(),
      stressScenarios: this.getStressScenarios(),
      timestamp: new Date().toISOString(),
    };
  }
}