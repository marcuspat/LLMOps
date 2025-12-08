/**
 * Distributed Training Coordinator
 * Manages distributed machine learning training across multiple workers and nodes
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import {
  MLModel,
  TrainingConfig,
  ModelType,
  ModelStatus,
  MLPipelineEvent,
  MLPipelineEventType,
  DistributedConfig
} from '../../types/ml.js';
import { Logger } from 'winston';
import { WorkerPool } from './WorkerPool.js';
import { ParameterServer } from './ParameterServer.js';
import { GradientAggregator } from './GradientAggregator.js';
import { TrainingCoordinator } from './TrainingCoordinator.js';
import { ResourceManager } from './ResourceManager.js';
import { FaultToleranceManager } from './FaultToleranceManager.js';
import { CheckpointManager } from './CheckpointManager.js';

export interface DistributedTrainingConfig {
  strategy: 'data_parallel' | 'model_parallel' | 'hybrid' | 'pipeline_parallel';
  workers: WorkerConfig[];
  parameterServer?: ParameterServerConfig;
  synchronization: 'synchronous' | 'asynchronous' | 'semi_synchronous';
  allReduce?: AllReduceConfig;
  faultTolerance: FaultToleranceConfig;
  checkpoints: CheckpointConfig;
  resourceAllocation: ResourceAllocationConfig;
}

export interface WorkerConfig {
  id: string;
  endpoint: string;
  type: 'cpu' | 'gpu' | 'tpu';
  resources: WorkerResources;
  maxConcurrentTasks: number;
  priority: number;
  region?: string;
  zone?: string;
}

export interface WorkerResources {
  cpu: number;
  memory: number;
  gpu?: number;
  storage: number;
  network?: number;
}

export interface ParameterServerConfig {
  type: 'centralized' | 'decentralized' | 'ring_allreduce';
  replication: number;
  consistency: 'strong' | 'eventual' | 'causal';
  shardCount?: number;
}

export interface AllReduceConfig {
  algorithm: 'ring' | 'tree' | 'halving_doubling' | 'nccl';
  compression: boolean;
  compressionType: 'fp16' | 'int8' | 'sparse';
  overlap: boolean;
}

export interface FaultToleranceConfig {
  enabled: boolean;
  maxRetries: number;
  retryDelay: number;
  workerTimeout: number;
  checkpointInterval: number;
  automaticRecovery: boolean;
  spareWorkers: number;
}

export interface CheckpointConfig {
  enabled: boolean;
  interval: number;
  keepLast: number;
  compression: boolean;
  storage: StorageConfig;
}

export interface StorageConfig {
  type: 'local' | 's3' | 'gcs' | 'azure';
  path: string;
  credentials?: any;
}

export interface ResourceAllocationConfig {
  autoScaling: boolean;
  minWorkers: number;
  maxWorkers: number;
  scalingPolicy: ScalingPolicy;
  resourceLimits: ResourceLimits;
}

export interface ScalingPolicy {
  scaleUpThreshold: number;
  scaleDownThreshold: number;
  scaleUpCooldown: number;
  scaleDownCooldown: number;
  metrics: string[];
}

export interface ResourceLimits {
  maxCpu: number;
  maxMemory: number;
  maxGpu: number;
  maxCost: number;
}

export interface DistributedTrainingJob {
  id: string;
  name: string;
  config: DistributedTrainingConfig;
  model: MLModel;
  trainingConfig: TrainingConfig;
  datasetPath: string;
  status: TrainingJobStatus;
  workers: string[];
  startTime: Date;
  endTime?: Date;
  progress: TrainingProgress;
  metrics: DistributedTrainingMetrics;
  checkpoints: CheckpointInfo[];
}

export interface TrainingProgress {
  epoch: number;
  totalEpochs: number;
  step: number;
  totalSteps: number;
  loss: number;
  accuracy?: number;
  learningRate: number;
  workerProgress: Record<string, WorkerProgress>;
}

export interface WorkerProgress {
  workerId: string;
  epoch: number;
  step: number;
  loss: number;
  speed: number; // steps per second
  memoryUsage: number;
  gpuUtilization?: number;
  lastUpdate: Date;
}

export interface DistributedTrainingMetrics {
  globalThroughput: number;
  averageWorkerSpeed: number;
  loadBalance: number;
  communicationOverhead: number;
  stragglers: string[];
  efficiency: number;
  cost: number;
  timeToCompletion: number;
}

export interface CheckpointInfo {
  id: string;
  timestamp: Date;
  epoch: number;
  step: number;
  loss: number;
  path: string;
  size: number;
  workers: string[];
}

export enum TrainingJobStatus {
  INITIALIZING = 'initializing',
  PREPARING = 'preparing',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RECOVERING = 'recovering'
}

export class DistributedTrainingCoordinator extends EventEmitter {
  private activeJobs: Map<string, DistributedTrainingJob> = new Map();
  private workerPools: Map<string, WorkerPool> = new Map();
  private parameterServers: Map<string, ParameterServer> = new Map();
  private gradientAggregators: Map<string, GradientAggregator> = new Map();
  private resourceManager: ResourceManager;
  private faultToleranceManager: FaultToleranceManager;
  private checkpointManager: CheckpointManager;
  private logger: Logger;

  // Monitoring and optimization
  private optimizationEnabled: boolean = true;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private scalingInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger) {
    super();
    this.logger = logger;

    this.resourceManager = new ResourceManager(logger);
    this.faultToleranceManager = new FaultToleranceManager(logger);
    this.checkpointManager = new CheckpointManager(logger);

    this.setupEventHandlers();
    this.startBackgroundTasks();
  }

  /**
   * Initialize the distributed training coordinator
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Distributed Training Coordinator...');

    try {
      await this.resourceManager.initialize();
      await this.faultToleranceManager.initialize();
      await this.checkpointManager.initialize();

      this.logger.info('Distributed Training Coordinator initialized successfully');
      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize Distributed Training Coordinator:', error);
      throw error;
    }
  }

  /**
   * Start a distributed training job
   */
  async startDistributedTraining(
    name: string,
    model: MLModel,
    trainingConfig: TrainingConfig,
    datasetPath: string,
    distributedConfig: DistributedTrainingConfig
  ): Promise<string> {
    const jobId = this.generateJobId();

    this.logger.info(`Starting distributed training job ${jobId}: ${name}`);

    try {
      // Validate configuration
      this.validateDistributedConfig(distributedConfig);

      // Create training job
      const job: DistributedTrainingJob = {
        id: jobId,
        name,
        config: distributedConfig,
        model: { ...model, status: ModelStatus.TRAINING },
        trainingConfig,
        datasetPath,
        status: TrainingJobStatus.INITIALIZING,
        workers: [],
        startTime: new Date(),
        progress: {
          epoch: 0,
          totalEpochs: trainingConfig.epochs,
          step: 0,
          totalSteps: 0,
          loss: 0,
          learningRate: 0,
          workerProgress: {}
        },
        metrics: {
          globalThroughput: 0,
          averageWorkerSpeed: 0,
          loadBalance: 0,
          communicationOverhead: 0,
          stragglers: [],
          efficiency: 0,
          cost: 0,
          timeToCompletion: 0
        },
        checkpoints: []
      };

      this.activeJobs.set(jobId, job);

      // Emit job created event
      this.emitEvent({
        id: this.generateEventId(),
        type: MLPipelineEventType.TRAINING_STARTED,
        timestamp: new Date(),
        source: 'DistributedTrainingCoordinator',
        data: { jobId, name, config: distributedConfig }
      });

      // Start job execution
      this.executeDistributedTraining(job).catch((error) => {
        this.logger.error(`Distributed training job ${jobId} failed:`, error);
        job.status = TrainingJobStatus.FAILED;
        this.emit('job_failed', { jobId, error });
      });

      return jobId;

    } catch (error) {
      this.logger.error(`Failed to start distributed training job ${name}:`, error);
      throw error;
    }
  }

  /**
   * Execute distributed training
   */
  private async executeDistributedTraining(job: DistributedTrainingJob): Promise<void> {
    try {
      this.logger.info(`Executing distributed training for job ${job.id}`);

      // Phase 1: Preparation
      job.status = TrainingJobStatus.PREPARING;
      await this.prepareTraining(job);

      // Phase 2: Worker setup
      await this.setupWorkers(job);

      // Phase 3: Distributed training
      job.status = TrainingJobStatus.RUNNING;
      await this.runDistributedTraining(job);

      // Phase 4: Completion
      job.status = TrainingJobStatus.COMPLETED;
      job.endTime = new Date();

      this.logger.info(`Distributed training job ${job.id} completed successfully`);
      this.emit('job_completed', { jobId: job.id, duration: job.endTime.getTime() - job.startTime.getTime() });

    } catch (error) {
      job.status = TrainingJobStatus.FAILED;
      job.endTime = new Date();
      throw error;
    }
  }

  /**
   * Prepare distributed training
   */
  private async prepareTraining(job: DistributedTrainingJob): Promise<void> {
    this.logger.info(`Preparing distributed training for job ${job.id}`);

    // Allocate resources
    const allocatedWorkers = await this.resourceManager.allocateWorkers(
      job.config.workers,
      job.config.resourceAllocation
    );

    job.workers = allocatedWorkers.map(w => w.id);

    // Setup parameter servers if needed
    if (job.config.parameterServer) {
      await this.setupParameterServers(job);
    }

    // Setup gradient aggregators
    await this.setupGradientAggregators(job);

    // Initialize checkpoints
    if (job.config.checkpoints.enabled) {
      await this.checkpointManager.setupCheckpointing(job.id, job.config.checkpoints);
    }
  }

  /**
   * Setup workers
   */
  private async setupWorkers(job: DistributedTrainingJob): Promise<void> {
    this.logger.info(`Setting up ${job.workers.length} workers for job ${job.id}`);

    for (const workerId of job.workers) {
      const workerConfig = job.config.workers.find(w => w.id === workerId);
      if (!workerConfig) {
        throw new Error(`Worker configuration not found for ${workerId}`);
      }

      const workerPool = new WorkerPool(workerConfig, this.logger);
      await workerPool.initialize();
      this.workerPools.set(workerId, workerPool);

      // Setup event handlers for worker
      workerPool.on('progress', (progress) => {
        this.handleWorkerProgress(job.id, workerId, progress);
      });

      workerPool.on('error', (error) => {
        this.handleWorkerError(job.id, workerId, error);
      });
    }
  }

  /**
   * Run distributed training
   */
  private async runDistributedTraining(job: DistributedTrainingJob): Promise<void> {
    this.logger.info(`Running distributed training for job ${job.id}`);

    const { strategy, synchronization } = job.config;

    switch (strategy) {
      case 'data_parallel':
        await this.runDataParallelTraining(job, synchronization);
        break;
      case 'model_parallel':
        await this.runModelParallelTraining(job, synchronization);
        break;
      case 'pipeline_parallel':
        await this.runPipelineParallelTraining(job, synchronization);
        break;
      case 'hybrid':
        await this.runHybridTraining(job, synchronization);
        break;
      default:
        throw new Error(`Unsupported distributed training strategy: ${strategy}`);
    }
  }

  /**
   * Run data parallel training
   */
  private async runDataParallelTraining(
    job: DistributedTrainingJob,
    synchronization: string
  ): Promise<void> {
    this.logger.info(`Running data parallel training with ${synchronization} synchronization`);

    const coordinator = new TrainingCoordinator(job, this.logger);

    if (synchronization === 'synchronous') {
      await coordinator.runSynchronousDataParallel();
    } else if (synchronization === 'asynchronous') {
      await coordinator.runAsynchronousDataParallel();
    } else {
      await coordinator.runSemiSynchronousDataParallel();
    }
  }

  /**
   * Run model parallel training
   */
  private async runModelParallelTraining(
    job: DistributedTrainingJob,
    synchronization: string
  ): Promise<void> {
    this.logger.info(`Running model parallel training with ${synchronization} synchronization`);

    const coordinator = new TrainingCoordinator(job, this.logger);
    await coordinator.runModelParallel();
  }

  /**
   * Run pipeline parallel training
   */
  private async runPipelineParallelTraining(
    job: DistributedTrainingJob,
    synchronization: string
  ): Promise<void> {
    this.logger.info(`Running pipeline parallel training with ${synchronization} synchronization`);

    const coordinator = new TrainingCoordinator(job, this.logger);
    await coordinator.runPipelineParallel();
  }

  /**
   * Run hybrid training
   */
  private async runHybridTraining(
    job: DistributedTrainingJob,
    synchronization: string
  ): Promise<void> {
    this.logger.info(`Running hybrid training with ${synchronization} synchronization`);

    const coordinator = new TrainingCoordinator(job, this.logger);
    await coordinator.runHybridParallel();
  }

  /**
   * Get job status
   */
  getJobStatus(jobId: string): DistributedTrainingJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * List all active jobs
   */
  listActiveJobs(): DistributedTrainingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Pause a training job
   */
  async pauseJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== TrainingJobStatus.RUNNING) {
      throw new Error(`Cannot pause job ${jobId} with status ${job.status}`);
    }

    this.logger.info(`Pausing training job ${jobId}`);
    job.status = TrainingJobStatus.PAUSED;

    // Notify all workers to pause
    for (const workerId of job.workers) {
      const workerPool = this.workerPools.get(workerId);
      if (workerPool) {
        await workerPool.pause();
      }
    }

    this.emit('job_paused', { jobId });
  }

  /**
   * Resume a training job
   */
  async resumeJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.status !== TrainingJobStatus.PAUSED) {
      throw new Error(`Cannot resume job ${jobId} with status ${job.status}`);
    }

    this.logger.info(`Resuming training job ${jobId}`);
    job.status = TrainingJobStatus.RUNNING;

    // Notify all workers to resume
    for (const workerId of job.workers) {
      const workerPool = this.workerPools.get(workerId);
      if (workerPool) {
        await workerPool.resume();
      }
    }

    this.emit('job_resumed', { jobId });
  }

  /**
   * Cancel a training job
   */
  async cancelJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    this.logger.info(`Cancelling training job ${jobId}`);
    job.status = TrainingJobStatus.CANCELLED;
    job.endTime = new Date();

    // Notify all workers to stop
    for (const workerId of job.workers) {
      const workerPool = this.workerPools.get(workerId);
      if (workerPool) {
        await workerPool.stop();
      }
    }

    // Clean up resources
    await this.cleanupJob(jobId);

    this.emit('job_cancelled', { jobId });
  }

  /**
   * Get training metrics
   */
  getTrainingMetrics(jobId: string): DistributedTrainingMetrics | undefined {
    const job = this.activeJobs.get(jobId);
    return job?.metrics;
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(jobId: string): Promise<string> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    this.logger.info(`Creating checkpoint for job ${jobId}`);

    const checkpointId = await this.checkpointManager.createCheckpoint(jobId, {
      epoch: job.progress.epoch,
      step: job.progress.step,
      loss: job.progress.loss,
      model: job.model,
      workers: job.workers
    });

    const checkpointInfo: CheckpointInfo = {
      id: checkpointId,
      timestamp: new Date(),
      epoch: job.progress.epoch,
      step: job.progress.step,
      loss: job.progress.loss,
      path: `${job.config.checkpoints.storage.path}/${jobId}/${checkpointId}`,
      size: 0, // Would be calculated by checkpoint manager
      workers: job.workers
    };

    job.checkpoints.push(checkpointInfo);

    this.emit('checkpoint_created', { jobId, checkpointId });
    return checkpointId;
  }

  /**
   * Restore from checkpoint
   */
  async restoreFromCheckpoint(jobId: string, checkpointId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    this.logger.info(`Restoring job ${jobId} from checkpoint ${checkpointId}`);

    const checkpoint = await this.checkpointManager.loadCheckpoint(checkpointId);

    // Restore job state
    job.progress.epoch = checkpoint.epoch;
    job.progress.step = checkpoint.step;
    job.progress.loss = checkpoint.loss;
    job.model = checkpoint.model;

    this.emit('checkpoint_restored', { jobId, checkpointId });
  }

  /**
   * Shutdown the coordinator
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Distributed Training Coordinator...');

    try {
      // Stop all active jobs
      const activeJobs = Array.from(this.activeJobs.keys());
      await Promise.all(activeJobs.map(jobId => this.cancelJob(jobId)));

      // Cleanup resources
      await this.resourceManager.shutdown();
      await this.faultToleranceManager.shutdown();
      await this.checkpointManager.shutdown();

      // Clear intervals
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }
      if (this.scalingInterval) {
        clearInterval(this.scalingInterval);
      }

      this.logger.info('Distributed Training Coordinator shutdown complete');

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('Distributed Training Coordinator error:', error);
    });

    this.faultToleranceManager.on('worker_failure', (data) => {
      this.handleWorkerFailure(data.jobId, data.workerId, data.error);
    });

    this.resourceManager.on('scaling_event', (data) => {
      this.handleScalingEvent(data.jobId, data.event);
    });
  }

  private startBackgroundTasks(): void {
    // Health check interval
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // Every 30 seconds

    // Auto-scaling interval
    this.scalingInterval = setInterval(async () => {
      await this.performAutoScaling();
    }, 60000); // Every minute
  }

  private async performHealthChecks(): Promise<void> {
    for (const [jobId, job] of this.activeJobs) {
      for (const workerId of job.workers) {
        const workerPool = this.workerPools.get(workerId);
        if (workerPool) {
          try {
            await workerPool.healthCheck();
          } catch (error) {
            this.logger.warn(`Health check failed for worker ${workerId}:`, error);
            await this.handleWorkerError(jobId, workerId, error);
          }
        }
      }
    }
  }

  private async performAutoScaling(): Promise<void> {
    for (const [jobId, job] of this.activeJobs) {
      if (job.config.resourceAllocation.autoScaling && job.status === TrainingJobStatus.RUNNING) {
        await this.resourceManager.evaluateScaling(job);
      }
    }
  }

  private validateDistributedConfig(config: DistributedTrainingConfig): void {
    if (!config.workers || config.workers.length === 0) {
      throw new Error('At least one worker must be specified');
    }

    if (config.workers.length > 1000) {
      throw new Error('Too many workers specified (max 1000)');
    }

    // Additional validation logic here...
  }

  private async setupParameterServers(job: DistributedTrainingJob): Promise<void> {
    const config = job.config.parameterServer!;
    const parameterServer = new ParameterServer(config, this.logger);
    await parameterServer.initialize();
    this.parameterServers.set(job.id, parameterServer);
  }

  private async setupGradientAggregators(job: DistributedTrainingJob): Promise<void> {
    const aggregator = new GradientAggregator(job.config, this.logger);
    await aggregator.initialize();
    this.gradientAggregators.set(job.id, aggregator);
  }

  private handleWorkerProgress(jobId: string, workerId: string, progress: any): void {
    const job = this.activeJobs.get(jobId);
    if (job) {
      job.progress.workerProgress[workerId] = {
        workerId,
        epoch: progress.epoch,
        step: progress.step,
        loss: progress.loss,
        speed: progress.speed,
        memoryUsage: progress.memoryUsage,
        gpuUtilization: progress.gpuUtilization,
        lastUpdate: new Date()
      };

      // Update global progress
      this.updateGlobalProgress(job);
    }
  }

  private handleWorkerError(jobId: string, workerId: string, error: any): Promise<void> {
    this.logger.error(`Worker ${workerId} error in job ${jobId}:`, error);

    if (this.activeJobs.has(jobId)) {
      await this.faultToleranceManager.handleWorkerFailure(jobId, workerId, error);
    }
  }

  private handleWorkerFailure(jobId: string, workerId: string, error: any): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (job && job.config.faultTolerance.automaticRecovery) {
      this.logger.info(`Attempting automatic recovery for worker ${workerId} in job ${jobId}`);
      job.status = TrainingJobStatus.RECOVERING;
      // Recovery logic here...
    }
  }

  private handleScalingEvent(jobId: string, event: any): void {
    this.logger.info(`Scaling event for job ${jobId}:`, event);
    this.emit('scaling_event', { jobId, event });
  }

  private updateGlobalProgress(job: DistributedTrainingJob): void {
    const workerProgress = Object.values(job.progress.workerProgress);
    if (workerProgress.length === 0) return;

    // Calculate average progress
    const avgEpoch = workerProgress.reduce((sum, p) => sum + p.epoch, 0) / workerProgress.length;
    const avgStep = workerProgress.reduce((sum, p) => sum + p.step, 0) / workerProgress.length;
    const avgLoss = workerProgress.reduce((sum, p) => sum + p.loss, 0) / workerProgress.length;
    const avgSpeed = workerProgress.reduce((sum, p) => sum + p.speed, 0) / workerProgress.length;

    job.progress.epoch = Math.floor(avgEpoch);
    job.progress.step = Math.floor(avgStep);
    job.progress.loss = avgLoss;
    job.metrics.averageWorkerSpeed = avgSpeed;
  }

  private async cleanupJob(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Stop worker pools
    for (const workerId of job.workers) {
      const workerPool = this.workerPools.get(workerId);
      if (workerPool) {
        await workerPool.shutdown();
        this.workerPools.delete(workerId);
      }
    }

    // Cleanup parameter servers
    const parameterServer = this.parameterServers.get(jobId);
    if (parameterServer) {
      await parameterServer.shutdown();
      this.parameterServers.delete(jobId);
    }

    // Cleanup gradient aggregators
    const aggregator = this.gradientAggregators.get(jobId);
    if (aggregator) {
      await aggregator.shutdown();
      this.gradientAggregators.delete(jobId);
    }

    // Release resources
    await this.resourceManager.releaseWorkers(job.workers);

    this.activeJobs.delete(jobId);
  }

  private emitEvent(event: MLPipelineEvent): void {
    this.emit('event', event);
    this.emit(event.type, event);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}