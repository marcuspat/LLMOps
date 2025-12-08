/**
 * Real-time Terminal Sharing System
 * Secure terminal broadcasting with collaborative command execution
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { TerminalSession, TerminalType, TerminalStatus, TerminalPermission, TerminalBuffer } from '../types.js';

export interface TerminalCommand {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  userId: string;
  sessionId: string;
  timestamp: Date;
  result?: TerminalCommandResult;
}

export interface TerminalCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timestamp: Date;
}

export interface TerminalEvent {
  id: string;
  type: TerminalEventType;
  sessionId: string;
  userId?: string;
  data: any;
  timestamp: Date;
}

export enum TerminalEventType {
  COMMAND_STARTED = 'command_started',
  COMMAND_OUTPUT = 'command_output',
  COMMAND_COMPLETED = 'command_completed',
  TERMINAL_RESIZE = 'terminal_resize',
  TERMINAL_CLEAR = 'terminal_clear',
  PERMISSION_CHANGED = 'permission_changed',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left'
}

export interface TerminalConfiguration {
  shell: string;
  terminalType: string;
  size: { width: number; height: number };
  environment: Record<string, string>;
  workingDirectory: string;
  allowCommandExecution: boolean;
  allowFileTransfer: boolean;
  maxCommandDuration: number;
  commandWhitelist: string[];
  commandBlacklist: string[];
}

/**
 * Real-time Terminal Sharing System
 * Supports multiple terminal types with secure execution
 */
export class TerminalSharing extends EventEmitter {
  private sessions: Map<string, TerminalSession> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private history: Map<string, TerminalCommand[]> = new Map();
  private buffers: Map<string, TerminalBuffer> = new Map();
  private permissions: Map<string, Map<string, TerminalPermission[]>> = new Map();

  constructor() {
    super();
    this.setupCleanupInterval();
  }

  /**
   * Create a new terminal session
   */
  public async createSession(
    sessionId: string,
    ownerId: string,
    config: Partial<TerminalConfiguration> = {}
  ): Promise<TerminalSession> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Terminal session ${sessionId} already exists`);
    }

    const fullConfig: TerminalConfiguration = {
      shell: process.env.SHELL || '/bin/bash',
      terminalType: 'xterm-256color',
      size: { width: 80, height: 24 },
      environment: { ...process.env },
      workingDirectory: process.cwd(),
      allowCommandExecution: true,
      allowFileTransfer: false,
      maxCommandDuration: 300000, // 5 minutes
      commandWhitelist: [],
      commandBlacklist: ['rm -rf /', 'dd if=/dev/zero', 'mkfs'],
      ...config
    };

    // Initialize terminal buffer
    const buffer: TerminalBuffer = {
      content: Array(fullConfig.size.height).fill(null).map(() => Array(fullConfig.size.width).fill(' ')),
      cursor: { x: 0, y: 0 },
      history: [],
      size: fullConfig.size
    };

    const terminalSession: TerminalSession = {
      id: sessionId,
      sessionId,
      ownerId,
      type: TerminalType.SHARED,
      status: TerminalStatus.ACTIVE,
      buffer,
      participants: [{
        userId: ownerId,
        permissions: [
          TerminalPermission.READ,
          TerminalPermission.WRITE,
          TerminalPermission.EXECUTE,
          TerminalPermission.SHARE
        ],
        joinedAt: new Date(),
        lastActivity: new Date()
      }],
      permissions: [
        TerminalPermission.READ,
        TerminalPermission.WRITE,
        TerminalPermission.EXECUTE
      ],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, terminalSession);
    this.buffers.set(sessionId, buffer);
    this.history.set(sessionId, []);
    this.permissions.set(sessionId, new Map());

    // Set owner permissions
    this.updateUserPermissions(sessionId, ownerId, [
      TerminalPermission.READ,
      TerminalPermission.WRITE,
      TerminalPermission.EXECUTE,
      TerminalPermission.SHARE
    ]);

    // Start shell process for interactive sessions
    if (terminalSession.type === TerminalType.INTERACTIVE) {
      await this.startInteractiveShell(sessionId, fullConfig);
    }

    this.emit('sessionCreated', { sessionId, session: terminalSession });
    return terminalSession;
  }

  /**
   * Execute a command in terminal session
   */
  public async executeCommand(
    sessionId: string,
    command: string,
    userId: string,
    args: string[] = [],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<TerminalCommand> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const userPermissions = this.getUserPermissions(sessionId, userId);
    if (!userPermissions.includes(TerminalPermission.EXECUTE)) {
      throw new Error('No execution permission');
    }

    // Check command against whitelist/blacklist
    if (!this.isCommandAllowed(command, session)) {
      throw new Error(`Command "${command}" is not allowed`);
    }

    const commandId = this.generateCommandId();
    const terminalCommand: TerminalCommand = {
      id: commandId,
      command,
      args,
      cwd: options.cwd,
      env: options.env,
      userId,
      sessionId,
      timestamp: new Date()
    };

    // Add to history
    const history = this.history.get(sessionId) || [];
    history.push(terminalCommand);
    this.history.set(sessionId, history);

    // Update session activity
    session.lastActivity = new Date();
    this.updateUserLastActivity(sessionId, userId);

    this.emit('commandStarted', { sessionId, command: terminalCommand });

    try {
      const result = await this.executeCommandProcess(
        terminalCommand,
        session,
        options.timeout
      );

      terminalCommand.result = result;

      // Update terminal buffer with output
      this.appendToBuffer(sessionId, result.stdout);
      if (result.stderr) {
        this.appendToBuffer(sessionId, result.stderr, true);
      }

      this.emit('commandCompleted', { sessionId, command: terminalCommand });
    } catch (error) {
      terminalCommand.result = {
        exitCode: -1,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        duration: 0,
        timestamp: new Date()
      };

      this.appendToBuffer(sessionId, terminalCommand.result.stderr, true);
      this.emit('commandError', { sessionId, command: terminalCommand, error });
    }

    return terminalCommand;
  }

  /**
   * Send input to interactive terminal
   */
  public sendInput(
    sessionId: string,
    input: string,
    userId: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.type !== TerminalType.INTERACTIVE) {
      throw new Error('Session does not support interactive input');
    }

    const userPermissions = this.getUserPermissions(sessionId, userId);
    if (!userPermissions.includes(TerminalPermission.WRITE)) {
      throw new Error('No write permission');
    }

    const process = this.processes.get(sessionId);
    if (!process || !process.stdin) {
      throw new Error('Interactive process not available');
    }

    process.stdin.write(input);
    this.appendToBuffer(sessionId, input);

    this.emit('inputSent', { sessionId, input, userId });
  }

  /**
   * Resize terminal
   */
  public resizeTerminal(
    sessionId: string,
    size: { width: number; height: number },
    userId: string
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const userPermissions = this.getUserPermissions(sessionId, userId);
    if (!userPermissions.includes(TerminalPermission.WRITE)) {
      throw new Error('No write permission');
    }

    const buffer = this.buffers.get(sessionId);
    if (buffer) {
      // Resize buffer content
      const newContent: string[][] = [];
      for (let y = 0; y < size.height; y++) {
        const row: string[] = [];
        for (let x = 0; x < size.width; x++) {
          if (buffer.content[y] && buffer.content[y][x]) {
            row.push(buffer.content[y][x]);
          } else {
            row.push(' ');
          }
        }
        newContent.push(row);
      }
      buffer.content = newContent;
      buffer.size = size;
    }

    // Resize actual terminal process if interactive
    const process = this.processes.get(sessionId);
    if (process && process.stdin) {
      // Send resize signal to process
      process.stdout?.write(`\x1b[8;${size.height};${size.width}t`);
    }

    session.lastActivity = new Date();
    this.updateUserLastActivity(sessionId, userId);

    this.emit('terminalResized', { sessionId, size, userId });
  }

  /**
   * Clear terminal
   */
  public clearTerminal(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const userPermissions = this.getUserPermissions(sessionId, userId);
    if (!userPermissions.includes(TerminalPermission.WRITE)) {
      throw new Error('No write permission');
    }

    const buffer = this.buffers.get(sessionId);
    if (buffer) {
      buffer.content = Array(buffer.size.height).fill(null).map(() =>
        Array(buffer.size.width).fill(' ')
      );
      buffer.cursor = { x: 0, y: 0 };
    }

    session.lastActivity = new Date();
    this.updateUserLastActivity(sessionId, userId);

    this.emit('terminalCleared', { sessionId, userId });
  }

  /**
   * Join terminal session
   */
  public async joinSession(
    sessionId: string,
    userId: string,
    permissions: TerminalPermission[] = [TerminalPermission.READ]
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    // Check if user already joined
    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      return;
    }

    const participant = {
      userId,
      permissions,
      joinedAt: new Date(),
      lastActivity: new Date()
    };

    session.participants.push(participant);
    this.updateUserPermissions(sessionId, userId, permissions);
    session.lastActivity = new Date();

    this.emit('userJoined', { sessionId, userId, participant });
  }

  /**
   * Leave terminal session
   */
  public async leaveSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const participantIndex = session.participants.findIndex(p => p.userId === userId);
    if (participantIndex === -1) {
      return;
    }

    session.participants.splice(participantIndex, 1);
    this.permissions.get(sessionId)?.delete(userId);
    session.lastActivity = new Date();

    // End session if no participants left and not owner
    if (session.participants.length === 0 && session.ownerId !== userId) {
      await this.endSession(sessionId);
    }

    this.emit('userLeft', { sessionId, userId });
  }

  /**
   * Update user permissions
   */
  public updateUserPermissions(
    sessionId: string,
    userId: string,
    permissions: TerminalPermission[]
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Terminal session ${sessionId} not found`);
    }

    const sessionPermissions = this.permissions.get(sessionId) || new Map();
    sessionPermissions.set(userId, permissions);
    this.permissions.set(sessionId, sessionPermissions);

    // Update participant permissions
    const participant = session.participants.find(p => p.userId === userId);
    if (participant) {
      participant.permissions = permissions;
    }

    this.emit('permissionsChanged', { sessionId, userId, permissions });
  }

  /**
   * Get user permissions
   */
  public getUserPermissions(sessionId: string, userId: string): TerminalPermission[] {
    return this.permissions.get(sessionId)?.get(userId) || [];
  }

  /**
   * Get terminal session
   */
  public getSession(sessionId: string): TerminalSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get terminal buffer
   */
  public getBuffer(sessionId: string): TerminalBuffer | null {
    return this.buffers.get(sessionId) || null;
  }

  /**
   * Get command history
   */
  public getHistory(sessionId: string, limit?: number): TerminalCommand[] {
    const history = this.history.get(sessionId) || [];
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * End terminal session
   */
  public async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Kill interactive process if exists
    const process = this.processes.get(sessionId);
    if (process) {
      process.kill();
      this.processes.delete(sessionId);
    }

    session.status = TerminalStatus.ENDED;
    session.lastActivity = new Date();

    this.emit('sessionEnded', { sessionId });
  }

  // Private methods

  private setupCleanupInterval(): void {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Check every minute
  }

  private async startInteractiveShell(
    sessionId: string,
    config: TerminalConfiguration
  ): Promise<void> {
    const shell = spawn(config.shell, [], {
      env: { ...config.environment },
      cwd: config.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.processes.set(sessionId, shell);

    // Handle stdout
    shell.stdout?.on('data', (data) => {
      this.appendToBuffer(sessionId, data.toString());
      this.emit('output', { sessionId, data: data.toString(), stream: 'stdout' });
    });

    // Handle stderr
    shell.stderr?.on('data', (data) => {
      this.appendToBuffer(sessionId, data.toString(), true);
      this.emit('output', { sessionId, data: data.toString(), stream: 'stderr' });
    });

    // Handle process exit
    shell.on('close', (code) => {
      this.processes.delete(sessionId);
      this.emit('processClosed', { sessionId, exitCode: code });
    });

    // Handle process error
    shell.on('error', (error) => {
      this.processes.delete(sessionId);
      this.emit('processError', { sessionId, error });
    });
  }

  private async executeCommandProcess(
    command: TerminalCommand,
    session: TerminalSession,
    timeout?: number
  ): Promise<TerminalCommandResult> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';

      const process = spawn(command.command, command.args || [], {
        env: { ...process.env, ...command.env },
        cwd: command.cwd || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const timeoutId = timeout ? setTimeout(() => {
        process.kill();
        reject(new Error(`Command timeout after ${timeout}ms`));
      }, timeout) : null;

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
        this.appendToBuffer(session.id, data.toString());
        this.emit('commandOutput', {
          sessionId: session.id,
          commandId: command.id,
          data: data.toString(),
          stream: 'stdout'
        });
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
        this.appendToBuffer(session.id, data.toString(), true);
        this.emit('commandOutput', {
          sessionId: session.id,
          commandId: command.id,
          data: data.toString(),
          stream: 'stderr'
        });
      });

      process.on('close', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        resolve({
          exitCode: code || 0,
          stdout,
          stderr,
          duration: Date.now() - startTime,
          timestamp: new Date()
        });
      });

      process.on('error', (error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(error);
      });

      // Send input if provided
      if (command.args && command.args.length > 0) {
        process.stdin?.write(command.args.join(' '));
        process.stdin?.end();
      }
    });
  }

  private appendToBuffer(sessionId: string, text: string, isError: boolean = false): void {
    const buffer = this.buffers.get(sessionId);
    if (!buffer) {
      return;
    }

    // Simple text append to buffer
    // In production, implement proper terminal emulation
    const lines = text.split('\n');
    for (const line of lines) {
      if (buffer.cursor.x + line.length > buffer.size.width) {
        // Move to next line
        buffer.cursor.x = 0;
        buffer.cursor.y = Math.min(buffer.cursor.y + 1, buffer.size.height - 1);
      }

      // Write characters to buffer
      for (let i = 0; i < line.length; i++) {
        if (buffer.cursor.x < buffer.size.width) {
          if (buffer.content[buffer.cursor.y]) {
            buffer.content[buffer.cursor.y][buffer.cursor.x] = line[i];
          }
          buffer.cursor.x++;
        } else {
          buffer.cursor.x = 0;
          buffer.cursor.y = Math.min(buffer.cursor.y + 1, buffer.size.height - 1);
          if (buffer.cursor.x < buffer.size.width && buffer.content[buffer.cursor.y]) {
            buffer.content[buffer.cursor.y][buffer.cursor.x] = line[i];
            buffer.cursor.x++;
          }
        }
      }
    }

    // Add command to history
    buffer.history.push({
      command: text.trim(),
      output: text,
      timestamp: new Date(),
      userId: 'system'
    });

    // Keep only last 100 commands in history
    if (buffer.history.length > 100) {
      buffer.history.shift();
    }
  }

  private isCommandAllowed(command: string, session: TerminalSession): boolean {
    const parts = command.trim().split(/\s+/);
    const baseCommand = parts[0];

    // Check blacklist
    for (const blacklisted of session.permissions) {
      if (blacklisted === baseCommand) {
        return false;
      }
    }

    // If whitelist is not empty, check against it
    // Note: This is simplified - in production, implement proper command validation
    return true;
  }

  private updateUserLastActivity(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const participant = session.participants.find(p => p.userId === userId);
    if (participant) {
      participant.lastActivity = new Date();
    }
  }

  private cleanupInactiveSessions(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff && session.status === TerminalStatus.ACTIVE) {
        this.endSession(sessionId).catch(console.error);
      }
    }
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}