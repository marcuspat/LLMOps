/**
 * Core type definitions for Turbo Flow backend system
 */

// Core System Types
export interface SystemConfig {
  truthThreshold: number;
  maxAgents: number;
  defaultTopology: SwarmTopology;
  enableMetrics: boolean;
  logLevel: LogLevel;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export enum SwarmTopology {
  HIERARCHICAL = 'hierarchical',
  MESH = 'mesh',
  RING = 'ring',
  STAR = 'star',
  ADAPTIVE = 'adaptive'
}

// Agent Management Types
export interface Agent {
  id: string;
  type: AgentType;
  name: string;
  capabilities: string[];
  status: AgentStatus;
  metrics: AgentMetrics;
  createdAt: Date;
  updatedAt: Date;
  swarmId?: string;
}

export enum AgentType {
  COORDINATOR = 'coordinator',
  ANALYST = 'analyst',
  OPTIMIZER = 'optimizer',
  DOCUMENTER = 'documenter',
  MONITOR = 'monitor',
  SPECIALIST = 'specialist',
  ARCHITECT = 'architect',
  TASK_ORCHESTRATOR = 'task-orchestrator',
  CODE_ANALYZER = 'code-analyzer',
  PERF_ANALYZER = 'perf-analyzer',
  API_DOCS = 'api-docs',
  PERFORMANCE_BENCHMARKER = 'performance-benchmarker',
  SYSTEM_ARCHITECT = 'system-architect',
  RESEARCHER = 'researcher',
  CODER = 'coder',
  TESTER = 'tester',
  REVIEWER = 'reviewer'
}

export enum AgentStatus {
  IDLE = 'idle',
  BUSY = 'busy',
  ERROR = 'error',
  OFFLINE = 'offline'
}

export interface AgentMetrics {
  cpuUsage: number;
  memoryUsage: number;
  tasksCompleted: number;
  averageTaskTime: number;
  successRate: number;
  lastActivity: Date;
}

// Truth Verification Types
export interface TruthVerificationRequest {
  content: string;
  type: VerificationType;
  threshold?: number;
  context?: Record<string, any>;
}

export interface TruthVerificationResult {
  score: number;
  passed: boolean;
  confidence: number;
  details: VerificationDetails;
  timestamp: Date;
}

export enum VerificationType {
  CODE_QUALITY = 'code_quality',
  TEST_COVERAGE = 'test_coverage',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  DOCUMENTATION = 'documentation'
}

export interface VerificationDetails {
  issues: VerificationIssue[];
  suggestions: string[];
  metrics: Record<string, number>;
}

export interface VerificationIssue {
  type: string;
  severity: IssueSeverity;
  message: string;
  line?: number;
  column?: number;
}

export enum IssueSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Task Management Types
export interface Task {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgentId?: string;
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  result?: TaskResult;
}

export enum TaskType {
  CODE_GENERATION = 'code_generation',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  ANALYSIS = 'analysis',
  OPTIMIZATION = 'optimization',
  SECURITY_SCAN = 'security_scan',
  PERFORMANCE_TEST = 'performance_test'
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface TaskResult {
  success: boolean;
  output: any;
  metrics: TaskMetrics;
  artifacts: string[];
}

export interface TaskMetrics {
  duration: number;
  resourcesUsed: Record<string, number>;
  quality: number;
}

// Swarm Management Types
export interface Swarm {
  id: string;
  name: string;
  topology: SwarmTopology;
  status: SwarmStatus;
  agents: Agent[];
  tasks: Task[];
  config: SwarmConfig;
  createdAt: Date;
  updatedAt: Date;
}

export enum SwarmStatus {
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  IDLE = 'idle',
  ERROR = 'error',
  TERMINATED = 'terminated'
}

export interface SwarmConfig {
  maxAgents: number;
  strategy: SwarmStrategy;
  enableAutoScaling: boolean;
  resourceLimits: ResourceLimits;
}

export enum SwarmStrategy {
  BALANCED = 'balanced',
  SPECIALIZED = 'specialized',
  ADAPTIVE = 'adaptive'
}

export interface ResourceLimits {
  maxCpuUsage: number;
  maxMemoryUsage: number;
  maxTasksPerAgent: number;
}

// GitHub Integration Types
export interface GitHubRepo {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  hooks: GitHubHook[];
}

export interface GitHubHook {
  id: string;
  name: string;
  events: string[];
  active: boolean;
  config: HookConfig;
}

export interface HookConfig {
  url: string;
  contentType: string;
  secret?: string;
}

export interface GitHubPullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  baseBranch: string;
  headBranch: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
}

// Security Types
export interface SecurityScan {
  id: string;
  type: ScanType;
  target: string;
  results: SecurityResult[];
  status: ScanStatus;
  createdAt: Date;
  completedAt?: Date;
}

export enum ScanType {
  SAST = 'sast',
  DAST = 'dast',
  DEPENDENCY = 'dependency',
  COMPREHENSIVE = 'comprehensive'
}

export enum ScanStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface SecurityResult {
  severity: IssueSeverity;
  type: string;
  description: string;
  file?: string;
  line?: number;
  cve?: string;
  recommendation: string;
}

// Performance Types
export interface PerformanceMetrics {
  timestamp: Date;
  cpu: CpuMetrics;
  memory: MemoryMetrics;
  network: NetworkMetrics;
  custom: Record<string, number>;
}

export interface CpuMetrics {
  usage: number;
  loadAverage: number[];
  cores: number;
}

export interface MemoryMetrics {
  used: number;
  free: number;
  total: number;
  percentage: number;
}

export interface NetworkMetrics {
  bytesIn: number;
  bytesOut: number;
  packetsIn: number;
  packetsOut: number;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// WebSocket Message Types
export interface WebSocketMessage {
  type: MessageType;
  id: string;
  payload: any;
  timestamp: Date;
}

export enum MessageType {
  AGENT_STATUS_UPDATE = 'agent_status_update',
  TASK_UPDATE = 'task_update',
  SWARM_UPDATE = 'swarm_update',
  VERIFICATION_RESULT = 'verification_result',
  SECURITY_SCAN_RESULT = 'security_scan_result',
  PERFORMANCE_UPDATE = 'performance_update',
  GITHUB_WEBHOOK = 'github_webhook'
}

// Machine Learning Pipeline Types
export interface MLPipeline {
  id: string;
  name: string;
  stages: MLPipelineStage[];
  status: PipelineStatus;
  config: PipelineConfig;
}

export interface MLPipelineStage {
  id: string;
  name: string;
  type: StageType;
  config: Record<string, any>;
  dependencies: string[];
}

export enum StageType {
  DATA_PREPARATION = 'data_preparation',
  TRAINING = 'training',
  VALIDATION = 'validation',
  DEPLOYMENT = 'deployment'
}

export enum PipelineStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface PipelineConfig {
  modelType: string;
  hyperparameters: Record<string, any>;
  resources: ResourceLimits;
  environment: Record<string, string>;
}

// Authentication & Authorization Types
export interface User {
  id: string;
  username: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  createdAt: Date;
  lastLogin: Date;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface AuthToken {
  token: string;
  type: TokenType;
  expiresAt: Date;
  scopes: string[];
}

export enum TokenType {
  ACCESS = 'access',
  REFRESH = 'refresh',
  API_KEY = 'api_key'
}

// Configuration Management Types
export interface Configuration {
  id: string;
  key: string;
  value: any;
  type: ConfigType;
  environment: string;
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ConfigType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  OBJECT = 'object',
  ARRAY = 'array'
}