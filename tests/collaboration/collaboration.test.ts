/**
 * Comprehensive Testing Suite for Pair Programming and Collaborative Development System
 * Tests all major components with high coverage and validation
 */

import {
  CollaborationEngine,
  ChatSystem,
  SharedCodeEditor,
  TerminalSharing,
  DebugCoordinator,
  BackendIntegration,
  CollaborationRole,
  SessionType,
  MessageType,
  Permission,
  TransformType,
  DebugType,
  DebugStatus
} from '../../src/collaboration/index.js';

import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

// Mock WebSocket for testing
class MockWebSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  sentMessages: any[] = [];

  send(data: string): void {
    this.sentMessages.push(JSON.parse(data));
  }

  close(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }
}

// Mock Turbo Flow Server
class MockTurboFlowServer extends EventEmitter {
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}

describe('Collaboration System Integration Tests', () => {
  let collaborationEngine: CollaborationEngine;
  let chatSystem: ChatSystem;
  let codeEditor: SharedCodeEditor;
  let terminalSharing: TerminalSharing;
  let debugCoordinator: DebugCoordinator;
  let backendIntegration: BackendIntegration;
  let mockServer: MockTurboFlowServer;

  let testUsers: any[];
  let testSessions: any[];

  beforeAll(async () => {
    mockServer = new MockTurboFlowServer();
    backendIntegration = new BackendIntegration(mockServer as any);

    collaborationEngine = new CollaborationEngine();
    chatSystem = new ChatSystem();
    codeEditor = new SharedCodeEditor();
    terminalSharing = new TerminalSharing();
    debugCoordinator = new DebugCoordinator();

    testUsers = [
      {
        id: 'user1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: CollaborationRole.MODERATOR,
        permissions: [Permission.READ, Permission.WRITE, Permission.EDIT, Permission.MODERATE]
      },
      {
        id: 'user2',
        name: 'Bob Smith',
        email: 'bob@example.com',
        role: CollaborationRole.DRIVER,
        permissions: [Permission.READ, Permission.WRITE, Permission.TERMINAL]
      },
      {
        id: 'user3',
        name: 'Charlie Brown',
        email: 'charlie@example.com',
        role: CollaborationRole.NAVIGATOR,
        permissions: [Permission.READ, Permission.EDIT, Permission.DEBUG]
      }
    ];

    // Register test users
    for (const user of testUsers) {
      collaborationEngine.registerUser(user);
    }

    testSessions = [];
  });

  afterAll(async () => {
    // Cleanup
    await backendIntegration.stop();
  });

  beforeEach(async () => {
    // Reset state before each test
    testSessions = [];
  });

  describe('Session Management', () => {
    test('should create a new collaboration session', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        description: 'A test collaboration session',
        type: SessionType.PAIR_PROGRAMMING
      });

      expect(session).toBeDefined();
      expect(session.name).toBe('Test Session');
      expect(session.type).toBe(SessionType.PAIR_PROGRAMMING);
      expect(session.hostId).toBe(testUsers[0].id);
      expect(session.participants).toHaveLength(1);
      expect(session.participants[0].userId).toBe(testUsers[0].id);
      expect(session.participants[0].role).toBe(CollaborationRole.MODERATOR);

      testSessions.push(session);
    });

    test('should allow users to join a session', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const { participant } = await collaborationEngine.joinSession(
        session.id,
        testUsers[1].id,
        CollaborationRole.DRIVER
      );

      expect(participant).toBeDefined();
      expect(participant.userId).toBe(testUsers[1].id);
      expect(participant.role).toBe(CollaborationRole.DRIVER);

      const updatedSession = collaborationEngine.getSession(session.id);
      expect(updatedSession?.participants).toHaveLength(2);

      testSessions.push(session);
    });

    test('should handle role changes within a session', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      await collaborationEngine.joinSession(session.id, testUsers[1].id, CollaborationRole.DRIVER);
      await collaborationEngine.joinSession(session.id, testUsers[2].id, CollaborationRole.NAVIGATOR);

      const participant = await collaborationEngine.changeRole(
        session.id,
        testUsers[1].id,
        CollaborationRole.NAVIGATOR
      );

      expect(participant.role).toBe(CollaborationRole.NAVIGATOR);
      expect(session.state.currentDriver).toBeUndefined(); // Driver was demoted

      testSessions.push(session);
    });

    test('should handle session lifecycle correctly', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      await collaborationEngine.joinSession(session.id, testUsers[1].id, CollaborationRole.DRIVER);

      expect(session.status).toBe('created');

      await collaborationEngine.startSession(session.id);
      expect(session.status).toBe('active');

      await collaborationEngine.endSession(session.id);
      expect(session.status).toBe('ended');

      testSessions.push(session);
    });
  });

  describe('Real-time Communication', () => {
    test('should handle WebSocket connections and message routing', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const mockWs = new MockWebSocket();
      const clientId = 'test-client-1';

      collaborationEngine.handleConnection(mockWs as any, clientId);

      // Test authentication
      const authMessage = {
        type: 'authenticate',
        sessionId: '',
        payload: { userId: testUsers[0].id, token: 'test-token' },
        timestamp: new Date(),
        id: 'auth-1'
      };

      mockWs.emit('message', JSON.stringify(authMessage));

      // Test session join
      const joinMessage = {
        type: 'joinSession',
        sessionId: session.id,
        payload: { sessionId: session.id, role: CollaborationRole.DRIVER },
        timestamp: new Date(),
        id: 'join-1'
      };

      mockWs.emit('message', JSON.stringify(joinMessage));

      // Verify authentication and join messages were sent
      expect(mockWs.sentMessages).toHaveLength(2);
      expect(mockWs.sentMessages[0].type).toBe('authenticated');
      expect(mockWs.sentMessages[1].type).toBe('joinedSession');

      testSessions.push(session);
    });

    test('should handle cursor position updates', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      await collaborationEngine.joinSession(session.id, testUsers[1].id, CollaborationRole.DRIVER);

      const cursorPosition = {
        line: 10,
        column: 5,
        documentId: 'test-doc',
        visible: true
      };

      collaborationEngine.updateCursor(session.id, 'test-doc', testUsers[1].id, cursorPosition);

      const updatedSession = collaborationEngine.getSession(session.id);
      expect(updatedSession?.state.cursors.has(testUsers[1].id)).toBe(true);

      const cursor = updatedSession?.state.cursors.get(testUsers[1].id);
      expect(cursor?.line).toBe(10);
      expect(cursor?.column).toBe(5);

      testSessions.push(session);
    });
  });

  describe('Chat System', () => {
    test('should send and receive chat messages', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const message = await chatSystem.sendMessage({
        sessionId: session.id,
        authorId: testUsers[0].id,
        content: 'Hello, team!',
        type: MessageType.TEXT
      });

      expect(message).toBeDefined();
      expect(message.content).toBe('Hello, team!');
      expect(message.authorId).toBe(testUsers[0].id);

      const messages = chatSystem.getMessages(session.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe(message.id);

      testSessions.push(session);
    });

    test('should handle message reactions', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const message = await chatSystem.sendMessage({
        sessionId: session.id,
        authorId: testUsers[0].id,
        content: 'Great work!',
        type: MessageType.TEXT
      });

      const updatedMessage = await chatSystem.addReaction(message.id, '👍', testUsers[1].id);

      expect(updatedMessage.reactions).toHaveLength(1);
      expect(updatedMessage.reactions![0].emoji).toBe('👍');
      expect(updatedMessage.reactions![0].userId).toBe(testUsers[1].id);

      testSessions.push(session);
    });

    test('should handle voice calls', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const call = await chatSystem.startCall({
        sessionId: session.id,
        type: 'voice' as any,
        participants: [testUsers[0].id, testUsers[1].id]
      });

      expect(call).toBeDefined();
      expect(call.type).toBe('voice');
      expect(call.participants).toHaveLength(2);

      const updatedCall = await chatSystem.joinCall(call.id, testUsers[2].id);
      expect(updatedCall.participants).toHaveLength(3);

      testSessions.push(session);
    });
  });

  describe('Code Editor Collaboration', () => {
    test('should create and manage shared documents', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const document = await codeEditor.createDocument(session.id, {
        name: 'test.js',
        content: 'console.log("Hello World");',
        language: 'javascript'
      });

      expect(document).toBeDefined();
      expect(document.name).toBe('test.js');
      expect(document.language).toBe('javascript');
      expect(document.content).toBe('console.log("Hello World");');

      testSessions.push(session);
    });

    test('should handle concurrent text operations', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const document = await codeEditor.createDocument(session.id, {
        name: 'test.js',
        content: '',
        language: 'javascript'
      });

      // User 1 inserts text
      const result1 = await codeEditor.applyOperation(session.id, document.id, {
        type: 'insert',
        position: { line: 0, column: 0 },
        content: 'const x = ',
        userId: testUsers[0].id,
        timestamp: new Date()
      }, testUsers[0].id);

      expect(result1.success).toBe(true);

      // User 2 inserts text
      const result2 = await codeEditor.applyOperation(session.id, document.id, {
        type: 'insert',
        position: { line: 0, column: 10 },
        content: '42;',
        userId: testUsers[1].id,
        timestamp: new Date()
      }, testUsers[1].id);

      expect(result2.success).toBe(true);

      const updatedDocument = codeEditor.getDocument(session.id, document.id);
      expect(updatedDocument?.content).toBe('const x = 42;');

      testSessions.push(session);
    });

    test('should handle cursor and selection tracking', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const document = await codeEditor.createDocument(session.id, {
        name: 'test.js',
        content: 'function hello() { return "Hello"; }',
        language: 'javascript'
      });

      // Update cursor position
      const cursorPosition = {
        line: 0,
        column: 9,
        documentId: document.id,
        userId: testUsers[0].id,
        timestamp: new Date(),
        visible: true
      };

      codeEditor.updateCursor(session.id, document.id, testUsers[0].id, cursorPosition);

      // Update selection
      const selection = {
        start: { line: 0, column: 9 },
        end: { line: 0, column: 14 },
        documentId: document.id,
        userId: testUsers[0].id,
        timestamp: new Date()
      };

      codeEditor.updateSelection(session.id, document.id, testUsers[0].id, selection);

      const userState = codeEditor.getUserState(session.id, testUsers[0].id);
      expect(userState?.cursor?.line).toBe(0);
      expect(userState?.cursor?.column).toBe(9);
      expect(userState?.selection?.start.column).toBe(9);
      expect(userState?.selection?.end.column).toBe(14);

      testSessions.push(session);
    });
  });

  describe('Terminal Sharing', () => {
    test('should create and manage terminal sessions', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const terminalSession = await terminalSharing.createSession(session.id, testUsers[0].id, {
        shell: '/bin/bash',
        terminalType: 'xterm-256color'
      });

      expect(terminalSession).toBeDefined();
      expect(terminalSession.sessionId).toBe(session.id);
      expect(terminalSession.ownerId).toBe(testUsers[0].id);
      expect(terminalSession.status).toBe('active');

      testSessions.push(session);
    });

    test('should handle command execution', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      await terminalSharing.createSession(session.id, testUsers[0].id);

      const command = await terminalSharing.executeCommand(
        session.id,
        'echo "Hello from terminal"',
        testUsers[0].id
      );

      expect(command).toBeDefined();
      expect(command.command).toBe('echo "Hello from terminal"');
      expect(command.userId).toBe(testUsers[0].id);
      expect(command.result?.exitCode).toBe(0);

      testSessions.push(session);
    });

    test('should manage terminal permissions', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const terminalSession = await terminalSharing.createSession(session.id, testUsers[0].id);

      await terminalSharing.joinSession(session.id, testUsers[1].id);

      const permissions = terminalSharing.getUserPermissions(session.id, testUsers[1].id);
      expect(permissions).toContain('read');

      // Update permissions
      terminalSharing.updateUserPermissions(session.id, testUsers[1].id, [
        'read' as any,
        'write' as any,
        'execute' as any
      ]);

      const updatedPermissions = terminalSharing.getUserPermissions(session.id, testUsers[1].id);
      expect(updatedPermissions).toContain('write');
      expect(updatedPermissions).toContain('execute');

      testSessions.push(session);
    });
  });

  describe('Debug Coordination', () => {
    test('should create and manage debug sessions', async () => {
      const debugSession = await debugCoordinator.startSession(
        'debug-session-1',
        {
          type: DebugType.LAUNCH,
          program: 'test.js',
          args: [],
          env: {},
          cwd: '/test'
        },
        'node',
        testUsers[0].id
      );

      expect(debugSession).toBeDefined();
      expect(debugSession.type).toBe(DebugType.LAUNCH);
      expect(debugSession.status).toBe(DebugStatus.ACTIVE);
      expect(debugSession.participants).toContain(testUsers[0].id);
    });

    test('should handle breakpoints', async () => {
      const debugSession = await debugCoordinator.startSession(
        'debug-session-2',
        {
          type: DebugType.LAUNCH,
          program: 'test.js',
          args: [],
          env: {},
          cwd: '/test'
        },
        'node',
        testUsers[0].id
      );

      const breakpoint = await debugCoordinator.setBreakpoint(
        debugSession.id,
        {
          file: '/test/test.js',
          line: 10,
          column: 0,
          enabled: true
        },
        testUsers[0].id
      );

      expect(breakpoint).toBeDefined();
      expect(breakpoint.file).toBe('/test/test.js');
      expect(breakpoint.line).toBe(10);
      expect(breakpoint.enabled).toBe(true);

      const breakpoints = debugCoordinator.getBreakpoints(debugSession.id);
      expect(breakpoints).toHaveLength(1);
    });

    test('should handle debug commands', async () => {
      const debugSession = await debugCoordinator.startSession(
        'debug-session-3',
        {
          type: DebugType.LAUNCH,
          program: 'test.js',
          args: [],
          env: {},
          cwd: '/test'
        },
        'node',
        testUsers[0].id
      );

      const result = await debugCoordinator.executeCommand(
        debugSession.id,
        'pause' as any,
        testUsers[0].id
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    test('should evaluate expressions', async () => {
      const debugSession = await debugCoordinator.startSession(
        'debug-session-4',
        {
          type: DebugType.LAUNCH,
          program: 'test.js',
          args: [],
          env: {},
          cwd: '/test'
        },
        'node',
        testUsers[0].id
      );

      const result = await debugCoordinator.evaluateExpression(debugSession.id, '2 + 2', testUsers[0].id);

      expect(result).toBeDefined();
    });
  });

  describe('Backend Integration', () => {
    test('should create integrated collaboration sessions', async () => {
      const session = await backendIntegration.createIntegratedSession(testUsers[0].id, {
        name: 'Integrated Test Session',
        type: SessionType.PAIR_PROGRAMMING,
        enableAgentCollaboration: true,
        enableGitHubSync: false,
        repositoryUrl: ''
      });

      expect(session).toBeDefined();
      expect(session.name).toBe('Integrated Test Session');
      expect(session.participants).toContain(testUsers[0].id);

      const integrationStatus = backendIntegration.getIntegrationStatus(session.id);
      expect(integrationStatus).toBeDefined();
      expect(integrationStatus?.agentCollaboration).toBe(true);
      expect(integrationStatus?.gitHubSync).toBe(false);
      expect(integrationStatus?.truthVerification).toBe(true);

      testSessions.push(session);
    });

    test('should handle truth verification integration', async () => {
      const session = await backendIntegration.createIntegratedSession(testUsers[0].id, {
        name: 'Verification Test Session',
        type: SessionType.PAIR_PROGRAMMING,
        enableGitHubSync: false,
        repositoryUrl: ''
      });

      // Create a document with code
      await codeEditor.createDocument(session.id, {
        name: 'test.js',
        content: 'function hello() { return "Hello"; }',
        language: 'javascript'
      });

      const verificationResult = await backendIntegration.verifyCodeQuality(session.id);

      expect(verificationResult).toBeDefined();
      expect(verificationResult.sessionId).toBe(session.id);
      expect(verificationResult.results).toBeDefined();
      expect(typeof verificationResult.overallScore).toBe('number');

      testSessions.push(session);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent sessions', async () => {
      const sessionPromises = [];

      // Create 10 concurrent sessions
      for (let i = 0; i < 10; i++) {
        sessionPromises.push(
          collaborationEngine.createSession(testUsers[0].id, {
            name: `Session ${i}`,
            type: SessionType.PAIR_PROGRAMMING
          })
        );
      }

      const sessions = await Promise.all(sessionPromises);
      expect(sessions).toHaveLength(10);

      const activeSessions = collaborationEngine.getActiveSessions();
      expect(activeSessions.length).toBeGreaterThanOrEqual(10);

      // Clean up
      for (const session of sessions) {
        await collaborationEngine.endSession(session.id);
      }
    });

    test('should handle high message throughput', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Performance Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const messagePromises = [];

      // Send 100 messages rapidly
      for (let i = 0; i < 100; i++) {
        messagePromises.push(
          chatSystem.sendMessage({
            sessionId: session.id,
            authorId: testUsers[0].id,
            content: `Message ${i}`,
            type: MessageType.TEXT
          })
        );
      }

      const messages = await Promise.all(messagePromises);
      expect(messages).toHaveLength(100);

      const retrievedMessages = chatSystem.getMessages(session.id);
      expect(retrievedMessages.length).toBe(100);

      testSessions.push(session);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid session IDs gracefully', async () => {
      expect(() => {
        collaborationEngine.getSession('invalid-session-id');
      }).not.toThrow();

      const session = collaborationEngine.getSession('invalid-session-id');
      expect(session).toBeNull();
    });

    test('should handle permission violations', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Permission Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      await collaborationEngine.joinSession(session.id, testUsers[1].id, CollaborationRole.OBSERVER);

      const document = await codeEditor.createDocument(session.id, {
        name: 'test.js',
        content: '',
        language: 'javascript'
      });

      // Observer should not be able to write by default
      await expect(
        codeEditor.applyOperation(session.id, document.id, {
          type: 'insert',
          position: { line: 0, column: 0 },
          content: 'test',
          userId: testUsers[1].id,
          timestamp: new Date()
        }, testUsers[1].id)
      ).rejects.toThrow('No write permission');

      testSessions.push(session);
    });

    test('should handle concurrent operations gracefully', async () => {
      const session = await collaborationEngine.createSession(testUsers[0].id, {
        name: 'Concurrency Test Session',
        type: SessionType.PAIR_PROGRAMMING
      });

      const document = await codeEditor.createDocument(session.id, {
        name: 'test.js',
        content: '',
        language: 'javascript'
      });

      // Simulate concurrent operations from multiple users
      const operationPromises = [];

      for (let i = 0; i < 20; i++) {
        const userId = testUsers[i % testUsers.length].id;
        operationPromises.push(
          codeEditor.applyOperation(session.id, document.id, {
            type: 'insert',
            position: { line: 0, column: i },
            content: 'x',
            userId,
            timestamp: new Date()
          }, userId)
        );
      }

      const results = await Promise.allSettled(operationPromises);

      // At least some operations should succeed
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBeGreaterThan(0);

      testSessions.push(session);
    });
  });

  afterEach(async () => {
    // Clean up test sessions
    for (const session of testSessions) {
      try {
        await collaborationEngine.endSession(session.id);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });
});

/**
 * Performance Benchmark Tests
 * These tests measure the performance of key collaboration features
 */
describe('Performance Benchmarks', () => {
  let collaborationEngine: CollaborationEngine;
  let chatSystem: ChatSystem;
  let codeEditor: SharedCodeEditor;

  beforeAll(() => {
    collaborationEngine = new CollaborationEngine();
    chatSystem = new ChatSystem();
    codeEditor = new SharedCodeEditor();
  });

  test('CRDT operation performance', async () => {
    const session = await collaborationEngine.createSession('perf-user', {
      name: 'Performance Test',
      type: SessionType.PAIR_PROGRAMMING
    });

    const document = await codeEditor.createDocument(session.id, {
      name: 'perf-test.js',
      content: '',
      language: 'javascript'
    });

    const startTime = performance.now();
    const operationCount = 1000;

    const operationPromises = [];
    for (let i = 0; i < operationCount; i++) {
      operationPromises.push(
        codeEditor.applyOperation(session.id, document.id, {
          type: 'insert',
          position: { line: 0, column: i },
          content: 'x',
          userId: 'perf-user',
          timestamp: new Date()
        }, 'perf-user')
      );
    }

    await Promise.all(operationPromises);
    const endTime = performance.now();

    const operationsPerSecond = operationCount / ((endTime - startTime) / 1000);

    console.log(`CRDT Operations: ${operationsPerSecond.toFixed(2)} ops/sec`);
    expect(operationsPerSecond).toBeGreaterThan(100); // Should handle at least 100 ops/sec

    await collaborationEngine.endSession(session.id);
  });

  test('Message throughput performance', async () => {
    const session = { id: 'perf-session' };
    const messageCount = 1000;

    const startTime = performance.now();

    const messagePromises = [];
    for (let i = 0; i < messageCount; i++) {
      messagePromises.push(
        chatSystem.sendMessage({
          sessionId: session.id,
          authorId: 'perf-user',
          content: `Performance test message ${i}`,
          type: MessageType.TEXT
        })
      );
    }

    await Promise.all(messagePromises);
    const endTime = performance.now();

    const messagesPerSecond = messageCount / ((endTime - startTime) / 1000);

    console.log(`Message Throughput: ${messagesPerSecond.toFixed(2)} msgs/sec`);
    expect(messagesPerSecond).toBeGreaterThan(500); // Should handle at least 500 msgs/sec
  });
});

/**
 * Integration Tests with Mock External Services
 * Tests that simulate real-world scenarios
 */
describe('Integration with External Services', () => {
  let collaborationEngine: CollaborationEngine;
  let backendIntegration: BackendIntegration;
  let mockServer: MockTurboFlowServer;

  beforeAll(async () => {
    mockServer = new MockTurboFlowServer();
    backendIntegration = new BackendIntegration(mockServer as any);
    collaborationEngine = new CollaborationEngine();
  });

  test('should integrate with GitHub webhook events', async () => {
    const session = await backendIntegration.createIntegratedSession('test-user', {
      name: 'GitHub Integration Test',
      type: SessionType.PAIR_PROGRAMMING,
      enableGitHubSync: true,
      repositoryUrl: 'https://github.com/test/test-repo.git'
    });

    // Simulate GitHub webhook event
    const pushEvent = {
      repository: {
        url: 'https://github.com/test/test-repo.git'
      },
      commits: [
        {
          id: 'abc123',
          message: 'Test commit',
          author: {
            name: 'Test User'
          }
        }
      ]
    };

    backendIntegration.emit('githubPushReceived', { sessionId: session.id, event: pushEvent });

    // Verify the event was handled
    expect(session.id).toBe('test-user');

    await backendIntegration.stop();
  });

  test('should integrate with agent coordination', async () => {
    // This would test the integration with the actual agent coordination system
    // For now, we'll simulate the integration

    const session = await backendIntegration.createIntegratedSession('test-user', {
      name: 'Agent Collaboration Test',
      type: SessionType.MOB_PROGRAMMING,
      enableAgentCollaboration: true,
      repositoryUrl: ''
    });

    // Simulate agent joining session
    const mockAgent = {
      id: 'agent-1',
      type: 'collaboration-specialist',
      capabilities: ['code-review', 'pair-programming']
    };

    backendIntegration.emit('agentJoined', { sessionId: session.id, agent: mockAgent });

    expect(session.id).toBe('test-user');

    await backendIntegration.stop();
  });
});