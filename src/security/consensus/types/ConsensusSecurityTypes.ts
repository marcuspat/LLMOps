/**
 * Consensus Security Types - Type definitions for distributed consensus security
 */

export interface ConsensusSecurityConfig {
  // Network configuration
  networkId: string;
  nodeId: string;
  networkParticipants: NetworkParticipant[];

  // Threshold signature configuration
  thresholdSignature: ThresholdSignatureConfig;

  // Zero-knowledge proof configuration
  zeroKnowledgeProof: ZKProofConfig;

  // Attack detection configuration
  attackDetection: AttackDetectionConfig;

  // Monitoring configuration
  monitoringInterval: number;

  // Key management configuration
  keyManagement: KeyManagementConfig;

  // Communication security
  communicationSecurity: CommunicationSecurityConfig;
}

export interface NetworkParticipant {
  nodeId: string;
  publicKey: string;
  endpoint: string;
  role: 'validator' | 'proposer' | 'observer';
  reputation: number;
  lastSeen: Date;
  metadata: {
    ipSubnet: string;
    asNumber: string;
    region: string;
    version: string;
    stake?: number;
  };
}

export interface ThresholdSignatureConfig {
  enabled: boolean;
  threshold: number;
  totalParties: number;
  curveType: 'secp256k1' | 'ed25519' | 'p256';
  keyRotationInterval: number; // in hours
  distributedKeyGenTimeout: number; // in seconds
  signatureTimeout: number; // in seconds
}

export interface ZKProofConfig {
  enabled: boolean;
  proofSystem: 'groth16' | 'plonk' | 'bulletproofs';
  provingKeyPath?: string;
  verifyingKeyPath?: string;
  trustedSetupFile?: string;
  cacheEnabled: boolean;
  maxProofSize: number;
  proofTimeout: number; // in seconds
}

export interface AttackDetectionConfig {
  enabled: boolean;
  byzzantineThreshold: number;
  sybilThreshold: number;
  eclipseThreshold: number;
  dosThreshold: number;
  reputationDecayRate: number;
  suspicionThreshold: number;
  monitoringWindow: number; // in seconds
}

export interface KeyManagementConfig {
  encryptionAlgorithm: string;
  keyDerivationFunction: string;
  keySize: number;
  saltLength: number;
  iterations: number;
  backupEnabled: boolean;
  backupLocations: string[];
  rotationEnabled: boolean;
  rotationInterval: number; // in hours
}

export interface CommunicationSecurityConfig {
  tlsEnabled: boolean;
  certificatePath?: string;
  privateKeyPath?: string;
  caCertificatePath?: string;
  minTLSVersion: string;
  allowedCiphers: string[];
  certificateRotationEnabled: boolean;
  certificateRotationInterval: number; // in days
}

// Threshold Signature Types
export interface ThresholdKeyShare {
  shareId: string;
  shareValue: Buffer;
  commitment: Buffer;
  publicKey: Buffer;
}

export interface ThresholdSignature {
  signatories: string[];
  signature: Buffer;
  proof: Buffer;
}

export interface PartialSignature {
  signerId: string;
  signature: Buffer;
  commitment: Buffer;
}

export interface KeyShare {
  shareId: string;
  shareValue: Buffer;
  publicKey: Buffer;
}

export interface DKGResult {
  masterPublicKey: Buffer;
  publicKeyShares: Map<string, Buffer>;
  ceremony: string;
  participants: string[];
}

// Zero-Knowledge Proof Types
export interface ZKProof {
  type: 'discrete_log' | 'range' | 'membership';
  proof: Buffer;
  inputs: any[];
  verificationKey: Buffer;
}

export interface RangeProof {
  value: number;
  commitment: Buffer;
  min: number;
  max: number;
  proof: ZKProof;
}

export interface Bulletproof {
  value: number;
  commitment: Buffer;
  generators: Buffer[];
  proof: Buffer;
  range: number;
}

export interface SchnorrProof {
  commitment: Buffer;
  challenge: Buffer;
  response: Buffer;
}

export interface MembershipProof {
  proof: ZKProof;
  setHash: Buffer;
  element: Buffer;
}

// Attack Detection Types
export interface AttackEvent {
  id: string;
  timestamp: Date;
  type: AttackType;
  severity: AttackSeverity;
  nodeId?: string;
  details: AttackDetails;
  confidence: number;
  mitigation?: MitigationAction;
}

export type AttackType =
  | 'BYZANTINE_ATTACK'
  | 'SYBIL_ATTACK'
  | 'ECLIPSE_ATTACK'
  | 'DOS_ATTACK'
  | 'ROUTING_ATTACK'
  | 'TIMING_ATTACK'
  | 'COLLUSION_ATTACK';

export type AttackSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface AttackDetails {
  [key: string]: any;
}

export interface MitigationAction {
  type: MitigationType;
  target: string;
  parameters: any;
  effectiveness?: number;
}

export type MitigationType =
  | 'RATE_LIMIT'
  | 'CONNECTION_FILTER'
  | 'REPUTATION_PENALTY'
  | 'NODE_ISOLATION'
  | 'KEY_ROTATION'
  | 'PROTOCOL_ADJUSTMENT';

// Consensus Security Event Types
export interface ConsensusSecurityEvent {
  id: string;
  timestamp: Date;
  type: ConsensusSecurityEventType;
  source: string;
  details: any;
  signature?: string;
  proof?: ZKProof;
}

export type ConsensusSecurityEventType =
  | 'CONSENSUS_STARTED'
  | 'CONSENSUS_COMPLETED'
  | 'CONSENSUS_FAILED'
  | 'SIGNATURE_CREATED'
  | 'SIGNATURE_VERIFIED'
  | 'PROOF_GENERATED'
  | 'PROOF_VERIFIED'
  | 'KEY_ROTATED'
  | 'ATTACK_DETECTED'
  | 'ATTACK_MITIGATED'
  | 'NODE_JOINED'
  | 'NODE_LEFT';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: string;
  severity: AttackSeverity;
  source: string;
  details: any;
}

// Reputation System Types
export interface ReputationScore {
  nodeId: string;
  score: number;
  confidence: number;
  lastUpdated: Date;
  factors: ReputationFactor[];
}

export interface ReputationFactor {
  type: string;
  weight: number;
  value: number;
  description: string;
}

export interface ReputationConfig {
  initialScore: number;
  maxScore: number;
  minScore: number;
  decayRate: number;
  rewardFactors: ReputationFactor[];
  penaltyFactors: ReputationFactor[];
}

// Cryptographic Operation Types
export interface CryptographicOperation {
  id: string;
  type: 'SIGN' | 'VERIFY' | 'PROVE' | 'VERIFY_PROOF' | 'ENCRYPT' | 'DECRYPT';
  input: any;
  output: any;
  duration: number;
  success: boolean;
  error?: string;
}

export interface KeyRotationEvent {
  id: string;
  timestamp: Date;
  oldKeyId: string;
  newKeyId: string;
  participants: string[];
  ceremony: string;
  duration: number;
  success: boolean;
}

// Network Security Types
export interface NetworkConnection {
  id: string;
  remoteNodeId: string;
  endpoint: string;
  established: Date;
  lastActivity: Date;
  bytesTransmitted: number;
  bytesReceived: number;
  encryptionEnabled: boolean;
  verified: boolean;
}

export interface MessageRate {
  nodeId: string;
  messagesPerSecond: number;
  averageSize: number;
  peakRate: number;
  timeWindow: number;
}

export interface BandwidthUsage {
  nodeId: string;
  uploadBandwidth: number;
  downloadBandwidth: number;
  totalUpload: number;
  totalDownload: number;
  timestamp: Date;
}

// Security Monitoring Types
export interface SecurityMetrics {
  timestamp: Date;
  totalNodes: number;
  honestNodes: number;
  maliciousNodes: number;
  consensusSuccessRate: number;
  averageLatency: number;
  signatureVerificationTime: number;
  zkpGenerationTime: number;
  attackDetectionLatency: number;
  keyRotationOverhead: number;
  threatsDetected: number;
  threatsMitigated: number;
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: string;
  severity: AttackSeverity;
  title: string;
  description: string;
  affectedNodes: string[];
  recommendedActions: string[];
  status: 'ACTIVE' | 'RESOLVED' | 'IGNORED';
}

// Configuration Validation Types
export interface ValidationRule {
  name: string;
  description: string;
  validator: (config: any) => ValidationResult;
  required: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SecurityConfig {
  enabled: boolean;
  rules: ValidationRule[];
  customRules?: ValidationRule[];
}

export interface ConfigurationSchema {
  version: string;
  rules: ValidationRule[];
  examples: any[];
}

// Database and Persistence Types
export interface SecurityRecord {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  signature?: string;
  checksum: string;
}

export interface BackupRecord {
  id: string;
  timestamp: Date;
  type: 'KEY_SHARE' | 'CONFIGURATION' | 'METRICS' | 'EVENTS';
  encrypted: boolean;
  location: string;
  checksum: string;
}

// Integration Types
export interface ConsensusIntegration {
  nodeId: string;
  messageHandler: (message: any) => Promise<void>;
  broadcastHandler: (message: any, targets?: string[]) => Promise<void>;
  getConnectedNodes: () => Promise<string[]>;
  getNetworkStats: () => Promise<any>;
}

export interface SecurityPlugin {
  name: string;
  version: string;
  enabled: boolean;
  configuration: any;
  initialize: (manager: any) => Promise<void>;
  shutdown: () => Promise<void>;
}

// Error Types
export class ConsensusSecurityError extends Error {
  public code: string;
  public details: any;

  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'ConsensusSecurityError';
    this.code = code;
    this.details = details;
  }
}

export class ThresholdSignatureError extends ConsensusSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'THRESHOLD_SIGNATURE_ERROR', details);
    this.name = 'ThresholdSignatureError';
  }
}

export class ZKProofError extends ConsensusSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'ZK_PROOF_ERROR', details);
    this.name = 'ZKProofError';
  }
}

export class AttackDetectionError extends ConsensusSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'ATTACK_DETECTION_ERROR', details);
    this.name = 'AttackDetectionError';
  }
}

export class KeyManagementError extends ConsensusSecurityError {
  constructor(message: string, details?: any) {
    super(message, 'KEY_MANAGEMENT_ERROR', details);
    this.name = 'KeyManagementError';
  }
}