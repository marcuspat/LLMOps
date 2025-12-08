import { MLPipelineManager } from '../../src/ml/core/MLPipelineManager.js';
import { MLConfiguration, ModelType, ModelStatus, MLPipelineEventType } from '../../src/types/ml.js';
import { Logger } from 'winston';

// Mock dependencies
jest.mock('@tensorflow/tfjs-node', () => ({
  setBackend: jest.fn().mockResolvedValue(undefined),
  ready: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../src/ml/core/ModelRegistry.js');
jest.mock('../../src/ml/core/ExperimentTracker.js');
jest.mock('../../src/ml/core/DataProcessor.js');
jest.mock('../../src/ml/core/ModelTrainer.js');
jest.mock('../../src/ml/core/ModelEvaluator.js');
jest.mock('../../src/ml/core/ModelDeployer.js');
jest.mock('../../src/ml/core/MonitoringService.js');
jest.mock('../../src/ml/core/CacheManager.js');

// Mock console methods
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();

describe('MLPipelineManager - Comprehensive ML Pipeline Tests', () => {
  let mlManager: MLPipelineManager;
  let mockLogger: jest.Mocked<Logger>;
  let mockConfig: MLConfiguration;
  let mockModelRegistry: any;
  let mockExperimentTracker: any;
  let mockDataProcessor: any;
  let mockModelTrainer: any;
  let mockModelEvaluator: any;
  let mockModelDeployer: any;
  let mockMonitoringService: any;
  let mockCacheManager: any;

  beforeEach(() => {
    // Setup mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    } as any;

    // Setup mock configuration
    mockConfig = {
      modelRegistry: {
        storagePath: '/tmp/models',
        maxModels: 100
      },
      training: {
        maxConcurrentTrainings: 5,
        defaultEpochs: 100,
        batchSize: 32
      },
      deployment: {
        defaultDeploymentConfig: {},
        monitoringEnabled: true
      },
      monitoring: {
        metricsRetentionDays: 30,
        alertThresholds: {
          predictionLatency: 1000,
          errorRate: 0.05
        }
      },
      cache: {
        maxSize: '1GB',
        ttl: 3600000
      }
    };

    // Create ML Pipeline Manager
    mlManager = new MLPipelineManager(mockConfig, mockLogger);

    // Get mocked components for easier configuration
    mockModelRegistry = (mlManager as any).modelRegistry;
    mockExperimentTracker = (mlManager as any).experimentTracker;
    mockDataProcessor = (mlManager as any).dataProcessor;
    mockModelTrainer = (mlManager as any).modelTrainer;
    mockModelEvaluator = (mlManager as any).modelEvaluator;
    mockModelDeployer = (mlManager as any).modelDeployer;
    mockMonitoringService = (mlManager as any).monitoringService;
    mockCacheManager = (mlManager as any).cacheManager;

    // Setup default mock implementations
    setupDefaultMocks();
  });

  afterEach(async () => {
    if (mlManager) {
      await mlManager.shutdown();
    }
    jest.clearAllMocks();
  });

  function setupDefaultMocks() {
    mockModelRegistry.loadAllModels.mockResolvedValue([]);
    mockModelRegistry.loadAllExperiments.mockResolvedValue([]);
    mockModelRegistry.saveModel.mockResolvedValue(undefined);
    mockModelRegistry.saveTrainedModel.mockResolvedValue(undefined);
    mockModelRegistry.loadTrainedModel.mockResolvedValue({ predict: jest.fn() });

    mockExperimentTracker.loadAllExperiments.mockResolvedValue([]);
    mockExperimentTracker.saveExperiment.mockResolvedValue(undefined);
    mockExperimentTracker.runExperiment.mockResolvedValue({ metrics: { accuracy: 0.95 } });

    mockDataProcessor.loadDataset.mockResolvedValue({
      features: [[1, 2, 3]],
      labels: [[0]],
      testData: { features: [[4, 5, 6]], labels: [[1]] }
    });
    mockDataProcessor.preprocess.mockResolvedValue({
      trainData: { features: [[1, 2, 3]], labels: [[0]] },
      testData: { features: [[4, 5, 6]], labels: [[1]] },
      featureShape: [3]
    });
    mockDataProcessor.preprocessInput.mockResolvedValue([[1, 2, 3]]);
    mockDataProcessor.postprocessOutput.mockResolvedValue({ prediction: 0.85 });

    mockModelTrainer.createModel.mockResolvedValue({ predict: jest.fn(), fit: jest.fn() });
    mockModelTrainer.train.mockResolvedValue({
      finalMetrics: { loss: 0.1, accuracy: 0.95, val_accuracy: 0.92 }
    });
    mockModelTrainer.predict.mockResolvedValue([[0.85]]);

    mockModelEvaluator.evaluate.mockResolvedValue({
      accuracy: 0.95,
      loss: 0.1,
      precision: 0.93,
      recall: 0.94,
      f1Score: 0.935
    });

    mockModelDeployer.deploy.mockResolvedValue(undefined);

    mockMonitoringService.start.mockResolvedValue(undefined);
    mockMonitoringService.stop.mockResolvedValue(undefined);
    mockMonitoringService.startModelMonitoring.mockResolvedValue(undefined);
    mockMonitoringService.recordPrediction.mockResolvedValue(undefined);
    mockMonitoringService.getModelMetrics.mockResolvedValue([
      { timestamp: new Date(), latency: 150, accuracy: 0.95 }
    ]);
    mockMonitoringService.checkAllModels.mockResolvedValue(undefined);

    mockCacheManager.cacheModel.mockResolvedValue(undefined);
    mockCacheManager.getCachedModel.mockResolvedValue(null);
    mockCacheManager.clear.mockResolvedValue(undefined);
    mockCacheManager.cleanup.mockResolvedValue(undefined);
  }

  describe('ML Pipeline Manager Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(mlManager.initialize()).resolves.not.toThrow();

      expect(mockModelRegistry.loadAllModels).toHaveBeenCalled();
      expect(mockModelRegistry.loadAllExperiments).toHaveBeenCalled();
      expect(mockMonitoringService.start).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockModelRegistry.loadAllModels.mockRejectedValue(new Error('Failed to load models'));

      await expect(mlManager.initialize()).rejects.toThrow('Failed to load models');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to initialize ML Pipeline Manager:',
        expect.any(Error)
      );
    });

    it('should emit initialization event on successful startup', async () => {
      const eventSpy = jest.fn();
      mlManager.on('initialized', eventSpy);

      await mlManager.initialize();

      expect(eventSpy).toHaveBeenCalledWith({ timestamp: expect.any(Date) });
    });

    it('should load existing artifacts during initialization', async () => {
      const mockModels = [
        {
          id: 'model-1',
          name: 'Test Model',
          type: ModelType.NEURAL_NETWORK,
          status: ModelStatus.READY
        }
      ];
      const mockExperiments = [
        {
          id: 'exp-1',
          name: 'Test Experiment',
          status: 'completed'
        }
      ];

      mockModelRegistry.loadAllModels.mockResolvedValue(mockModels);
      mockExperimentTracker.loadAllExperiments.mockResolvedValue(mockExperiments);

      await mlManager.initialize();

      expect(mlManager.listModels()).toHaveLength(1);
      expect(mlManager.listExperiments()).toHaveLength(1);
      expect(mlManager.getModel('model-1')).toEqual(mockModels[0]);
      expect(mlManager.getExperiment('exp-1')).toEqual(mockExperiments[0]);
    });
  });

  describe('Model Training', () => {
    beforeEach(async () => {
      await mlManager.initialize();
    });

    it('should start model training successfully', async () => {
      const modelConfig = {
        name: 'Test Model',
        type: ModelType.NEURAL_NETWORK,
        metadata: { architecture: { layers: 3 } }
      };
      const trainingConfig = {
        epochs: 50,
        batchSize: 16,
        learningRate: 0.001
      };

      const modelId = await mlManager.trainModel(modelConfig, trainingConfig, '/path/to/dataset');

      expect(modelId).toBeDefined();
      expect(modelId).toMatch(/^model_\d+_[a-z0-9]+$/);

      const model = mlManager.getModel(modelId);
      expect(model).toBeDefined();
      expect(model?.name).toBe('Test Model');
      expect(model?.status).toBe(ModelStatus.INITIALIZING);

      expect(mockModelRegistry.saveModel).toHaveBeenCalledWith(
        expect.objectContaining({
          id: modelId,
          name: 'Test Model',
          type: ModelType.NEURAL_NETWORK
        })
      );
    });

    it('should handle training process execution', async () => {
      const modelConfig = { name: 'Training Test Model' };
      const trainingConfig = { epochs: 10 };

      const modelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      // Wait for training to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const model = mlManager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.READY);
      expect(model?.performance).toEqual({
        accuracy: 0.95,
        loss: 0.1,
        precision: 0.93,
        recall: 0.94,
        f1Score: 0.935
      });

      expect(mockDataProcessor.loadDataset).toHaveBeenCalledWith('/test/dataset');
      expect(mockModelTrainer.createModel).toHaveBeenCalled();
      expect(mockModelTrainer.train).toHaveBeenCalled();
      expect(mockModelEvaluator.evaluate).toHaveBeenCalled();
      expect(mockModelRegistry.saveTrainedModel).toHaveBeenCalledWith(modelId, expect.any(Object));
      expect(mockCacheManager.cacheModel).toHaveBeenCalledWith(modelId, expect.any(Object));
    });

    it('should handle training failures', async () => {
      mockModelTrainer.train.mockRejectedValue(new Error('Training failed'));

      const modelConfig = { name: 'Failing Model' };
      const trainingConfig = { epochs: 5 };

      const modelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      // Wait for training to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      const model = mlManager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.FAILED);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Model training failed for'),
        expect.any(Error)
      );
    });

    it('should emit training events', async () => {
      const startedSpy = jest.fn();
      const completedSpy = jest.fn();

      mlManager.on(MLPipelineEventType.TRAINING_STARTED, startedSpy);
      mlManager.on(MLPipelineEventType.TRAINING_COMPLETED, completedSpy);

      const modelConfig = { name: 'Event Test Model' };
      const trainingConfig = { epochs: 5 };

      await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      expect(startedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MLPipelineEventType.TRAINING_STARTED,
          data: expect.objectContaining({
            modelConfig,
            trainingConfig
          })
        })
      );
    });

    it('should handle concurrent training with limits', async () => {
      const trainingPromises = [];
      const maxConcurrent = mockConfig.training.maxConcurrentTrainings;

      // Start more trainings than the limit
      for (let i = 0; i < maxConcurrent + 2; i++) {
        const promise = mlManager.trainModel(
          { name: `Concurrent Model ${i}` },
          { epochs: 1 },
          `/dataset/${i}`
        );
        trainingPromises.push(promise);
      }

      const modelIds = await Promise.all(trainingPromises);
      expect(modelIds).toHaveLength(maxConcurrent + 2);
      expect(modelIds).toEqual(expect.arrayContaining([expect.stringMatching(/^model_\d+_[a-z0-9]+$/)]));
    });

    it('should handle invalid training configurations', async () => {
      await expect(
        mlManager.trainModel({} as any, {} as any, '')
      ).rejects.toThrow();

      await expect(
        mlManager.trainModel({ name: 'Test' }, {} as any, 'nonexistent-dataset')
      ).rejects.toThrow();
    });
  });

  describe('Model Prediction', () => {
    let trainedModelId: string;

    beforeEach(async () => {
      await mlManager.initialize();

      // Create a trained model for prediction tests
      const modelConfig = { name: 'Prediction Test Model' };
      const trainingConfig = { epochs: 1 };

      trainedModelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      // Wait for training to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should make successful predictions', async () => {
      const predictionRequest = {
        modelId: trainedModelId,
        input: [[1, 2, 3]]
      };

      const response = await mlManager.predict(predictionRequest);

      expect(response).toEqual({
        prediction: [[0.85]],
        latency: expect.any(Number),
        metadata: {
          modelId: trainedModelId,
          timestamp: expect.any(Date),
          version: '1.0.0'
        }
      });

      expect(response.latency).toBeGreaterThan(0);
      expect(mockMonitoringService.recordPrediction).toHaveBeenCalledWith(
        trainedModelId,
        expect.any(Number)
      );
    });

    it('should handle prediction with preprocessing and postprocessing', async () => {
      const predictionRequest = {
        modelId: trainedModelId,
        input: [1, 2, 3],
        preprocessor: { type: 'normalize' },
        postprocessor: { type: 'sigmoid' }
      };

      const response = await mlManager.predict(predictionRequest);

      expect(mockDataProcessor.preprocessInput).toHaveBeenCalledWith(
        [1, 2, 3],
        { type: 'normalize' }
      );
      expect(mockDataProcessor.postprocessOutput).toHaveBeenCalledWith(
        [[0.85]],
        { type: 'sigmoid' }
      );
    });

    it('should use cached models for predictions', async () => {
      mockCacheManager.getCachedModel.mockResolvedValue({ predict: jest.fn() });

      const predictionRequest = {
        modelId: trainedModelId,
        input: [[1, 2, 3]]
      };

      await mlManager.predict(predictionRequest);

      expect(mockCacheManager.getCachedModel).toHaveBeenCalledWith(trainedModelId);
      expect(mockModelRegistry.loadTrainedModel).not.toHaveBeenCalled();
    });

    it('should handle prediction errors gracefully', async () => {
      const invalidRequest = {
        modelId: 'nonexistent-model',
        input: [[1, 2, 3]]
      };

      await expect(mlManager.predict(invalidRequest)).rejects.toThrow(
        'Model nonexistent-model not found'
      );
    });

    it('should reject predictions for non-ready models', async () => {
      // Create a model that's still training
      const trainingConfig = { epochs: 100 }; // Long training
      const newModelId = await mlManager.trainModel(
        { name: 'Training Model' },
        trainingConfig,
        '/test/dataset'
      );

      const predictionRequest = {
        modelId: newModelId,
        input: [[1, 2, 3]]
      };

      await expect(mlManager.predict(predictionRequest)).rejects.toThrow(
        `Model ${newModelId} is not ready for prediction`
      );
    });

    it('should emit prediction events', async () => {
      const predictionSpy = jest.fn();
      mlManager.on(MLPipelineEventType.PREDICTION_MADE, predictionSpy);

      const predictionRequest = {
        modelId: trainedModelId,
        input: [[1, 2, 3]]
      };

      await mlManager.predict(predictionRequest);

      expect(predictionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MLPipelineEventType.PREDICTION_MADE,
          data: expect.objectContaining({
            modelId: trainedModelId,
            prediction: [[0.85]]
          })
        })
      );
    });
  });

  describe('Model Deployment', () => {
    let trainedModelId: string;

    beforeEach(async () => {
      await mlManager.initialize();

      const modelConfig = { name: 'Deployment Test Model' };
      const trainingConfig = { epochs: 1 };

      trainedModelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      // Wait for training to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should deploy model successfully', async () => {
      const deploymentConfig = {
        environment: 'production',
        replicas: 3,
        resources: { memory: '2GB', cpu: '1' }
      };

      await mlManager.deployModel(trainedModelId, deploymentConfig);

      const model = mlManager.getModel(trainedModelId);
      expect(model?.status).toBe(ModelStatus.DEPLOYED);

      expect(mockModelDeployer.deploy).toHaveBeenCalledWith(trainedModelId, deploymentConfig);
      expect(mockMonitoringService.startModelMonitoring).toHaveBeenCalledWith(trainedModelId);
    });

    it('should emit deployment events', async () => {
      const deploymentSpy = jest.fn();
      mlManager.on(MLPipelineEventType.MODEL_DEPLOYED, deploymentSpy);

      await mlManager.deployModel(trainedModelId);

      expect(deploymentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MLPipelineEventType.MODEL_DEPLOYED,
          data: expect.objectContaining({
            modelId: trainedModelId
          })
        })
      );
    });

    it('should reject deployment of non-existent models', async () => {
      await expect(
        mlManager.deployModel('nonexistent-model')
      ).rejects.toThrow('Model nonexistent-model not found');
    });

    it('should reject deployment of non-ready models', async () => {
      // Create a model that failed training
      const failingModelConfig = { name: 'Failing Model' };
      mockModelTrainer.train.mockRejectedValueOnce(new Error('Training failed'));

      const failingModelId = await mlManager.trainModel(
        failingModelConfig,
        { epochs: 1 },
        '/test/dataset'
      );

      // Wait for training to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      await expect(
        mlManager.deployModel(failingModelId)
      ).rejects.toThrow(`Model ${failingModelId} is not ready for deployment`);
    });

    it('should handle deployment errors', async () => {
      mockModelDeployer.deploy.mockRejectedValue(new Error('Deployment failed'));

      await expect(
        mlManager.deployModel(trainedModelId)
      ).rejects.toThrow('Deployment failed');

      const model = mlManager.getModel(trainedModelId);
      expect(model?.status).toBe(ModelStatus.READY); // Should remain unchanged on error
    });
  });

  describe('Experiment Management', () => {
    beforeEach(async () => {
      await mlManager.initialize();
    });

    it('should create and run experiments', async () => {
      const experimentConfig = {
        hyperparameters: { learningRate: [0.001, 0.01], batchSize: [16, 32] },
        modelTypes: [ModelType.NEURAL_NETWORK, ModelType.RANDOM_FOREST]
      };

      const experimentId = await mlManager.runExperiment(
        'Hyperparameter Tuning',
        'Test different learning rates and batch sizes',
        experimentConfig
      );

      expect(experimentId).toBeDefined();
      expect(experimentId).toMatch(/^experiment_\d+_[a-z0-9]+$/);

      const experiment = mlManager.getExperiment(experimentId);
      expect(experiment).toBeDefined();
      expect(experiment?.name).toBe('Hyperparameter Tuning');
      expect(experiment?.status).toBe('running');

      expect(mockExperimentTracker.saveExperiment).toHaveBeenCalledWith(
        expect.objectContaining({
          id: experimentId,
          name: 'Hyperparameter Tuning'
        })
      );
    });

    it('should execute experiments and update results', async () => {
      const experimentId = await mlManager.runExperiment(
        'Test Experiment',
        'Test experiment execution',
        { test: true }
      );

      // Wait for experiment to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      const experiment = mlManager.getExperiment(experimentId);
      expect(experiment?.status).toBe('completed');
      expect(experiment?.results).toEqual({ metrics: { accuracy: 0.95 } });
      expect(experiment?.completedAt).toBeInstanceOf(Date);

      expect(mockExperimentTracker.runExperiment).toHaveBeenCalled();
    });

    it('should handle experiment failures', async () => {
      mockExperimentTracker.runExperiment.mockRejectedValue(new Error('Experiment failed'));

      const experimentId = await mlManager.runExperiment(
        'Failing Experiment',
        'This experiment should fail',
        { willFail: true }
      );

      // Wait for experiment to fail
      await new Promise(resolve => setTimeout(resolve, 100));

      const experiment = mlManager.getExperiment(experimentId);
      expect(experiment?.status).toBe('failed');
    });

    it('should emit experiment events', async () => {
      const createdSpy = jest.fn();
      const completedSpy = jest.fn();

      mlManager.on(MLPipelineEventType.EXPERIMENT_CREATED, createdSpy);
      mlManager.on(MLPipelineEventType.EXPERIMENT_COMPLETED, completedSpy);

      await mlManager.runExperiment(
        'Event Test Experiment',
        'Test experiment events',
        { test: true }
      );

      expect(createdSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MLPipelineEventType.EXPERIMENT_CREATED,
          data: expect.objectContaining({
            name: 'Event Test Experiment'
          })
        })
      );
    });
  });

  describe('Monitoring and Metrics', () => {
    let trainedModelId: string;

    beforeEach(async () => {
      await mlManager.initialize();

      const modelConfig = { name: 'Monitoring Test Model' };
      const trainingConfig = { epochs: 1 };

      trainedModelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      // Wait for training to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should retrieve model metrics', async () => {
      const metrics = await mlManager.getModelMetrics(trainedModelId);

      expect(metrics).toEqual([
        { timestamp: expect.any(Date), latency: 150, accuracy: 0.95 }
      ]);
      expect(mockMonitoringService.getModelMetrics).toHaveBeenCalledWith(trainedModelId);
    });

    it('should record prediction metrics', async () => {
      const predictionRequest = {
        modelId: trainedModelId,
        input: [[1, 2, 3]]
      };

      await mlManager.predict(predictionRequest);

      expect(mockMonitoringService.recordPrediction).toHaveBeenCalledWith(
        trainedModelId,
        expect.any(Number)
      );
    });

    it('should start monitoring for deployed models', async () => {
      await mlManager.deployModel(trainedModelId);

      expect(mockMonitoringService.startModelMonitoring).toHaveBeenCalledWith(trainedModelId);
    });
  });

  describe('Cache Management', () => {
    let trainedModelId: string;

    beforeEach(async () => {
      await mlManager.initialize();

      const modelConfig = { name: 'Cache Test Model' };
      const trainingConfig = { epochs: 1 };

      trainedModelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

      // Wait for training to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should cache models after training', async () => {
      expect(mockCacheManager.cacheModel).toHaveBeenCalledWith(
        trainedModelId,
        expect.any(Object)
      );
    });

    it('should use cached models for predictions', async () => {
      const mockCachedModel = { predict: jest.fn() };
      mockCacheManager.getCachedModel.mockResolvedValue(mockCachedModel);

      const predictionRequest = {
        modelId: trainedModelId,
        input: [[1, 2, 3]]
      };

      await mlManager.predict(predictionRequest);

      expect(mockCacheManager.getCachedModel).toHaveBeenCalledWith(trainedModelId);
      expect(mockModelRegistry.loadTrainedModel).not.toHaveBeenCalled();
    });

    it('should fallback to registry when cache miss', async () => {
      mockCacheManager.getCachedModel.mockResolvedValue(null);

      const predictionRequest = {
        modelId: trainedModelId,
        input: [[1, 2, 3]]
      };

      await mlManager.predict(predictionRequest);

      expect(mockCacheManager.getCachedModel).toHaveBeenCalledWith(trainedModelId);
      expect(mockModelRegistry.loadTrainedModel).toHaveBeenCalledWith(trainedModelId);
      expect(mockCacheManager.cacheModel).toHaveBeenCalledWith(
        trainedModelId,
        expect.any(Object)
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await mlManager.initialize();
    });

    it('should handle TensorFlow initialization failures', async () => {
      const { setBackend } = require('@tensorflow/tfjs-node');
      setBackend.mockRejectedValue(new Error('TensorFlow initialization failed'));

      const newManager = new MLPipelineManager(mockConfig, mockLogger);

      await expect(newManager.initialize()).rejects.toThrow('TensorFlow initialization failed');
    });

    it('should handle dataset loading failures', async () => {
      mockDataProcessor.loadDataset.mockRejectedValue(new Error('Dataset not found'));

      await expect(
        mlManager.trainModel(
          { name: 'Test Model' },
          { epochs: 10 },
          '/nonexistent/dataset'
        )
      ).rejects.toThrow('Dataset not found');
    });

    it('should handle model creation failures', async () => {
      mockModelTrainer.createModel.mockRejectedValue(new Error('Invalid architecture'));

      const modelConfig = { name: 'Invalid Model', metadata: { architecture: {} } };

      await expect(
        mlManager.trainModel(modelConfig, { epochs: 10 }, '/test/dataset')
      ).rejects.toThrow('Invalid architecture');
    });

    it('should handle evaluation failures', async () => {
      mockModelEvaluator.evaluate.mockRejectedValue(new Error('Evaluation failed'));

      const modelId = await mlManager.trainModel(
        { name: 'Eval Fail Model' },
        { epochs: 1 },
        '/test/dataset'
      );

      // Wait for training to fail during evaluation
      await new Promise(resolve => setTimeout(resolve, 100));

      const model = mlManager.getModel(modelId);
      expect(model?.status).toBe(ModelStatus.FAILED);
    });

    it('should handle missing model files', async () => {
      mockModelRegistry.loadTrainedModel.mockRejectedValue(new Error('Model file not found'));
      mockCacheManager.getCachedModel.mockResolvedValue(null);

      const predictionRequest = {
        modelId: 'any-model-id',
        input: [[1, 2, 3]]
      };

      await expect(mlManager.predict(predictionRequest)).rejects.toThrow('Model file not found');
    });

    it('should handle large prediction inputs', async () => {
      const largeInput = Array(10000).fill(0).map(() => Array(1000).fill(Math.random()));

      const predictionRequest = {
        modelId: 'any-model-id',
        input: largeInput
      };

      // This should either succeed or fail gracefully, not crash
      try {
        await mlManager.predict(predictionRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await mlManager.initialize();
    });

    it('should handle shutdown gracefully', async () => {
      // Start some training processes
      const trainingPromises = [];
      for (let i = 0; i < 3; i++) {
        trainingPromises.push(
          mlManager.trainModel(
            { name: `Shutdown Test Model ${i}` },
            { epochs: 100 },
            `/test/dataset${i}`
          )
        );
      }

      await Promise.all(trainingPromises);

      // Shutdown should wait for active trainings
      await expect(mlManager.shutdown()).resolves.not.toThrow();

      expect(mockMonitoringService.stop).toHaveBeenCalled();
      expect(mockCacheManager.clear).toHaveBeenCalled();
    });

    it('should handle shutdown with no active trainings', async () => {
      await expect(mlManager.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown errors gracefully', async () => {
      mockMonitoringService.stop.mockRejectedValue(new Error('Stop failed'));
      mockCacheManager.clear.mockRejectedValue(new Error('Clear failed'));

      // Should not throw despite component failures
      await expect(mlManager.shutdown()).resolves.not.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during ML Pipeline Manager shutdown:',
        expect.any(Error)
      );
    });
  });

  describe('Periodic Tasks', () => {
    beforeEach(async () => {
      await mlManager.initialize();
    });

    it('should set up periodic monitoring checks', (done) => {
      // Fast forward time to trigger periodic tasks
      jest.useFakeTimers();

      // Advance time by more than the monitoring interval (60 seconds)
      jest.advanceTimersByTime(65000);

      // Use setTimeout to allow async periodic tasks to execute
      setTimeout(() => {
        expect(mockMonitoringService.checkAllModels).toHaveBeenCalled();
        jest.useRealTimers();
        done();
      }, 100);
    });

    it('should set up periodic cache cleanup', (done) => {
      jest.useFakeTimers();

      // Advance time by more than the cache cleanup interval (5 minutes)
      jest.advanceTimersByTime(301000);

      setTimeout(() => {
        expect(mockCacheManager.cleanup).toHaveBeenCalled();
        jest.useRealTimers();
        done();
      }, 100);
    });

    it('should handle periodic task errors', (done) => {
      jest.useFakeTimers();

      mockMonitoringService.checkAllModels.mockRejectedValue(new Error('Monitoring check failed'));

      jest.advanceTimersByTime(65000);

      setTimeout(() => {
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error in periodic monitoring check:',
          expect.any(Error)
        );
        jest.useRealTimers();
        done();
      }, 100);
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal configuration', () => {
      const minimalConfig: MLConfiguration = {
        modelRegistry: { storagePath: '/tmp', maxModels: 10 },
        training: { maxConcurrentTrainings: 1, defaultEpochs: 10, batchSize: 16 },
        deployment: { defaultDeploymentConfig: {}, monitoringEnabled: false },
        monitoring: { metricsRetentionDays: 7, alertThresholds: { predictionLatency: 500, errorRate: 0.1 } },
        cache: { maxSize: '100MB', ttl: 1800000 }
      };

      expect(() => new MLPipelineManager(minimalConfig, mockLogger)).not.toThrow();
    });

    it('should handle different model types', async () => {
      await mlManager.initialize();

      const modelTypes = [
        ModelType.NEURAL_NETWORK,
        ModelType.RANDOM_FOREST,
        ModelType.SVM,
        ModelType.LINEAR_REGRESSION
      ];

      for (const modelType of modelTypes) {
        const modelConfig = { type: modelType, name: `Test ${modelType}` };
        const trainingConfig = { epochs: 1 };

        const modelId = await mlManager.trainModel(modelConfig, trainingConfig, '/test/dataset');

        expect(modelId).toBeDefined();
        expect(mlManager.getModel(modelId)?.type).toBe(modelType);
      }
    });
  });

  describe('Event System', () => {
    beforeEach(async () => {
      await mlManager.initialize();
    });

    it('should emit and handle custom events', async () => {
      const customEventSpy = jest.fn();
      mlManager.on('custom-event', customEventSpy);

      // Emit a custom event
      (mlManager as any).emitEvent({
        id: 'custom-event-1',
        type: 'custom-event' as any,
        timestamp: new Date(),
        source: 'test',
        data: { test: 'data' }
      });

      expect(customEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom-event',
          data: { test: 'data' }
        })
      );
    });

    it('should handle multiple event listeners', async () => {
      const spy1 = jest.fn();
      const spy2 = jest.fn();

      mlManager.on('test-event', spy1);
      mlManager.on('test-event', spy2);

      (mlManager as any).emitEvent({
        id: 'test-event-1',
        type: 'test-event' as any,
        timestamp: new Date(),
        source: 'test',
        data: {}
      });

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
    });

    it('should handle event listener errors', async () => {
      mlManager.on('error-event', () => {
        throw new Error('Event listener error');
      });

      // Should not throw when event listener throws
      expect(() => {
        (mlManager as any).emitEvent({
          id: 'error-event-1',
          type: 'error-event' as any,
          timestamp: new Date(),
          source: 'test',
          data: {}
        });
      }).not.toThrow();
    });
  });
});