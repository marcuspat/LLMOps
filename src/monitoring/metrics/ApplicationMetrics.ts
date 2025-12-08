import { register, Counter, Histogram, Gauge, collectDefaultMetrics, Registry } from 'prom-client';

class ApplicationMetrics {
  private registry: Registry;

  // HTTP Request Metrics
  private httpRequestsTotal: Counter<string>;
  private httpRequestDuration: Histogram<string>;
  private httpRequestSize: Histogram<string>;
  private httpResponseSize: Histogram<string>;

  // Business Metrics
  private activeUsers: Gauge<string>;
  private swarmsCreated: Counter<string>;
  private agentsDeployed: Counter<string>;
  private tasksCompleted: Counter<string>;
  private githubOperationsTotal: Counter<string>;

  // Database Metrics
  private databaseConnections: Gauge<string>;
  private databaseQueryDuration: Histogram<string>;
  private databaseTransactionsTotal: Counter<string>;

  // Cache Metrics
  private cacheHits: Counter<string>;
  private cacheMisses: Counter<string>;
  private cacheSize: Gauge<string>;

  // WebSocket Connections
  private websocketConnections: Gauge<string>;
  private websocketMessages: Counter<string>;

  // Security Metrics
  private authenticationAttempts: Counter<string>;
  private authenticationFailures: Counter<string>;
  private securityAlerts: Counter<string>;

  // ML Pipeline Metrics
  private mlInferenceRequests: Counter<string>;
  private mlTrainingJobs: Counter<string>;
  private mlModelAccuracy: Gauge<string>;

  // Error Metrics
  private errorTotal: Counter<string>;
  private panicTotal: Counter<string>;

  constructor(serviceName: string) {
    this.registry = new Registry();

    // Set default labels
    this.registry.setDefaultLabels({
      service: serviceName,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'production'
    });

    // Collect default Node.js metrics
    collectDefaultMetrics({ register: this.registry });

    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // HTTP Request Metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'instance'],
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code', 'instance'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry]
    });

    this.httpResponseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry]
    });

    // Business Metrics
    this.activeUsers = new Gauge({
      name: 'active_users_total',
      help: 'Number of currently active users',
      labelNames: ['type'], // e.g., 'total', 'authenticated'
      registers: [this.registry]
    });

    this.swarmsCreated = new Counter({
      name: 'swarms_created_total',
      help: 'Total number of swarms created',
      labelNames: ['type', 'success'],
      registers: [this.registry]
    });

    this.agentsDeployed = new Counter({
      name: 'agents_deployed_total',
      help: 'Total number of agents deployed',
      labelNames: ['type', 'status'],
      registers: [this.registry]
    });

    this.tasksCompleted = new Counter({
      name: 'tasks_completed_total',
      help: 'Total number of tasks completed',
      labelNames: ['type', 'status'],
      registers: [this.registry]
    });

    this.githubOperationsTotal = new Counter({
      name: 'github_operations_total',
      help: 'Total number of GitHub operations',
      labelNames: ['operation', 'status'],
      registers: [this.registry]
    });

    // Database Metrics
    this.databaseConnections = new Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      labelNames: ['database'],
      registers: [this.registry]
    });

    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['database', 'operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    this.databaseTransactionsTotal = new Counter({
      name: 'database_transactions_total',
      help: 'Total number of database transactions',
      labelNames: ['database', 'status'],
      registers: [this.registry]
    });

    // Cache Metrics
    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });

    this.cacheSize = new Gauge({
      name: 'cache_size_bytes',
      help: 'Cache size in bytes',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });

    // WebSocket Metrics
    this.websocketConnections = new Gauge({
      name: 'websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.registry]
    });

    this.websocketMessages = new Counter({
      name: 'websocket_messages_total',
      help: 'Total number of WebSocket messages',
      labelNames: ['type', 'direction'], // direction: 'sent' | 'received'
      registers: [this.registry]
    });

    // Security Metrics
    this.authenticationAttempts = new Counter({
      name: 'authentication_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['method', 'status'],
      registers: [this.registry]
    });

    this.authenticationFailures = new Counter({
      name: 'authentication_failures_total',
      help: 'Total number of authentication failures',
      labelNames: ['reason'],
      registers: [this.registry]
    });

    this.securityAlerts = new Counter({
      name: 'security_alerts_total',
      help: 'Total number of security alerts',
      labelNames: ['severity', 'type'],
      registers: [this.registry]
    });

    // ML Pipeline Metrics
    this.mlInferenceRequests = new Counter({
      name: 'ml_inference_requests_total',
      help: 'Total number of ML inference requests',
      labelNames: ['model', 'status'],
      registers: [this.registry]
    });

    this.mlTrainingJobs = new Counter({
      name: 'ml_training_jobs_total',
      help: 'Total number of ML training jobs',
      labelNames: ['status'],
      registers: [this.registry]
    });

    this.mlModelAccuracy = new Gauge({
      name: 'ml_model_accuracy',
      help: 'ML model accuracy score',
      labelNames: ['model', 'metric_type'],
      registers: [this.registry]
    });

    // Error Metrics
    this.errorTotal = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
      registers: [this.registry]
    });

    this.panicTotal = new Counter({
      name: 'panics_total',
      help: 'Total number of panics',
      registers: [this.registry]
    });
  }

  // HTTP Request Methods
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number, requestSize?: number, responseSize?: number, instance?: string): void {
    this.httpRequestsTotal
      .labels(method, route, statusCode.toString(), instance || process.env.HOSTNAME || 'unknown')
      .inc();

    this.httpRequestDuration
      .labels(method, route, statusCode.toString(), instance || process.env.HOSTNAME || 'unknown')
      .observe(duration / 1000);

    if (requestSize) {
      this.httpRequestSize.labels(method, route).observe(requestSize);
    }

    if (responseSize) {
      this.httpResponseSize.labels(method, route).observe(responseSize);
    }
  }

  // Business Metrics Methods
  setActiveUsers(type: string, count: number): void {
    this.activeUsers.labels(type).set(count);
  }

  incrementSwarmsCreated(type: string, success: boolean): void {
    this.swarmsCreated.labels(type, success.toString()).inc();
  }

  incrementAgentsDeployed(type: string, status: string): void {
    this.agentsDeployed.labels(type, status).inc();
  }

  incrementTasksCompleted(type: string, status: string): void {
    this.tasksCompleted.labels(type, status).inc();
  }

  incrementGithubOperations(operation: string, status: string): void {
    this.githubOperationsTotal.labels(operation, status).inc();
  }

  // Database Methods
  setDatabaseConnections(database: string, count: number): void {
    this.databaseConnections.labels(database).set(count);
  }

  recordDatabaseQuery(database: string, operation: string, table: string, duration: number): void {
    this.databaseQueryDuration.labels(database, operation, table).observe(duration / 1000);
  }

  incrementDatabaseTransaction(database: string, status: string): void {
    this.databaseTransactionsTotal.labels(database, status).inc();
  }

  // Cache Methods
  incrementCacheHit(cacheType: string): void {
    this.cacheHits.labels(cacheType).inc();
  }

  incrementCacheMiss(cacheType: string): void {
    this.cacheMisses.labels(cacheType).inc();
  }

  setCacheSize(cacheType: string, size: number): void {
    this.cacheSize.labels(cacheType).set(size);
  }

  // WebSocket Methods
  setWebsocketConnections(count: number): void {
    this.websocketConnections.set(count);
  }

  incrementWebsocketMessages(type: string, direction: string): void {
    this.websocketMessages.labels(type, direction).inc();
  }

  // Security Methods
  incrementAuthenticationAttempt(method: string, status: string): void {
    this.authenticationAttempts.labels(method, status).inc();
  }

  incrementAuthenticationFailure(reason: string): void {
    this.authenticationFailures.labels(reason).inc();
  }

  incrementSecurityAlert(severity: string, type: string): void {
    this.securityAlerts.labels(severity, type).inc();
  }

  // ML Pipeline Methods
  incrementMlInferenceRequest(model: string, status: string): void {
    this.mlInferenceRequests.labels(model, status).inc();
  }

  incrementMlTrainingJob(status: string): void {
    this.mlTrainingJobs.labels(status).inc();
  }

  setMlModelAccuracy(model: string, metricType: string, accuracy: number): void {
    this.mlModelAccuracy.labels(model, metricType).set(accuracy);
  }

  // Error Methods
  incrementError(type: string, severity: string): void {
    this.errorTotal.labels(type, severity).inc();
  }

  incrementPanic(): void {
    this.panicTotal.inc();
  }

  // Get registry for Prometheus scraping
  getRegistry(): Registry {
    return this.registry;
  }

  // Get metrics in Prometheus format
  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}

export default ApplicationMetrics;