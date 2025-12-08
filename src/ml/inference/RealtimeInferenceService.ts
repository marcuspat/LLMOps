/**
 * Real-time Inference Service
 * High-performance inference service for ML models with caching, batching, and monitoring
 */

import * as tf from '@tensorflow/tfjs-node';
import { EventEmitter } from 'events';
import {
  PredictionRequest,
  PredictionResponse,
  BatchPredictionRequest,
  BatchPredictionResponse,
  MLPipelineEvent,
  MLPipelineEventType,
  ModelStatus,
  MonitoringMetrics
} from '../../types/ml.js';
import { Logger } from 'winston';
import { ModelRegistry } from '../core/ModelRegistry.js';
import { InferenceCache } from './InferenceCache.js';
import { BatchProcessor } from './BatchProcessor.js';
import { LoadBalancer } from './LoadBalancer.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { QueueManager } from './QueueManager.js';

export interface InferenceServiceConfig {
  maxConcurrency: number;
  batchSize: number;
  batchTimeout: number;
  cacheEnabled: boolean;
  cacheSize: number;
  cacheTTL: number;
  loadBalancingStrategy: 'round_robin' | 'least_loaded' | 'weighted';
  monitoringEnabled: boolean;
  queueEnabled: boolean;
  maxQueueSize: number;
  priorityQueues: string[];
}

export interface InferenceMetrics {
  requestCount: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number;
  errorRate: number;
  cacheHitRate: number;
  memoryUsage: number;
  gpuUtilization?: number;
}

export interface ModelEndpoint {
  modelId: string;
  status: ModelStatus;
  endpoint: string;
  load: number;
  lastHealthCheck: Date;
  metrics: ModelEndpointMetrics;
}

export interface ModelEndpointMetrics {
  requestsPerSecond: number;
  averageLatency: number;
  errorRate: number;
  memoryUsage: number;
  queueSize: number;
}

export interface InferenceRequest extends PredictionRequest {
  id: string;
  timestamp: Date;
  priority: number;
  timeout: number;
  retries: number;
  maxRetries: number;
}

export interface InferenceResponse extends PredictionResponse {
  requestId: string;
  modelEndpoint: string;
  cacheHit: boolean;
  queueTime: number;
  processingTime: number;
}

export class RealtimeInferenceService extends EventEmitter {
  private config: InferenceServiceConfig;
  private logger: Logger;
  private modelRegistry: ModelRegistry;
  private inferenceCache: InferenceCache;
  private batchProcessor: BatchProcessor;
  private loadBalancer: LoadBalancer;
  private performanceMonitor: PerformanceMonitor;
  private queueManager: QueueManager;

  // Runtime state
  private activeRequests: Map<string, InferenceRequest> = new Map();
  private modelEndpoints: Map<string, ModelEndpoint> = new Map();
  private requestQueue: InferenceRequest[] = [];
  private isProcessing: boolean = false;
  private metrics: InferenceMetrics;
  private shutdownRequested: boolean = false;

  // Performance optimization
  private requestLatencies: number[] = [];
  private maxLatencyHistory: number = 1000;

  constructor(config: InferenceServiceConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.modelRegistry = new ModelRegistry({}, logger);
    this.inferenceCache = new InferenceCache(config.cacheSize, config.cacheTTL, logger);
    this.batchProcessor = new BatchProcessor(config.batchSize, config.batchTimeout, logger);
    this.loadBalancer = new LoadBalancer(config.loadBalancingStrategy, logger);
    this.performanceMonitor = new PerformanceMonitor(logger);
    this.queueManager = new QueueManager(config.maxQueueSize, logger);

    this.metrics = {
      requestCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
      errorRate: 0,
      cacheHitRate: 0,
      memoryUsage: 0
    };

    this.setupEventHandlers();
  }

  /**
   * Initialize the inference service
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Real-time Inference Service...');

    try {
      // Initialize components
      await this.modelRegistry.initialize();
      await this.inferenceCache.initialize();
      await this.batchProcessor.initialize();
      await this.loadBalancer.initialize();
      await this.performanceMonitor.initialize();
      await this.queueManager.initialize();

      // Load available models
      await this.loadAvailableModels();

      // Start background processing
      this.startBackgroundProcessing();

      // Start monitoring
      if (this.config.monitoringEnabled) {
        this.startMonitoring();
      }

      this.logger.info('Real-time Inference Service initialized successfully');
      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize Real-time Inference Service:', error);
      throw error;
    }
  }

  /**
   * Make a single prediction
   */
  async predict(request: PredictionRequest): Promise<PredictionResponse> {
    const startTime = Date.now();
    const inferenceRequest: InferenceRequest = {
      ...request,
      id: this.generateRequestId(),
      timestamp: new Date(),
      priority: 0,
      timeout: 30000, // 30 seconds default
      retries: 0,
      maxRetries: 3
    };

    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cachedResult = await this.inferenceCache.get(request);
        if (cachedResult) {
          this.updateCacheMetrics(true);
          this.emit('cache_hit', { requestId: inferenceRequest.id });
          return cachedResult;
        }
      }

      // Check if model is available
      const modelEndpoint = await this.loadBalancer.selectEndpoint(request.modelId);
      if (!modelEndpoint) {
        throw new Error(`No available endpoint for model ${request.modelId}`);
      }

      // Check queue size
      if (this.config.queueEnabled && this.requestQueue.length >= this.config.maxQueueSize) {
        throw new Error('Inference queue is full');
      }

      // Add to queue or process immediately based on load
      if (this.shouldQueue(inferenceRequest)) {
        this.queueRequest(inferenceRequest);
        return await this.waitForResponse(inferenceRequest.id);
      } else {
        return await this.processRequest(inferenceRequest, modelEndpoint);
      }

    } catch (error) {
      this.updateErrorMetrics();
      this.logger.error(`Prediction failed for request ${inferenceRequest.id}:`, error);
      throw error;
    } finally {
      const latency = Date.now() - startTime;
      this.updateLatencyMetrics(latency);
    }
  }

  /**
   * Make batch predictions
   */
  async predictBatch(request: BatchPredictionRequest): Promise<BatchPredictionResponse> {
    const startTime = Date.now();

    try {
      // Check if batching is beneficial for this request size
      if (request.inputs.length < this.config.batchSize) {
        // Fall back to individual predictions
        const predictions: any[] = [];
        const latencies: number[] = [];

        for (const input of request.inputs) {
          const singleRequest: PredictionRequest = {
            modelId: request.modelId,
            input,
            preprocessor: request.preprocessor,
            postprocessor: request.postprocessor,
            metadata: request.metadata
          };

          const response = await this.predict(singleRequest);
          predictions.push(response.prediction);
          latencies.push(response.latency);
        }

        return {
          predictions,
          latencies,
          totalLatency: Date.now() - startTime,
          metadata: {
            modelId: request.modelId,
            timestamp: new Date(),
            batchSize: request.inputs.length,
            processingMethod: 'individual'
          }
        };
      }

      // Process as batch
      return await this.processBatchRequest(request);

    } catch (error) {
      this.logger.error('Batch prediction failed:', error);
      throw error;
    }
  }

  /**
   * Get service metrics
   */
  getMetrics(): InferenceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get model endpoint status
   */
  getModelEndpoints(): ModelEndpoint[] {
    return Array.from(this.modelEndpoints.values());
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    size: number;
    processing: boolean;
    oldestRequest?: Date;
  } {
    const oldestRequest = this.requestQueue.length > 0
      ? this.requestQueue[0].timestamp
      : undefined;

    return {
      size: this.requestQueue.length,
      processing: this.isProcessing,
      oldestRequest
    };
  }

  /**
   * Add a new model endpoint
   */
  async addModelEndpoint(modelId: string, endpoint: string): Promise<void> {
    this.logger.info(`Adding model endpoint: ${modelId} -> ${endpoint}`);

    try {
      const modelEndpoint: ModelEndpoint = {
        modelId,
        endpoint,
        status: ModelStatus.READY,
        load: 0,
        lastHealthCheck: new Date(),
        metrics: {
          requestsPerSecond: 0,
          averageLatency: 0,
          errorRate: 0,
          memoryUsage: 0,
          queueSize: 0
        }
      };

      this.modelEndpoints.set(modelId, modelEndpoint);
      await this.loadBalancer.addEndpoint(modelId, endpoint);

      // Start health checking
      this.startHealthCheck(modelId);

      this.emit('endpoint_added', { modelId, endpoint });

    } catch (error) {
      this.logger.error(`Failed to add model endpoint ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Remove a model endpoint
   */
  async removeModelEndpoint(modelId: string): Promise<void> {
    this.logger.info(`Removing model endpoint: ${modelId}`);

    try {
      this.modelEndpoints.delete(modelId);
      await this.loadBalancer.removeEndpoint(modelId);

      this.emit('endpoint_removed', { modelId });

    } catch (error) {
      this.logger.error(`Failed to remove model endpoint ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Shutdown the inference service
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Real-time Inference Service...');

    this.shutdownRequested = true;

    try {
      // Wait for active requests to complete or timeout
      const timeout = 30000; // 30 seconds
      const startShutdown = Date.now();

      while (this.activeRequests.size > 0 && Date.now() - startShutdown < timeout) {
        await this.sleep(1000);
      }

      // Stop background processing
      this.isProcessing = false;

      // Shutdown components
      await this.inferenceCache.shutdown();
      await this.batchProcessor.shutdown();
      await this.loadBalancer.shutdown();
      await this.performanceMonitor.shutdown();
      await this.queueManager.shutdown();

      this.logger.info('Real-time Inference Service shutdown complete');

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('Inference service error:', error);
    });

    // Handle inference cache events
    this.inferenceCache.on('eviction', (data) => {
      this.emit('cache_eviction', data);
    });

    // Handle batch processor events
    this.batchProcessor.on('batch_completed', (data) => {
      this.emit('batch_completed', data);
    });

    // Handle load balancer events
    this.loadBalancer.on('endpoint_health_change', (data) => {
      this.emit('endpoint_health_change', data);
    });
  }

  private async loadAvailableModels(): Promise<void> {
    try {
      const models = await this.modelRegistry.loadAllModels();

      for (const model of models) {
        if (model.status === ModelStatus.READY || model.status === ModelStatus.DEPLOYED) {
          await this.addModelEndpoint(model.id, `http://localhost:3000/inference/${model.id}`);
        }
      }

      this.logger.info(`Loaded ${models.length} models`);

    } catch (error) {
      this.logger.warn('Failed to load models:', error);
    }
  }

  private startBackgroundProcessing(): void {
    setInterval(async () => {
      if (!this.isProcessing && this.requestQueue.length > 0 && !this.shutdownRequested) {
        this.processQueue();
      }
    }, 100); // Process queue every 100ms
  }

  private startMonitoring(): void {
    setInterval(async () => {
      await this.collectMetrics();
    }, 5000); // Collect metrics every 5 seconds

    setInterval(async () => {
      await this.updateModelEndpoints();
    }, 30000); // Update endpoint metrics every 30 seconds
  }

  private startHealthCheck(modelId: string): void {
    setInterval(async () => {
      await this.checkEndpointHealth(modelId);
    }, 60000); // Health check every minute
  }

  private async checkEndpointHealth(modelId: string): Promise<void> {
    const endpoint = this.modelEndpoints.get(modelId);
    if (!endpoint) return;

    try {
      // Simple health check - in practice, this would make actual HTTP requests
      const isHealthy = Math.random() > 0.01; // 99% uptime simulation

      endpoint.status = isHealthy ? ModelStatus.READY : ModelStatus.FAILED;
      endpoint.lastHealthCheck = new Date();

    } catch (error) {
      endpoint.status = ModelStatus.FAILED;
      endpoint.lastHealthCheck = new Date();
      this.logger.warn(`Health check failed for ${modelId}:`, error);
    }
  }

  private shouldQueue(request: InferenceRequest): boolean {
    if (!this.config.queueEnabled) return false;

    // Check system load
    const avgLoad = this.calculateAverageLoad();
    if (avgLoad > 0.8) return true; // Queue if load is high

    // Check queue size
    if (this.requestQueue.length > this.config.maxQueueSize * 0.8) return true;

    // Check concurrency limit
    if (this.activeRequests.size >= this.config.maxConcurrency) return true;

    return false;
  }

  private queueRequest(request: InferenceRequest): void {
    this.requestQueue.push(request);
    this.sortQueue();
  }

  private sortQueue(): void {
    this.requestQueue.sort((a, b) => {
      // Sort by priority first, then timestamp
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) return;

    this.isProcessing = true;

    try {
      const availableSlots = this.config.maxConcurrency - this.activeRequests.size;
      const requestsToProcess = this.requestQueue.splice(0, availableSlots);

      const promises = requestsToProcess.map(async (request) => {
        try {
          const endpoint = await this.loadBalancer.selectEndpoint(request.modelId);
          if (endpoint) {
            return await this.processRequest(request, endpoint);
          } else {
            throw new Error(`No available endpoint for model ${request.modelId}`);
          }
        } catch (error) {
          this.logger.error(`Failed to process request ${request.id}:`, error);
          throw error;
        }
      });

      await Promise.allSettled(promises);

    } finally {
      this.isProcessing = false;
    }
  }

  private async processRequest(
    request: InferenceRequest,
    endpoint: ModelEndpoint
  ): Promise<InferenceResponse> {
    const startTime = Date.now();
    this.activeRequests.set(request.id, request);

    try {
      // Update endpoint load
      endpoint.load += 1;

      // Process the request
      const response = await this.executeInference(request, endpoint);

      // Cache the result if caching is enabled
      if (this.config.cacheEnabled) {
        await this.inferenceCache.set(request, response);
      }

      const processingTime = Date.now() - startTime;

      // Update endpoint metrics
      endpoint.load -= 1;
      endpoint.metrics.requestsPerSecond += 1;
      endpoint.metrics.averageLatency =
        (endpoint.metrics.averageLatency + processingTime) / 2;

      const inferenceResponse: InferenceResponse = {
        ...response,
        requestId: request.id,
        modelEndpoint: endpoint.endpoint,
        cacheHit: false,
        queueTime: startTime - request.timestamp.getTime(),
        processingTime
      };

      // Update global metrics
      this.updateSuccessMetrics();

      // Emit completion event
      this.emit('request_completed', {
        requestId: request.id,
        latency: processingTime,
        endpoint: endpoint.endpoint
      });

      return inferenceResponse;

    } catch (error) {
      endpoint.load -= 1;
      throw error;
    } finally {
      this.activeRequests.delete(request.id);
    }
  }

  private async executeInference(
    request: InferenceRequest,
    endpoint: ModelEndpoint
  ): Promise<PredictionResponse> {
    // This would make actual HTTP request to the model endpoint
    // For now, simulate inference
    const simulatedLatency = Math.random() * 100 + 50; // 50-150ms

    await this.sleep(simulatedLatency);

    return {
      prediction: Math.random(), // Simulated prediction
      latency: simulatedLatency,
      metadata: {
        modelId: request.modelId,
        timestamp: new Date(),
        endpoint: endpoint.endpoint
      }
    };
  }

  private async processBatchRequest(request: BatchPredictionRequest): Promise<BatchPredictionResponse> {
    const startTime = Date.now();

    // Use batch processor to handle batch efficiently
    const batchResults = await this.batchProcessor.processBatch(request);

    return {
      predictions: batchResults.predictions,
      confidences: batchResults.confidences,
      latencies: batchResults.latencies,
      totalLatency: Date.now() - startTime,
      metadata: {
        modelId: request.modelId,
        timestamp: new Date(),
        batchSize: request.inputs.length,
        processingMethod: 'batch'
      }
    };
  }

  private async waitForResponse(requestId: string): Promise<PredictionResponse> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Request ${requestId} timed out`));
      }, 30000);

      const checkResponse = () => {
        if (!this.activeRequests.has(requestId)) {
          clearTimeout(timeout);
          // This would need proper response tracking
          resolve({
            prediction: Math.random(),
            latency: Date.now(),
            metadata: {}
          });
        } else {
          setTimeout(checkResponse, 100);
        }
      };

      checkResponse();
    });
  }

  private calculateAverageLoad(): number {
    if (this.modelEndpoints.size === 0) return 0;

    const totalLoad = Array.from(this.modelEndpoints.values())
      .reduce((sum, endpoint) => sum + endpoint.load, 0);

    return totalLoad / this.modelEndpoints.size;
  }

  private updateLatencyMetrics(latency: number): void {
    this.requestLatencies.push(latency);
    if (this.requestLatencies.length > this.maxLatencyHistory) {
      this.requestLatencies.shift();
    }

    this.metrics.averageLatency = this.requestLatencies.reduce((a, b) => a + b, 0) / this.requestLatencies.length;

    // Calculate percentiles
    const sorted = [...this.requestLatencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p99Index = Math.floor(sorted.length * 0.99);

    this.metrics.p95Latency = sorted[p95Index] || 0;
    this.metrics.p99Latency = sorted[p99Index] || 0;
  }

  private updateSuccessMetrics(): void {
    this.metrics.requestCount += 1;

    // Update cache hit rate
    this.updateCacheMetrics(false);

    // Update throughput
    this.metrics.throughput = this.metrics.requestCount / (Date.now() / 1000);

    // Update memory usage (simplified)
    this.metrics.memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  }

  private updateErrorMetrics(): void {
    const totalRequests = this.metrics.requestCount + 1;
    this.metrics.errorRate = 1 / totalRequests;
  }

  private updateCacheMetrics(hit: boolean): void {
    if (hit) {
      const totalCacheRequests = this.metrics.requestCount || 1;
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * (totalCacheRequests - 1) + 1) / totalCacheRequests;
    } else {
      const totalCacheRequests = this.metrics.requestCount || 1;
      this.metrics.cacheHitRate = (this.metrics.cacheHitRate * totalCacheRequests) / totalCacheRequests;
    }
  }

  private async collectMetrics(): Promise<void> {
    // Collect detailed metrics for monitoring
    const detailedMetrics = {
      timestamp: new Date(),
      activeRequests: this.activeRequests.size,
      queueSize: this.requestQueue.length,
      endpoints: this.getModelEndpoints(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };

    this.emit('metrics_collected', detailedMetrics);
  }

  private async updateModelEndpoints(): Promise<void> {
    // Update endpoint metrics
    for (const endpoint of this.modelEndpoints.values()) {
      // Reset per-second metrics
      endpoint.metrics.requestsPerSecond = 0;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}