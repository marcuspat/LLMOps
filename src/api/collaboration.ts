/**
 * Collaboration API Routes
 * RESTful API endpoints for the pair programming and collaborative development system
 */

import express from 'express';
import { CollaborationEngine } from '../collaboration/core/CollaborationEngine.js';
import { ChatSystem } from '../collaboration/communication/ChatSystem.js';
import { SharedCodeEditor } from '../collaboration/editor/SharedCodeEditor.js';
import { TerminalSharing } from '../collaboration/terminal/TerminalSharing.js';
import { DebugCoordinator } from '../collaboration/debugging/DebugCoordinator.js';
import { BackendIntegration } from '../collaboration/integration/BackendIntegration.js';
import {
  CollaborationRole,
  SessionType,
  MessageType,
  Permission,
  UserStatus
} from '../collaboration/types.js';

/**
 * Collaboration API Routes
 * Provides RESTful endpoints for the collaboration system
 */
export class CollaborationAPI {
  private router = express.Router();
  private collaborationEngine: CollaborationEngine;
  private chatSystem: ChatSystem;
  private codeEditor: SharedCodeEditor;
  private terminalSharing: TerminalSharing;
  private debugCoordinator: DebugCoordinator;
  private backendIntegration: BackendIntegration;

  constructor(backendIntegration: BackendIntegration) {
    this.backendIntegration = backendIntegration;
    this.collaborationEngine = new CollaborationEngine();
    this.chatSystem = new ChatSystem();
    this.codeEditor = new SharedCodeEditor();
    this.terminalSharing = new TerminalSharing();
    this.debugCoordinator = new DebugCoordinator();

    this.setupRoutes();
    this.setupMiddleware();
  }

  /**
   * Get the Express router
   */
  public getRouter(): express.Router {
    return this.router;
  }

  private setupMiddleware(): void {
    // Authentication middleware (to be implemented)
    this.router.use((req, res, next) => {
      // Add user authentication logic here
      req.userId = req.headers['x-user-id'] as string || 'anonymous';
      next();
    });

    // Request validation middleware
    this.router.use(express.json({ limit: '10mb' }));
    this.router.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private setupRoutes(): void {
    // Session management routes
    this.setupSessionRoutes();

    // User management routes
    this.setupUserRoutes();

    // Chat system routes
    this.setupChatRoutes();

    // Code editor routes
    this.setupEditorRoutes();

    // Terminal sharing routes
    this.setupTerminalRoutes();

    // Debug coordinator routes
    this.setupDebugRoutes();

    // Integration routes
    this.setupIntegrationRoutes();

    // Utility routes
    this.setupUtilityRoutes();
  }

  private setupSessionRoutes(): void {
    // Create collaboration session
    this.router.post('/sessions', async (req, res) => {
      try {
        const { name, description, type, settings } = req.body;
        const userId = req.userId;

        const session = await this.collaborationEngine.createSession(userId, {
          name,
          description,
          type: type || SessionType.PAIR_PROGRAMMING,
          settings
        });

        res.status(201).json({
          success: true,
          data: session
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_CREATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create session'
          }
        });
      }
    });

    // Get session information
    this.router.get('/sessions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const session = this.collaborationEngine.getSession(sessionId);

        if (!session) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'SESSION_NOT_FOUND',
              message: 'Session not found'
            }
          });
        }

        res.json({
          success: true,
          data: session
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get session'
          }
        });
      }
    });

    // List active sessions
    this.router.get('/sessions', async (req, res) => {
      try {
        const sessions = this.collaborationEngine.getActiveSessions();
        res.json({
          success: true,
          data: sessions
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSIONS_LIST_ERROR',
            message: error instanceof Error ? error.message : 'Failed to list sessions'
          }
        });
      }
    });

    // Join session
    this.router.post('/sessions/:sessionId/join', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { role = CollaborationRole.OBSERVER } = req.body;
        const userId = req.userId;

        const { session, participant } = await this.collaborationEngine.joinSession(
          sessionId,
          userId,
          role
        );

        res.json({
          success: true,
          data: { session, participant }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_JOIN_ERROR',
            message: error instanceof Error ? error.message : 'Failed to join session'
          }
        });
      }
    });

    // Leave session
    this.router.post('/sessions/:sessionId/leave', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const userId = req.userId;

        await this.collaborationEngine.leaveSession(sessionId, userId);

        res.json({
          success: true,
          data: { message: 'Left session successfully' }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_LEAVE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to leave session'
          }
        });
      }
    });

    // Change role in session
    this.router.post('/sessions/:sessionId/role', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { newRole } = req.body;
        const userId = req.userId;

        const participant = await this.collaborationEngine.changeRole(
          sessionId,
          userId,
          newRole
        );

        res.json({
          success: true,
          data: participant
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'ROLE_CHANGE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to change role'
          }
        });
      }
    });

    // Start session
    this.router.post('/sessions/:sessionId/start', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const session = await this.collaborationEngine.startSession(sessionId);

        res.json({
          success: true,
          data: session
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_START_ERROR',
            message: error instanceof Error ? error.message : 'Failed to start session'
          }
        });
      }
    });

    // End session
    this.router.post('/sessions/:sessionId/end', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const session = await this.collaborationEngine.endSession(sessionId);

        res.json({
          success: true,
          data: session
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'SESSION_END_ERROR',
            message: error instanceof Error ? error.message : 'Failed to end session'
          }
        });
      }
    });
  }

  private setupUserRoutes(): void {
    // Register user
    this.router.post('/users', async (req, res) => {
      try {
        const { id, name, email, avatar, role, permissions } = req.body;

        const user = this.collaborationEngine.registerUser({
          id,
          name,
          email,
          avatar,
          role: role || CollaborationRole.OBSERVER,
          permissions: permissions || [Permission.READ],
          status: UserStatus.ONLINE,
          preferences: {
            theme: 'dark',
            fontSize: 14,
            tabSize: 2,
            wordWrap: true,
            autoSave: true,
            notifications: {
              mentions: true,
              messages: true,
              cursorUpdates: false,
              roleChanges: true,
              systemAlerts: true
            },
            shortcuts: {
              switchRole: 'ctrl+r',
              sendMessage: 'enter',
              shareScreen: 'ctrl+s',
              startCall: 'ctrl+c',
              endSession: 'ctrl+e'
            }
          }
        });

        res.status(201).json({
          success: true,
          data: user
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'USER_REGISTER_ERROR',
            message: error instanceof Error ? error.message : 'Failed to register user'
          }
        });
      }
    });

    // Get user information
    this.router.get('/users/:userId', async (req, res) => {
      try {
        const { userId } = req.params;
        const user = this.collaborationEngine.getUser(userId);

        if (!user) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found'
            }
          });
        }

        res.json({
          success: true,
          data: user
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'USER_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get user'
          }
        });
      }
    });

    // Get user sessions
    this.router.get('/users/:userId/sessions', async (req, res) => {
      try {
        const { userId } = req.params;
        const sessions = this.collaborationEngine.getUserSessions(userId);

        res.json({
          success: true,
          data: sessions
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'USER_SESSIONS_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get user sessions'
          }
        });
      }
    });
  }

  private setupChatRoutes(): void {
    // Send message
    this.router.post('/chat/messages', async (req, res) => {
      try {
        const { sessionId, content, type, attachments, threadId, mentions } = req.body;
        const userId = req.userId;

        const message = await this.chatSystem.sendMessage({
          sessionId,
          authorId: userId,
          content,
          type: type || MessageType.TEXT,
          attachments,
          threadId,
          mentions
        });

        res.status(201).json({
          success: true,
          data: message
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'MESSAGE_SEND_ERROR',
            message: error instanceof Error ? error.message : 'Failed to send message'
          }
        });
      }
    });

    // Get messages
    this.router.get('/chat/sessions/:sessionId/messages', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { limit, before, threadId } = req.query;

        const beforeDate = before ? new Date(before as string) : undefined;
        const messages = this.chatSystem.getMessages(
          sessionId,
          limit ? parseInt(limit as string) : undefined,
          beforeDate,
          threadId as string
        );

        res.json({
          success: true,
          data: messages
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'MESSAGES_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get messages'
          }
        });
      }
    });

    // Search messages
    this.router.get('/chat/sessions/:sessionId/search', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { query, authorId, messageType, startDate, endDate } = req.query;

        if (!query) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_QUERY',
              message: 'Search query is required'
            }
          });
        }

        const options: any = {};
        if (authorId) options.authorId = authorId;
        if (messageType) options.messageType = messageType;
        if (startDate && endDate) {
          options.dateRange = {
            start: new Date(startDate as string),
            end: new Date(endDate as string)
          };
        }

        const messages = this.chatSystem.searchMessages(sessionId, query as string, options);

        res.json({
          success: true,
          data: messages
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'MESSAGE_SEARCH_ERROR',
            message: error instanceof Error ? error.message : 'Failed to search messages'
          }
        });
      }
    });

    // Add reaction
    this.router.post('/chat/messages/:messageId/reactions', async (req, res) => {
      try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.userId;

        const message = await this.chatSystem.addReaction(messageId, emoji, userId);

        res.json({
          success: true,
          data: message
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'REACTION_ADD_ERROR',
            message: error instanceof Error ? error.message : 'Failed to add reaction'
          }
        });
      }
    });

    // Start voice call
    this.router.post('/chat/calls', async (req, res) => {
      try {
        const { sessionId, type, participants, configuration } = req.body;
        const userId = req.userId;

        const call = await this.chatSystem.startCall({
          sessionId,
          type: type || 'voice',
          participants: participants || [userId],
          configuration
        });

        res.status(201).json({
          success: true,
          data: call
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'CALL_START_ERROR',
            message: error instanceof Error ? error.message : 'Failed to start call'
          }
        });
      }
    });

    // Join call
    this.router.post('/chat/calls/:callId/join', async (req, res) => {
      try {
        const { callId } = req.params;
        const userId = req.userId;

        const call = await this.chatSystem.joinCall(callId, userId);

        res.json({
          success: true,
          data: call
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'CALL_JOIN_ERROR',
            message: error instanceof Error ? error.message : 'Failed to join call'
          }
        });
      }
    });

    // Leave call
    this.router.post('/chat/calls/:callId/leave', async (req, res) => {
      try {
        const { callId } = req.params;
        const userId = req.userId;

        const call = await this.chatSystem.leaveCall(callId, userId);

        res.json({
          success: true,
          data: call
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'CALL_LEAVE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to leave call'
          }
        });
      }
    });
  }

  private setupEditorRoutes(): void {
    // Create document
    this.router.post('/editor/documents', async (req, res) => {
      try {
        const { sessionId, name, content, language } = req.body;
        const userId = req.userId;

        const document = await this.codeEditor.createDocument(sessionId, {
          name,
          content,
          language
        });

        res.status(201).json({
          success: true,
          data: document
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DOCUMENT_CREATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create document'
          }
        });
      }
    });

    // Get document
    this.router.get('/editor/sessions/:sessionId/documents/:documentId', async (req, res) => {
      try {
        const { sessionId, documentId } = req.params;
        const document = this.codeEditor.getDocument(sessionId, documentId);

        if (!document) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'DOCUMENT_NOT_FOUND',
              message: 'Document not found'
            }
          });
        }

        res.json({
          success: true,
          data: document
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DOCUMENT_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get document'
          }
        });
      }
    });

    // Apply operation
    this.router.post('/editor/sessions/:sessionId/documents/:documentId/operations', async (req, res) => {
      try {
        const { sessionId, documentId } = req.params;
        const { operation } = req.body;
        const userId = req.userId;

        const result = await this.codeEditor.applyOperation(sessionId, documentId, operation, userId);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'OPERATION_APPLY_ERROR',
            message: error instanceof Error ? error.message : 'Failed to apply operation'
          }
        });
      }
    });

    // Update cursor
    this.router.post('/editor/sessions/:sessionId/documents/:documentId/cursor', async (req, res) => {
      try {
        const { sessionId, documentId } = req.params;
        const { position } = req.body;
        const userId = req.userId;

        this.codeEditor.updateCursor(sessionId, documentId, userId, position);

        res.json({
          success: true,
          data: { message: 'Cursor updated' }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'CURSOR_UPDATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to update cursor'
          }
        });
      }
    });

    // Format document
    this.router.post('/editor/sessions/:sessionId/documents/:documentId/format', async (req, res) => {
      try {
        const { sessionId, documentId } = req.params;
        const { options } = req.body;
        const userId = req.userId;

        const document = await this.codeEditor.formatDocument(sessionId, documentId, userId, options);

        res.json({
          success: true,
          data: document
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DOCUMENT_FORMAT_ERROR',
            message: error instanceof Error ? error.message : 'Failed to format document'
          }
        });
      }
    });

    // Search in document
    this.router.get('/editor/sessions/:sessionId/documents/:documentId/search', async (req, res) => {
      try {
        const { sessionId, documentId } = req.params;
        const { query, caseSensitive, regex, wholeWord } = req.query;

        if (!query) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'MISSING_QUERY',
              message: 'Search query is required'
            }
          });
        }

        const options: any = {};
        if (caseSensitive !== undefined) options.caseSensitive = caseSensitive === 'true';
        if (regex !== undefined) options.regex = regex === 'true';
        if (wholeWord !== undefined) options.wholeWord = wholeWord === 'true';

        const results = this.codeEditor.searchInDocument(sessionId, documentId, query as string, options);

        res.json({
          success: true,
          data: results
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DOCUMENT_SEARCH_ERROR',
            message: error instanceof Error ? error.message : 'Failed to search document'
          }
        });
      }
    });
  }

  private setupTerminalRoutes(): void {
    // Create terminal session
    this.router.post('/terminal/sessions', async (req, res) => {
      try {
        const { sessionId, shell, terminalType, size, environment, workingDirectory } = req.body;
        const userId = req.userId;

        const terminalSession = await this.terminalSharing.createSession(sessionId, userId, {
          shell,
          terminalType,
          size,
          environment,
          workingDirectory
        });

        res.status(201).json({
          success: true,
          data: terminalSession
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'TERMINAL_SESSION_CREATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create terminal session'
          }
        });
      }
    });

    // Execute command
    this.router.post('/terminal/sessions/:sessionId/execute', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { command, args, cwd, env, timeout } = req.body;
        const userId = req.userId;

        const result = await this.terminalSharing.executeCommand(sessionId, command, userId, args, {
          cwd,
          env,
          timeout
        });

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'COMMAND_EXECUTE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to execute command'
          }
        });
      }
    });

    // Send input
    this.router.post('/terminal/sessions/:sessionId/input', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { input } = req.body;
        const userId = req.userId;

        this.terminalSharing.sendInput(sessionId, input, userId);

        res.json({
          success: true,
          data: { message: 'Input sent successfully' }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INPUT_SEND_ERROR',
            message: error instanceof Error ? error.message : 'Failed to send input'
          }
        });
      }
    });

    // Resize terminal
    this.router.post('/terminal/sessions/:sessionId/resize', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { size } = req.body;
        const userId = req.userId;

        this.terminalSharing.resizeTerminal(sessionId, size, userId);

        res.json({
          success: true,
          data: { message: 'Terminal resized successfully' }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'TERMINAL_RESIZE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to resize terminal'
          }
        });
      }
    });

    // Get terminal buffer
    this.router.get('/terminal/sessions/:sessionId/buffer', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const buffer = this.terminalSharing.getBuffer(sessionId);

        if (!buffer) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'TERMINAL_BUFFER_NOT_FOUND',
              message: 'Terminal buffer not found'
            }
          });
        }

        res.json({
          success: true,
          data: buffer
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'TERMINAL_BUFFER_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get terminal buffer'
          }
        });
      }
    });

    // Get command history
    this.router.get('/terminal/sessions/:sessionId/history', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { limit } = req.query;

        const history = this.terminalSharing.getHistory(
          sessionId,
          limit ? parseInt(limit as string) : undefined
        );

        res.json({
          success: true,
          data: history
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'TERMINAL_HISTORY_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get terminal history'
          }
        });
      }
    });
  }

  private setupDebugRoutes(): void {
    // Start debug session
    this.router.post('/debug/sessions', async (req, res) => {
      try {
        const { sessionId, configuration, adapterType } = req.body;
        const userId = req.userId;

        const debugSession = await this.debugCoordinator.startSession(sessionId, configuration, adapterType, userId);

        res.status(201).json({
          success: true,
          data: debugSession
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DEBUG_SESSION_START_ERROR',
            message: error instanceof Error ? error.message : 'Failed to start debug session'
          }
        });
      }
    });

    // Execute debug command
    this.router.post('/debug/sessions/:sessionId/commands', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { command, data } = req.body;
        const userId = req.userId;

        const result = await this.debugCoordinator.executeCommand(sessionId, command, userId, data);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DEBUG_COMMAND_ERROR',
            message: error instanceof Error ? error.message : 'Failed to execute debug command'
          }
        });
      }
    });

    // Set breakpoint
    this.router.post('/debug/sessions/:sessionId/breakpoints', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { file, line, column, condition, enabled } = req.body;
        const userId = req.userId;

        const breakpoint = await this.debugCoordinator.setBreakpoint(sessionId, {
          file,
          line,
          column: column || 0,
          condition,
          enabled: enabled !== false
        }, userId);

        res.status(201).json({
          success: true,
          data: breakpoint
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'BREAKPOINT_SET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to set breakpoint'
          }
        });
      }
    });

    // Remove breakpoint
    this.router.delete('/debug/sessions/:sessionId/breakpoints/:breakpointId', async (req, res) => {
      try {
        const { sessionId, breakpointId } = req.params;
        const userId = req.userId;

        await this.debugCoordinator.removeBreakpoint(sessionId, breakpointId, userId);

        res.json({
          success: true,
          data: { message: 'Breakpoint removed successfully' }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'BREAKPOINT_REMOVE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to remove breakpoint'
          }
        });
      }
    });

    // Evaluate expression
    this.router.post('/debug/sessions/:sessionId/evaluate', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { expression } = req.body;
        const userId = req.userId;

        const result = await this.debugCoordinator.evaluateExpression(sessionId, expression, userId);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'EXPRESSION_EVALUATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to evaluate expression'
          }
        });
      }
    });

    // Get debug session
    this.router.get('/debug/sessions/:sessionId', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const debugSession = this.debugCoordinator.getSession(sessionId);

        if (!debugSession) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'DEBUG_SESSION_NOT_FOUND',
              message: 'Debug session not found'
            }
          });
        }

        res.json({
          success: true,
          data: debugSession
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'DEBUG_SESSION_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get debug session'
          }
        });
      }
    });
  }

  private setupIntegrationRoutes(): void {
    // Create integrated session
    this.router.post('/integration/sessions', async (req, res) => {
      try {
        const { name, description, type, enableAgentCollaboration, enableGitHubSync, repositoryUrl, swarmConfig } = req.body;
        const userId = req.userId;

        const session = await this.backendIntegration.createIntegratedSession(userId, {
          name,
          description,
          type,
          enableAgentCollaboration,
          enableGitHubSync,
          repositoryUrl,
          swarmConfig
        });

        res.status(201).json({
          success: true,
          data: session
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTEGRATED_SESSION_CREATE_ERROR',
            message: error instanceof Error ? error.message : 'Failed to create integrated session'
          }
        });
      }
    });

    // Get integration status
    this.router.get('/integration/sessions/:sessionId/status', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const status = this.backendIntegration.getIntegrationStatus(sessionId);

        if (!status) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'INTEGRATION_STATUS_NOT_FOUND',
              message: 'Integration status not found'
            }
          });
        }

        res.json({
          success: true,
          data: status
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'INTEGRATION_STATUS_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get integration status'
          }
        });
      }
    });

    // Sync with GitHub
    this.router.post('/integration/sessions/:sessionId/github/sync', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const { commitMessage, createPullRequest, branchName } = req.body;

        await this.backendIntegration.syncWithGitHub(sessionId, {
          commitMessage,
          createPullRequest,
          branchName
        });

        res.json({
          success: true,
          data: { message: 'GitHub sync completed successfully' }
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'GITHUB_SYNC_ERROR',
            message: error instanceof Error ? error.message : 'Failed to sync with GitHub'
          }
        });
      }
    });

    // Verify code quality
    this.router.post('/integration/sessions/:sessionId/verify', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const result = await this.backendIntegration.verifyCodeQuality(sessionId);

        res.json({
          success: true,
          data: result
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'CODE_QUALITY_VERIFY_ERROR',
            message: error instanceof Error ? error.message : 'Failed to verify code quality'
          }
        });
      }
    });

    // Get performance metrics
    this.router.get('/integration/sessions/:sessionId/metrics', async (req, res) => {
      try {
        const { sessionId } = req.params;
        const metrics = this.backendIntegration.getSessionPerformanceMetrics(sessionId);

        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'PERFORMANCE_METRICS_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get performance metrics'
          }
        });
      }
    });
  }

  private setupUtilityRoutes(): void {
    // Health check
    this.router.get('/health', (req, res) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date(),
          components: {
            collaborationEngine: 'active',
            chatSystem: 'active',
            codeEditor: 'active',
            terminalSharing: 'active',
            debugCoordinator: 'active',
            backendIntegration: 'active'
          }
        }
      });
    });

    // Statistics
    this.router.get('/stats', async (req, res) => {
      try {
        const stats = {
          activeSessions: this.collaborationEngine.getActiveSessions().length,
          totalUsers: 0, // Would need to track this
          totalMessages: 0, // Would need to track this
          activeCalls: this.chatSystem.getActiveCalls('any').length, // Simplified
          activeDocuments: 0, // Would need to track this
          activeTerminalSessions: 0, // Would need to track this
          activeDebugSessions: 0 // Would need to track this
        };

        res.json({
          success: true,
          data: stats
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'STATS_GET_ERROR',
            message: error instanceof Error ? error.message : 'Failed to get statistics'
          }
        });
      }
    });
  }
}

// Extend Express Request interface to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}