/**
 * Core Machine Learning Types and Interfaces
 * Defines the fundamental types used across the ML pipeline
 */

import * as tf from '@tensorflow/tfjs-node';

export interface MLModel {
  id: string;
  name: string;
  type: ModelType;
  version: string;
  status: ModelStatus;
  metadata: ModelMetadata;
  performance: ModelPerformance;
  createdAt: Date;
  updatedAt: Date;
  trainedAt?: Date;
}

export enum ModelType {
  NEURAL_NETWORK = 'neural_network',
  TRANSFORMER = 'transformer',
  CONVOLUTIONAL = 'convolutional',
  RECURRENT = 'recurrent',
  ENSEMBLE = 'ensemble',
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  CLUSTERING = 'clustering',
  ANOMALY_DETECTION = 'anomaly_detection',
  REINFORCEMENT_LEARNING = 'reinforcement_learning',
  AGENT_MODEL = 'agent_model'
}

export enum ModelStatus {
  INITIALIZING = 'initializing',
  TRAINING = 'training',
  EVALUATING = 'evaluating',
  READY = 'ready',
  DEPLOYED = 'deployed',
  FAILED = 'failed',
  ARCHIVED = 'archived'
}

export interface ModelMetadata {
  description: string;
  tags: string[];
  architecture?: ArchitectureConfig;
  hyperparameters?: Record<string, any>;
  dataset?: DatasetInfo;
  framework: MLFramework;
  accuracy?: number;
  loss?: number;
  metrics?: Record<string, number>;
}

export interface ModelPerformance {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  auc?: number;
  confusionMatrix?: number[][];
  customMetrics?: Record<string, number>;
  inferenceTime?: number;
  modelSize?: number;
  memoryUsage?: number;
}

export interface ArchitectureConfig {
  layers: LayerConfig[];
  optimizer: OptimizerConfig;
  lossFunction: string;
  metrics: string[];
}

export interface LayerConfig {
  type: string;
  units?: number;
  activation?: string;
  inputShape?: number[];
  outputShape?: number[];
  parameters?: Record<string, any>;
}

export interface OptimizerConfig {
  type: string;
  learningRate: number;
  beta1?: number;
  beta2?: number;
  epsilon?: number;
  decay?: number;
  momentum?: number;
}

export enum MLFramework {
  TENSORFLOW = 'tensorflow',
  PYTORCH = 'pytorch',
  BRAIN_JS = 'brain_js',
  ML_JS = 'ml_js',
  CUSTOM = 'custom'
}

export interface DatasetInfo {
  name: string;
  source: string;
  size: number;
  features: FeatureInfo[];
  labels?: LabelInfo[];
  preprocessing?: PreprocessingConfig;
  splits?: DataSplit;
}

export interface FeatureInfo {
  name: string;
  type: FeatureType;
  shape?: number[];
  encoding?: string;
  normalized?: boolean;
  missing?: number;
}

export enum FeatureType {
  NUMERICAL = 'numerical',
  CATEGORICAL = 'categorical',
  TEXT = 'text',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  SEQUENCE = 'sequence',
  TIME_SERIES = 'time_series'
}

export interface LabelInfo {
  name: string;
  type: LabelType;
  classes?: string[];
  encoding?: string;
}

export enum LabelType {
  CLASSIFICATION = 'classification',
  REGRESSION = 'regression',
  MULTICLASS = 'multiclass',
  MULTILABEL = 'multilabel',
  SEQUENCE = 'sequence'
}

export interface PreprocessingConfig {
  scaling?: ScalingConfig;
  encoding?: EncodingConfig;
  featureSelection?: FeatureSelectionConfig;
  dimensionalityReduction?: DimensionalityReductionConfig;
  augmentation?: AugmentationConfig;
}

export interface ScalingConfig {
  method: 'standard' | 'minmax' | 'robust' | 'none';
  featureRange?: [number, number];
}

export interface EncodingConfig {
  categorical?: 'onehot' | 'label' | 'target' | 'binary';
  text?: 'tfidf' | 'word2vec' | 'bert' | 'custom';
  images?: 'pixels' | 'features' | 'embeddings';
}

export interface FeatureSelectionConfig {
  method: 'variance' | 'correlation' | 'mutual_info' | 'recursive' | 'lasso';
  k?: number;
  threshold?: number;
}

export interface DimensionalityReductionConfig {
  method: 'pca' | 'tsne' | 'umap' | 'lda' | 'autoencoder';
  components?: number;
  perplexity?: number;
  nNeighbors?: number;
}

export interface AugmentationConfig {
  enabled: boolean;
  methods: string[];
  parameters?: Record<string, any>;
}

export interface DataSplit {
  train: number;
  validation: number;
  test: number;
  stratify?: boolean;
  shuffle?: boolean;
}

// Training Configuration
export interface TrainingConfig {
  epochs: number;
  batchSize: number;
  validationSplit?: number;
  earlyStopping?: EarlyStoppingConfig;
  checkpoints?: CheckpointConfig;
  callbacks?: CallbackConfig[];
  distributed?: DistributedConfig;
}

export interface EarlyStoppingConfig {
  monitor: string;
  patience: number;
  minDelta?: number;
  restoreBestWeights?: boolean;
}

export interface CheckpointConfig {
  saveFrequency: number;
  saveBest: boolean;
  saveWeights: boolean;
  directory: string;
}

export interface CallbackConfig {
  type: string;
  parameters?: Record<string, any>;
}

export interface DistributedConfig {
  strategy: 'data_parallel' | 'model_parallel' | 'hybrid';
  workers: number;
  synchronization?: 'sync' | 'async';
  allReduce?: boolean;
}

// Experiment Tracking
export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  config: ExperimentConfig;
  results?: ExperimentResults;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export enum ExperimentStatus {
  CREATED = 'created',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ExperimentConfig {
  modelConfig: ModelMetadata;
  trainingConfig: TrainingConfig;
  dataset: DatasetInfo;
  environment?: EnvironmentConfig;
}

export interface EnvironmentConfig {
  framework: string;
  version: string;
  hardware: HardwareConfig;
  software: SoftwareConfig;
}

export interface HardwareConfig {
  cpu?: number;
  gpu?: string[];
  memory?: number;
  storage?: string;
  tpu?: boolean;
}

export interface SoftwareConfig {
  os: string;
  pythonVersion?: string;
  nodeVersion?: string;
  libraries: Record<string, string>;
}

export interface ExperimentResults {
  metrics: Record<string, number[]>;
  finalMetrics: Record<string, number>;
  modelPath: string;
  logs: string[];
  artifacts: Artifact[];
  duration: number;
}

export interface Artifact {
  name: string;
  path: string;
  type: string;
  size: number;
  metadata?: Record<string, any>;
}

// Prediction and Inference
export interface PredictionRequest {
  modelId: string;
  input: any;
  preprocessor?: string;
  postprocessor?: string;
  metadata?: Record<string, any>;
}

export interface PredictionResponse {
  prediction: any;
  confidence?: number;
  probabilities?: number[];
  latency: number;
  metadata: Record<string, any>;
}

export interface BatchPredictionRequest {
  modelId: string;
  inputs: any[];
  batchSize?: number;
  preprocessor?: string;
  postprocessor?: string;
  metadata?: Record<string, any>;
}

export interface BatchPredictionResponse {
  predictions: any[];
  confidences?: number[];
  latencies: number[];
  totalLatency: number;
  metadata: Record<string, any>;
}

// Model Monitoring
export interface MonitoringMetrics {
  timestamp: Date;
  modelId: string;
  requestCount: number;
  averageLatency: number;
  errorRate: number;
  resourceUsage: ResourceUsage;
  dataDrift?: DataDriftMetrics;
  conceptDrift?: ConceptDriftMetrics;
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  gpu?: number;
  disk: number;
  network?: number;
}

export interface DataDriftMetrics {
  populationStabilityIndex: number;
  kolmogorovSmirnovStatistic: number;
  featureDriftScore: number;
  driftThreshold: number;
}

export interface ConceptDriftMetrics {
  accuracyDrift: number;
  predictionDistributionChange: number;
  errorRateChange: number;
  driftThreshold: number;
}

// Agent-Specific ML Types
export interface AgentTrainingData {
  agentId: string;
  agentType: string;
  experiences: AgentExperience[];
  performanceHistory: AgentPerformance[];
  capabilities: string[];
}

export interface AgentExperience {
  id: string;
  taskId: string;
  input: any;
  actions: AgentAction[];
  outcome: AgentOutcome;
  reward: number;
  context: AgentContext;
  timestamp: Date;
}

export interface AgentAction {
  type: string;
  parameters: Record<string, any>;
  timestamp: Date;
  outcome: string;
}

export interface AgentOutcome {
  success: boolean;
  quality: number;
  efficiency: number;
  errors: string[];
  learnings: string[];
}

export interface AgentContext {
  environment: string;
  collaborators: string[];
  resources: ResourceUsage;
  constraints: Record<string, any>;
}

export interface AgentPerformance {
  taskId: string;
  timestamp: Date;
  metrics: {
    speed: number;
    quality: number;
    efficiency: number;
    collaboration: number;
    learning: number;
  };
  feedback: AgentFeedback;
}

export interface AgentFeedback {
  positive: string[];
  negative: string[];
  suggestions: string[];
  improvements: string[];
}

// Code Analysis ML Types
export interface CodeAnalysisFeatures {
  syntactic: SyntacticFeatures;
  semantic: SemanticFeatures;
  structural: StructuralFeatures;
  complexity: ComplexityFeatures;
  quality: QualityFeatures;
}

export interface SyntacticFeatures {
  tokenCount: number;
  lineCount: number;
  characterCount: number;
  commentRatio: number;
  identifierDensity: number;
  keywordDensity: number;
  operatorDensity: number;
}

export interface SemanticFeatures {
  functionCount: number;
  classCount: number;
  importCount: number;
  variableCount: number;
  controlFlowComplexity: number;
  dataFlowComplexity: number;
  abstractionLevel: number;
}

export interface StructuralFeatures {
  nestingDepth: number;
  coupling: number;
  cohesion: number;
  inheritanceDepth: number;
  moduleSize: number;
  interfaceComplexity: number;
  designPatterns: string[];
}

export interface ComplexityFeatures {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  halsteadComplexity: number;
  maintainabilityIndex: number;
  technicalDebt: number;
  codeChurn: number;
}

export interface QualityFeatures {
  testCoverage: number;
  bugDensity: number;
  vulnerabilityCount: number;
  codeSmells: number;
  duplicationRatio: number;
  documentationCoverage: number;
}

export interface CodeQualityPrediction {
  overallQuality: number;
  maintainabilityScore: number;
  reliabilityScore: number;
  securityScore: number;
  performanceScore: number;
  recommendations: QualityRecommendation[];
  riskFactors: RiskFactor[];
}

export interface QualityRecommendation {
  type: 'refactor' | 'test' | 'document' | 'optimize' | 'secure';
  priority: 'high' | 'medium' | 'low';
  description: string;
  location: string;
  impact: number;
}

export interface RiskFactor {
  category: 'performance' | 'security' | 'maintainability' | 'reliability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location: string;
  mitigation: string;
}

// ML Pipeline Events
export interface MLPipelineEvent {
  id: string;
  type: MLPipelineEventType;
  timestamp: Date;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

export enum MLPipelineEventType {
  TRAINING_STARTED = 'training_started',
  TRAINING_COMPLETED = 'training_completed',
  TRAINING_FAILED = 'training_failed',
  MODEL_DEPLOYED = 'model_deployed',
  MODEL_UPDATED = 'model_updated',
  PREDICTION_MADE = 'prediction_made',
  BATCH_PREDICTION_MADE = 'batch_prediction_made',
  MONITORING_ALERT = 'monitoring_alert',
  EXPERIMENT_CREATED = 'experiment_created',
  EXPERIMENT_COMPLETED = 'experiment_completed',
  AGENT_TRAINED = 'agent_trained',
  CODE_ANALYZED = 'code_analyzed'
}

export interface MLConfiguration {
  models: Record<string, MLModel>;
  experiments: Record<string, Experiment>;
  datasets: Record<string, DatasetInfo>;
  pipelines: Record<string, MLPipelineConfig>;
  monitoring: MonitoringConfig;
  deployment: DeploymentConfig;
}

export interface MLPipelineConfig {
  name: string;
  description: string;
  stages: PipelineStage[];
  schedule?: ScheduleConfig;
  resources: ResourceConfig;
  notifications?: NotificationConfig[];
}

export interface PipelineStage {
  name: string;
  type: StageType;
  config: any;
  dependencies: string[];
  timeout?: number;
  retries?: number;
}

export enum StageType {
  DATA_INGESTION = 'data_ingestion',
  DATA_PREPROCESSING = 'data_preprocessing',
  FEATURE_ENGINEERING = 'feature_engineering',
  MODEL_TRAINING = 'model_training',
  MODEL_EVALUATION = 'model_evaluation',
  MODEL_DEPLOYMENT = 'model_deployment',
  MONITORING = 'monitoring',
  VALIDATION = 'validation'
}

export interface ScheduleConfig {
  frequency: string;
  timezone: string;
  enabled: boolean;
  holidays?: string[];
}

export interface ResourceConfig {
  cpu: number;
  memory: number;
  gpu?: number;
  storage: number;
  maxConcurrency: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  metrics: string[];
  alerts: AlertConfig[];
  retention: number;
}

export interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
}

export interface DeploymentConfig {
  environment: string;
  replicas: number;
  autoscaling: AutoscalingConfig;
  loadBalancing: LoadBalancingConfig;
  healthCheck: HealthCheckConfig;
}

export interface AutoscalingConfig {
  enabled: boolean;
  minReplicas: number;
  maxReplicas: number;
  targetCpuUtilization: number;
  targetMemoryUtilization: number;
}

export interface LoadBalancingConfig {
  algorithm: 'round_robin' | 'least_connections' | 'ip_hash' | 'weighted';
  healthCheck: boolean;
  stickySessions: boolean;
}

export interface HealthCheckConfig {
  path: string;
  interval: number;
  timeout: number;
  retries: number;
  successThreshold: number;
}

export interface NotificationConfig {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  recipients: string[];
  template?: string;
  enabled: boolean;
}