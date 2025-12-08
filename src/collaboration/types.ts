/**
 * Pair Programming and Collaborative Development System
 * Real-time collaboration engine with CRDT-based operational transformation
 */

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: CollaborationRole;
  permissions: Permission[];
  status: UserStatus;
  lastSeen: Date;
  cursor?: CursorPosition;
  preferences: UserPreferences;
}

export interface CollaborationSession {
  id: string;
  name: string;
  description?: string;
  type: SessionType;
  status: SessionStatus;
  participants: Participant[];
  hostId: string;
  createdAt: Date;
  updatedAt: Date;
  settings: SessionSettings;
  state: SessionState;
  recording?: SessionRecording;
}

export interface Participant {
  userId: string;
  sessionId: string;
  role: CollaborationRole;
  joinedAt: Date;
  permissions: Permission[];
  isActive: boolean;
  cursor?: CursorPosition;
  selection?: TextSelection;
}

export interface OperationalTransform {
  id: string;
  type: TransformType;
  position: number;
  content?: string;
  length?: number;
  attributes?: Record<string, any>;
  authorId: string;
  timestamp: Date;
  priority: number;
  sessionId: string;
  documentId: string;
  dependencies?: string[];
}

export interface DocumentState {
  id: string;
  sessionId: string;
  content: string;
  version: number;
  checksum: string;
  transforms: OperationalTransform[];
  collaborators: Map<string, UserState>;
  metadata: DocumentMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface CursorPosition {
  line: number;
  column: number;
  documentId: string;
  userId: string;
  timestamp: Date;
  visible: boolean;
}

export interface TextSelection {
  start: { line: number; column: number };
  end: { line: number; column: number };
  documentId: string;
  userId: string;
  timestamp: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  authorId: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  metadata: MessageMetadata;
  reactions?: MessageReaction[];
  threadId?: string;
}

export interface VoiceCall {
  id: string;
  sessionId: string;
  participants: string[];
  type: CallType;
  status: CallStatus;
  startedAt: Date;
  endedAt?: Date;
  quality: CallQuality;
}

export interface TerminalSession {
  id: string;
  sessionId: string;
  ownerId: string;
  type: TerminalType;
  status: TerminalStatus;
  buffer: TerminalBuffer;
  participants: TerminalParticipant[];
  permissions: TerminalPermission[];
  createdAt: Date;
  lastActivity: Date;
}

export interface DebugSession {
  id: string;
  sessionId: string;
  type: DebugType;
  status: DebugStatus;
  breakpoints: Breakpoint[];
  callStack: CallStackFrame[];
  variables: DebugVariable[];
  participants: string[];
  configuration: DebugConfiguration;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConflictResolution {
  id: string;
  type: ConflictType;
  documentId: string;
  transforms: OperationalTransform[];
  resolution: TransformResolution;
  resolvedAt: Date;
  resolvedBy: string;
  metadata: ConflictMetadata;
}

export interface SessionRecording {
  id: string;
  sessionId: string;
  startedAt: Date;
  endedAt?: Date;
  events: RecordedEvent[];
  metadata: RecordingMetadata;
  size: number;
  duration?: number;
}

// Enums

export enum CollaborationRole {
  DRIVER = 'driver',
  NAVIGATOR = 'navigator',
  OBSERVER = 'observer',
  MODERATOR = 'moderator'
}

export enum SessionType {
  PAIR_PROGRAMMING = 'pair_programming',
  MOB_PROGRAMMING = 'mob_programming',
  CODE_REVIEW = 'code_review',
  DEBUG_SESSION = 'debug_session',
  INTERVIEW = 'interview',
  TRAINING = 'training',
  WORKSHOP = 'workshop'
}

export enum SessionStatus {
  CREATED = 'created',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended',
  ARCHIVED = 'archived'
}

export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline'
}

export enum Permission {
  READ = 'read',
  WRITE = 'write',
  EDIT = 'edit',
  DELETE = 'delete',
  SHARE = 'share',
  RECORD = 'record',
  TERMINAL = 'terminal',
  DEBUG = 'debug',
  MODERATE = 'moderate'
}

export enum TransformType {
  INSERT = 'insert',
  DELETE = 'delete',
  RETAIN = 'retain',
  FORMAT = 'format',
  REPLACE = 'replace'
}

export enum MessageType {
  TEXT = 'text',
  CODE = 'code',
  FILE = 'file',
  IMAGE = 'image',
  SYSTEM = 'system',
  ERROR = 'error'
}

export enum CallType {
  VOICE = 'voice',
  VIDEO = 'video',
  SCREEN_SHARE = 'screen_share'
}

export enum CallStatus {
  RINGING = 'ringing',
  ACTIVE = 'active',
  HOLD = 'hold',
  ENDED = 'ended',
  FAILED = 'failed'
}

export enum TerminalType {
  SHARED = 'shared',
  BROADCAST = 'broadcast',
  INTERACTIVE = 'interactive'
}

export enum TerminalStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ENDED = 'ended'
}

export enum DebugType {
  LOCAL = 'local',
  REMOTE = 'remote',
  ATTACH = 'attach',
  LAUNCH = 'launch'
}

export enum DebugStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error'
}

export enum ConflictType {
  CONCURRENT_EDIT = 'concurrent_edit',
  STRUCTURAL_CONFLICT = 'structural_conflict',
  ATTRIBUTE_CONFLICT = 'attribute_conflict'
}

// Supporting Types

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  notifications: NotificationSettings;
  shortcuts: KeyboardShortcuts;
}

export interface NotificationSettings {
  mentions: boolean;
  messages: boolean;
  cursorUpdates: boolean;
  roleChanges: boolean;
  systemAlerts: boolean;
}

export interface KeyboardShortcuts {
  switchRole: string;
  sendMessage: string;
  shareScreen: string;
  startCall: string;
  endSession: string;
}

export interface SessionSettings {
  maxParticipants: number;
  allowRecording: boolean;
  allowVoiceCall: boolean;
  allowScreenShare: boolean;
  autoSave: boolean;
  conflictResolution: ConflictResolutionStrategy;
  publicAccess: boolean;
  requireAuthentication: boolean;
}

export enum ConflictResolutionStrategy {
  LAST_WRITER_WINS = 'last_writer_wins',
  FIRST_WRITER_WINS = 'first_writer_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}

export interface UserState {
  userId: string;
  cursor: CursorPosition;
  selection: TextSelection;
  lastActivity: Date;
  isActive: boolean;
  permissions: Permission[];
}

export interface DocumentMetadata {
  title: string;
  language: string;
  path: string;
  size: number;
  encoding: string;
  lastModified: Date;
  version: string;
  tags: string[];
}

export interface MessageMetadata {
  edited: boolean;
  editedAt?: Date;
  pinned: boolean;
  priority: 'low' | 'medium' | 'high';
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  timestamp: Date;
}

export interface CallQuality {
  audio: QualityMetric;
  video: QualityMetric;
  connection: QualityMetric;
}

export interface QualityMetric {
  bitrate: number;
  latency: number;
  packetLoss: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface TerminalBuffer {
  content: string[][];
  cursor: { x: number; y: number };
  history: TerminalCommand[];
  size: { width: number; height: number };
}

export interface TerminalCommand {
  command: string;
  output: string;
  timestamp: Date;
  userId: string;
}

export interface TerminalParticipant {
  userId: string;
  permissions: TerminalPermission[];
  joinedAt: Date;
  lastActivity: Date;
}

export enum TerminalPermission {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  SHARE = 'share'
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column: number;
  condition?: string;
  enabled: boolean;
  hitCount: number;
  createdAt: Date;
}

export interface CallStackFrame {
  id: string;
  function: string;
  file: string;
  line: number;
  column: number;
  variables: DebugVariable[];
}

export interface DebugVariable {
  name: string;
  value: any;
  type: string;
  scope: string;
  mutable: boolean;
}

export interface DebugConfiguration {
  type: DebugType;
  program: string;
  args: string[];
  env: Record<string, string>;
  cwd: string;
  runtime: string;
}

export interface TransformResolution {
  strategy: ConflictResolutionStrategy;
  resolvedTransforms: OperationalTransform[];
  conflicts: Conflict[];
  metadata: ResolutionMetadata;
}

export interface Conflict {
  transformIds: string[];
  type: ConflictType;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ResolutionMetadata {
  resolvedBy: string;
  resolvedAt: Date;
  timeTaken: number;
  manualIntervention: boolean;
}

export interface ConflictMetadata {
  detectionTime: Date;
  affectedUsers: string[];
  severity: 'low' | 'medium' | 'high';
  autoResolved: boolean;
}

export interface RecordedEvent {
  id: string;
  type: string;
  timestamp: Date;
  userId?: string;
  data: any;
  duration?: number;
}

export interface RecordingMetadata {
  title: string;
  description: string;
  participants: string[];
  tags: string[];
  quality: 'low' | 'medium' | 'high';
  isPublic: boolean;
}

export interface SessionState {
  documents: Map<string, DocumentState>;
  cursors: Map<string, CursorPosition>;
  selections: Map<string, TextSelection>;
  activeUsers: Set<string>;
  currentDriver?: string;
  currentNavigator?: string;
  pendingTransforms: OperationalTransform[];
  conflicts: ConflictResolution[];
}