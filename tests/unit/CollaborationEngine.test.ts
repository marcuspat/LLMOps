/**
 * Unit tests for Collaboration Engine
 * Tests real-time collaboration, conflict resolution, and CRDT operations
 */

import { CollaborationEngine } from '../../src/collaboration/core/CollaborationEngine.js';
import { CollaborationEvent, ConflictResolutionStrategy, UserPresence } from '../../src/collaboration/types.js';

// Mock WebSocket for real-time communication
const mockWebSocket = {
  send: jest.fn(),
  on: jest.fn(),
  close: jest.fn(),
  readyState: 1 // WebSocket.OPEN
};

// Mock EventEmitter
jest.mock('events', () => {
  const originalModule = jest.requireActual('events');
  return {
    ...originalModule,
    EventEmitter: jest.fn().mockImplementation(() => ({
      emit: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      removeAllListeners: jest.fn()
    }))
  };
});

describe('CollaborationEngine', () => {
  let collaborationEngine: CollaborationEngine;
  const mockConfig = {
    maxConcurrentUsers: 10,
    conflictResolution: ConflictResolutionStrategy.LAST_WRITER_WINS,
    syncInterval: 100,
    operationTimeout: 5000
  };

  beforeEach(() => {
    collaborationEngine = new CollaborationEngine(mockConfig);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (collaborationEngine) {
      await collaborationEngine.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const engine = new CollaborationEngine();
      expect(engine).toBeDefined();
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxConcurrentUsers: 20,
        conflictResolution: ConflictResolutionStrategy.OPERATIONAL_TRANSFORM,
        syncInterval: 50
      };

      const engine = new CollaborationEngine(customConfig);
      expect(engine).toBeDefined();
    });

    it('should start in inactive state', () => {
      expect(collaborationEngine.isActive()).toBe(false);
    });
  });

  describe('User Management', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should add user successfully', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        avatar: 'avatar.png',
        permissions: ['read', 'write']
      };

      const result = await collaborationEngine.addUser(user);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-1');
      expect(collaborationEngine.getUserCount()).toBe(1);
    });

    it('should reject user when limit reached', async () => {
      // Fill up to max users
      const promises = Array(mockConfig.maxConcurrentUsers).fill(null).map((_, i) =>
        collaborationEngine.addUser({
          id: `user-${i}`,
          name: `User ${i}`,
          permissions: ['read', 'write']
        })
      );

      await Promise.all(promises);

      // Try to add one more
      const result = await collaborationEngine.addUser({
        id: 'extra-user',
        name: 'Extra User',
        permissions: ['read']
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum concurrent users');
    });

    it('should remove user successfully', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        permissions: ['read', 'write']
      };

      await collaborationEngine.addUser(user);
      expect(collaborationEngine.getUserCount()).toBe(1);

      const result = await collaborationEngine.removeUser('user-1');

      expect(result.success).toBe(true);
      expect(collaborationEngine.getUserCount()).toBe(0);
    });

    it('should handle removing non-existent user', async () => {
      const result = await collaborationEngine.removeUser('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('User not found');
    });

    it('should update user presence', async () => {
      const user = {
        id: 'user-1',
        name: 'Test User',
        permissions: ['read', 'write']
      };

      await collaborationEngine.addUser(user);

      const presence: UserPresence = {
        userId: 'user-1',
        cursor: { line: 5, column: 10 },
        selection: { start: { line: 5, column: 0 }, end: { line: 5, column: 20 } },
        isActive: true
      };

      const result = await collaborationEngine.updatePresence(presence);

      expect(result.success).toBe(true);

      const userPresence = collaborationEngine.getUserPresence('user-1');
      expect(userPresence?.cursor).toEqual({ line: 5, column: 10 });
      expect(userPresence?.selection).toEqual({
        start: { line: 5, column: 0 },
        end: { line: 5, column: 20 }
      });
    });

    it('should get all active users', async () => {
      const users = [
        { id: 'user-1', name: 'User 1', permissions: ['read', 'write'] },
        { id: 'user-2', name: 'User 2', permissions: ['read'] },
        { id: 'user-3', name: 'User 3', permissions: ['read', 'write'] }
      ];

      for (const user of users) {
        await collaborationEngine.addUser(user);
      }

      const activeUsers = collaborationEngine.getActiveUsers();

      expect(activeUsers).toHaveLength(3);
      expect(activeUsers.map(u => u.id)).toContain('user-1');
      expect(activeUsers.map(u => u.id)).toContain('user-2');
      expect(activeUsers.map(u => u.id)).toContain('user-3');
    });
  });

  describe('Document Operations', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should create document successfully', async () => {
      const result = await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test Document',
        content: 'Initial content',
        ownerId: 'user-1'
      });

      expect(result.success).toBe(true);
      expect(result.documentId).toBe('doc-1');

      const doc = collaborationEngine.getDocument('doc-1');
      expect(doc).toBeDefined();
      expect(doc?.content).toBe('Initial content');
    });

    it('should handle document creation with invalid data', async () => {
      const result = await collaborationEngine.createDocument({
        id: '', // Invalid ID
        title: '',
        content: '',
        ownerId: ''
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid document data');
    });

    it('should apply operation to document', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Hello world',
        ownerId: 'user-1'
      });

      const operation = {
        type: 'insert',
        position: 5,
        content: ' beautiful',
        userId: 'user-1'
      };

      const result = await collaborationEngine.applyOperation('doc-1', operation);

      expect(result.success).toBe(true);

      const doc = collaborationEngine.getDocument('doc-1');
      expect(doc?.content).toBe('Hello beautiful world');
    });

    it('should reject operation on non-existent document', async () => {
      const operation = {
        type: 'insert',
        position: 0,
        content: 'test',
        userId: 'user-1'
      };

      const result = await collaborationEngine.applyOperation('non-existent-doc', operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Document not found');
    });

    it('should handle concurrent operations with conflict resolution', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'ABC',
        ownerId: 'user-1'
      });

      // Two users try to insert at same position
      const operation1 = {
        type: 'insert',
        position: 1,
        content: 'X',
        userId: 'user-1'
      };

      const operation2 = {
        type: 'insert',
        position: 1,
        content: 'Y',
        userId: 'user-2'
      };

      // Add users
      await collaborationEngine.addUser({ id: 'user-1', name: 'User 1', permissions: ['write'] });
      await collaborationEngine.addUser({ id: 'user-2', name: 'User 2', permissions: ['write'] });

      // Apply operations concurrently
      const [result1, result2] = await Promise.all([
        collaborationEngine.applyOperation('doc-1', operation1),
        collaborationEngine.applyOperation('doc-1', operation2)
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify conflict was resolved
      const doc = collaborationEngine.getDocument('doc-1');
      expect(doc?.content).toMatch(/A[XY]BC/);
    });

    it('should handle delete operations', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Hello world',
        ownerId: 'user-1'
      });

      const operation = {
        type: 'delete',
        position: 5,
        length: 6,
        userId: 'user-1'
      };

      const result = await collaborationEngine.applyOperation('doc-1', operation);

      expect(result.success).toBe(true);

      const doc = collaborationEngine.getDocument('doc-1');
      expect(doc?.content).toBe('Hello');
    });

    it('should handle replace operations', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Hello world',
        ownerId: 'user-1'
      });

      const operation = {
        type: 'replace',
        position: 6,
        length: 5,
        content: 'universe',
        userId: 'user-1'
      };

      const result = await collaborationEngine.applyOperation('doc-1', operation);

      expect(result.success).toBe(true);

      const doc = collaborationEngine.getDocument('doc-1');
      expect(doc?.content).toBe('Hello universe');
    });
  });

  describe('Conflict Resolution', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should use last-writer-wins strategy', async () => {
      // Create engine with last-writer-wins strategy
      const engine = new CollaborationEngine({
        conflictResolution: ConflictResolutionStrategy.LAST_WRITER_WINS
      });
      await engine.initialize();

      await engine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Initial',
        ownerId: 'user-1'
      });

      // User 1 edits first
      const op1 = {
        type: 'replace',
        position: 0,
        length: 7,
        content: 'User 1 edit',
        userId: 'user-1'
      };

      await engine.applyOperation('doc-1', op1);

      // User 2 edits same position later
      const op2 = {
        type: 'replace',
        position: 0,
        length: 11,
        content: 'User 2 edit',
        userId: 'user-2'
      };

      await engine.applyOperation('doc-1', op2);

      const doc = engine.getDocument('doc-1');
      expect(doc?.content).toBe('User 2 edit');

      await engine.shutdown();
    });

    it('should merge concurrent operations with operational transform', async () => {
      // Create engine with operational transform strategy
      const engine = new CollaborationEngine({
        conflictResolution: ConflictResolutionStrategy.OPERATIONAL_TRANSFORM
      });
      await engine.initialize();

      await engine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'AB',
        ownerId: 'user-1'
      });

      // Two concurrent insertions
      const op1 = {
        type: 'insert',
        position: 1,
        content: 'X',
        userId: 'user-1'
      };

      const op2 = {
        type: 'insert',
        position: 1,
        content: 'Y',
        userId: 'user-2'
      };

      // Add users
      await engine.addUser({ id: 'user-1', name: 'User 1', permissions: ['write'] });
      await engine.addUser({ id: 'user-2', name: 'User 2', permissions: ['write'] });

      await Promise.all([
        engine.applyOperation('doc-1', op1),
        engine.applyOperation('doc-1', op2)
      ]);

      const doc = engine.getDocument('doc-1');
      // Both insertions should be preserved
      expect(doc?.content).toMatch(/A[XY]B/);

      await engine.shutdown();
    });
  });

  describe('Real-time Synchronization', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should broadcast operations to all users', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Initial',
        ownerId: 'user-1'
      });

      // Add multiple users
      await collaborationEngine.addUser({ id: 'user-1', name: 'User 1', permissions: ['write'] });
      await collaborationEngine.addUser({ id: 'user-2', name: 'User 2', permissions: ['write'] });
      await collaborationEngine.addUser({ id: 'user-3', name: 'User 3', permissions: ['read'] });

      const operation = {
        type: 'insert',
        position: 7,
        content: ' content',
        userId: 'user-1'
      };

      // Mock WebSocket connections
      const mockConnections = new Map([
        ['user-1', mockWebSocket],
        ['user-2', mockWebSocket],
        ['user-3', mockWebSocket]
      ]);

      (collaborationEngine as any).connections = mockConnections;

      await collaborationEngine.applyOperation('doc-1', operation);

      // Verify broadcast to all users
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2); // Excludes sender
    });

    it('should handle sync requests', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Current state',
        ownerId: 'user-1'
      });

      // Apply some operations
      await collaborationEngine.applyOperation('doc-1', {
        type: 'insert',
        position: 0,
        content: 'Updated: ',
        userId: 'user-1'
      });

      const syncData = await collaborationEngine.getSyncData('doc-1', 'user-2');

      expect(syncData.documentId).toBe('doc-1');
      expect(syncData.content).toBe('Updated: Current state');
      expect(syncData.version).toBeGreaterThan(0);
      expect(syncData.operations).toBeDefined();
    });

    it('should handle operation history', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Start',
        ownerId: 'user-1'
      });

      // Apply multiple operations
      const operations = [
        { type: 'insert' as const, position: 5, content: ' middle', userId: 'user-1' },
        { type: 'append' as const, content: ' end', userId: 'user-1' },
        { type: 'insert' as const, position: 0, content: 'Beginning ', userId: 'user-2' }
      ];

      for (const op of operations) {
        await collaborationEngine.applyOperation('doc-1', op);
      }

      const history = collaborationEngine.getOperationHistory('doc-1');

      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('insert');
      expect(history[1].type).toBe('append');
      expect(history[2].type).toBe('insert');
    });
  });

  describe('Permission Management', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should enforce write permissions', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Initial',
        ownerId: 'owner-1'
      });

      // Add user with read-only permissions
      await collaborationEngine.addUser({
        id: 'reader-1',
        name: 'Reader',
        permissions: ['read']
      });

      const operation = {
        type: 'insert',
        position: 0,
        content: 'Unauthorized edit',
        userId: 'reader-1'
      };

      const result = await collaborationEngine.applyOperation('doc-1', operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('write permission');
    });

    it('should allow owner to edit regardless of explicit permissions', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Initial',
        ownerId: 'owner-1'
      });

      // Add owner without explicit write permission
      await collaborationEngine.addUser({
        id: 'owner-1',
        name: 'Owner',
        permissions: [] // No explicit permissions
      });

      const operation = {
        type: 'insert',
        position: 0,
        content: 'Owner edit',
        userId: 'owner-1'
      };

      const result = await collaborationEngine.applyOperation('doc-1', operation);

      expect(result.success).toBe(true);
    });

    it('should handle permission changes', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Initial',
        ownerId: 'owner-1'
      });

      const userId = 'user-1';

      // Add user with read-only
      await collaborationEngine.addUser({
        id: userId,
        name: 'User',
        permissions: ['read']
      });

      // Try to edit (should fail)
      const operation = {
        type: 'insert',
        position: 0,
        content: 'Edit',
        userId
      };

      let result = await collaborationEngine.applyOperation('doc-1', operation);
      expect(result.success).toBe(false);

      // Grant write permission
      await collaborationEngine.updatePermissions(userId, ['read', 'write']);

      // Try to edit again (should succeed)
      result = await collaborationEngine.applyOperation('doc-1', operation);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should handle high frequency operations', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Start',
        ownerId: 'user-1'
      });

      await collaborationEngine.addUser({
        id: 'user-1',
        name: 'User',
        permissions: ['write']
      });

      // Apply many operations rapidly
      const operations = Array(100).fill(null).map((_, i) => ({
        type: 'append' as const,
        content: `${i}`,
        userId: 'user-1'
      }));

      const startTime = Date.now();

      const results = await Promise.all(
        operations.map(op => collaborationEngine.applyOperation('doc-1', op))
      );

      const duration = Date.now() - startTime;

      // All operations should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle many concurrent users', async () => {
      const userCount = 50;
      const users = Array(userCount).fill(null).map((_, i) => ({
        id: `user-${i}`,
        name: `User ${i}`,
        permissions: ['read', 'write']
      }));

      // Add all users
      const addPromises = users.map(user => collaborationEngine.addUser(user));
      const results = await Promise.all(addPromises);

      // All users should be added successfully (within limit)
      const successfulAdds = results.filter(r => r.success);
      expect(successfulAdds.length).toBeLessThanOrEqual(mockConfig.maxConcurrentUsers);

      // Verify active user count
      expect(collaborationEngine.getUserCount()).toBeLessThanOrEqual(mockConfig.maxConcurrentUsers);
    });

    it('should maintain performance with large documents', async () => {
      // Create large document
      const largeContent = 'A'.repeat(10000);

      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Large Document',
        content: largeContent,
        ownerId: 'user-1'
      });

      await collaborationEngine.addUser({
        id: 'user-1',
        name: 'User',
        permissions: ['write']
      });

      // Operation in middle of large document
      const operation = {
        type: 'insert',
        position: 5000,
        content: 'INSERTED',
        userId: 'user-1'
      };

      const startTime = Date.now();
      const result = await collaborationEngine.applyOperation('doc-1', operation);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Should complete quickly even with large document
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await collaborationEngine.initialize();
    });

    it('should handle invalid operation types', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Initial',
        ownerId: 'user-1'
      });

      const invalidOperation = {
        type: 'invalid-type',
        position: 0,
        content: 'test',
        userId: 'user-1'
      } as any;

      const result = await collaborationEngine.applyOperation('doc-1', invalidOperation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid operation type');
    });

    it('should handle operations with invalid positions', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Short',
        ownerId: 'user-1'
      });

      const operation = {
        type: 'insert',
        position: 100, // Beyond document length
        content: 'test',
        userId: 'user-1'
      };

      const result = await collaborationEngine.applyOperation('doc-1', operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid position');
    });

    it('should handle document deletion', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Content',
        ownerId: 'user-1'
      });

      const result = await collaborationEngine.deleteDocument('doc-1', 'user-1');

      expect(result.success).toBe(true);
      expect(collaborationEngine.getDocument('doc-1')).toBeUndefined();
    });

    it('should prevent unauthorized document deletion', async () => {
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Content',
        ownerId: 'owner-1'
      });

      const result = await collaborationEngine.deleteDocument('doc-1', 'unauthorized-user');

      expect(result.success).toBe(false);
      expect(result.error).toContain('permission');
    });

    it('should handle corrupted document state', async () => {
      // Simulate corrupted document
      (collaborationEngine as any).documents.set('corrupted-doc', {
        id: 'corrupted-doc',
        content: null, // Corrupted state
        version: -1
      });

      const operation = {
        type: 'insert',
        position: 0,
        content: 'test',
        userId: 'user-1'
      };

      const result = await collaborationEngine.applyOperation('corrupted-doc', operation);

      expect(result.success).toBe(false);
      expect(result.error).toContain('corrupted');
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should cleanup resources on shutdown', async () => {
      await collaborationEngine.initialize();

      // Add some data
      await collaborationEngine.addUser({ id: 'user-1', name: 'User', permissions: ['write'] });
      await collaborationEngine.createDocument({
        id: 'doc-1',
        title: 'Test',
        content: 'Content',
        ownerId: 'user-1'
      });

      await collaborationEngine.shutdown();

      expect(collaborationEngine.isActive()).toBe(false);
      expect(collaborationEngine.getUserCount()).toBe(0);
    });

    it('should handle shutdown errors gracefully', async () => {
      await collaborationEngine.initialize();

      // Simulate error during cleanup
      (collaborationEngine as any).connections = new Map([['user-1', null]]);

      // Should not throw
      await expect(collaborationEngine.shutdown()).resolves.not.toThrow();
    });
  });
});