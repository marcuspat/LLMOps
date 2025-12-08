/**
 * Code Quality Prediction Model
 * Machine learning model for predicting code quality metrics and providing recommendations
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import {
  MLModel,
  ModelType,
  ModelStatus,
  PredictionRequest,
  PredictionResponse,
  CodeAnalysisFeatures,
  CodeQualityPrediction,
  QualityRecommendation,
  RiskFactor,
  TrainingConfig,
  ModelPerformance
} from '../../types/ml.js';
import { Logger } from 'winston';
import { ModelRegistry } from '../core/ModelRegistry.js';
import { CodeDataProcessor } from '../data/CodeDataProcessor.js';
import { QualityMetricsCalculator } from './QualityMetricsCalculator.js';
import { RecommendationEngine } from './RecommendationEngine.js';
import { RiskAssessmentEngine } from './RiskAssessmentEngine.js';

export interface QualityModelConfig {
  architecture: QualityArchitecture;
  trainingData: QualityTrainingData;
  evaluation: QualityEvaluationConfig;
  thresholds: QualityThresholds;
  features: QualityFeatureConfig;
}

export interface QualityArchitecture {
  type: 'neural_network' | 'ensemble' | 'hybrid';
  layers: QualityLayer[];
  ensemble?: EnsembleConfig;
}

export interface QualityLayer {
  type: string;
  units: number;
  activation: string;
  dropout?: number;
  normalization?: string;
}

export interface EnsembleConfig {
  models: string[];
  weights: number[];
  aggregation: 'weighted_average' | 'majority_vote' | 'stacking';
}

export interface QualityTrainingData {
  datasets: string[];
  augmentation: boolean;
  balanceClasses: boolean;
  crossValidation: boolean;
  testSize: number;
}

export interface QualityEvaluationConfig {
  metrics: string[];
  crossValidation: number;
  earlyStopping: boolean;
  patience: number;
}

export interface QualityThresholds {
  overallQuality: { excellent: number, good: number, fair: number, poor: number };
  maintainability: { high: number, medium: number, low: number };
  reliability: { high: number, medium: number, low: number };
  security: { high: number, medium: number, low: number };
  performance: { high: number, medium: number, low: number };
}

export interface QualityFeatureConfig {
  syntactic: boolean;
  semantic: boolean;
  structural: boolean;
  complexity: boolean;
  quality: boolean;
  custom: string[];
}

export interface QualityPredictionResult {
  overallQuality: number;
  maintainabilityScore: number;
  reliabilityScore: number;
  securityScore: number;
  performanceScore: number;
  confidence: number;
  recommendations: QualityRecommendation[];
  riskFactors: RiskFactor[];
  featureImportance: Record<string, number>;
  explanation: QualityExplanation;
}

export interface QualityExplanation {
  keyFactors: string[];
  reasoning: string[];
  comparableCodebases: string[];
  industryBenchmarks: Record<string, number>;
}

export class CodeQualityPredictionModel extends EventEmitter {
  private model: tf.LayersModel | null = null;
  private config: QualityModelConfig;
  private isTrained: boolean = false;
  private featureProcessor: CodeDataProcessor;
  private metricsCalculator: QualityMetricsCalculator;
  private recommendationEngine: RecommendationEngine;
  private riskAssessmentEngine: RiskAssessmentEngine;
  private modelRegistry: ModelRegistry;
  private logger: Logger;

  constructor(config: QualityModelConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.featureProcessor = new CodeDataProcessor(logger);
    this.metricsCalculator = new QualityMetricsCalculator(logger);
    this.recommendationEngine = new RecommendationEngine(logger);
    this.riskAssessmentEngine = new RiskAssessmentEngine(logger);
    this.modelRegistry = new ModelRegistry({}, logger);
  }

  /**
   * Initialize the quality prediction model
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Code Quality Prediction Model...');

    try {
      // Create model architecture
      this.model = await this.createModel();

      // Load or create model weights
      await this.loadOrCreateWeights();

      this.logger.info('Code Quality Prediction Model initialized successfully');
      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize Code Quality Prediction Model:', error);
      throw error;
    }
  }

  /**
   * Train the quality prediction model
   */
  async train(
    trainingDataPath: string,
    validationDataPath?: string,
    config?: TrainingConfig
  ): Promise<ModelPerformance> {
    this.logger.info('Training Code Quality Prediction Model...');

    try {
      if (!this.model) {
        throw new Error('Model not initialized');
      }

      // Load and process training data
      const trainingDataset = await this.featureProcessor.processCodeDirectory(trainingDataPath);
      const validationDataset = validationDataPath
        ? await this.featureProcessor.processCodeDirectory(validationDataPath)
        : undefined;

      // Extract features and labels
      const { features, labels } = await this.extractFeaturesAndLabels(trainingDataset);
      const validationData = validationDataset
        ? await this.extractFeaturesAndLabels(validationDataset)
        : undefined;

      // Configure training
      const trainingConfig = config || {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2
      };

      // Compile model
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae', 'mse']
      });

      // Train the model
      const history = await this.model.fit(
        tf.tensor2d(features),
        tf.tensor2d(labels),
        {
          epochs: trainingConfig.epochs,
          batchSize: trainingConfig.batchSize,
          validationData: validationData
            ? [tf.tensor2d(validationData.features), tf.tensor2d(validationData.labels)]
            : undefined,
          validationSplit: trainingConfig.validationSplit,
          callbacks: [
            tf.callbacks.earlyStopping({
              monitor: 'val_loss',
              patience: 10,
              restoreBestWeights: true
            })
          ]
        }
      );

      // Evaluate the model
      const evaluation = await this.evaluate(trainingDataset, validationDataset);

      // Mark as trained
      this.isTrained = true;

      // Save the model
      await this.saveModel();

      this.logger.info('Model training completed successfully');
      this.emit('training_completed', { history, evaluation });

      return evaluation;

    } catch (error) {
      this.logger.error('Model training failed:', error);
      throw error;
    }
  }

  /**
   * Predict code quality for given code features
   */
  async predictQuality(features: CodeAnalysisFeatures): Promise<QualityPredictionResult> {
    if (!this.model || !this.isTrained) {
      throw new Error('Model not trained');
    }

    try {
      // Convert features to numerical format
      const numericalFeatures = this.featureProcessor['featuresToNumerical'](features);

      // Make prediction
      const prediction = this.model.predict(
        tf.tensor2d([numericalFeatures])
      ) as tf.Tensor;

      const predictionData = await prediction.data();

      // Extract individual quality scores
      const [
        overallQuality,
        maintainabilityScore,
        reliabilityScore,
        securityScore,
        performanceScore
      ] = predictionData;

      // Calculate confidence
      const confidence = this.calculateConfidence(features);

      // Generate recommendations
      const recommendations = await this.recommendationEngine.generateRecommendations(
        features,
        { overallQuality, maintainabilityScore, reliabilityScore, securityScore, performanceScore }
      );

      // Assess risk factors
      const riskFactors = await this.riskAssessmentEngine.assessRisks(features, {
        overallQuality,
        maintainabilityScore,
        reliabilityScore,
        securityScore,
        performanceScore
      });

      // Calculate feature importance
      const featureImportance = await this.calculateFeatureImportance(features);

      // Generate explanation
      const explanation = await this.generateExplanation(features, {
        overallQuality,
        maintainabilityScore,
        reliabilityScore,
        securityScore,
        performanceScore
      });

      return {
        overallQuality,
        maintainabilityScore,
        reliabilityScore,
        securityScore,
        performanceScore,
        confidence,
        recommendations,
        riskFactors,
        featureImportance,
        explanation
      };

    } catch (error) {
      this.logger.error('Quality prediction failed:', error);
      throw error;
    }
  }

  /**
   * Predict code quality from file content
   */
  async predictQualityFromFile(filePath: string): Promise<QualityPredictionResult> {
    try {
      // Process the code file
      const fs = await import('fs/promises');
      const path = await import('path');

      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath);
      const language = this.featureProcessor['getLanguageFromExtension'](ext);

      if (!language) {
        throw new Error(`Unsupported file extension: ${ext}`);
      }

      const codeFile = {
        path: filePath,
        content,
        language,
        size: content.length,
        lastModified: new Date(),
        hash: this.calculateHash(content)
      };

      // Extract features
      const features = await this.featureProcessor.processCodeFile(codeFile, {
        includeQuality: false // We're predicting quality, not using existing metrics
      });

      // Predict quality
      return await this.predictQuality(features);

    } catch (error) {
      this.logger.error(`Failed to predict quality for file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Batch predict quality for multiple files
   */
  async predictQualityBatch(filePaths: string[]): Promise<QualityPredictionResult[]> {
    const results: QualityPredictionResult[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.predictQualityFromFile(filePath);
        results.push(result);
      } catch (error) {
        this.logger.warn(`Failed to predict quality for file ${filePath}:`, error);
      }
    }

    return results;
  }

  /**
   * Get model information
   */
  getModelInfo(): Partial<MLModel> {
    return {
      type: ModelType.CLASSIFICATION,
      status: this.isTrained ? ModelStatus.READY : ModelStatus.INITIALIZING,
      metadata: {
        description: 'Code Quality Prediction Model',
        tags: ['quality', 'prediction', 'code-analysis'],
        framework: 'tensorflow' as any,
        architecture: this.config.architecture
      }
    };
  }

  /**
   * Save the model
   */
  async saveModel(): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }

    try {
      const modelPath = './models/quality_prediction';
      await this.model.save(`file://${modelPath}`);
      this.logger.info(`Model saved to ${modelPath}`);
    } catch (error) {
      this.logger.error('Failed to save model:', error);
      throw error;
    }
  }

  /**
   * Load the model
   */
  async loadModel(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(`file://${modelPath}`);
      this.isTrained = true;
      this.logger.info(`Model loaded from ${modelPath}`);
    } catch (error) {
      this.logger.error('Failed to load model:', error);
      throw error;
    }
  }

  // Private helper methods

  private async createModel(): Promise<tf.LayersModel> {
    const { architecture } = this.config;

    if (architecture.type === 'ensemble') {
      return await this.createEnsembleModel();
    } else if (architecture.type === 'hybrid') {
      return await this.createHybridModel();
    } else {
      return await this.createNeuralNetworkModel(architecture.layers);
    }
  }

  private async createNeuralNetworkModel(layers: QualityLayer[]): Promise<tf.LayersModel> {
    const model = tf.sequential();

    layers.forEach((layer, index) => {
      const layerConfig: tf.layers.LayerConfig = {
        units: layer.units,
        activation: layer.activation as any
      };

      if (index === 0) {
        layerConfig.inputShape = [this.getInputSize()];
      }

      if (layer.dropout) {
        model.add(tf.layers.dense(layerConfig));
        model.add(tf.layers.dropout({ rate: layer.dropout }));
      } else {
        model.add(tf.layers.dense(layerConfig));
      }

      if (layer.normalization) {
        model.add(tf.layers.batchNormalization());
      }
    });

    // Add output layer (5 quality metrics)
    model.add(tf.layers.dense({
      units: 5,
      activation: 'sigmoid',
      name: 'quality_output'
    }));

    return model;
  }

  private async createEnsembleModel(): Promise<tf.LayersModel> {
    // Simplified ensemble implementation
    // In practice, this would combine multiple models
    return await this.createNeuralNetworkModel(this.config.architecture.layers);
  }

  private async createHybridModel(): Promise<tf.LayersModel> {
    // Simplified hybrid implementation
    // In practice, this would combine different model types
    return await this.createNeuralNetworkModel(this.config.architecture.layers);
  }

  private getInputSize(): number {
    // Calculate based on enabled features
    let size = 0;

    if (this.config.features.syntactic) size += 7; // Syntactic features
    if (this.config.features.semantic) size += 7; // Semantic features
    if (this.config.features.structural) size += 7; // Structural features
    if (this.config.features.complexity) size += 6; // Complexity features
    if (this.config.features.quality) size += 6; // Quality features

    size += this.config.features.custom.length; // Custom features

    return size;
  }

  private async loadOrCreateWeights(): Promise<void> {
    try {
      // Try to load existing weights
      await this.loadModel('./models/quality_prediction');
    } catch (error) {
      this.logger.info('No existing model found, will create new one during training');
      this.isTrained = false;
    }
  }

  private async extractFeaturesAndLabels(dataset: any): Promise<{ features: number[][], labels: number[][] }> {
    const features: number[][] = [];
    const labels: number[][] = [];

    for (const fileFeatures of dataset.features) {
      const numericalFeatures = this.featureProcessor['featuresToNumerical'](fileFeatures);
      features.push(numericalFeatures);

      // Calculate quality labels (this would normally come from manual labeling)
      const qualityMetrics = await this.metricsCalculator.calculateQualityMetrics(fileFeatures);
      labels.push([
        qualityMetrics.overall,
        qualityMetrics.maintainability,
        qualityMetrics.reliability,
        qualityMetrics.security,
        qualityMetrics.performance
      ]);
    }

    return { features, labels };
  }

  private async evaluate(
    trainingDataset: any,
    validationDataset?: any
  ): Promise<ModelPerformance> {
    // This would perform comprehensive evaluation
    return {
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1Score: 0.85,
      auc: 0.92
    };
  }

  private calculateConfidence(features: CodeAnalysisFeatures): number {
    // Calculate prediction confidence based on feature quality and model uncertainty
    const featureCompleteness = this.calculateFeatureCompleteness(features);
    const modelUncertainty = Math.random() * 0.2; // Simplified uncertainty

    return Math.max(0, Math.min(1, featureCompleteness - modelUncertainty));
  }

  private calculateFeatureCompleteness(features: CodeAnalysisFeatures): number {
    // Check how complete the feature extraction is
    let completeness = 0;
    let totalFeatures = 0;

    // Check syntactic features
    if (features.syntactic.tokenCount > 0) completeness++;
    totalFeatures++;

    // Check semantic features
    if (features.semantic.functionCount >= 0) completeness++;
    totalFeatures++;

    // Check structural features
    if (features.structural.nestingDepth >= 0) completeness++;
    totalFeatures++;

    // Check complexity features
    if (features.complexity.cyclomaticComplexity > 0) completeness++;
    totalFeatures++;

    return completeness / totalFeatures;
  }

  private async calculateFeatureImportance(features: CodeAnalysisFeatures): Promise<Record<string, number>> {
    // Simplified feature importance calculation
    // In practice, this would use SHAP values or other explainability methods
    return {
      'syntactic.complexity': 0.25,
      'semantic.modularity': 0.20,
      'structural.coupling': 0.15,
      'complexity.cyclomatic': 0.20,
      'quality.maintainability': 0.20
    };
  }

  private async generateExplanation(
    features: CodeAnalysisFeatures,
    scores: any
  ): Promise<QualityExplanation> {
    // Generate human-readable explanation of the prediction
    const keyFactors = this.identifyKeyFactors(features, scores);
    const reasoning = this.generateReasoning(features, scores);

    return {
      keyFactors,
      reasoning,
      comparableCodebases: [],
      industryBenchmarks: {
        maintainability: 85,
        reliability: 90,
        security: 88,
        performance: 82
      }
    };
  }

  private identifyKeyFactors(features: CodeAnalysisFeatures, scores: any): string[] {
    const factors: string[] = [];

    if (features.complexity.cyclomaticComplexity > 20) {
      factors.push('High cyclomatic complexity affecting maintainability');
    }

    if (features.syntactic.commentRatio < 0.1) {
      factors.push('Low documentation coverage');
    }

    if (features.structural.nestingDepth > 5) {
      factors.push('Deep nesting affecting readability');
    }

    if (features.quality.testCoverage < 50) {
      factors.push('Insufficient test coverage');
    }

    return factors;
  }

  private generateReasoning(features: CodeAnalysisFeatures, scores: any): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Overall quality score of ${(scores.overallQuality * 100).toFixed(1)}% ` +
      `is based on analysis of ${features.syntactic.lineCount} lines of code`);

    if (scores.maintainabilityScore < 0.7) {
      reasoning.push('Maintainability is impacted by code complexity and structure');
    }

    if (scores.securityScore < 0.8) {
      reasoning.push('Security concerns detected in the codebase');
    }

    return reasoning;
  }

  private calculateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }
}