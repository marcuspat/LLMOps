/**
 * Core Collaboration Engine
 * Manages real-time collaboration sessions, user participation, and role management
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import {
  User,
  CollaborationSession,
  Participant,
  CollaborationRole,
  SessionType,
  SessionStatus,
  UserStatus,
  Permission,
  SessionSettings,
  ConflictResolutionStrategy,
  SessionState
} from '../types.js';
import { CRDTOperationalTransform } from '../crdt/OperationalTransform.js';

export interface CollaborationMessage {
  type: string;
  sessionId: string;
  userId?: string;
  payload: any;
  timestamp: Date;
  id: string;
}

export interface ClientConnection {
  id: string;
  ws: WebSocket;
  userId?: string;
  sessionId?: string;
  lastPing: Date;
  role?: CollaborationRole;
  permissions: Permission[];
}

/**
 * Main collaboration engine that manages sessions, users, and real-time communication
 */
export class CollaborationEngine extends EventEmitter {
  private sessions: Map<string, CollaborationSession> = new Map();
  private users: Map<string, User> = new Map();
  private clients: Map<string, ClientConnection> = new Map();
  private documents: Map<string, CRDTOperationalTransform> = new Map();
  private sessionTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Create a new collaboration session
   */
  public async createSession(
    hostId: string,
    config: {
      name: string;
      description?: string;
      type: SessionType;
      settings?: Partial<SessionSettings>;
    }
  ): Promise<CollaborationSession> {
    const user = await this.getUser(hostId);
    if (!user) {
      throw new Error(`User ${hostId} not found`);
    }

    const sessionId = this.generateSessionId();
    const session: CollaborationSession = {
      id: sessionId,
      name: config.name,
      description: config.description,
      type: config.type,
      status: SessionStatus.CREATED,
      participants: [],
      hostId,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        maxParticipants: 10,
        allowRecording: true,
        allowVoiceCall: true,
        allowScreenShare: true,
        autoSave: true,
        conflictResolution: ConflictResolutionStrategy.LAST_WRITER_WINS,
        publicAccess: false,
        requireAuthentication: true,
        ...config.settings
      },
      state: {
        documents: new Map(),
        cursors: new Map(),
        selections: new Map(),
        activeUsers: new Set(),
        pendingTransforms: [],
        conflicts: []
      }
    };

    // Add host as participant with moderator role
    const hostParticipant: Participant = {
      userId: hostId,
      sessionId,
      role: CollaborationRole.MODERATOR,
      joinedAt: new Date(),
      permissions: [
        Permission.READ,
        Permission.WRITE,
        Permission.EDIT,
        Permission.SHARE,
        Permission.RECORD,
        Permission.MODERATE
      ],
      isActive: true
    };

    session.participants.push(hostParticipant);
    session.state.activeUsers.add(hostId);
    session.state.currentDriver = hostId;

    this.sessions.set(sessionId, session);

    // Create CRDT document for session
    const crdt = new CRDTOperationalTransform(sessionId);
    this.documents.set(sessionId, crdt);

    // Set up session timer for cleanup
    this.setSessionTimer(sessionId);

    this.emit('sessionCreated', session);
    return session;
  }

  /**
   * Join a collaboration session
   */
  public async joinSession(
    sessionId: string,
    userId: string,
    role: CollaborationRole = CollaborationRole.OBSERVER
  ): Promise<{ session: CollaborationSession; participant: Participant }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== SessionStatus.ACTIVE && session.status !== SessionStatus.CREATED) {
      throw new Error(`Session ${sessionId} is not joinable`);
    }

    const user = await this.getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    // Check if user is already a participant
    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      return { session, participant: existingParticipant };
    }

    // Check participant limit
    if (session.participants.length >= session.settings.maxParticipants) {
      throw new Error(`Session ${sessionId} is full`);
    }

    // Determine permissions based on role
    const permissions = this.getPermissionsForRole(role);

    const participant: Participant = {
      userId,
      sessionId,
      role,
      joinedAt: new Date(),
      permissions,
      isActive: true
    };

    session.participants.push(participant);
    session.state.activeUsers.add(userId);
    session.updatedAt = new Date();

    // Update user status
    user.status = UserStatus.ONLINE;
    user.lastSeen = new Date();

    this.emit('userJoined', { session, participant, user });
    return { session, participant };
  }

  /**
   * Leave a collaboration session
   */
  public async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const participantIndex = session.participants.findIndex(p => p.userId === userId);
    if (participantIndex === -1) {
      return; // User not in session
    }

    const participant = session.participants[participantIndex];
    participant.isActive = false;
    session.state.activeUsers.delete(userId);

    // Remove from participants array if not host
    if (participant.userId !== session.hostId) {
      session.participants.splice(participantIndex, 1);
    }

    session.updatedAt = new Date();

    // Update driver/navigator if needed
    if (session.state.currentDriver === userId) {
      session.state.currentDriver = this.selectNewDriver(session);
    }

    if (session.state.currentNavigator === userId) {
      session.state.currentNavigator = this.selectNewNavigator(session);
    }

    // Check if session should be ended
    const activeParticipants = session.participants.filter(p => p.isActive);
    if (activeParticipants.length === 0 && session.status === SessionStatus.ACTIVE) {
      await this.endSession(sessionId);
    }

    this.emit('userLeft', { session, participant, userId });
  }

  /**
   * Change user role in session
   */
  public async changeRole(
    sessionId: string,
    userId: string,
    newRole: CollaborationRole
  ): Promise<Participant> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (!participant) {
      throw new Error(`User ${userId} not in session ${sessionId}`);
    }

    const oldRole = participant.role;
    participant.role = newRole;
    participant.permissions = this.getPermissionsForRole(newRole);
    session.updatedAt = new Date();

    // Update driver/navigator assignments
    if (newRole === CollaborationRole.DRIVER) {
      // Demote current driver to navigator
      if (session.state.currentDriver && session.state.currentDriver !== userId) {
        const currentDriver = session.participants.find(p => p.userId === session.state.currentDriver);
        if (currentDriver) {
          currentDriver.role = CollaborationRole.NAVIGATOR;
        }
      }
      session.state.currentDriver = userId;
    } else if (oldRole === CollaborationRole.DRIVER) {
      session.state.currentDriver = this.selectNewDriver(session);
    }

    if (newRole === CollaborationRole.NAVIGATOR) {
      session.state.currentNavigator = userId;
    } else if (oldRole === CollaborationRole.NAVIGATOR) {
      session.state.currentNavigator = this.selectNewNavigator(session);
    }

    this.emit('roleChanged', { session, participant, oldRole, newRole });
    return participant;
  }

  /**
   * Start a session
   */
  public async startSession(sessionId: string): Promise<CollaborationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== SessionStatus.CREATED) {
      throw new Error(`Session ${sessionId} is already started`);
    }

    session.status = SessionStatus.ACTIVE;
    session.updatedAt = new Date();

    this.emit('sessionStarted', session);
    return session;
  }

  /**
   * End a session
   */
  public async endSession(sessionId: string): Promise<CollaborationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === SessionStatus.ENDED) {
      return session;
    }

    session.status = SessionStatus.ENDED;
    session.updatedAt = new Date();

    // Deactivate all participants
    session.participants.forEach(p => {
      p.isActive = false;
    });
    session.state.activeUsers.clear();

    // Clear session timer
    const timer = this.sessionTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.sessionTimers.delete(sessionId);
    }

    this.emit('sessionEnded', session);
    return session;
  }

  /**
   * Handle WebSocket connection
   */
  public handleConnection(ws: WebSocket, clientId: string): void {
    const client: ClientConnection = {
      id: clientId,
      ws,
      lastPing: new Date(),
      permissions: []
    };

    this.clients.set(clientId, client);

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as CollaborationMessage;
        this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Invalid message from client:', error);
        this.sendError(clientId, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.handleDisconnection(clientId);
    });

    // Send initial connection confirmation
    this.sendToClient(clientId, {
      type: 'connected',
      sessionId: '',
      payload: { clientId, message: 'Connected to collaboration engine' },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  /**
   * Get session information
   */
  public getSession(sessionId: string): CollaborationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.status === SessionStatus.ACTIVE);
  }

  /**
   * Get user information
   */
  public getUser(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Register a user
   */
  public registerUser(user: Omit<User, 'lastSeen'>): User {
    const fullUser: User = {
      ...user,
      lastSeen: new Date()
    };

    this.users.set(user.id, fullUser);
    this.emit('userRegistered', fullUser);
    return fullUser;
  }

  /**
   * Get sessions for a user
   */
  public getUserSessions(userId: string): CollaborationSession[] {
    return Array.from(this.sessions.values())
      .filter(session =>
        session.participants.some(p => p.userId === userId && p.isActive)
      );
  }

  // Private methods

  private setupEventHandlers(): void {
    // Handle cleanup intervals
    setInterval(() => {
      this.cleanupInactiveSessions();
      this.cleanupInactiveClients();
    }, 60000); // Check every minute
  }

  private handleMessage(clientId: string, message: CollaborationMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    client.lastPing = new Date();

    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(clientId, message.payload);
        break;
      case 'joinSession':
        this.handleJoinSession(clientId, message.payload);
        break;
      case 'leaveSession':
        this.handleLeaveSession(clientId, message.payload);
        break;
      case 'changeRole':
        this.handleChangeRole(clientId, message.payload);
        break;
      case 'cursorUpdate':
        this.handleCursorUpdate(clientId, message.payload);
        break;
      case 'textOperation':
        this.handleTextOperation(clientId, message.payload);
        break;
      case 'chatMessage':
        this.handleChatMessage(clientId, message.payload);
        break;
      case 'voiceCall':
        this.handleVoiceCall(clientId, message.payload);
        break;
      case 'terminalCommand':
        this.handleTerminalCommand(clientId, message.payload);
        break;
      case 'debugCommand':
        this.handleDebugCommand(clientId, message.payload);
        break;
      case 'ping':
        this.handlePing(clientId);
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private async handleAuthentication(clientId: string, payload: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    const { userId, token } = payload;

    // Validate authentication token (implement proper auth)
    const user = this.getUser(userId);
    if (!user) {
      this.sendError(clientId, 'Authentication failed');
      return;
    }

    client.userId = userId;
    user.lastSeen = new Date();
    user.status = UserStatus.ONLINE;

    this.sendToClient(clientId, {
      type: 'authenticated',
      sessionId: '',
      payload: { user, clientId },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private async handleJoinSession(clientId: string, payload: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.userId) {
      this.sendError(clientId, 'Not authenticated');
      return;
    }

    try {
      const { sessionId, role } = payload;
      const { session, participant } = await this.joinSession(
        sessionId,
        client.userId,
        role
      );

      client.sessionId = sessionId;
      client.role = participant.role;
      client.permissions = participant.permissions;

      this.sendToClient(clientId, {
        type: 'joinedSession',
        sessionId,
        payload: { session, participant },
        timestamp: new Date(),
        id: this.generateMessageId()
      });

      // Notify other participants
      this.broadcastToSession(sessionId, {
        type: 'userJoined',
        sessionId,
        payload: { participant, user },
        timestamp: new Date(),
        id: this.generateMessageId()
      }, clientId);
    } catch (error) {
      this.sendError(clientId, error instanceof Error ? error.message : 'Failed to join session');
    }
  }

  private async handleLeaveSession(clientId: string, payload: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || !client.userId || !client.sessionId) {
      return;
    }

    await this.leaveSession(client.sessionId, client.userId);

    client.sessionId = undefined;
    client.role = undefined;
    client.permissions = [];

    this.sendToClient(clientId, {
      type: 'leftSession',
      sessionId: '',
      payload: { success: true },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private handleCursorUpdate(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    const session = this.sessions.get(client.sessionId);
    if (!session) {
      return;
    }

    // Update cursor position in session state
    session.state.cursors.set(client.userId!, {
      line: payload.line,
      column: payload.column,
      documentId: payload.documentId,
      userId: client.userId!,
      timestamp: new Date(),
      visible: payload.visible !== false
    });

    // Broadcast to other participants
    this.broadcastToSession(client.sessionId, {
      type: 'cursorUpdate',
      sessionId: client.sessionId,
      payload: {
        userId: client.userId,
        cursor: payload
      },
      timestamp: new Date(),
      id: this.generateMessageId()
    }, clientId);
  }

  private handleTextOperation(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId || !client.userId) {
      return;
    }

    // Check write permission
    if (!client.permissions.includes(Permission.WRITE)) {
      this.sendError(clientId, 'No write permission');
      return;
    }

    const crdt = this.documents.get(client.sessionId);
    if (!crdt) {
      return;
    }

    try {
      const result = crdt.applyOperation(client.sessionId, {
        ...payload.operation,
        author: client.userId
      });

      if (result.success) {
        // Broadcast the operation to other clients
        this.broadcastToSession(client.sessionId, {
          type: 'textOperation',
          sessionId: client.sessionId,
          payload: {
            operation: result.appliedOperation,
            conflicts: result.conflicts
          },
          timestamp: new Date(),
          id: this.generateMessageId()
        }, clientId);
      } else {
        // Send conflicts back to client
        this.sendToClient(clientId, {
          type: 'operationConflict',
          sessionId: client.sessionId,
          payload: {
            conflicts: result.conflicts,
            operation: payload.operation
          },
          timestamp: new Date(),
          id: this.generateMessageId()
        });
      }
    } catch (error) {
      this.sendError(clientId, `Operation failed: ${error}`);
    }
  }

  private handleChatMessage(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    // Broadcast chat message to all participants
    this.broadcastToSession(client.sessionId, {
      type: 'chatMessage',
      sessionId: client.sessionId,
      payload: {
        authorId: client.userId,
        content: payload.content,
        type: payload.type,
        timestamp: new Date()
      },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private handleVoiceCall(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    // Handle voice call signaling
    this.broadcastToSession(client.sessionId, {
      type: 'voiceCall',
      sessionId: client.sessionId,
      payload: {
        action: payload.action,
        userId: client.userId,
        data: payload.data
      },
      timestamp: new Date(),
      id: this.generateMessageId()
    }, clientId);
  }

  private handleTerminalCommand(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    // Check terminal permission
    if (!client.permissions.includes(Permission.TERMINAL)) {
      this.sendError(clientId, 'No terminal permission');
      return;
    }

    // Broadcast terminal command
    this.broadcastToSession(client.sessionId, {
      type: 'terminalCommand',
      sessionId: client.sessionId,
      payload: {
        userId: client.userId,
        command: payload.command,
        output: payload.output,
        timestamp: new Date()
      },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private handleDebugCommand(clientId: string, payload: any): void {
    const client = this.clients.get(clientId);
    if (!client || !client.sessionId) {
      return;
    }

    // Check debug permission
    if (!client.permissions.includes(Permission.DEBUG)) {
      this.sendError(clientId, 'No debug permission');
      return;
    }

    // Handle debug session coordination
    this.broadcastToSession(client.sessionId, {
      type: 'debugCommand',
      sessionId: client.sessionId,
      payload: {
        userId: client.userId,
        action: payload.action,
        data: payload.data
      },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private handlePing(clientId: string): void {
    this.sendToClient(clientId, {
      type: 'pong',
      sessionId: '',
      payload: { timestamp: new Date() },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private handleDisconnection(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Remove from session if user was in one
    if (client.sessionId && client.userId) {
      this.leaveSession(client.sessionId, client.userId).catch(console.error);
    }

    this.clients.delete(clientId);
  }

  private sendToClient(clientId: string, message: CollaborationMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
    }
  }

  private broadcastToSession(
    sessionId: string,
    message: CollaborationMessage,
    excludeClientId?: string
  ): void {
    this.clients.forEach((client, clientId) => {
      if (client.sessionId === sessionId &&
          client.ws.readyState === WebSocket.OPEN &&
          clientId !== excludeClientId) {
        this.sendToClient(clientId, message);
      }
    });
  }

  private sendError(clientId: string, error: string): void {
    this.sendToClient(clientId, {
      type: 'error',
      sessionId: '',
      payload: { error },
      timestamp: new Date(),
      id: this.generateMessageId()
    });
  }

  private getPermissionsForRole(role: CollaborationRole): Permission[] {
    switch (role) {
      case CollaborationRole.DRIVER:
        return [
          Permission.READ,
          Permission.WRITE,
          Permission.EDIT,
          Permission.TERMINAL,
          Permission.DEBUG
        ];
      case CollaborationRole.NAVIGATOR:
        return [
          Permission.READ,
          Permission.EDIT,
          Permission.TERMINAL,
          Permission.DEBUG
        ];
      case CollaborationRole.MODERATOR:
        return [
          Permission.READ,
          Permission.WRITE,
          Permission.EDIT,
          Permission.DELETE,
          Permission.SHARE,
          Permission.RECORD,
          Permission.TERMINAL,
          Permission.DEBUG,
          Permission.MODERATE
        ];
      case CollaborationRole.OBSERVER:
        return [Permission.READ];
      default:
        return [Permission.READ];
    }
  }

  private selectNewDriver(session: CollaborationSession): string | undefined {
    const drivers = session.participants.filter(p =>
      p.isActive && p.role === CollaborationRole.DRIVER
    );

    if (drivers.length > 0) {
      return drivers[0].userId;
    }

    // Promote a navigator to driver
    const navigators = session.participants.filter(p =>
      p.isActive && p.role === CollaborationRole.NAVIGATOR
    );

    if (navigators.length > 0) {
      const newDriver = navigators[0];
      newDriver.role = CollaborationRole.DRIVER;
      return newDriver.userId;
    }

    return undefined;
  }

  private selectNewNavigator(session: CollaborationSession): string | undefined {
    const navigators = session.participants.filter(p =>
      p.isActive && p.role === CollaborationRole.NAVIGATOR
    );

    if (navigators.length > 0) {
      return navigators[0].userId;
    }

    return undefined;
  }

  private setSessionTimer(sessionId: string): void {
    const timer = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.participants.filter(p => p.isActive).length === 0) {
        this.endSession(sessionId).catch(console.error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    this.sessionTimers.set(sessionId, timer);
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    this.sessions.forEach((session, sessionId) => {
      const timeSinceUpdate = now.getTime() - session.updatedAt.getTime();

      // Archive sessions inactive for more than 24 hours
      if (timeSinceUpdate > 24 * 60 * 60 * 1000 &&
          session.status === SessionStatus.ENDED) {
        session.status = SessionStatus.ARCHIVED;
      }
    });
  }

  private cleanupInactiveClients(): void {
    const now = new Date();
    this.clients.forEach((client, clientId) => {
      const timeSincePing = now.getTime() - client.lastPing.getTime();

      // Remove clients inactive for more than 5 minutes
      if (timeSincePing > 5 * 60 * 1000) {
        this.handleDisconnection(clientId);
      }
    });
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}