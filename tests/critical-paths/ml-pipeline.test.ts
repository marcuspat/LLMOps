/**
 * ML Pipeline Training & Inference Critical Path Tests
 * Comprehensive testing for model training, inference, and resource management
 */

import { MLPipelineManager } from '../../src/ml/core/MLPipelineManager.js';
import { MLConfiguration, MLModel, ModelType, ModelStatus, TrainingConfig, PredictionRequest } from '../../src/types/ml.js';
import { EventEmitter } from 'events';

// Mock TensorFlow
jest.mock('@tensorflow/tfjs-node', () => ({
  setBackend: jest.fn().mockResolvedValue(true),
  ready: jest.fn().mockResolvedValue(true),
  tensor: jest.fn(),
  sequential: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({
      history: {
        loss: [0.5, 0.3, 0.1],
        accuracy: [0.8, 0.9, 0.95]
      }
    }),
    predict: jest.fn().mockResolvedValue([[0.8]]),
    save: jest.fn().mockResolvedValue(true),
    dispose: jest.fn()
  })),
  layers: {
    dense: jest.fn(),
    dropout: jest.fn(),
    conv2d: jest.fn(),
    maxPooling2d: jest.fn(),
    flatten: jest.fn()
  },
  data: {
    csv: jest.fn(),
    generator: jest.fn()
  },
  image: {
    decodeJpeg: jest.fn(),
    resizeBilinear: jest.fn()
  }
}));

// Mock Winston logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

describe('ML Pipeline Training & Inference - Critical Path Tests', () => {
  let mlPipeline: MLPipelineManager;
  let mlConfig: MLConfiguration;

  beforeEach(async () => {
    mlConfig = {
      modelsDirectory: './test-models',
      experimentsDirectory: './test-experiments',
      dataDirectory: './test-data',
      cacheDirectory: './test-cache',
      maxConcurrentTrainings: 3,
      maxModelMemoryMB: 2048,
      defaultTrainingConfig: {
        epochs: 10,
        batchSize: 32,
        validationSplit: 0.2,
        earlyStoppingPatience: 5,
        learningRate: 0.001
      },
      monitoring: {
        enabled: true,
        metricsInterval: 30000,
        alertThresholds: {
          trainingTimeMinutes: 60,
          inferenceLatencyMs: 1000,
          memoryUsageMB: 4096
        }
      },
      security: {
        modelEncryption: true,
        dataEncryption: true,
        accessControl: true,
        auditLogging: true
      }
    };

    // Create mock implementations for all components
    const mockComponents = {
      modelRegistry: {
        saveModel: jest.fn().mockResolvedValue(true),
        loadAllModels: jest.fn().mockResolvedValue([]),
        loadAllExperiments: jest.fn().mockResolvedValue([]),
        saveTrainedModel: jest.fn().mockResolvedValue(true),
        loadTrainedModel: jest.fn().mockResolvedValue({ predict: jest.fn() })
      },
      experimentTracker: {
        saveExperiment: jest.fn().mockResolvedValue(true),
        runExperiment: jest.fn().mockResolvedValue({ metrics: { accuracy: 0.95 } })
      },
      dataProcessor: {
        loadDataset: jest.fn().mockResolvedValue({
          data: [[1, 2], [3, 4]],
          labels: [0, 1],
          featureShape: [2]
        }),
        preprocess: jest.fn().mockResolvedValue({
          data: [[1, 2], [3, 4]],
          labels: [0, 1],
          testData: { data: [[1, 2]], labels: [0] },
          featureShape: [2]
        }),
        preprocessInput: jest.fn().mockResolvedValue([[1, 2]]),
        postprocessOutput: jest.fn().mockResolvedValue([[0.8]])
      },
      modelTrainer: {
        createModel: jest.fn().mockResolvedValue({ predict: jest.fn() }),
        train: jest.fn().mockResolvedValue({
          finalMetrics: { loss: 0.1, accuracy: 0.95 }
        }),
        predict: jest.fn().mockResolvedValue([[0.8]])
      },
      modelEvaluator: {
        evaluate: jest.fn().mockResolvedValue({
          accuracy: 0.95,
          loss: 0.1,
          precision: 0.93,
          recall: 0.97
        })
      },
      modelDeployer: {
        deploy: jest.fn().mockResolvedValue(true)
      },
      monitoringService: {
        start: jest.fn().mockResolvedValue(true),
        stop: jest.fn().mockResolvedValue(true),
        recordPrediction: jest.fn().mockResolvedValue(true),
        getModelMetrics: jest.fn().mockResolvedValue([
          { timestamp: new Date(), latency: 50, accuracy: 0.95 }
        ]),
        checkAllModels: jest.fn().mockResolvedValue(true),
        startModelMonitoring: jest.fn().mockResolvedValue(true)
      },
      cacheManager: {
        cacheModel: jest.fn().mockResolvedValue(true),
        getCachedModel: jest.fn().mockResolvedValue(null),
        clear: jest.fn().mockResolvedValue(true),
        cleanup: jest.fn().mockResolvedValue(true)
      }
    };

    mlPipeline = new MLPipelineManager(mlConfig, mockLogger as any);

    // Mock all component methods
    Object.assign(mlPipeline, mockComponents);

    await mlPipeline.initialize();
  });

  describe('Model Training', () => {
    describe('Training Process', () => {
      it('should start and complete model training successfully', async () => {
        const modelConfig = {
          name: 'Test Model',
          type: ModelType.NEURAL_NETWORK,
          metadata: {
            architecture: { layers: 2, units: 64 },
            dataset: { source: 'test-data.csv' }
          }
        };

        const trainingConfig: TrainingConfig = {
          epochs: 5,
          batchSize: 16,
          validationSplit: 0.2,
          learningRate: 0.001
        };

        const datasetPath = './test-dataset.csv';

        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

        expect(modelId).toBeDefined();
        expect(modelId).toMatch(/^model_/);

        // Wait a bit for async training to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        const model = mlPipeline.getModel(modelId);
        expect(model).toBeDefined();
        expect(model!.status).toBe(ModelStatus.READY);
      });

      it('should handle training failures gracefully', async () => {
        // Mock training failure
        const mockModelTrainer = {
          createModel: jest.fn().mockRejectedValue(new Error('Model creation failed')),
          train: jest.fn(),
          predict: jest.fn()
        };

        (mlPipeline as any).modelTrainer = mockModelTrainer;

        const modelConfig = {
          name: 'Failing Model',
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 5,
          batchSize: 16
        };

        const datasetPath = './nonexistent-dataset.csv';

        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

        expect(modelId).toBeDefined();

        // Wait for training to fail
        await new Promise(resolve => setTimeout(resolve, 100));

        const model = mlPipeline.getModel(modelId);
        expect(model).toBeDefined();
        expect(model!.status).toBe(ModelStatus.FAILED);
      });

      it('should enforce concurrent training limits', async () => {
        const trainingPromises = [];
        const maxConcurrent = mlConfig.maxConcurrentTrainings;

        // Start more trainings than allowed
        for (let i = 0; i < maxConcurrent + 3; i++) {
          const modelConfig = {
            name: `Concurrent Model ${i}`,
            type: ModelType.NEURAL_NETWORK
          };

          const trainingConfig: TrainingConfig = {
            epochs: 10,
            batchSize: 32
          };

          const promise = mlPipeline.trainModel(modelConfig, trainingConfig, `dataset${i}.csv`);
          trainingPromises.push(promise);
        }

        const modelIds = await Promise.all(trainingPromises);

        // All should return model IDs (queuing or immediate start)
        expect(modelIds).toHaveLength(maxConcurrent + 3);
        modelIds.forEach(id => expect(id).toBeDefined());

        // Check that only maxConcurrent are actively training
        const activeTrainings = (mlPipeline as any).activeTrainings;
        expect(activeTrainings.size).toBeLessThanOrEqual(maxConcurrent);
      });

      it('should handle training timeout scenarios', async () => {
        // Mock slow training
        const mockModelTrainer = {
          createModel: jest.fn().mockResolvedValue({}),
          train: jest.fn().mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 20000)) // 20 second delay
          ),
          predict: jest.fn()
        };

        (mlPipeline as any).modelTrainer = mockModelTrainer;

        const modelConfig = {
          name: 'Timeout Model',
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 100, // Large number to trigger timeout
          batchSize: 32
        };

        const datasetPath = './large-dataset.csv';

        const startTime = Date.now();
        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);
        const duration = Date.now() - startTime;

        expect(modelId).toBeDefined();
        expect(duration).toBeLessThan(5000); // Should start quickly, not wait for full training
      });
    });

    describe('Resource Management During Training', () => {
      it('should monitor memory usage during training', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        const modelConfig = {
          name: 'Memory Test Model',
          type: ModelType.NEURAL_NETWORK,
          metadata: {
            architecture: { layers: 10, units: 512 } // Large model
          }
        };

        const trainingConfig: TrainingConfig = {
          epochs: 3,
          batchSize: 64
        };

        const datasetPath = './large-dataset.csv';

        await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

        // Wait a bit for training to progress
        await new Promise(resolve => setTimeout(resolve, 100));

        const currentMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = currentMemory - initialMemory;

        // Memory increase should be reasonable
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      });

      it('should handle GPU memory constraints', async () => {
        // Mock GPU memory constraint
        const mockModelTrainer = {
          createModel: jest.fn().mockImplementation(() => {
            // Simulate GPU memory check
            const mockError = new Error('GPU memory limit exceeded');
            (mockError as any).code = 'CUDA_OUT_OF_MEMORY';
            throw mockError;
          }),
          train: jest.fn(),
          predict: jest.fn()
        };

        (mlPipeline as any).modelTrainer = mockModelTrainer;

        const modelConfig = {
          name: 'GPU Memory Model',
          type: ModelType.NEURAL_NETWORK,
          metadata: {
            architecture: { layers: 50, units: 1024 } // Very large model
          }
        };

        const trainingConfig: TrainingConfig = {
          epochs: 10,
          batchSize: 128
        };

        const datasetPath = './very-large-dataset.csv';

        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

        expect(modelId).toBeDefined();

        // Wait for training to fail
        await new Promise(resolve => setTimeout(resolve, 100));

        const model = mlPipeline.getModel(modelId);
        expect(model!.status).toBe(ModelStatus.FAILED);
      });
    });

    describe('Training Data Validation', () => {
      it('should validate dataset format and quality', async () => {
        // Mock invalid dataset
        const mockDataProcessor = {
          loadDataset: jest.fn().mockRejectedValue(new Error('Invalid dataset format')),
          preprocess: jest.fn(),
          preprocessInput: jest.fn(),
          postprocessOutput: jest.fn()
        };

        (mlPipeline as any).dataProcessor = mockDataProcessor;

        const modelConfig = {
          name: 'Invalid Data Model',
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 5,
          batchSize: 32
        };

        const invalidDatasetPath = './invalid-format.txt';

        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, invalidDatasetPath);

        expect(modelId).toBeDefined();

        // Wait for training to fail
        await new Promise(resolve => setTimeout(resolve, 100));

        const model = mlPipeline.getModel(modelId);
        expect(model!.status).toBe(ModelStatus.FAILED);
      });

      it('should handle empty datasets', async () => {
        // Mock empty dataset
        const mockDataProcessor = {
          loadDataset: jest.fn().mockResolvedValue({
            data: [],
            labels: [],
            featureShape: [0]
          }),
          preprocess: jest.fn().mockResolvedValue({
            data: [],
            labels: [],
            testData: { data: [], labels: [] },
            featureShape: [0]
          }),
          preprocessInput: jest.fn(),
          postprocessOutput: jest.fn()
        };

        (mlPipeline as any).dataProcessor = mockDataProcessor;

        const modelConfig = {
          name: 'Empty Data Model',
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 5,
          batchSize: 32
        };

        const emptyDatasetPath = './empty-dataset.csv';

        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, emptyDatasetPath);

        expect(modelId).toBeDefined();

        // Wait for training to handle empty data
        await new Promise(resolve => setTimeout(resolve, 100));

        const model = mlPipeline.getModel(modelId);
        expect(model!.status).toBe(ModelStatus.FAILED);
      });
    });
  });

  describe('Model Inference', () => {
    describe('Prediction Process', () => {
      it('should make predictions with trained models', async () => {
        // First, create and train a model
        const modelConfig = {
          name: 'Inference Test Model',
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 1,
          batchSize: 32
        };

        const datasetPath = './test-dataset.csv';

        const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

        // Deploy the model
        await mlPipeline.deployModel(modelId);

        // Make prediction
        const predictionRequest: PredictionRequest = {
          modelId,
          input: [1, 2, 3, 4],
          preprocessor: 'standard',
          postprocessor: 'sigmoid'
        };

        const result = await mlPipeline.predict(predictionRequest);

        expect(result).toBeDefined();
        expect(result.prediction).toBeDefined();
        expect(result.latency).toBeGreaterThan(0);
        expect(result.metadata.modelId).toBe(modelId);
        expect(result.metadata.timestamp).toBeInstanceOf(Date);
      });

      it('should handle inference timeout scenarios', async () => {
        // Mock slow prediction
        const mockModelTrainer = {
          predict: jest.fn().mockImplementation(() =>
            new Promise(resolve => setTimeout(resolve, 5000)) // 5 second delay
          )
        };

        (mlPipeline as any).modelTrainer = mockModelTrainer;

        const predictionRequest: PredictionRequest = {
          modelId: 'test-model-id',
          input: [1, 2, 3, 4]
        };

        const startTime = Date.now();
        const result = await mlPipeline.predict(predictionRequest);
        const duration = Date.now() - startTime;

        expect(result).toBeDefined();
        expect(duration).toBeGreaterThan(5000); // Should wait for prediction to complete
      });

      it('should validate input data for predictions', async () => {
        const predictionRequest: PredictionRequest = {
          modelId: 'test-model-id',
          input: null as any // Invalid input
        };

        await expect(mlPipeline.predict(predictionRequest)).rejects.toThrow();
      });

      it('should handle batch predictions efficiently', async () => {
        const predictionRequests: PredictionRequest[] = Array.from({ length: 100 }, (_, i) => ({
          modelId: 'test-model-id',
          input: [i, i + 1, i + 2, i + 3]
        }));

        const startTime = Date.now();

        const results = await Promise.all(
          predictionRequests.map(req => mlPipeline.predict(req))
        );

        const duration = Date.now() - startTime;

        expect(results).toHaveLength(100);
        expect(results.every(r => r.prediction !== undefined)).toBe(true);
        expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      });
    });

    describe('Model State Management', () => {
      it('should reject predictions for untrained models', async () => {
        // Create model without training
        const untrainedModel: MLModel = {
          id: 'untrained-model',
          name: 'Untrained Model',
          type: ModelType.NEURAL_NETWORK,
          version: '1.0.0',
          status: ModelStatus.INITIALIZING,
          metadata: {},
          performance: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        (mlPipeline as any).models.set('untrained-model', untrainedModel);

        const predictionRequest: PredictionRequest = {
          modelId: 'untrained-model',
          input: [1, 2, 3, 4]
        };

        await expect(mlPipeline.predict(predictionRequest)).rejects.toThrow(
          'not ready for prediction'
        );
      });

      it('should handle model corruption during inference', async () => {
        // Mock corrupted model
        const mockModelTrainer = {
          predict: jest.fn().mockRejectedValue(new Error('Model file corrupted'))
        };

        (mlPipeline as any).modelTrainer = mockModelTrainer;

        const predictionRequest: PredictionRequest = {
          modelId: 'corrupted-model',
          input: [1, 2, 3, 4]
        };

        await expect(mlPipeline.predict(predictionRequest)).rejects.toThrow(
          'Model file corrupted'
        );
      });

      it('should cache loaded models for efficient inference', async () => {
        const predictionRequest: PredictionRequest = {
          modelId: 'cached-model',
          input: [1, 2, 3, 4]
        };

        // Mock cache manager to track cache calls
        const mockCacheManager = {
          getCachedModel: jest.fn().mockResolvedValue(null).mockResolvedValueOnce(null),
          cacheModel: jest.fn().mockResolvedValue(true)
        };

        (mlPipeline as any).cacheManager = mockCacheManager;

        // First prediction should load model and cache it
        await mlPipeline.predict(predictionRequest);

        expect(mockCacheManager.getCachedModel).toHaveBeenCalledTimes(1);
        expect(mockCacheManager.cacheModel).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Model Deployment', () => {
    it('should deploy models to production', async () => {
      // First, create and train a model
      const modelConfig = {
        name: 'Deployment Test Model',
        type: ModelType.NEURAL_NETWORK
      };

      const trainingConfig: TrainingConfig = {
        epochs: 1,
        batchSize: 32
      };

      const datasetPath = './test-dataset.csv';

      const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

      // Deploy the model
      await mlPipeline.deployModel(modelId);

      const model = mlPipeline.getModel(modelId);
      expect(model!.status).toBe(ModelStatus.DEPLOYED);
    });

    it('should reject deployment of untrained models', async () => {
      const untrainedModelId = 'untrained-model';

      await expect(mlPipeline.deployModel(untrainedModelId)).rejects.toThrow(
        'not ready for deployment'
      );
    });

    it('should handle deployment configuration', async () => {
      const modelConfig = {
        name: 'Config Deployment Model',
        type: ModelType.NEURAL_NETWORK
      };

      const trainingConfig: TrainingConfig = {
        epochs: 1,
        batchSize: 32
      };

      const datasetPath = './test-dataset.csv';

      const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

      const deploymentConfig = {
        environment: 'production',
        scaling: {
          minInstances: 1,
          maxInstances: 5,
          targetCpuUtilization: 70
        },
        resources: {
          memory: '2Gi',
          cpu: '1000m'
        }
      };

      await mlPipeline.deployModel(modelId, deploymentConfig);

      // Verify deployment config was used
      const mockDeployer = (mlPipeline as any).modelDeployer;
      expect(mockDeployer.deploy).toHaveBeenCalledWith(modelId, deploymentConfig);
    });
  });

  describe('Experiment Management', () => {
    it('should create and run experiments', async () => {
      const experimentId = await mlPipeline.runExperiment(
        'Test Experiment',
        'Testing experiment functionality',
        {
          algorithm: 'random_forest',
          parameters: {
            n_estimators: 100,
            max_depth: 10
          },
          dataset: 'test-dataset.csv'
        }
      );

      expect(experimentId).toBeDefined();
      expect(experimentId).toMatch(/^experiment_/);

      // Wait for experiment to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const experiment = mlPipeline.getExperiment(experimentId);
      expect(experiment).toBeDefined();
      expect(experiment!.name).toBe('Test Experiment');
    });

    it('should handle experiment failures gracefully', async () => {
      // Mock experiment failure
      const mockExperimentTracker = {
        saveExperiment: jest.fn().mockResolvedValue(true),
        runExperiment: jest.fn().mockRejectedValue(new Error('Experiment configuration error'))
      };

      (mlPipeline as any).experimentTracker = mockExperimentTracker;

      const experimentId = await mlPipeline.runExperiment(
        'Failing Experiment',
        'Testing experiment failure handling',
        { invalidConfig: true }
      );

      expect(experimentId).toBeDefined();

      // Wait for experiment to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      const experiment = mlPipeline.getExperiment(experimentId);
      expect(experiment!.status).toBe('failed');
    });
  });

  describe('Security Tests', () => {
    it('should prevent model poisoning attacks', async () => {
      // Mock malicious dataset with poisoned data
      const mockDataProcessor = {
        loadDataset: jest.fn().mockResolvedValue({
          data: [[1, 2], [999999, 888888], [3, 4]], // Poisoned data point
          labels: [0, 1, 0],
          featureShape: [2]
        }),
        preprocess: jest.fn().mockImplementation((dataset) => {
          // Detect and flag suspicious data points
          const suspiciousPoints = dataset.data.filter((row: number[]) =>
            row.some(val => Math.abs(val) > 10000)
          );

          if (suspiciousPoints.length > 0) {
            throw new Error('Potential data poisoning detected');
          }

          return {
            data: dataset.data,
            labels: dataset.labels,
            testData: { data: [[1, 2]], labels: [0] },
            featureShape: [2]
          };
        }),
        preprocessInput: jest.fn(),
        postprocessOutput: jest.fn()
      };

      (mlPipeline as any).dataProcessor = mockDataProcessor;

      const modelConfig = {
        name: 'Security Test Model',
        type: ModelType.NEURAL_NETWORK
      };

      const trainingConfig: TrainingConfig = {
        epochs: 5,
        batchSize: 32
      };

      const poisonedDatasetPath = './potentially-poisoned-dataset.csv';

      const modelId = await mlPipeline.trainModel(modelConfig, trainingConfig, poisonedDatasetPath);

      expect(modelId).toBeDefined();

      // Wait for training to fail due to poisoning detection
      await new Promise(resolve => setTimeout(resolve, 100));

      const model = mlPipeline.getModel(modelId);
      expect(model!.status).toBe(ModelStatus.FAILED);
    });

    it('should handle adversarial input attacks', async () => {
      // Mock adversarial input detection
      const mockModelTrainer = {
        predict: jest.fn().mockImplementation((model, input) => {
          // Detect adversarial patterns
          const inputArray = Array.isArray(input) ? input : [input];
          const hasAdversarialPattern = inputArray.some((val: number) =>
            !isFinite(val) || Math.abs(val) > 1000
          );

          if (hasAdversarialPattern) {
            throw new Error('Potential adversarial input detected');
          }

          return [[0.8]];
        }),
        createModel: jest.fn(),
        train: jest.fn()
      };

      (mlPipeline as any).modelTrainer = mockModelTrainer;

      const predictionRequest: PredictionRequest = {
        modelId: 'test-model',
        input: [Infinity, -Infinity, NaN, 1e10] // Adversarial input
      };

      await expect(mlPipeline.predict(predictionRequest)).rejects.toThrow(
        'Potential adversarial input detected'
      );
    });

    it('should protect against resource exhaustion attacks', async () => {
      // Mock resource usage monitoring
      const mockMonitoringService = {
        start: jest.fn().mockResolvedValue(true),
        stop: jest.fn().mockResolvedValue(true),
        recordPrediction: jest.fn().mockImplementation((modelId, latency) => {
          // Detect unusually high resource usage
          if (latency > 10000) { // 10 seconds
            throw new Error('Resource usage threshold exceeded');
          }
          return true;
        }),
        getModelMetrics: jest.fn().mockResolvedValue([]),
        checkAllModels: jest.fn().mockResolvedValue(true),
        startModelMonitoring: jest.fn().mockResolvedValue(true)
      };

      (mlPipeline as any).monitoringService = mockMonitoringService;

      // Mock slow prediction to trigger resource protection
      const mockModelTrainer = {
        predict: jest.fn().mockImplementation(() => {
          return new Promise(resolve => {
            setTimeout(() => resolve([[0.8]]), 15000); // 15 second prediction
          });
        }),
        createModel: jest.fn(),
        train: jest.fn()
      };

      (mlPipeline as any).modelTrainer = mockModelTrainer;

      const predictionRequest: PredictionRequest = {
        modelId: 'test-model',
        input: [1, 2, 3, 4]
      };

      await expect(mlPipeline.predict(predictionRequest)).rejects.toThrow(
        'Resource usage threshold exceeded'
      );
    });
  });

  describe('Performance Tests', () => {
    it('should handle high-volume prediction requests', async () => {
      const predictionRequests: PredictionRequest[] = Array.from({ length: 1000 }, (_, i) => ({
        modelId: 'test-model',
        input: [i % 10, (i + 1) % 10, (i + 2) % 10, (i + 3) % 10]
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        predictionRequests.map(req => mlPipeline.predict(req))
      );

      const duration = Date.now() - startTime;
      const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;

      expect(results).toHaveLength(1000);
      expect(avgLatency).toBeLessThan(100); // Average latency should be < 100ms
      expect(duration).toBeLessThan(60000); // Total time should be < 60 seconds
    });

    it('should maintain memory efficiency during operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple operations
      for (let i = 0; i < 50; i++) {
        const modelConfig = {
          name: `Memory Test Model ${i}`,
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 1,
          batchSize: 16
        };

        const datasetPath = `dataset${i}.csv`;

        await mlPipeline.trainModel(modelConfig, trainingConfig, datasetPath);

        const predictionRequest: PredictionRequest = {
          modelId: `model-${i}`,
          input: [1, 2, 3, 4]
        };

        try {
          await mlPipeline.predict(predictionRequest);
        } catch (error) {
          // Expected for non-existent models
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
    });

    it('should handle concurrent training and inference', async () => {
      const trainingPromises = [];
      const inferencePromises = [];

      // Start multiple trainings
      for (let i = 0; i < 3; i++) {
        const modelConfig = {
          name: `Concurrent Training Model ${i}`,
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 2,
          batchSize: 16
        };

        const trainingPromise = mlPipeline.trainModel(modelConfig, trainingConfig, `dataset${i}.csv`);
        trainingPromises.push(trainingPromise);
      }

      // Start multiple inferences
      for (let i = 0; i < 10; i++) {
        const predictionRequest: PredictionRequest = {
          modelId: 'existing-model',
          input: [i, i + 1, i + 2, i + 3]
        };

        const inferencePromise = mlPipeline.predict(predictionRequest);
        inferencePromises.push(inferencePromise);
      }

      const startTime = Date.now();

      const results = await Promise.allSettled([
        ...trainingPromises,
        ...inferencePromises
      ]);

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(13);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle TensorFlow initialization failures', async () => {
      // Mock TensorFlow initialization failure
      const tf = require('@tensorflow/tfjs-node');
      tf.setBackend.mockRejectedValue(new Error('TensorFlow initialization failed'));

      const newPipeline = new MLPipelineManager(mlConfig, mockLogger as any);

      await expect(newPipeline.initialize()).rejects.toThrow(
        'TensorFlow initialization failed'
      );
    });

    it('should handle component initialization failures', async () => {
      // Mock component initialization failure
      const mockFailingComponent = {
        initialize: jest.fn().mockRejectedValue(new Error('Component initialization failed'))
      };

      const newPipeline = new MLPipelineManager(mlConfig, mockLogger as any);
      (newPipeline as any).modelRegistry = mockFailingComponent;

      await expect(newPipeline.initialize()).rejects.toThrow();
    });

    it('should cleanup resources on shutdown', async () => {
      // Add some active trainings
      for (let i = 0; i < 2; i++) {
        const modelConfig = {
          name: `Shutdown Test Model ${i}`,
          type: ModelType.NEURAL_NETWORK
        };

        const trainingConfig: TrainingConfig = {
          epochs: 10,
          batchSize: 32
        };

        await mlPipeline.trainModel(modelConfig, trainingConfig, `dataset${i}.csv`);
      }

      await mlPipeline.shutdown();

      // Verify cleanup methods were called
      const mockMonitoringService = (mlPipeline as any).monitoringService;
      const mockCacheManager = (mlPipeline as any).cacheManager;

      expect(mockMonitoringService.stop).toHaveBeenCalled();
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });
  });
});