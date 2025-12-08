/**
 * Core ML Pipeline Manager
 * Central coordinator for all machine learning operations in Turbo Flow
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import {
  MLModel,
  Experiment,
  TrainingConfig,
  ModelType,
  ModelStatus,
  MLPipelineEvent,
  MLPipelineEventType,
  MLConfiguration,
  MonitoringMetrics,
  PredictionRequest,
  PredictionResponse
} from '../../types/ml.js';
import { Logger } from 'winston';
import { ModelRegistry } from './ModelRegistry.js';
import { ExperimentTracker } from './ExperimentTracker.js';
import { DataProcessor } from './DataProcessor.js';
import { ModelTrainer } from './ModelTrainer.js';
import { ModelEvaluator } from './ModelEvaluator.js';
import { ModelDeployer } from './ModelDeployer.js';
import { MonitoringService } from './MonitoringService.js';
import { CacheManager } from './CacheManager.js';

export class MLPipelineManager extends EventEmitter {
  private models: Map<string, MLModel> = new Map();
  private experiments: Map<string, Experiment> = new Map();
  private activeTrainings: Map<string, Promise<void>> = new Map();
  private logger: Logger;
  private config: MLConfiguration;

  // Core components
  private modelRegistry: ModelRegistry;
  private experimentTracker: ExperimentTracker;
  private dataProcessor: DataProcessor;
  private modelTrainer: ModelTrainer;
  private modelEvaluator: ModelEvaluator;
  private modelDeployer: ModelDeployer;
  private monitoringService: MonitoringService;
  private cacheManager: CacheManager;

  constructor(config: MLConfiguration, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    // Initialize components
    this.modelRegistry = new ModelRegistry(config, logger);
    this.experimentTracker = new ExperimentTracker(config, logger);
    this.dataProcessor = new DataProcessor(config, logger);
    this.modelTrainer = new ModelTrainer(config, logger);
    this.modelEvaluator = new ModelEvaluator(config, logger);
    this.modelDeployer = new ModelDeployer(config, logger);
    this.monitoringService = new MonitoringService(config, logger);
    this.cacheManager = new CacheManager(config, logger);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Initialize the ML Pipeline Manager
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing ML Pipeline Manager...');

    try {
      // Load existing models and experiments
      await this.loadExistingArtifacts();

      // Initialize TensorFlow backend
      await this.initializeTensorFlow();

      // Start monitoring service
      await this.monitoringService.start();

      // Set up periodic tasks
      this.setupPeriodicTasks();

      this.logger.info('ML Pipeline Manager initialized successfully');
      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize ML Pipeline Manager:', error);
      throw error;
    }
  }

  /**
   * Train a new model
   */
  async trainModel(
    modelConfig: Partial<MLModel>,
    trainingConfig: TrainingConfig,
    datasetPath: string
  ): Promise<string> {
    const modelId = modelConfig.id || this.generateModelId();

    this.logger.info(`Starting model training for ${modelId}`);

    try {
      // Create model entry
      const model: MLModel = {
        id: modelId,
        name: modelConfig.name || `model_${modelId}`,
        type: modelConfig.type || ModelType.NEURAL_NETWORK,
        version: '1.0.0',
        status: ModelStatus.INITIALIZING,
        metadata: modelConfig.metadata || {},
        performance: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.models.set(modelId, model);
      await this.modelRegistry.saveModel(model);

      // Emit training started event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.TRAINING_STARTED,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: { modelId, modelConfig, trainingConfig }
      });

      // Start training in background
      const trainingPromise = this.executeTraining(modelId, trainingConfig, datasetPath);
      this.activeTrainings.set(modelId, trainingPromise);

      // Handle training completion
      trainingPromise
        .then(() => {
          this.activeTrainings.delete(modelId);
          this.logger.info(`Model training completed for ${modelId}`);
        })
        .catch((error) => {
          this.activeTrainings.delete(modelId);
          this.logger.error(`Model training failed for ${modelId}:`, error);
          model.status = ModelStatus.FAILED;
          this.models.set(modelId, model);
        });

      return modelId;

    } catch (error) {
      this.logger.error(`Failed to start training for model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Execute the actual training process
   */
  private async executeTraining(
    modelId: string,
    trainingConfig: TrainingConfig,
    datasetPath: string
  ): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    try {
      // Update model status
      model.status = ModelStatus.TRAINING;
      model.updatedAt = new Date();
      await this.modelRegistry.saveModel(model);

      // Load and preprocess data
      this.logger.info(`Loading dataset from ${datasetPath}`);
      const dataset = await this.dataProcessor.loadDataset(datasetPath);
      const processedData = await this.dataProcessor.preprocess(
        dataset,
        model.metadata.dataset?.preprocessing
      );

      // Create and configure the model
      this.logger.info(`Creating model architecture for ${modelId}`);
      const tfModel = await this.modelTrainer.createModel(
        model.type,
        model.metadata.architecture,
        processedData.featureShape
      );

      // Train the model
      this.logger.info(`Starting training for ${modelId}`);
      const trainingHistory = await this.modelTrainer.train(
        tfModel,
        processedData,
        trainingConfig
      );

      // Evaluate the model
      this.logger.info(`Evaluating model ${modelId}`);
      const evaluation = await this.modelEvaluator.evaluate(
        tfModel,
        processedData.testData
      );

      // Update model with results
      model.status = ModelStatus.READY;
      model.trainedAt = new Date();
      model.updatedAt = new Date();
      model.performance = evaluation;
      model.metadata.metrics = trainingHistory.finalMetrics;

      await this.modelRegistry.saveModel(model);

      // Save the trained model
      await this.modelRegistry.saveTrainedModel(modelId, tfModel);

      // Cache model for quick inference
      await this.cacheManager.cacheModel(modelId, tfModel);

      // Emit training completed event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.TRAINING_COMPLETED,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: {
          modelId,
          evaluation,
          trainingHistory: trainingHistory.finalMetrics
        }
      });

      this.logger.info(`Model training completed successfully for ${modelId}`);

    } catch (error) {
      this.logger.error(`Training failed for model ${modelId}:`, error);

      // Update model status to failed
      model.status = ModelStatus.FAILED;
      model.updatedAt = new Date();
      await this.modelRegistry.saveModel(model);

      // Emit training failed event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.TRAINING_FAILED,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: { modelId, error: error.message }
      });

      throw error;
    }
  }

  /**
   * Make a prediction using a trained model
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();

    try {
      const model = this.models.get(request.modelId);
      if (!model) {
        throw new Error(`Model ${request.modelId} not found`);
      }

      if (model.status !== ModelStatus.READY && model.status !== ModelStatus.DEPLOYED) {
        throw new Error(`Model ${request.modelId} is not ready for prediction`);
      }

      // Get model from cache or registry
      let tfModel = await this.cacheManager.getCachedModel(request.modelId);
      if (!tfModel) {
        tfModel = await this.modelRegistry.loadTrainedModel(request.modelId);
        await this.cacheManager.cacheModel(request.modelId, tfModel);
      }

      // Preprocess input if needed
      let processedInput = request.input;
      if (request.preprocessor) {
        processedInput = await this.dataProcessor.preprocessInput(
          request.input,
          request.preprocessor
        );
      }

      // Make prediction
      const prediction = await this.modelTrainer.predict(tfModel, processedInput);

      // Postprocess prediction if needed
      let finalPrediction = prediction;
      if (request.postprocessor) {
        finalPrediction = await this.dataProcessor.postprocessOutput(
          prediction,
          request.postprocessor
        );
      }

      const latency = Date.now() - startTime;

      // Create response
      const response: PredictionResponse = {
        prediction: finalPrediction,
        latency,
        metadata: {
          modelId: request.modelId,
          timestamp: new Date(),
          version: model.version
        }
      };

      // Update monitoring metrics
      await this.monitoringService.recordPrediction(request.modelId, latency);

      // Emit prediction event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.PREDICTION_MADE,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: { modelId: request.modelId, latency, prediction: finalPrediction }
      });

      return response;

    } catch (error) {
      this.logger.error(`Prediction failed for model ${request.modelId}:`, error);
      throw error;
    }
  }

  /**
   * Deploy a model to production
   */
  async deployModel(modelId: string, deploymentConfig?: any): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (model.status !== ModelStatus.READY) {
      throw new Error(`Model ${modelId} is not ready for deployment`);
    }

    try {
      this.logger.info(`Deploying model ${modelId} to production`);

      // Deploy using model deployer
      await this.modelDeployer.deploy(modelId, deploymentConfig);

      // Update model status
      model.status = ModelStatus.DEPLOYED;
      model.updatedAt = new Date();
      await this.modelRegistry.saveModel(model);

      // Start monitoring for deployed model
      await this.monitoringService.startModelMonitoring(modelId);

      // Emit deployment event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.MODEL_DEPLOYED,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: { modelId, deploymentConfig }
      });

      this.logger.info(`Model ${modelId} deployed successfully`);

    } catch (error) {
      this.logger.error(`Failed to deploy model ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Create and run an experiment
   */
  async runExperiment(
    name: string,
    description: string,
    config: any
  ): Promise<string> {
    const experimentId = this.generateExperimentId();

    this.logger.info(`Starting experiment ${experimentId}: ${name}`);

    try {
      // Create experiment
      const experiment: Experiment = {
        id: experimentId,
        name,
        description,
        status: 'running' as any,
        config,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.experiments.set(experimentId, experiment);
      await this.experimentTracker.saveExperiment(experiment);

      // Emit experiment created event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.EXPERIMENT_CREATED,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: { experimentId, name, description, config }
      });

      // Run experiment in background
      this.executeExperiment(experimentId)
        .then((results) => {
          this.logger.info(`Experiment ${experimentId} completed successfully`);
        })
        .catch((error) => {
          this.logger.error(`Experiment ${experimentId} failed:`, error);
        });

      return experimentId;

    } catch (error) {
      this.logger.error(`Failed to create experiment ${name}:`, error);
      throw error;
    }
  }

  /**
   * Execute an experiment
   */
  private async executeExperiment(experimentId: string): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    try {
      // Execute experiment based on configuration
      const results = await this.experimentTracker.runExperiment(experiment);

      // Update experiment with results
      experiment.results = results;
      experiment.status = 'completed' as any;
      experiment.completedAt = new Date();
      experiment.updatedAt = new Date();

      await this.experimentTracker.saveExperiment(experiment);

      // Emit experiment completed event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.EXPERIMENT_COMPLETED,
        timestamp: new Date(),
        source: 'MLPipelineManager',
        data: { experimentId, results }
      });

    } catch (error) {
      experiment.status = 'failed' as any;
      experiment.updatedAt = new Date();
      await this.experimentTracker.saveExperiment(experiment);
      throw error;
    }
  }

  /**
   * Get monitoring metrics for a model
   */
  async getModelMetrics(modelId: string): Promise<MonitoringMetrics[]> {
    return await this.monitoringService.getModelMetrics(modelId);
  }

  /**
   * List all models
   */
  listModels(): MLModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): MLModel | undefined {
    return this.models.get(modelId);
  }

  /**
   * List all experiments
   */
  listExperiments(): Experiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get experiment by ID
   */
  getExperiment(experimentId: string): Experiment | undefined {
    return this.experiments.get(experimentId);
  }

  /**
   * Shutdown the ML Pipeline Manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ML Pipeline Manager...');

    try {
      // Wait for active trainings to complete or timeout
      const trainingPromises = Array.from(this.activeTrainings.values());
      if (trainingPromises.length > 0) {
        this.logger.info(`Waiting for ${trainingPromises.length} active trainings to complete...`);
        await Promise.allSettled(trainingPromises);
      }

      // Stop monitoring service
      await this.monitoringService.stop();

      // Clear caches
      await this.cacheManager.clear();

      this.logger.info('ML Pipeline Manager shutdown complete');

    } catch (error) {
      this.logger.error('Error during ML Pipeline Manager shutdown:', error);
    }
  }

  // Private helper methods

  private setupEventListeners(): void {
    this.on('error', (error) => {
      this.logger.error('ML Pipeline Manager error:', error);
    });
  }

  private async loadExistingArtifacts(): Promise<void> {
    try {
      // Load existing models
      const models = await this.modelRegistry.loadAllModels();
      for (const model of models) {
        this.models.set(model.id, model);
      }

      // Load existing experiments
      const experiments = await this.experimentTracker.loadAllExperiments();
      for (const experiment of experiments) {
        this.experiments.set(experiment.id, experiment);
      }

      this.logger.info(
        `Loaded ${models.length} models and ${experiments.length} experiments`
      );

    } catch (error) {
      this.logger.warn('Failed to load existing artifacts:', error);
    }
  }

  private async initializeTensorFlow(): Promise<void> {
    try {
      // Set TensorFlow backend
      await tf.setBackend('tensorflow');
      await tf.ready();

      this.logger.info('TensorFlow backend initialized');

    } catch (error) {
      this.logger.error('Failed to initialize TensorFlow:', error);
      throw error;
    }
  }

  private setupPeriodicTasks(): void {
    // Set up periodic model monitoring checks
    setInterval(async () => {
      try {
        await this.monitoringService.checkAllModels();
      } catch (error) {
        this.logger.error('Error in periodic monitoring check:', error);
      }
    }, 60000); // Every minute

    // Set up periodic cache cleanup
    setInterval(async () => {
      try {
        await this.cacheManager.cleanup();
      } catch (error) {
        this.logger.error('Error in periodic cache cleanup:', error);
      }
    }, 300000); // Every 5 minutes
  }

  private emitEvent(event: MLPipelineEvent): void {
    this.emit('event', event);
    this.emit(event.type, event);
  }

  private generateModelId(): string {
    return `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExperimentId(): string {
    return `experiment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}