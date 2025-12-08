/**
 * Load Test Thresholds Configuration
 * Defines performance thresholds and acceptable limits for load testing
 */

export interface LoadTestThresholds {
  responseTime: {
    excellent: number;  // < 100ms
    good: number;       // < 500ms
    acceptable: number; // < 1s
    poor: number;       // < 2s
    critical: number;   // >= 2s
  };
  throughput: {
    minimal: number;    // 10 req/s
    basic: number;      // 50 req/s
    good: number;       // 100 req/s
    excellent: number;  // 200 req/s
    exceptional: number; // 500 req/s
  };
  errorRate: {
    excellent: number;  // < 0.1%
    good: number;       // < 0.5%
    acceptable: number; // < 1%
    poor: number;       // < 5%
    critical: number;   // >= 5%
  };
  resourceUsage: {
    cpu: {
      good: number;      // < 50%
      acceptable: number; // < 75%
      poor: number;      // < 90%
      critical: number;  // >= 90%
    };
    memory: {
      good: number;      // < 60%
      acceptable: number; // < 80%
      poor: number;      // < 90%
      critical: number;  // >= 90%
    };
    disk: {
      good: number;      // < 70%
      acceptable: number; // < 85%
      poor: number;      // < 95%
      critical: number;  // >= 95%
    };
  };
  specificEndpoints: {
    [endpoint: string]: {
      responseTime: {
        p50: number;
        p90: number;
        p95: number;
        p99: number;
      };
      throughput: number;
      errorRate: number;
    };
  };
}

export const LoadTestThresholds: LoadTestThresholds = {
  responseTime: {
    excellent: 100,
    good: 500,
    acceptable: 1000,
    poor: 2000,
    critical: 2000,
  },
  throughput: {
    minimal: 10,
    basic: 50,
    good: 100,
    excellent: 200,
    exceptional: 500,
  },
  errorRate: {
    excellent: 0.001,
    good: 0.005,
    acceptable: 0.01,
    poor: 0.05,
    critical: 0.05,
  },
  resourceUsage: {
    cpu: {
      good: 50,
      acceptable: 75,
      poor: 90,
      critical: 90,
    },
    memory: {
      good: 60,
      acceptable: 80,
      poor: 90,
      critical: 90,
    },
    disk: {
      good: 70,
      acceptable: 85,
      poor: 95,
      critical: 95,
    },
  },
  specificEndpoints: {
    '/api/auth/login': {
      responseTime: { p50: 200, p90: 500, p95: 800, p99: 1200 },
      throughput: 50,
      errorRate: 0.005,
    },
    '/api/swarms': {
      responseTime: { p50: 300, p90: 600, p95: 1000, p99: 1500 },
      throughput: 30,
      errorRate: 0.01,
    },
    '/api/swarms/{id}/tasks': {
      responseTime: { p50: 400, p90: 800, p95: 1200, p99: 2000 },
      throughput: 40,
      errorRate: 0.01,
    },
    '/api/tasks': {
      responseTime: { p50: 500, p90: 1000, p95: 1500, p99: 2500 },
      throughput: 25,
      errorRate: 0.015,
    },
    '/api/metrics': {
      responseTime: { p50: 150, p90: 300, p95: 500, p99: 800 },
      throughput: 100,
      errorRate: 0.005,
    },
    '/api/analytics': {
      responseTime: { p50: 800, p90: 2000, p95: 3000, p99: 5000 },
      throughput: 10,
      errorRate: 0.02,
    },
  },
};

export interface ThresholdEvaluation {
  metric: string;
  value: number;
  threshold: number;
  status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
  passed: boolean;
  recommendation?: string;
}

export class ThresholdEvaluator {
  constructor(private thresholds: LoadTestThresholds = LoadTestThresholds) {}

  evaluateResponseTime(responseTime: number): ThresholdEvaluation {
    const thresholds = this.thresholds.responseTime;

    let status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
    let threshold: number;
    let recommendation: string;

    if (responseTime < thresholds.excellent) {
      status = 'excellent';
      threshold = thresholds.excellent;
      recommendation = 'Excellent response time';
    } else if (responseTime < thresholds.good) {
      status = 'good';
      threshold = thresholds.good;
      recommendation = 'Good response time';
    } else if (responseTime < thresholds.acceptable) {
      status = 'acceptable';
      threshold = thresholds.acceptable;
      recommendation = 'Acceptable response time';
    } else if (responseTime < thresholds.poor) {
      status = 'poor';
      threshold = thresholds.poor;
      recommendation = 'Poor response time - consider optimization';
    } else {
      status = 'critical';
      threshold = thresholds.critical;
      recommendation = 'Critical response time - optimization required';
    }

    return {
      metric: 'response_time',
      value: responseTime,
      threshold,
      status,
      passed: status !== 'critical' && status !== 'poor',
      recommendation,
    };
  }

  evaluateThroughput(throughput: number): ThresholdEvaluation {
    const thresholds = this.thresholds.throughput;

    let status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
    let threshold: number;
    let recommendation: string;

    if (throughput >= thresholds.exceptional) {
      status = 'excellent';
      threshold = thresholds.exceptional;
      recommendation = 'Exceptional throughput';
    } else if (throughput >= thresholds.excellent) {
      status = 'excellent';
      threshold = thresholds.excellent;
      recommendation = 'Excellent throughput';
    } else if (throughput >= thresholds.good) {
      status = 'good';
      threshold = thresholds.good;
      recommendation = 'Good throughput';
    } else if (throughput >= thresholds.basic) {
      status = 'acceptable';
      threshold = thresholds.basic;
      recommendation = 'Basic throughput - room for improvement';
    } else {
      status = 'critical';
      threshold = thresholds.minimal;
      recommendation = 'Critical throughput - scaling needed';
    }

    return {
      metric: 'throughput',
      value: throughput,
      threshold,
      status,
      passed: status !== 'critical',
      recommendation,
    };
  }

  evaluateErrorRate(errorRate: number): ThresholdEvaluation {
    const thresholds = this.thresholds.errorRate;

    let status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
    let threshold: number;
    let recommendation: string;

    if (errorRate < thresholds.excellent) {
      status = 'excellent';
      threshold = thresholds.excellent;
      recommendation = 'Excellent reliability';
    } else if (errorRate < thresholds.good) {
      status = 'good';
      threshold = thresholds.good;
      recommendation = 'Good reliability';
    } else if (errorRate < thresholds.acceptable) {
      status = 'acceptable';
      threshold = thresholds.acceptable;
      recommendation = 'Acceptable reliability - monitor closely';
    } else if (errorRate < thresholds.poor) {
      status = 'poor';
      threshold = thresholds.poor;
      recommendation = 'Poor reliability - investigation needed';
    } else {
      status = 'critical';
      threshold = thresholds.critical;
      recommendation = 'Critical reliability - immediate attention required';
    }

    return {
      metric: 'error_rate',
      value: errorRate * 100, // Convert to percentage
      threshold: threshold * 100,
      status,
      passed: status !== 'critical' && status !== 'poor',
      recommendation,
    };
  }

  evaluateResourceUsage(resourceType: 'cpu' | 'memory' | 'disk', usage: number): ThresholdEvaluation {
    const thresholds = this.thresholds.resourceUsage[resourceType];

    let status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
    let threshold: number;
    let recommendation: string;

    if (usage < thresholds.good) {
      status = 'excellent';
      threshold = thresholds.good;
      recommendation = `Excellent ${resourceType} utilization`;
    } else if (usage < thresholds.acceptable) {
      status = 'good';
      threshold = thresholds.acceptable;
      recommendation = `Good ${resourceType} utilization`;
    } else if (usage < thresholds.poor) {
      status = 'acceptable';
      threshold = thresholds.poor;
      recommendation = `Acceptable ${resourceType} utilization - monitor trends`;
    } else {
      status = 'critical';
      threshold = thresholds.critical;
      recommendation = `Critical ${resourceType} utilization - scaling required`;
    }

    return {
      metric: `${resourceType}_usage`,
      value: usage,
      threshold,
      status,
      passed: status !== 'critical' && status !== 'poor',
      recommendation,
    };
  }

  evaluateEndpointPerformance(endpoint: string, metrics: {
    responseTime: { p50: number; p90: number; p95: number; p99: number };
    throughput: number;
    errorRate: number;
  }): ThresholdEvaluation[] {
    const endpointThresholds = this.thresholds.specificEndpoints[endpoint];

    if (!endpointThresholds) {
      return [{
        metric: 'endpoint_performance',
        value: 0,
        threshold: 0,
        status: 'acceptable' as const,
        passed: true,
        recommendation: `No specific thresholds defined for ${endpoint}`,
      }];
    }

    const evaluations: ThresholdEvaluation[] = [];

    // Evaluate response time percentiles
    ['p50', 'p90', 'p95', 'p99'].forEach(percentile => {
      const value = metrics.responseTime[percentile as keyof typeof metrics.responseTime];
      const threshold = endpointThresholds.responseTime[percentile as keyof typeof endpointThresholds.responseTime];

      const passed = value <= threshold;
      const status = passed ? 'good' : 'critical';

      evaluations.push({
        metric: `${endpoint}_response_time_${percentile}`,
        value,
        threshold,
        status: status as 'good' | 'critical',
        passed,
        recommendation: passed ? 'Response time within limits' : 'Response time exceeded threshold',
      });
    });

    // Evaluate throughput
    evaluations.push({
      metric: `${endpoint}_throughput`,
      value: metrics.throughput,
      threshold: endpointThresholds.throughput,
      status: metrics.throughput >= endpointThresholds.throughput ? 'good' : 'critical',
      passed: metrics.throughput >= endpointThresholds.throughput,
      recommendation: metrics.throughput >= endpointThresholds.throughput
        ? 'Throughput meets expectations'
        : 'Throughput below expected threshold',
    });

    // Evaluate error rate
    evaluations.push({
      metric: `${endpoint}_error_rate`,
      value: metrics.errorRate * 100,
      threshold: endpointThresholds.errorRate * 100,
      status: metrics.errorRate <= endpointThresholds.errorRate ? 'good' : 'critical',
      passed: metrics.errorRate <= endpointThresholds.errorRate,
      recommendation: metrics.errorRate <= endpointThresholds.errorRate
        ? 'Error rate within acceptable limits'
        : 'Error rate exceeds threshold - investigation needed',
    });

    return evaluations;
  }

  evaluateOverallPerformance(metrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
  }): {
    overall: ThresholdEvaluation;
    details: ThresholdEvaluation[];
    score: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  } {
    const details: ThresholdEvaluation[] = [
      this.evaluateResponseTime(metrics.responseTime),
      this.evaluateThroughput(metrics.throughput),
      this.evaluateErrorRate(metrics.errorRate),
      this.evaluateResourceUsage('cpu', metrics.cpuUsage),
      this.evaluateResourceUsage('memory', metrics.memoryUsage),
    ];

    // Calculate overall score
    const passedCount = details.filter(d => d.passed).length;
    const score = (passedCount / details.length) * 100;

    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    let status: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';

    if (score >= 90) {
      grade = 'A';
      status = 'excellent';
    } else if (score >= 80) {
      grade = 'B';
      status = 'good';
    } else if (score >= 70) {
      grade = 'C';
      status = 'acceptable';
    } else if (score >= 60) {
      grade = 'D';
      status = 'poor';
    } else {
      grade = 'F';
      status = 'critical';
    }

    const overall: ThresholdEvaluation = {
      metric: 'overall_performance',
      value: score,
      threshold: 80, // Target 80% passing metrics
      status,
      passed: score >= 80,
      recommendation: `Performance grade: ${grade} (${score.toFixed(1)}%)`,
    };

    return {
      overall,
      details,
      score,
      grade,
    };
  }

  generateK6Thresholds(): string[] {
    return [
      `http_req_duration[${this.thresholds.responseTime.acceptable}]`, // Response time under 1s
      `http_req_failed[${(this.thresholds.errorRate.acceptable * 100).toFixed(1)}%]`, // Error rate under 1%
      `http_reqs[${this.thresholds.throughput.good}]`, // Throughput above 50 req/s
    ];
  }

  getThresholdSummary(): string {
    return `
Load Test Thresholds Summary
============================

Response Time:
- Excellent: < ${this.thresholds.responseTime.excellent}ms
- Good: < ${this.thresholds.responseTime.good}ms
- Acceptable: < ${this.thresholds.responseTime.acceptable}ms
- Poor: < ${this.thresholds.responseTime.poor}ms
- Critical: >= ${this.thresholds.responseTime.critical}ms

Throughput:
- Minimal: ${this.thresholds.throughput.minimal} req/s
- Basic: ${this.thresholds.throughput.basic} req/s
- Good: ${this.thresholds.throughput.good} req/s
- Excellent: ${this.thresholds.throughput.excellent} req/s
- Exceptional: ${this.thresholds.throughput.exceptional} req/s

Error Rate:
- Excellent: < ${(this.thresholds.errorRate.excellent * 100).toFixed(2)}%
- Good: < ${(this.thresholds.errorRate.good * 100).toFixed(2)}%
- Acceptable: < ${(this.thresholds.errorRate.acceptable * 100).toFixed(2)}%
- Poor: < ${(this.thresholds.errorRate.poor * 100).toFixed(2)}%
- Critical: >= ${(this.thresholds.errorRate.critical * 100).toFixed(2)}%

Resource Usage:
- CPU: Good < ${this.thresholds.resourceUsage.cpu.good}%, Critical >= ${this.thresholds.resourceUsage.cpu.critical}%
- Memory: Good < ${this.thresholds.resourceUsage.memory.good}%, Critical >= ${this.thresholds.resourceUsage.memory.critical}%
- Disk: Good < ${this.thresholds.resourceUsage.disk.good}%, Critical >= ${this.thresholds.resourceUsage.disk.critical}%
`;
  }
}