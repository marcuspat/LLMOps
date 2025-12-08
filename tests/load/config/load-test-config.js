/**
 * Load Test Configuration
 * Defines parameters and scenarios for load testing
 */

export class LoadTestConfig {
  constructor() {
    this.baseURL = 'http://localhost:3000/api';
    this.testSwarmId = 'load-test-swarm';
    this.testEnvironment = 'staging';
    this.apiVersion = 'v1';

    // Load test specific settings
    this.rpsLimit = 100; // requests per second
    this.maxDuration = '30m';
    this.thinkTime = 1; // seconds between requests
    this.concurrentUsers = 50;

    // Test data
    this.testSwarms = ['swarm-1', 'swarm-2', 'swarm-3'];
    this.testUsers = [];
  }

  getStages() {
    return [
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
    ];
  }

  getThresholds() {
    return {
      http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
      http_req_failed: ['rate<0.05'],     // Error rate under 5%
      http_reqs: ['rate>10'],             // Minimum 10 requests per second
      task_creation_duration: ['p(90)<1500'], // Task creation under 1.5s (90th percentile)
      swarm_creation_duration: ['p(90)<3000'], // Swarm creation under 3s (90th percentile)
      api_response_duration: ['p(95)<1000'],   // API responses under 1s (95th percentile)
      active_users: ['rate>0.8'],        // At least 80% of users should be active
      system_throughput: ['count>1000'],  // Minimum 1000 operations
    };
  }

  getRPSLimit() {
    return this.rpsLimit;
  }

  getThinkTime() {
    // Return random think time between 0.5 and 2 seconds
    return Math.random() * 1.5 + 0.5;
  }

  getAPIBaseURL() {
    return this.baseURL;
  }

  getTestSwarmId() {
    const swarmIndex = Math.floor(Math.random() * this.testSwarms.length);
    return this.testSwarms[swarmIndex];
  }

  getRandomSwarmId() {
    return this.getTestSwarmId();
  }

  selectWorkflow(vuId) {
    // Distribute VUs across different workflows
    const workflows = ['swarm_creation', 'task_submission', 'mixed_operations'];
    const index = vuId % workflows.length;
    return workflows[index];
  }

  // Environment-specific configuration
  getEnvironmentConfig() {
    const configs = {
      development: {
        baseURL: 'http://localhost:3000/api',
        rpsLimit: 50,
        thinkTime: 2,
        thresholds: this.getDevelopmentThresholds(),
      },
      staging: {
        baseURL: 'https://staging-api.turboflow.dev/api',
        rpsLimit: 200,
        thinkTime: 1,
        thresholds: this.getStagingThresholds(),
      },
      production: {
        baseURL: 'https://api.turboflow.dev/api',
        rpsLimit: 500,
        thinkTime: 0.5,
        thresholds: this.getProductionThresholds(),
      },
    };

    return configs[this.testEnvironment] || configs.development;
  }

  getDevelopmentThresholds() {
    return {
      http_req_duration: ['p(95)<5000'], // More lenient for dev
      http_req_failed: ['rate<0.1'],     // Allow more errors in dev
      task_creation_duration: ['p(90)<3000'],
      swarm_creation_duration: ['p(90)<5000'],
    };
  }

  getStagingThresholds() {
    return {
      http_req_duration: ['p(95)<2000'], // Standard thresholds
      http_req_failed: ['rate<0.05'],
      task_creation_duration: ['p(90)<1500'],
      swarm_creation_duration: ['p(90)<3000'],
    };
  }

  getProductionThresholds() {
    return {
      http_req_duration: ['p(95)<1000'], // Strict thresholds for prod
      http_req_failed: ['rate<0.01'],     // Only 1% errors allowed
      task_creation_duration: ['p(90)<1000'],
      swarm_creation_duration: ['p(90)<2000'],
    };
  }

  // Test data management
  generateTestData(count = 100) {
    const testUsers = [];
    const testSwarms = [];
    const testTasks = [];

    for (let i = 0; i < count; i++) {
      testUsers.push({
        id: `user-${i}`,
        email: `testuser${i}@turboflow.test`,
        name: `Test User ${i}`,
        role: i % 5 === 0 ? 'admin' : 'user',
      });

      testSwarms.push({
        id: `swarm-${i}`,
        name: `Test Swarm ${i}`,
        topology: ['MESH', 'HIERARCHICAL', 'RING'][i % 3],
        agentCount: (i % 10) + 1,
      });

      testTasks.push({
        id: `task-${i}`,
        name: `Test Task ${i}`,
        type: ['CODE_GENERATION', 'TESTING', 'DOCUMENTATION'][i % 3],
        priority: ['LOW', 'MEDIUM', 'HIGH'][i % 3],
      });
    }

    return {
      users: testUsers,
      swarms: testSwarms,
      tasks: testTasks,
    };
  }

  // Performance benchmarks
  getPerformanceBenchmarks() {
    return {
      // Response time benchmarks (milliseconds)
      responseTime: {
        excellent: 100,
        good: 500,
        acceptable: 1000,
        poor: 2000,
        critical: 5000,
      },

      // Throughput benchmarks (requests per second)
      throughput: {
        minimal: 10,
        basic: 50,
        good: 100,
        excellent: 200,
        exceptional: 500,
      },

      // Error rate benchmarks (percentage)
      errorRate: {
        excellent: 0.1,
        good: 0.5,
        acceptable: 1.0,
        poor: 5.0,
        critical: 10.0,
      },

      // Resource usage benchmarks (percentage)
      resourceUsage: {
        cpu: {
          good: 50,
          acceptable: 75,
          poor: 90,
          critical: 95,
        },
        memory: {
          good: 60,
          acceptable: 80,
          poor: 90,
          critical: 95,
        },
      },
    };
  }

  // Custom scenarios
  getCustomScenario(name) {
    const scenarios = {
      'mobile_users': {
        userAgent: 'TurboFlow-Mobile/1.0',
        thinkTime: 2,
        timeout: '30s',
        stages: [
          { duration: '2m', target: 20 },
          { duration: '5m', target: 40 },
          { duration: '3m', target: 0 },
        ],
      },
      'api_clients': {
        userAgent: 'TurboFlow-API/1.0',
        thinkTime: 0.1,
        timeout: '10s',
        stages: [
          { duration: '1m', target: 100 },
          { duration: '8m', target: 200 },
          { duration: '1m', target: 0 },
        ],
      },
      'desktop_users': {
        userAgent: 'TurboFlow-Desktop/1.0',
        thinkTime: 3,
        timeout: '60s',
        stages: [
          { duration: '3m', target: 10 },
          { duration: '12m', target: 25 },
          { duration: '5m', target: 0 },
        ],
      },
    };

    return scenarios[name] || null;
  }

  // Monitoring and alerting thresholds
  getMonitoringThresholds() {
    return {
      alerts: {
        responseTime: {
          warning: 2000, // 2 seconds
          critical: 5000, // 5 seconds
        },
        errorRate: {
          warning: 0.05, // 5%
          critical: 0.10, // 10%
        },
        throughput: {
          warning: 10, // requests per second
          critical: 5,  // requests per second
        },
        resourceUsage: {
          cpu: {
            warning: 75, // percentage
            critical: 90,
          },
          memory: {
            warning: 80, // percentage
            critical: 95,
          },
        },
      },
    };
  }

  // Export configuration for use in test reports
  exportConfig() {
    return {
      testEnvironment: this.testEnvironment,
      baseURL: this.baseURL,
      stages: this.getStages(),
      thresholds: this.getThresholds(),
      rpsLimit: this.rpsLimit,
      performanceBenchmarks: this.getPerformanceBenchmarks(),
      monitoringThresholds: this.getMonitoringThresholds(),
      timestamp: new Date().toISOString(),
    };
  }
}