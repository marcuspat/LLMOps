/**
 * Unit tests for Consensus Security Manager
 * Tests advanced threat detection, cryptographic infrastructure, and Byzantine fault tolerance
 */

import { ConsensusSecurityManager } from '../../src/security/consensus/ConsensusSecurityManager.js';
import { ConsensusSecurityConfig } from '../../src/security/consensus/types/ConsensusSecurityTypes.js';

// Mock crypto module
const mockCrypto = {
  randomUUID: jest.fn(() => 'mock-uuid'),
  generateKeyPairSync: jest.fn(() => ({
    publicKey: {
      export: jest.fn(() => Buffer.from('mock-public-key'))
    }
  }))
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto,
  writable: true
});

// Mock logger
jest.mock('../../src/security/monitoring/AuditLogger.js', () => {
  return {
    AuditLogger: jest.fn().mockImplementation(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }))
  };
});

// Mock cryptographic components
jest.mock('../../src/security/consensus/cryptography/ThresholdSignatureSystem.js', () => {
  return {
    ThresholdSignatureSystem: jest.fn().mockImplementation(() => ({
      generateDistributedKeys: jest.fn().mockResolvedValue({
        privateKeyShare: 'mock-private-share',
        publicKey: 'mock-public-key'
      }),
      createThresholdSignature: jest.fn().mockResolvedValue(Buffer.from('mock-signature')),
      verifyThresholdSignature: jest.fn().mockResolvedValue(true),
      updateKeys: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('../../src/security/consensus/cryptography/ZeroKnowledgeProofSystem.js', () => {
  return {
    ZeroKnowledgeProofSystem: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      proveDiscreteLog: jest.fn().mockResolvedValue({
        proof: 'mock-proof',
        commitment: 'mock-commitment'
      }),
      verifyDiscreteLogProof: jest.fn().mockResolvedValue(true)
    }))
  };
});

jest.mock('../../src/security/consensus/cryptography/SecureKeyManager.js', () => {
  return {
    SecureKeyManager: jest.fn().mockImplementation(() => ({
      storeKeyShare: jest.fn().mockResolvedValue(undefined),
      rotateKeys: jest.fn().mockResolvedValue({
        masterPublicKey: 'new-master-key'
      }),
      cleanup: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

jest.mock('../../src/security/consensus/attack/ConsensusSecurityMonitor.js', () => {
  return {
    ConsensusSecurityMonitor: jest.fn().mockImplementation(() => ({
      configure: jest.fn().mockResolvedValue(undefined),
      detectByzantineAttacks: jest.fn().mockResolvedValue([]),
      cleanup: jest.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('ConsensusSecurityManager', () => {
  let securityManager: ConsensusSecurityManager;
  let mockConfig: ConsensusSecurityConfig;

  beforeEach(() => {
    mockConfig = {
      thresholdSignature: {
        threshold: 3,
        totalParties: 5,
        curveType: 'secp256k1'
      },
      attackDetection: {
        byzzantineThreshold: 0.33,
        sybilThreshold: 10,
        eclipseThreshold: 0.3,
        dosThreshold: 1000
      },
      networkParticipants: [
        { nodeId: 'node-1', ipSubnet: '192.168.1.0/24', asNumber: 'AS12345', region: 'us-east' },
        { nodeId: 'node-2', ipSubnet: '192.168.1.0/24', asNumber: 'AS12345', region: 'us-east' },
        { nodeId: 'node-3', ipSubnet: '10.0.0.0/8', asNumber: 'AS67890', region: 'us-west' }
      ],
      monitoringInterval: 5000
    };

    securityManager = new ConsensusSecurityManager(mockConfig, 'test-node-1');
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (securityManager) {
      await securityManager.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(securityManager.initialize()).resolves.not.toThrow();

      // Verify cryptographic systems were initialized
      expect(securityManager['thresholdSignatureSystem'].generateDistributedKeys).toHaveBeenCalled();
      expect(securityManager['zkpSystem'].initialize).toHaveBeenCalled();
      expect(securityManager['securityMonitor'].configure).toHaveBeenCalledWith({
        byzantineThreshold: 0.33,
        sybilThreshold: 10,
        eclipseThreshold: 0.3,
        dosThreshold: 1000
      });
    });

    it('should set initial metrics correctly', () => {
      const metrics = securityManager.getMetrics();

      expect(metrics).toEqual({
        signatureVerificationTime: 0,
        zkpGenerationTime: 0,
        attackDetectionLatency: 0,
        keyRotationOverhead: 0,
        threatsDetected: 0,
        byzantineNodes: 0,
        sybilAttempts: 0,
        eclipseAttempts: 0,
        dosAttempts: 0,
        consensusSuccess: 0,
        consensusFailures: 0
      });
    });

    it('should initialize reputation system with neutral scores', () => {
      const reputationScores = securityManager.getReputationScores();

      mockConfig.networkParticipants.forEach(participant => {
        expect(reputationScores.get(participant.nodeId)).toBe(0.5);
      });
    });

    it('should emit initialized event', async () => {
      const emitSpy = jest.spyOn(securityManager, 'emit');

      await securityManager.initialize();

      expect(emitSpy).toHaveBeenCalledWith('initialized', {
        nodeId: 'test-node-1'
      });
    });
  });

  describe('Threshold Signatures', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should create threshold signature successfully', async () => {
      const signatories = ['node-1', 'node-2', 'node-3'];

      const signature = await securityManager.createThresholdSignature(
        'test message',
        signatories
      );

      expect(signature).toBe('mock-signature');
      expect(securityManager['thresholdSignatureSystem'].createThresholdSignature).toHaveBeenCalledWith(
        'test message',
        signatories
      );

      // Verify metrics updated
      const metrics = securityManager.getMetrics();
      expect(metrics.signatureVerificationTime).toBeGreaterThan(0);
    });

    it('should verify threshold signature successfully', async () => {
      const isValid = await securityManager.verifyThresholdSignature(
        'test message',
        'mock-signature'
      );

      expect(isValid).toBe(true);
      expect(securityManager['thresholdSignatureSystem'].verifyThresholdSignature).toHaveBeenCalledWith(
        'test message',
        Buffer.from('mock-signature', 'hex')
      );
    });

    it('should handle signature creation errors', async () => {
      securityManager['thresholdSignatureSystem'].createThresholdSignature.mockRejectedValueOnce(
        new Error('Signing failed')
      );

      await expect(securityManager.createThresholdSignature('test', ['node-1']))
        .rejects.toThrow('Signing failed');
    });

    it('should handle signature verification errors', async () => {
      securityManager['thresholdSignatureSystem'].verifyThresholdSignature.mockRejectedValueOnce(
        new Error('Verification failed')
      );

      const isValid = await securityManager.verifyThresholdSignature('test', 'signature');
      expect(isValid).toBe(false);
    });
  });

  describe('Zero Knowledge Proofs', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should create ZK proof successfully', async () => {
      const proof = await securityManager.createZeroKnowledgeProof(
        'secret',
        'commitment'
      );

      expect(proof).toEqual({
        proof: 'mock-proof',
        commitment: 'mock-commitment'
      });

      // Verify metrics updated
      const metrics = securityManager.getMetrics();
      expect(metrics.zkpGenerationTime).toBeGreaterThan(0);
    });

    it('should verify ZK proof successfully', async () => {
      const proof = { proof: 'mock-proof', commitment: 'mock-commitment' };

      const isValid = await securityManager.verifyZeroKnowledgeProof(
        proof,
        'public-key'
      );

      expect(isValid).toBe(true);
    });

    it('should handle ZK proof creation with custom challenge', async () => {
      await securityManager.createZeroKnowledgeProof(
        'secret',
        'commitment',
        'custom-challenge'
      );

      expect(securityManager['zkpSystem'].proveDiscreteLog).toHaveBeenCalledWith(
        'secret',
        'commitment',
        'custom-challenge'
      );
    });
  });

  describe('Attack Detection', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should detect Byzantine attacks', async () => {
      const mockAttacks = [
        {
          type: 'BYZANTINE_ATTACK',
          severity: 'HIGH',
          details: {
            contradictions: [
              { nodeId: 'node-1', contradictoryMessages: ['msg1', 'msg2'] }
            ]
          }
        }
      ];

      securityManager['securityMonitor'].detectByzantineAttacks.mockResolvedValue(mockAttacks);
      securityManager['getRecentConsensusMessages'] = jest.fn().mockResolvedValue([]);

      // Trigger security check
      await (securityManager as any).performSecurityCheck();

      const securityEvents = securityManager.getSecurityEvents();
      expect(securityEvents).toContainEqual(
        expect.objectContaining({
          type: 'ATTACK_DETECTED',
          severity: 'HIGH'
        })
      );

      const metrics = securityManager.getMetrics();
      expect(metrics.threatsDetected).toBe(1);
    });

    it('should detect Sybil attacks', async () => {
      // Add more nodes with similar characteristics to trigger Sybil detection
      for (let i = 4; i <= 15; i++) {
        await securityManager.addParticipant({
          nodeId: `node-${i}`,
          ipSubnet: '192.168.1.0/24',
          asNumber: 'AS12345',
          region: 'us-east'
        });
      }

      // Trigger security check
      await (securityManager as any).performSecurityCheck();

      const securityEvents = securityManager.getSecurityEvents();
      const sybilAttack = securityEvents.find(e =>
        e.details && e.details.type === 'SYBIL_ATTACK'
      );

      expect(sybilAttack).toBeDefined();

      const metrics = securityManager.getMetrics();
      expect(metrics.sybilAttempts).toBeGreaterThan(0);
    });

    it('should detect Eclipse attacks', async () => {
      // Reduce reputation of honest peers to trigger eclipse detection
      const reputationScores = securityManager.getReputationScores();
      reputationScores.forEach((score, nodeId) => {
        if (nodeId !== 'malicious-node') {
          securityManager['reputationScores'].set(nodeId, 0.2);
        }
      });

      // Add many malicious peers
      for (let i = 10; i <= 20; i++) {
        await securityManager.addParticipant({
          nodeId: `malicious-node-${i}`,
          ipSubnet: '10.0.0.0/8',
          asNumber: 'AS99999',
          region: 'unknown'
        });
      }

      // Trigger security check
      await (securityManager as any).performSecurityCheck();

      const securityEvents = securityManager.getSecurityEvents();
      const eclipseAttack = securityEvents.find(e =>
        e.details && e.details.type === 'ECLIPSE_ATTACK'
      );

      expect(eclipseAttack).toBeDefined();
      expect(eclipseAttack?.severity).toBe('CRITICAL');
    });

    it('should detect DoS attacks', async () => {
      securityManager['getMessageRates'] = jest.fn().mockResolvedValue(
        new Map([['attacker-node', 1500]])
      );

      // Trigger security check
      await (securityManager as any).performSecurityCheck();

      const securityEvents = securityManager.getSecurityEvents();
      const dosAttack = securityEvents.find(e =>
        e.details && e.details.type === 'DOS_ATTACK'
      );

      expect(dosAttack).toBeDefined();
      expect(dosAttack?.details.nodeId).toBe('attacker-node');
      expect(dosAttack?.details.messageRate).toBe(1500);
    });
  });

  describe('Attack Mitigation', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should mitigate Sybil attacks by reducing reputation', async () => {
      const attack = {
        type: 'SYBIL_ATTACK',
        details: {
          nodes: ['node-1', 'node-2']
        }
      };

      // Set initial reputation
      securityManager['reputationScores'].set('node-1', 0.8);
      securityManager['reputationScores'].set('node-2', 0.7);

      await (securityManager as any).mitigateAttack(attack);

      // Verify reputation reduced
      expect(securityManager['reputationScores'].get('node-1')).toBe(0.5);
      expect(securityManager['reputationScores'].get('node-2')).toBe(0.4);
    });

    it('should isolate Byzantine nodes', async () => {
      const attack = {
        type: 'BYZANTINE_ATTACK',
        details: {
          contradictions: [
            { nodeId: 'byzantine-node' },
            { nodeId: 'another-byzantine' }
          ]
        }
      };

      await (securityManager as any).mitigateAttack(attack);

      // Verify nodes were isolated
      const reputationScores = securityManager.getReputationScores();
      expect(reputationScores.has('byzantine-node')).toBe(false);
      expect(reputationScores.has('another-byzantine')).toBe(false);
    });

    it('should apply rate limiting for DoS attacks', async () => {
      const attack = {
        type: 'DOS_ATTACK',
        details: {
          nodeId: 'dos-attacker'
        }
      };

      const applyRateLimitingSpy = jest.spyOn(securityManager as any, 'applyRateLimiting');

      await (securityManager as any).mitigateAttack(attack);

      expect(applyRateLimitingSpy).toHaveBeenCalledWith('dos-attacker');
    });
  });

  describe('Key Rotation', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should rotate keys successfully', async () => {
      const emitSpy = jest.spyOn(securityManager, 'emit');

      await securityManager.rotateKeys();

      expect(securityManager['keyManager'].rotateKeys).toHaveBeenCalled();
      expect(securityManager['thresholdSignatureSystem'].updateKeys).toHaveBeenCalled();

      // Verify security event recorded
      const securityEvents = securityManager.getSecurityEvents();
      const keyRotationEvent = securityEvents.find(e => e.type === 'KEY_ROTATION');
      expect(keyRotationEvent).toBeDefined();

      // Verify metrics updated
      const metrics = securityManager.getMetrics();
      expect(metrics.keyRotationOverhead).toBeGreaterThan(0);

      // Verify event emitted
      expect(emitSpy).toHaveBeenCalledWith('keyRotated', expect.objectContaining({
        type: 'KEY_ROTATION',
        severity: 'MEDIUM'
      }));
    });

    it('should handle key rotation failures', async () => {
      securityManager['keyManager'].rotateKeys.mockRejectedValueOnce(
        new Error('Key rotation failed')
      );

      await expect(securityManager.rotateKeys()).rejects.toThrow('Key rotation failed');
    });
  });

  describe('Participant Management', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should add participant with neutral reputation', async () => {
      const newParticipant = {
        nodeId: 'new-node',
        ipSubnet: '172.16.0.0/12',
        asNumber: 'AS54321',
        region: 'eu-west'
      };

      await securityManager.addParticipant(newParticipant);

      const reputationScores = securityManager.getReputationScores();
      expect(reputationScores.get('new-node')).toBe(0.5);
    });

    it('should remove participant and clean up reputation', async () => {
      await securityManager.addParticipant({
        nodeId: 'temp-node',
        ipSubnet: '10.0.0.0/8',
        asNumber: 'AS11111',
        region: 'ap-south'
      });

      await securityManager.removeParticipant('temp-node');

      const reputationScores = securityManager.getReputationScores();
      expect(reputationScores.has('temp-node')).toBe(false);
    });
  });

  describe('Security Event Management', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should record security events correctly', async () => {
      securityManager['securityMonitor'].detectByzantineAttacks.mockResolvedValue([
        {
          type: 'BYZANTINE_ATTACK',
          severity: 'CRITICAL',
          details: { test: 'data' }
        }
      ]);

      await (securityManager as any).performSecurityCheck();

      const events = securityManager.getSecurityEvents();
      expect(events).toHaveLength(1);

      const event = events[0];
      expect(event.id).toBe('mock-uuid');
      expect(event.type).toBe('ATTACK_DETECTED');
      expect(event.severity).toBe('CRITICAL');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should limit returned security events', async () => {
      // Add multiple events
      for (let i = 0; i < 10; i++) {
        securityManager['securityEvents'].push({
          id: `event-${i}`,
          timestamp: new Date(),
          type: 'TEST_EVENT',
          severity: 'LOW' as const,
          details: {}
        });
      }

      const limitedEvents = securityManager.getSecurityEvents(5);
      expect(limitedEvents).toHaveLength(5);
    });

    it('should return all events when no limit specified', async () => {
      // Add some events
      for (let i = 0; i < 3; i++) {
        securityManager['securityEvents'].push({
          id: `event-${i}`,
          timestamp: new Date(),
          type: 'TEST_EVENT',
          severity: 'LOW' as const,
          details: {}
        });
      }

      const allEvents = securityManager.getSecurityEvents();
      expect(allEvents).toHaveLength(3);
    });
  });

  describe('Metrics Collection', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should update metrics during operations', async () => {
      // Perform some operations
      await securityManager.createThresholdSignature('test', ['node-1']);
      await securityManager.createZeroKnowledgeProof('secret', 'commitment');

      const metrics = securityManager.getMetrics();

      expect(metrics.signatureVerificationTime).toBeGreaterThan(0);
      expect(metrics.zkpGenerationTime).toBeGreaterThan(0);
    });

    it('should track attack detection metrics', async () => {
      // Simulate attack detection
      securityManager['securityMonitor'].detectByzantineAttacks.mockResolvedValue([
        { type: 'BYZANTINE_ATTACK' }
      ]);

      await (securityManager as any).performSecurityCheck();

      const metrics = securityManager.getMetrics();
      expect(metrics.threatsDetected).toBe(1);
      expect(metrics.attackDetectionLatency).toBeGreaterThan(0);
    });

    it('should return immutable metrics object', async () => {
      const metrics1 = securityManager.getMetrics();
      const metrics2 = securityManager.getMetrics();

      // Modify first object
      metrics1.signatureVerificationTime = 999;

      // Second object should not be affected
      expect(metrics2.signatureVerificationTime).not.toBe(999);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      securityManager['thresholdSignatureSystem'].generateDistributedKeys.mockRejectedValueOnce(
        new Error('Initialization failed')
      );

      await expect(securityManager.initialize()).rejects.toThrow('Initialization failed');
    });

    it('should handle security check errors', async () => {
      await securityManager.initialize();

      // Mock error in attack detection
      securityManager['securityMonitor'].detectByzantineAttacks.mockRejectedValueOnce(
        new Error('Security check failed')
      );

      // Should not throw, should log error
      await expect((securityManager as any).performSecurityCheck()).resolves.not.toThrow();
    });

    it('should handle cleanup errors', async () => {
      await securityManager.initialize();

      securityManager['keyManager'].cleanup.mockRejectedValueOnce(
        new Error('Cleanup failed')
      );

      // Should still complete shutdown
      await expect(securityManager.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await securityManager.initialize();
    });

    it('should handle empty participant list', () => {
      const emptyConfig = {
        ...mockConfig,
        networkParticipants: []
      };

      const emptyManager = new ConsensusSecurityManager(emptyConfig, 'test-node');

      const reputationScores = emptyManager.getReputationScores();
      expect(reputationScores.size).toBe(0);
    });

    it('should handle unknown attack types', async () => {
      const unknownAttack = {
        type: 'UNKNOWN_ATTACK',
        details: {}
      };

      // Should not throw
      await expect((securityManager as any).mitigateAttack(unknownAttack))
        .resolves.not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const promises = Array(10).fill(null).map(() =>
        securityManager.createThresholdSignature('test', ['node-1'])
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result).toBe('mock-signature');
      });
    });
  });

  describe('Resource Cleanup', () => {
    it('should cleanup resources on shutdown', async () => {
      await securityManager.initialize();

      const keyManagerCleanupSpy = jest.spyOn(securityManager['keyManager'], 'cleanup');
      const monitorCleanupSpy = jest.spyOn(securityManager['securityMonitor'], 'cleanup');

      await securityManager.shutdown();

      expect(keyManagerCleanupSpy).toHaveBeenCalled();
      expect(monitorCleanupSpy).toHaveBeenCalled();
      expect(securityManager['isActive']).toBe(false);
    });

    it('should remove all event listeners on shutdown', async () => {
      await securityManager.initialize();

      const removeAllListenersSpy = jest.spyOn(securityManager, 'removeAllListeners');

      await securityManager.shutdown();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });
});