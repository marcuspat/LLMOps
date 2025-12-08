/**
 * Main entry point for Turbo Flow Backend System with ML Integration
 * Initializes and starts the server with all core systems including ML pipeline
 */

import { TurboFlowServer } from './api/server.js';
import { config } from './config/index.js';
import { MLPipelineManager } from './ml/core/MLPipelineManager.js';
import { MLConfiguration } from './types/ml.js';
import { Logger } from 'winston';
import { MLTestSuite } from './ml/testing/MLTestSuite.js';
import { RealtimeInferenceService } from './ml/inference/RealtimeInferenceService.js';
import { MLEvaluationDashboard } from './ml/monitoring/MLEvaluationDashboard.js';

// Create logger
const logger = new Logger({
  level: config.environment === 'development' ? 'debug' : 'info',
  format: 'combined',
  transports: [
    new (require('winston').transports.Console)(),
    new (require('winston').transports.File)({ filename: 'logs/turbo-flow.log' })
  ]
});

async function main(): Promise<void> {
  console.log('🚀 Starting Turbo Flow Backend System with ML Integration...');
  console.log(`📋 Environment: ${config.environment}`);
  console.log(`🔧 Port: ${config.port}`);
  console.log('🤖 ML Pipeline: Enabled');

  try {
    // Initialize ML configuration
    const mlConfig: MLConfiguration = {
      models: {},
      experiments: {},
      datasets: {},
      pipelines: {},
      monitoring: {
        enabled: true,
        interval: 60000,
        metrics: ['accuracy', 'latency', 'throughput', 'error_rate'],
        alerts: [],
        retention: 86400000 // 24 hours
      },
      deployment: {
        environment: config.environment,
        replicas: config.environment === 'production' ? 3 : 1,
        autoscaling: {
          enabled: config.environment === 'production',
          minReplicas: 1,
          maxReplicas: 5,
          targetCpuUtilization: 70,
          targetMemoryUtilization: 80
        },
        loadBalancing: {
          algorithm: 'round_robin',
          healthCheck: true,
          stickySessions: false
        },
        healthCheck: {
          path: '/health',
          interval: 30000,
          timeout: 5000,
          retries: 3,
          successThreshold: 2
        }
      }
    };

    // Initialize ML components
    logger.info('🤖 Initializing ML Pipeline Manager...');
    const mlPipelineManager = new MLPipelineManager(mlConfig, logger);
    await mlPipelineManager.initialize();

    // Initialize ML test suite
    logger.info('🧪 Initializing ML Test Suite...');
    const mlTestSuite = new MLTestSuite({
      testCategories: [
        {
          name: 'unit',
          enabled: true,
          tests: [],
          dependencies: []
        },
        {
          name: 'integration',
          enabled: true,
          tests: [],
          dependencies: ['unit']
        },
        {
          name: 'performance',
          enabled: true,
          tests: [],
          dependencies: ['unit', 'integration']
        }
      ],
      testEnvironments: [
        {
          name: 'development',
          type: 'development',
          configuration: {},
          resources: { cpu: 2, memory: 4096, storage: 10240, network: 100 }
        }
      ],
      parallelExecution: true,
      timeout: 300000,
      retryPolicy: {
        enabled: true,
        maxRetries: 3,
        retryDelay: 1000,
        backoffMultiplier: 2
      },
      reporting: {
        formats: ['html', 'json'],
        destinations: [
          { type: 'file', config: { path: './test-results' } }
        ],
        templates: [],
        notifications: {
          onSuccess: false,
          onFailure: true,
          channels: ['console'],
          recipients: []
        }
      },
      benchmarks: {
        enabled: true,
        baseline: {},
        regression: 0.1,
        improvement: 0.05
      }
    }, logger);

    await mlTestSuite.initialize();

    // Initialize inference service
    logger.info('⚡ Initializing Real-time Inference Service...');
    const inferenceService = new RealtimeInferenceService({
      maxConcurrency: 10,
      batchSize: 32,
      batchTimeout: 100,
      cacheEnabled: true,
      cacheSize: 1000,
      cacheTTL: 300000,
      loadBalancingStrategy: 'least_loaded',
      monitoringEnabled: true,
      queueEnabled: true,
      maxQueueSize: 1000,
      priorityQueues: ['high', 'medium', 'low']
    }, logger);

    await inferenceService.initialize();

    // Initialize evaluation dashboard
    logger.info('📊 Initializing ML Evaluation Dashboard...');
    const evaluationDashboard = new MLEvaluationDashboard({
      refreshInterval: 30,
      metricsRetention: 7,
      alerting: {
        enabled: true,
        thresholds: {
          accuracy: { min: 0.8, max: 1.0 },
          latency: { min: 0, max: 5000 },
          errorRate: { min: 0, max: 0.05 },
          drift: { min: 0, max: 0.2 },
          resource: { cpu: 90, memory: 90 }
        },
        channels: [
          { type: 'console', enabled: true, config: {}, recipients: [] }
        ],
        cooldown: 300000
      },
      visualizations: {
        enabled: true,
        types: [
          { id: 'accuracy', name: 'Model Accuracy', type: 'line', dataSource: 'metrics', refreshRate: 60 },
          { id: 'latency', name: 'Inference Latency', type: 'line', dataSource: 'metrics', refreshRate: 30 },
          { id: 'throughput', name: 'Prediction Throughput', type: 'bar', dataSource: 'metrics', refreshRate: 60 }
        ],
        updateInterval: 30,
        exportFormats: ['png', 'svg']
      },
      reports: {
        enabled: true,
        schedule: [
          { type: 'daily', time: '09:00', recipients: [], template: 'daily_report' },
          { type: 'weekly', time: 'Monday 09:00', recipients: [], template: 'weekly_report' }
        ],
        formats: ['html', 'pdf'],
        distribution: {
          email: true,
          slack: false,
          webhook: false,
          storage: true
        }
      },
      performance: {
        enabled: true,
        benchmarking: true,
        comparison: true,
        trending: true,
        anomalyDetection: true
      }
    }, logger);

    await evaluationDashboard.initialize();

    // Create and start the server
    const server = new TurboFlowServer(config.port);

    // Set up graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 ${signal} received, shutting down gracefully...`);

      try {
        // Shutdown ML components first
        logger.info('🤖 Shutting down ML components...');
        await Promise.all([
          evaluationDashboard.shutdown(),
          inferenceService.shutdown(),
          mlTestSuite.shutdown(),
          mlPipelineManager.shutdown()
        ]);

        // Shutdown server
        await server.stop();

        console.log('✅ All systems shut down successfully');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Unhandled error handling
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      logger.error('Unhandled rejection:', { promise, reason });
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      logger.error('Uncaught exception:', error);
      process.exit(1);
    });

    // Start the server
    await server.start();

    // Run ML tests if in development or CI
    if (config.environment === 'development' || process.env.CI === 'true') {
      logger.info('🧪 Running ML test suite...');
      try {
        const testResults = await mlTestSuite.runTestSuite('startup-tests', 'development');
        logger.info(`✅ ML tests completed: ${testResults.passedTests}/${testResults.totalTests} passed`);
      } catch (error) {
        logger.error('❌ ML tests failed:', error);
        if (process.env.CI === 'true') {
          process.exit(1);
        }
      }
    }

    console.log('✅ Turbo Flow Backend System with ML Integration is running successfully');
    console.log('🤖 ML Pipeline: Active');
    console.log('⚡ Inference Service: Active');
    console.log('📊 Evaluation Dashboard: Active');
    console.log('🧪 Test Suite: Ready');

    // Set up periodic ML maintenance tasks
    setInterval(async () => {
      try {
        // Perform ML health checks
        const systemHealth = evaluationDashboard.getSystemHealth();
        if (systemHealth.status !== 'healthy') {
          logger.warn('ML system health issues detected:', systemHealth.issues);
        }

        // Clean up old ML artifacts
        await performMLMaintenance(mlPipelineManager);
      } catch (error) {
        logger.error('Error in periodic ML maintenance:', error);
      }
    }, 300000); // Every 5 minutes

  } catch (error) {
    console.error('❌ Failed to start Turbo Flow Backend System:', error);
    logger.error('Failed to start system:', error);
    process.exit(1);
  }
}

// ML maintenance tasks
async function performMLMaintenance(mlPipelineManager: MLPipelineManager): Promise<void> {
  // Clean up old models and experiments
  // Optimize caches
  // Update model metrics
  // Archive old data
}

// Start the application
if (require.main === module) {
  main();
}

export { TurboFlowServer };
export { MLPipelineManager };