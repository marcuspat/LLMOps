/**
 * ML Evaluation Dashboard
 * Comprehensive monitoring and evaluation dashboard for machine learning models and training
 */

import { EventEmitter } from 'events';
import {
  MLModel,
  Experiment,
  MonitoringMetrics,
  ModelPerformance,
  MLPipelineEvent,
  MLPipelineEventType,
  DataDriftMetrics,
  ConceptDriftMetrics
} from '../../types/ml.js';
import { Logger } from 'winston';
import { MetricsCollector } from './MetricsCollector.js';
import { AlertManager } from './AlertManager.js';
import { ReportGenerator } from './ReportGenerator.js';
import { VisualizationService } from './VisualizationService.js';
import { PerformanceAnalyzer } from './PerformanceAnalyzer.js';
import { DriftDetector } from './DriftDetector.js';
import { ModelComparator } from './ModelComparator.js';

export interface DashboardConfig {
  refreshInterval: number;
  metricsRetention: number;
  alerting: AlertingConfig;
  visualizations: VisualizationConfig;
  reports: ReportConfig;
  performance: PerformanceAnalysisConfig;
}

export interface AlertingConfig {
  enabled: boolean;
  thresholds: AlertThresholds;
  channels: AlertChannel[];
  cooldown: number;
}

export interface AlertThresholds {
  accuracy: { min: number, max: number };
  latency: { min: number, max: number };
  errorRate: { min: number, max: number };
  drift: { min: number, max: number };
  resource: { cpu: number, memory: number };
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  enabled: boolean;
  config: any;
  recipients: string[];
}

export interface VisualizationConfig {
  enabled: boolean;
  types: VisualizationType[];
  updateInterval: number;
  exportFormats: string[];
}

export interface VisualizationType {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'scatter' | 'heatmap' | 'gauge' | 'table';
  dataSource: string;
  refreshRate: number;
}

export interface ReportConfig {
  enabled: boolean;
  schedule: ReportSchedule[];
  formats: string[];
  distribution: ReportDistribution;
}

export interface ReportSchedule {
  type: 'daily' | 'weekly' | 'monthly' | 'on_demand';
  time: string;
  recipients: string[];
  template: string;
}

export interface ReportDistribution {
  email: boolean;
  slack: boolean;
  webhook: boolean;
  storage: boolean;
}

export interface PerformanceAnalysisConfig {
  enabled: boolean;
  benchmarking: boolean;
  comparison: boolean;
  trending: boolean;
  anomalyDetection: boolean;
}

export interface DashboardData {
  overview: OverviewMetrics;
  models: ModelDashboardData[];
  experiments: ExperimentDashboardData[];
  system: SystemMetrics;
  alerts: AlertData[];
  trends: TrendData;
  drift: DriftData;
}

export interface OverviewMetrics {
  totalModels: number;
  activeModels: number;
  totalExperiments: number;
  runningExperiments: number;
  systemHealth: number;
  averageAccuracy: number;
  averageLatency: number;
  errorRate: number;
  resourceUtilization: ResourceUtilization;
}

export interface ModelDashboardData {
  model: MLModel;
  currentMetrics: ModelPerformance;
  historicalMetrics: HistoricalMetrics[];
  predictions: PredictionMetrics;
  drift: ModelDriftMetrics;
  health: ModelHealth;
  comparisons: ModelComparison[];
}

export interface HistoricalMetrics {
  timestamp: Date;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  latency: number;
  throughput: number;
  errorRate: number;
}

export interface PredictionMetrics {
  totalPredictions: number;
  successfulPredictions: number;
  failedPredictions: number;
  averageLatency: number;
  throughput: number;
  accuracy: number;
}

export interface ModelDriftMetrics {
  dataDrift?: DataDriftMetrics;
  conceptDrift?: ConceptDriftMetrics;
  lastDriftDetected: Date;
  driftScore: number;
}

export interface ModelHealth {
  status: 'healthy' | 'warning' | 'critical';
  score: number;
  issues: HealthIssue[];
  lastCheck: Date;
}

export interface HealthIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
  detected: Date;
}

export interface ModelComparison {
  baselineModel: string;
  comparisonModel: string;
  metrics: ComparisonMetrics;
  improvement: number;
  recommendation: string;
}

export interface ComparisonMetrics {
  accuracyDelta: number;
  latencyDelta: number;
  memoryDelta: number;
  throughputDelta: number;
}

export interface ExperimentDashboardData {
  experiment: Experiment;
  progress: ExperimentProgress;
  metrics: ExperimentMetrics;
  comparison: ExperimentComparison;
}

export interface ExperimentProgress {
  currentEpoch: number;
  totalEpochs: number;
  currentStep: number;
  totalSteps: number;
  timeElapsed: number;
  estimatedCompletion: Date;
  resourceUsage: ResourceUtilization;
}

export interface ExperimentMetrics {
  trainingLoss: number[];
  validationLoss: number[];
  accuracy: number[];
  learningRate: number;
  hyperparameters: Record<string, any>;
}

export interface ExperimentComparison {
  baseline: string;
  improvements: string[];
  regressions: string[];
  recommendation: string;
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  gpu?: number;
  disk: number;
  network: number;
  uptime: number;
  activeConnections: number;
  queueSizes: Record<string, number>;
}

export interface AlertData {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  resolved: boolean;
}

export interface TrendData {
  modelPerformance: PerformanceTrend[];
  systemUtilization: UtilizationTrend[];
  errorRates: ErrorRateTrend[];
  predictionVolume: VolumeTrend[];
}

export interface PerformanceTrend {
  timestamp: Date;
  modelId: string;
  metric: string;
  value: number;
}

export interface UtilizationTrend {
  timestamp: Date;
  resource: string;
  utilization: number;
}

export interface ErrorRateTrend {
  timestamp: Date;
  modelId: string;
  errorRate: number;
}

export interface VolumeTrend {
  timestamp: Date;
  predictions: number;
}

export interface DriftData {
  dataDrift: Record<string, DataDriftMetrics>;
  conceptDrift: Record<string, ConceptDriftMetrics>;
  driftTrends: DriftTrend[];
}

export interface DriftTrend {
  timestamp: Date;
  modelId: string;
  driftType: 'data' | 'concept';
  score: number;
}

export interface ResourceUtilization {
  cpu: number;
  memory: number;
  gpu?: number;
  storage: number;
  network: number;
}

export class MLEvaluationDashboard extends EventEmitter {
  private config: DashboardConfig;
  private logger: Logger;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  private reportGenerator: ReportGenerator;
  private visualizationService: VisualizationService;
  private performanceAnalyzer: PerformanceAnalyzer;
  private driftDetector: DriftDetector;
  private modelComparator: ModelComparator;

  // Data storage
  private dashboardData: DashboardData;
  private refreshTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor(config: DashboardConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;

    this.metricsCollector = new MetricsCollector(logger);
    this.alertManager = new AlertManager(config.alerting, logger);
    this.reportGenerator = new ReportGenerator(config.reports, logger);
    this.visualizationService = new VisualizationService(config.visualizations, logger);
    this.performanceAnalyzer = new PerformanceAnalyzer(config.performance, logger);
    this.driftDetector = new DriftDetector(logger);
    this.modelComparator = new ModelComparator(logger);

    this.initializeDashboardData();
    this.setupEventHandlers();
  }

  /**
   * Initialize the dashboard
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing ML Evaluation Dashboard...');

    try {
      // Initialize components
      await this.metricsCollector.initialize();
      await this.alertManager.initialize();
      await this.reportGenerator.initialize();
      await this.visualizationService.initialize();
      await this.performanceAnalyzer.initialize();
      await this.driftDetector.initialize();
      await this.modelComparator.initialize();

      // Start data collection
      await this.startDataCollection();

      // Start refresh timer
      this.startRefreshTimer();

      this.isRunning = true;
      this.logger.info('ML Evaluation Dashboard initialized successfully');
      this.emit('initialized', { timestamp: new Date() });

    } catch (error) {
      this.logger.error('Failed to initialize ML Evaluation Dashboard:', error);
      throw error;
    }
  }

  /**
   * Get current dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    if (!this.isRunning) {
      throw new Error('Dashboard is not running');
    }

    try {
      // Refresh data if needed
      await this.refreshDashboardData();
      return this.dashboardData;

    } catch (error) {
      this.logger.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get model-specific dashboard data
   */
  async getModelDashboardData(modelId: string): Promise<ModelDashboardData | null> {
    try {
      const modelData = this.dashboardData.models.find(m => m.model.id === modelId);
      if (!modelData) {
        return null;
      }

      // Refresh model-specific data
      await this.refreshModelData(modelData);
      return modelData;

    } catch (error) {
      this.logger.error(`Failed to get model dashboard data for ${modelId}:`, error);
      throw error;
    }
  }

  /**
   * Get experiment-specific dashboard data
   */
  async getExperimentDashboardData(experimentId: string): Promise<ExperimentDashboardData | null> {
    try {
      const experimentData = this.dashboardData.experiments.find(e => e.experiment.id === experimentId);
      if (!experimentData) {
        return null;
      }

      // Refresh experiment-specific data
      await this.refreshExperimentData(experimentData);
      return experimentData;

    } catch (error) {
      this.logger.error(`Failed to get experiment dashboard data for ${experimentId}:`, error);
      throw error;
    }
  }

  /**
   * Generate and send reports
   */
  async generateReport(type: 'daily' | 'weekly' | 'monthly' | 'custom', customConfig?: any): Promise<void> {
    try {
      this.logger.info(`Generating ${type} report`);

      const reportData = await this.collectReportData();
      const report = await this.reportGenerator.generateReport(type, reportData, customConfig);

      // Distribute report
      await this.distributeReport(report);

      this.logger.info(`${type} report generated and distributed successfully`);
      this.emit('report_generated', { type, report });

    } catch (error) {
      this.logger.error(`Failed to generate ${type} report:`, error);
      throw error;
    }
  }

  /**
   * Create visualization
   */
  async createVisualization(
    type: VisualizationType['type'],
    dataSource: string,
    config: any
  ): Promise<any> {
    try {
      return await this.visualizationService.createVisualization(type, dataSource, config);
    } catch (error) {
      this.logger.error(`Failed to create visualization:`, error);
      throw error;
    }
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    // Check system metrics
    if (this.dashboardData.system.cpu > 90) {
      issues.push('High CPU utilization');
      score -= 20;
    }

    if (this.dashboardData.system.memory > 90) {
      issues.push('High memory utilization');
      score -= 20;
    }

    if (this.dashboardData.overview.errorRate > 0.05) {
      issues.push('High error rate');
      score -= 15;
    }

    // Check active alerts
    const criticalAlerts = this.dashboardData.alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts`);
      score -= 25;
    }

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (score < 70) status = 'critical';
    else if (score < 85) status = 'warning';

    return { status, score, issues };
  }

  /**
   * Acknowledge alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    const alert = this.dashboardData.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      await this.alertManager.acknowledgeAlert(alertId);
      this.emit('alert_acknowledged', { alertId });
    }
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const alert = this.dashboardData.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      await this.alertManager.resolveAlert(alertId);
      this.emit('alert_resolved', { alertId });
    }
  }

  /**
   * Compare models
   */
  async compareModels(modelIds: string[]): Promise<ModelComparison[]> {
    try {
      return await this.modelComparator.compareModels(modelIds);
    } catch (error) {
      this.logger.error('Failed to compare models:', error);
      throw error;
    }
  }

  /**
   * Shutdown the dashboard
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down ML Evaluation Dashboard...');

    try {
      this.isRunning = false;

      // Stop refresh timer
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }

      // Shutdown components
      await this.metricsCollector.shutdown();
      await this.alertManager.shutdown();
      await this.reportGenerator.shutdown();
      await this.visualizationService.shutdown();
      await this.performanceAnalyzer.shutdown();
      await this.driftDetector.shutdown();
      await this.modelComparator.shutdown();

      this.logger.info('ML Evaluation Dashboard shutdown complete');

    } catch (error) {
      this.logger.error('Error during shutdown:', error);
    }
  }

  // Private helper methods

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      this.logger.error('Dashboard error:', error);
    });

    this.metricsCollector.on('metrics_collected', (data) => {
      this.updateDashboardMetrics(data);
    });

    this.alertManager.on('alert_triggered', (alert) => {
      this.dashboardData.alerts.push(alert);
      this.emit('alert_triggered', alert);
    });

    this.driftDetector.on('drift_detected', (driftData) => {
      this.updateDriftData(driftData);
      this.emit('drift_detected', driftData);
    });

    this.performanceAnalyzer.on('performance_issue', (issue) => {
      this.handlePerformanceIssue(issue);
    });
  }

  private initializeDashboardData(): void {
    this.dashboardData = {
      overview: {
        totalModels: 0,
        activeModels: 0,
        totalExperiments: 0,
        runningExperiments: 0,
        systemHealth: 100,
        averageAccuracy: 0,
        averageLatency: 0,
        errorRate: 0,
        resourceUtilization: {
          cpu: 0,
          memory: 0,
          storage: 0,
          network: 0
        }
      },
      models: [],
      experiments: [],
      system: {
        cpu: 0,
        memory: 0,
        uptime: 0,
        activeConnections: 0,
        queueSizes: {},
        disk: 0,
        network: 0
      },
      alerts: [],
      trends: {
        modelPerformance: [],
        systemUtilization: [],
        errorRates: [],
        predictionVolume: []
      },
      drift: {
        dataDrift: {},
        conceptDrift: {},
        driftTrends: []
      }
    };
  }

  private async startDataCollection(): Promise<void> {
    await this.metricsCollector.startCollection();
    await this.performanceAnalyzer.startAnalysis();
    await this.driftDetector.startDetection();
  }

  private startRefreshTimer(): void {
    this.refreshTimer = setInterval(async () => {
      if (this.isRunning) {
        await this.refreshDashboardData();
      }
    }, this.config.refreshInterval * 1000);
  }

  private async refreshDashboardData(): Promise<void> {
    try {
      // Collect latest metrics
      const metrics = await this.metricsCollector.collectAllMetrics();

      // Update overview
      this.updateOverviewMetrics(metrics);

      // Update system metrics
      this.updateSystemMetrics(metrics);

      // Update model data
      await this.updateAllModelData();

      // Update experiment data
      await this.updateAllExperimentData();

      // Update trends
      this.updateTrendData(metrics);

      // Clean old data
      this.cleanupOldData();

    } catch (error) {
      this.logger.error('Failed to refresh dashboard data:', error);
    }
  }

  private updateOverviewMetrics(metrics: any): void {
    // This would update overview metrics based on collected data
    this.dashboardData.overview.totalModels = metrics.totalModels || 0;
    this.dashboardData.overview.activeModels = metrics.activeModels || 0;
    this.dashboardData.overview.totalExperiments = metrics.totalExperiments || 0;
    this.dashboardData.overview.runningExperiments = metrics.runningExperiments || 0;
    this.dashboardData.overview.averageAccuracy = metrics.averageAccuracy || 0;
    this.dashboardData.overview.averageLatency = metrics.averageLatency || 0;
    this.dashboardData.overview.errorRate = metrics.errorRate || 0;
  }

  private updateSystemMetrics(metrics: any): void {
    this.dashboardData.system.cpu = metrics.cpu || 0;
    this.dashboardData.system.memory = metrics.memory || 0;
    this.dashboardData.system.gpu = metrics.gpu;
    this.dashboardData.system.disk = metrics.disk || 0;
    this.dashboardData.system.network = metrics.network || 0;
    this.dashboardData.system.uptime = metrics.uptime || 0;
    this.dashboardData.system.activeConnections = metrics.activeConnections || 0;
    this.dashboardData.system.queueSizes = metrics.queueSizes || {};
  }

  private async updateAllModelData(): Promise<void> {
    // Update all model data in parallel
    const updatePromises = this.dashboardData.models.map(modelData =>
      this.refreshModelData(modelData)
    );

    await Promise.allSettled(updatePromises);
  }

  private async refreshModelData(modelData: ModelDashboardData): Promise<void> {
    try {
      // Collect current metrics for this model
      const currentMetrics = await this.metricsCollector.getModelMetrics(modelData.model.id);
      modelData.currentMetrics = currentMetrics;

      // Update prediction metrics
      const predictionMetrics = await this.metricsCollector.getPredictionMetrics(modelData.model.id);
      modelData.predictions = predictionMetrics;

      // Check for drift
      const driftMetrics = await this.driftDetector.checkModelDrift(modelData.model.id);
      if (driftMetrics) {
        modelData.drift = driftMetrics;
      }

      // Update health status
      modelData.health = await this.assessModelHealth(modelData);

    } catch (error) {
      this.logger.warn(`Failed to refresh model data for ${modelData.model.id}:`, error);
    }
  }

  private async updateAllExperimentData(): Promise<void> {
    const updatePromises = this.dashboardData.experiments.map(expData =>
      this.refreshExperimentData(expData)
    );

    await Promise.allSettled(updatePromises);
  }

  private async refreshExperimentData(experimentData: ExperimentDashboardData): Promise<void> {
    try {
      // Update experiment progress
      const progress = await this.metricsCollector.getExperimentProgress(experimentData.experiment.id);
      experimentData.progress = progress;

      // Update experiment metrics
      const metrics = await this.metricsCollector.getExperimentMetrics(experimentData.experiment.id);
      experimentData.metrics = metrics;

    } catch (error) {
      this.logger.warn(`Failed to refresh experiment data for ${experimentData.experiment.id}:`, error);
    }
  }

  private updateTrendData(metrics: any): void {
    const timestamp = new Date();

    // Add performance trend data point
    if (metrics.modelPerformance) {
      for (const perf of metrics.modelPerformance) {
        this.dashboardData.trends.modelPerformance.push({
          timestamp,
          modelId: perf.modelId,
          metric: perf.metric,
          value: perf.value
        });
      }
    }

    // Add utilization trend data point
    this.dashboardData.trends.systemUtilization.push({
      timestamp,
      resource: 'cpu',
      utilization: this.dashboardData.system.cpu
    });

    this.dashboardData.trends.systemUtilization.push({
      timestamp,
      resource: 'memory',
      utilization: this.dashboardData.system.memory
    });

    // Add error rate trend data point
    if (metrics.errorRates) {
      for (const errorRate of metrics.errorRates) {
        this.dashboardData.trends.errorRates.push({
          timestamp,
          modelId: errorRate.modelId,
          errorRate: errorRate.rate
        });
      }
    }

    // Add prediction volume trend data point
    this.dashboardData.trends.predictionVolume.push({
      timestamp,
      predictions: metrics.totalPredictions || 0
    });
  }

  private updateDriftData(driftData: any): void {
    if (driftData.dataDrift) {
      this.dashboardData.drift.dataDrift = {
        ...this.dashboardData.drift.dataDrift,
        ...driftData.dataDrift
      };
    }

    if (driftData.conceptDrift) {
      this.dashboardData.drift.conceptDrift = {
        ...this.dashboardData.drift.conceptDrift,
        ...driftData.conceptDrift
      };
    }

    if (driftData.driftTrend) {
      this.dashboardData.drift.driftTrends.push(driftData.driftTrend);
    }
  }

  private updateDashboardMetrics(metrics: any): void {
    // Update dashboard metrics based on collected data
    this.dashboardData.overview.resourceUtilization = {
      cpu: metrics.cpu || 0,
      memory: metrics.memory || 0,
      gpu: metrics.gpu,
      storage: metrics.disk || 0,
      network: metrics.network || 0
    };
  }

  private handlePerformanceIssue(issue: any): void {
    this.logger.warn('Performance issue detected:', issue);

    // Create alert if needed
    if (issue.severity === 'high' || issue.severity === 'critical') {
      this.alertManager.createAlert({
        type: 'performance',
        severity: issue.severity,
        message: issue.description,
        source: 'performance_analyzer'
      });
    }
  }

  private async assessModelHealth(modelData: ModelDashboardData): Promise<ModelHealth> {
    const issues: HealthIssue[] = [];
    let score = 100;

    // Check accuracy
    if (modelData.currentMetrics.accuracy && modelData.currentMetrics.accuracy < 0.8) {
      issues.push({
        type: 'low_accuracy',
        severity: 'high',
        description: 'Model accuracy is below threshold',
        recommendation: 'Consider retraining with more data',
        detected: new Date()
      });
      score -= 20;
    }

    // Check latency
    if (modelData.predictions.averageLatency > 1000) {
      issues.push({
        type: 'high_latency',
        severity: 'medium',
        description: 'Prediction latency is high',
        recommendation: 'Consider model optimization or scaling',
        detected: new Date()
      });
      score -= 15;
    }

    // Check error rate
    if (modelData.predictions.errorRate > 0.05) {
      issues.push({
        type: 'high_error_rate',
        severity: 'high',
        description: 'Prediction error rate is high',
        recommendation: 'Check model health and input data quality',
        detected: new Date()
      });
      score -= 25;
    }

    // Check drift
    if (modelData.drift.driftScore > 0.7) {
      issues.push({
        type: 'data_drift',
        severity: 'medium',
        description: 'Significant data drift detected',
        recommendation: 'Consider retraining with recent data',
        detected: new Date()
      });
      score -= 15;
    }

    let status: ModelHealth['status'] = 'healthy';
    if (score < 70) status = 'critical';
    else if (score < 85) status = 'warning';

    return {
      status,
      score,
      issues,
      lastCheck: new Date()
    };
  }

  private async collectReportData(): Promise<any> {
    return {
      overview: this.dashboardData.overview,
      models: this.dashboardData.models,
      experiments: this.dashboardData.experiments,
      trends: this.dashboardData.trends,
      alerts: this.dashboardData.alerts,
      system: this.dashboardData.system
    };
  }

  private async distributeReport(report: any): Promise<void> {
    // Distribute report based on configuration
    if (this.config.reports.distribution.email) {
      await this.reportGenerator.sendEmailReport(report);
    }

    if (this.config.reports.distribution.slack) {
      await this.reportGenerator.sendSlackReport(report);
    }

    if (this.config.reports.distribution.webhook) {
      await this.reportGenerator.sendWebhookReport(report);
    }

    if (this.config.reports.distribution.storage) {
      await this.reportGenerator.saveReport(report);
    }
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const retentionMs = this.config.metricsRetention * 24 * 60 * 60 * 1000;

    // Clean old trend data
    this.dashboardData.trends.modelPerformance = this.dashboardData.trends.modelPerformance.filter(
      trend => now - trend.timestamp.getTime() < retentionMs
    );

    this.dashboardData.trends.systemUtilization = this.dashboardData.trends.systemUtilization.filter(
      trend => now - trend.timestamp.getTime() < retentionMs
    );

    this.dashboardData.trends.errorRates = this.dashboardData.trends.errorRates.filter(
      trend => now - trend.timestamp.getTime() < retentionMs
    );

    this.dashboardData.trends.predictionVolume = this.dashboardData.trends.predictionVolume.filter(
      trend => now - trend.timestamp.getTime() < retentionMs
    );

    // Clean old drift trends
    this.dashboardData.drift.driftTrends = this.dashboardData.drift.driftTrends.filter(
      trend => now - trend.timestamp.getTime() < retentionMs
    );
  }
}