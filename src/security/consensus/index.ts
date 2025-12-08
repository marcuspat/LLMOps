/**
 * Consensus Security System - Main Entry Point
 * Comprehensive security for distributed consensus protocols with advanced threat detection
 */

// Core consensus security manager
export { ConsensusSecurityManager } from './ConsensusSecurityManager.js';

// Type definitions
export type {
  ConsensusSecurityConfig,
  NetworkParticipant,
  ThresholdSignatureConfig,
  ZKProofConfig,
  AttackDetectionConfig,
  KeyManagementConfig,
  CommunicationSecurityConfig
} from './types/ConsensusSecurityTypes.js';

export type {
  ThresholdSignature,
  PartialSignature,
  DKGResult,
  KeyShare
} from './types/ConsensusSecurityTypes.js';

export type {
  SchnorrProof,
  RangeProof,
  Bulletproof,
  MembershipProof
} from './types/ConsensusSecurityTypes.js';

export type {
  AttackEvent,
  AttackType,
  AttackSeverity,
  MitigationAction,
  SecurityEvent
} from './types/ConsensusSecurityTypes.js';

export type {
  SecurityConfig as ConsensusSecurityConfigType,
  ValidationRule,
  ValidationResult
} from './types/ConsensusSecurityTypes.js';

export type {
  CryptographicOperation,
  KeyRotationEvent,
  NetworkConnection,
  MessageRate,
  BandwidthUsage
} from './types/ConsensusSecurityTypes.js';

export type {
  ConsensusSecurityEventType,
  ReputationScore as ReputationScoreType,
  ReputationFactor,
  ReputationConfig as ReputationConfigType
} from './types/ConsensusSecurityTypes.js';

export type {
  IntegrationConfig
} from './integration/SecurityFrameworkIntegration.js';

// Cryptographic components
export { ThresholdSignatureSystem } from './cryptography/ThresholdSignatureSystem.js';
export { ZeroKnowledgeProofSystem } from './cryptography/ZeroKnowledgeProofSystem.js';
export { SecureKeyManager } from './cryptography/SecureKeyManager.js';
export { KeyManager } from './cryptography/KeyManager.js';
export { LagrangeInterpolation } from './cryptography/LagrangeInterpolation.js';
export { DistributedKeyGeneration } from './cryptography/DistributedKeyGeneration.js';
export { EncryptionService } from './cryptography/EncryptionService.js';
export { BackupSystem } from './cryptography/BackupSystem.js';

// Attack detection components
export { ConsensusSecurityMonitor } from './attack/ConsensusSecurityMonitor.js';
export { BehaviorAnalyzer } from './attack/BehaviorAnalyzer.js';
export { ReputationSystem } from './attack/ReputationSystem.js';
export { SecurityAlertSystem } from './attack/SecurityAlertSystem.js';
export { ForensicLogger } from './attack/ForensicLogger.js';

// Penetration testing framework
export { ConsensusPenetrationTester } from './testing/ConsensusPenetrationTester.js';
export { SecurityTestSuite } from './testing/SecurityTestSuite.js';
export { AttackSimulator } from './testing/AttackSimulator.js';

// Integration components
export { SecurityFrameworkIntegration } from './integration/SecurityFrameworkIntegration.js';

/**
 * Factory function to create and initialize consensus security manager
 */
export async function createConsensusSecurityManager(
  nodeId: string,
  config?: Partial<ConsensusSecurityConfig>
): Promise<ConsensusSecurityManager> {
  const securityConfig: ConsensusSecurityConfig = {
    networkId: 'default-network',
    nodeId,
    networkParticipants: [],
    thresholdSignature: {
      enabled: true,
      threshold: 3,
      totalParties: 5,
      curveType: 'secp256k1',
      keyRotationInterval: 168, // 1 week
      distributedKeyGenTimeout: 300,
      signatureTimeout: 60
    },
    zeroKnowledgeProof: {
      enabled: true,
      proofSystem: 'groth16',
      cacheEnabled: true,
      maxProofSize: 1048576, // 1MB
      proofTimeout: 30
    },
    attackDetection: {
      enabled: true,
      byzzantineThreshold: 0.3,
      sybilThreshold: 5,
      eclipseThreshold: 0.2,
      dosThreshold: 1000,
      reputationDecayRate: 0.01,
      suspicionThreshold: 0.7,
      monitoringWindow: 300000 // 5 minutes
    },
    monitoringInterval: 10000, // 10 seconds
    keyManagement: {
      encryptionAlgorithm: 'aes-256-gcm',
      keyDerivationFunction: 'pbkdf2',
      keySize: 256,
      saltLength: 32,
      iterations: 100000,
      backupEnabled: true,
      backupLocations: ['local', 'remote1', 'remote2'],
      rotationEnabled: true,
      rotationInterval: 168
    },
    communicationSecurity: {
      tlsEnabled: true,
      minTLSVersion: '1.3',
      allowedCiphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ],
      certificateRotationEnabled: true,
      certificateRotationInterval: 30 // days
    },
    ...config
  };

  const manager = new ConsensusSecurityManager(securityConfig, nodeId);
  await manager.initialize();

  return manager;
}

/**
 * Factory function to create threshold signature system
 */
export function createThresholdSignatureSystem(
  threshold: number,
  totalParties: number,
  curveType: string = 'secp256k1'
): ThresholdSignatureSystem {
  return new ThresholdSignatureSystem(threshold, totalParties, curveType);
}

/**
 * Factory function to create zero-knowledge proof system
 */
export function createZeroKnowledgeProofSystem(): ZeroKnowledgeProofSystem {
  return new ZeroKnowledgeProofSystem();
}

/**
 * Factory function to create security monitor
 */
export function createConsensusSecurityMonitor(): ConsensusSecurityMonitor {
  return new ConsensusSecurityMonitor();
}

/**
 * Factory function to create penetration tester
 */
export function createConsensusPenetrationTester(): ConsensusPenetrationTester {
  return new ConsensusPenetrationTester();
}

/**
 * Factory function to create framework integration
 */
export function createSecurityFrameworkIntegration(
  securityFramework: any,
  config?: Partial<IntegrationConfig>
): SecurityFrameworkIntegration {
  return new SecurityFrameworkIntegration(securityFramework, config);
}

/**
 * Example consensus security setup
 */
export class ConsensusSecuritySetup {
  private securityManager: ConsensusSecurityManager;
  private penetrationTester: ConsensusPenetrationTester;

  constructor(nodeId: string) {
    this.initialize(nodeId);
  }

  private async initialize(nodeId: string): Promise<void> {
    // Initialize security manager
    this.securityManager = await createConsensusSecurityManager(nodeId, {
      thresholdSignature: {
        threshold: 3,
        totalParties: 7,
        curveType: 'secp256k1',
        keyRotationInterval: 168 // 1 week
      },
      zeroKnowledgeProof: {
        enabled: true,
        proofSystem: 'groth16'
      },
      attackDetection: {
        enabled: true,
        byzzantineThreshold: 0.3,
        sybilThreshold: 5,
        eclipseThreshold: 0.2,
        dosThreshold: 1000
      }
    });

    // Initialize penetration tester
    this.penetrationTester = createConsensusPenetrationTester();
    await this.penetrationTester.initialize();
  }

  /**
   * Add network participant
   */
  async addParticipant(nodeId: string, publicKey: string, endpoint: string): Promise<void> {
    await this.securityManager.addParticipant({
      nodeId,
      publicKey,
      endpoint,
      role: 'validator',
      reputation: 0.5,
      lastSeen: new Date(),
      metadata: {
        ipSubnet: '192.168.1',
        asNumber: 'AS12345',
        region: 'us-west',
        version: '1.0.0'
      }
    });
  }

  /**
   * Generate distributed keys for threshold signing
   */
  async generateThresholdKeys(participants: string[]): Promise<string> {
    const dkgResult = await this.securityManager.thresholdSignatureSystem.generateDistributedKeys();
    return dkgResult.ceremony;
  }

  /**
   * Create threshold signature for consensus message
   */
  async createThresholdSignature(message: string, signatories: string[]): Promise<string> {
    return await this.securityManager.createThresholdSignature(message, signatories);
  }

  /**
   * Verify threshold signature
   */
  async verifyThresholdSignature(message: string, signature: string): Promise<boolean> {
    return await this.securityManager.verifyThresholdSignature(message, signature);
  }

  /**
   * Create zero-knowledge proof
   */
  async createZKProof(secret: string, publicKey: string): Promise<any> {
    return await this.securityManager.createZeroKnowledgeProof(secret, publicKey);
  }

  /**
   * Verify zero-knowledge proof
   */
  async verifyZKProof(proof: any, publicKey: string): Promise<boolean> {
    return await this.securityManager.verifyZeroKnowledgeProof(proof, publicKey);
  }

  /**
   * Run comprehensive security tests
   */
  async runSecurityTests(): Promise<any> {
    return await this.penetrationTester.runSecurityTests();
  }

  /**
   * Monitor network for attacks
   */
  async monitorNetwork(): Promise<void> {
    console.log('Starting network monitoring...');
    // Monitoring is handled automatically by the security manager
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): any {
    return {
      consensusSecurity: this.securityManager.getSecurityMetrics(),
      monitoring: this.securityManager.getNetworkStatistics(),
      forensic: this.securityManager.getSecurityEvents()
    };
  }

  /**
   * Rotate keys
   */
  async rotateKeys(): Promise<void> {
    await this.securityManager.rotateKeys();
  }

  /**
   * Shutdown the security setup
   */
  async shutdown(): Promise<void> {
    await this.securityManager.shutdown();
    await this.penetrationTester.cleanup();
    console.log('Consensus security setup shutdown complete');
  }
}

/**
 * Default configuration for consensus security
 */
export const defaultConsensusSecurityConfig: ConsensusSecurityConfig = {
  networkId: 'default-network',
  nodeId: 'node-1',
  networkParticipants: [],
  thresholdSignature: {
    enabled: true,
    threshold: 3,
    totalParties: 5,
    curveType: 'secp256k1',
    keyRotationInterval: 168,
    distributedKeyGenTimeout: 300,
    signatureTimeout: 60
  },
  zeroKnowledgeProof: {
    enabled: true,
    proofSystem: 'groth16',
    cacheEnabled: true,
    maxProofSize: 1048576,
    proofTimeout: 30
  },
  attackDetection: {
    enabled: true,
    byzzantineThreshold: 0.3,
    sybilThreshold: 5,
    eclipseThreshold: 0.2,
    dosThreshold: 1000,
    reputationDecayRate: 0.01,
    suspicionThreshold: 0.7,
    monitoringWindow: 300000
  },
  monitoringInterval: 10000,
  keyManagement: {
    encryptionAlgorithm: 'aes-256-gcm',
    keyDerivationFunction: 'pbkdf2',
    keySize: 256,
    saltLength: 32,
    iterations: 100000,
    backupEnabled: true,
    backupLocations: ['local', 'remote1', 'remote2'],
    rotationEnabled: true,
    rotationInterval: 168
  },
  communicationSecurity: {
    tlsEnabled: true,
    minTLSVersion: '1.3',
    allowedCiphers: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256'
    ],
    certificateRotationEnabled: true,
    certificateRotationInterval: 30
  }
};

/**
 * Export default configuration
 */
export { defaultConsensusSecurityConfig as consensusConfig };

/**
 * Utility functions
 */

/**
 * Create secure network configuration
 */
export function createSecureNetworkConfig(nodeId: string): any {
  return {
    nodeId,
    threshold: Math.floor((nodeId.charCodeAt(0) % 5) + 3), // 3-7 based on node ID
    totalParties: 7,
    curveType: 'secp256k1',
    keyRotationInterval: 168, // 1 week
    backupLocations: ['local', 'remote1', 'remote2', 'cloud1'],
    attackDetectionEnabled: true,
    byzantineThreshold: 0.3,
    sybilThreshold: 5,
    eclipseThreshold: 0.2,
    dosThreshold: 1000
  };
}

/**
 * Validate consensus security configuration
 */
export function validateConsensusConfig(config: ConsensusSecurityConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate threshold signature configuration
  if (!config.thresholdSignature) {
    errors.push('Threshold signature configuration is required');
  } else {
    if (config.thresholdSignature.threshold >= config.thresholdSignature.totalParties) {
      errors.push('Threshold must be less than total parties');
    }
    if (config.thresholdSignature.threshold < Math.floor(config.thresholdSignature.totalParties / 2)) {
      warnings.push('Threshold should be at least majority of total parties for Byzantine fault tolerance');
    }
  }

  // Validate attack detection configuration
  if (config.attackDetection) {
    if (config.attackDetection.byzzantineThreshold < 0 || config.attackDetection.byzzantineThreshold > 1) {
      errors.push('Byzantine threshold must be between 0 and 1');
    }
    if (config.attackDetection.dosThreshold <= 0) {
      warnings.push('DoS threshold should be positive');
    }
  }

  // Validate key management configuration
  if (config.keyManagement) {
    if (config.keyManagement.keySize < 128) {
      errors.push('Key size must be at least 128 bits');
    }
    if (config.keyManagement.iterations < 10000) {
      warnings.push('Key derivation iterations should be at least 10,000');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Performance monitoring utilities
 */
export class ConsensusSecurityMetrics {
  private metrics: Map<string, number> = new Map();

  recordMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Map<string, number> {
    return new Map(this.metrics);
  }

  resetMetrics(): void {
    this.metrics.clear();
  }

  getPerformanceReport(): any {
    return {
      timestamp: new Date(),
      metrics: Object.fromEntries(this.metrics),
      summary: this.generateSummary()
    };
  }

  private generateSummary(): any {
    const metrics = Array.from(this.metrics.entries());

    return {
      totalMetrics: metrics.length,
      averageValue: metrics.reduce((sum, [, value]) => sum + value, 0) / metrics.length,
      maxValue: Math.max(...metrics.map(([, value]) => value)),
      minValue: Math.min(...metrics.map(([, value]) => value))
    };
  }
}

/**
 * Integration helper for existing SecurityFramework
 */
export function integrateWithSecurityFramework(securityFramework: any): void {
  console.log('Integrating consensus security with existing SecurityFramework');

  // Add consensus security components to existing framework
  if (securityFramework.addModule) {
    securityFramework.addModule('consensus', {
      ConsensusSecurityManager,
      ThresholdSignatureSystem,
      ZeroKnowledgeProofSystem,
      ConsensusSecurityMonitor,
      createConsensusSecurityManager,
      createThresholdSignatureSystem,
      createZeroKnowledgeProofSystem
    });
  }
}