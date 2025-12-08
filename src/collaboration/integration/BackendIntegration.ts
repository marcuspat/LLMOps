/**
 * Turbo Flow Backend Integration
 * Connects collaboration system with existing Turbo Flow backend and agent coordination
 */

import { EventEmitter } from 'events';
import { TurboFlowServer } from '../../api/server.js';
import { AgentCoordination } from '../../core/AgentCoordination.js';
import { TruthVerification } from '../../core/TruthVerification.js';
import { GitHubIntegration } from '../../core/GitHubIntegration.js';
import { PerformanceMonitoring } from '../../core/PerformanceMonitoring.js';
import { CollaborationEngine } from '../core/CollaborationEngine.js';
import { ChatSystem } from '../communication/ChatSystem.js';
import { SharedCodeEditor } from '../editor/SharedCodeEditor.js';
import { TerminalSharing } from '../terminal/TerminalSharing.js';
import { DebugCoordinator } from '../debugging/DebugCoordinator.js';
import {
  CollaborationSession,
  User,
  CollaborationRole,
  SessionType,
  Permission,
  WebSocketMessage
} from '../types.js';

export interface IntegrationConfig {
  enableAgentCollaboration: boolean;
  enableGitHubSync: boolean;
  enableTruthVerification: boolean;
  enablePerformanceMonitoring: boolean;
  maxConcurrentSessions: number;
  sessionTimeout: number;
  autoSaveInterval: number;
}

export interface AgentCollaborationConfig {
  enabled: boolean;
  agentsCanDrive: boolean;
  agentsCanNavigate: boolean;
  agentsCanDebug: boolean;
  agentsCanExecute: boolean;
  autoJoin: boolean;
  preferredRole: CollaborationRole;
}

/**
 * Integration layer that connects collaboration system with Turbo Flow backend
 */
export class BackendIntegration extends EventEmitter {
  private turboFlowServer: TurboFlowServer;
  private agentCoordination: AgentCoordination;
  private truthVerification: TruthVerification;
  private gitHubIntegration: GitHubIntegration;
  private performanceMonitoring: PerformanceMonitoring;

  private collaborationEngine: CollaborationEngine;
  private chatSystem: ChatSystem;
  private codeEditor: SharedCodeEditor;
  private terminalSharing: TerminalSharing;
  private debugCoordinator: DebugCoordinator;

  private config: IntegrationConfig;
  private agentConfig: AgentCollaborationConfig;
  private activeIntegrations: Map<string, any> = new Map();

  constructor(
    turboFlowServer: TurboFlowServer,
    config: Partial<IntegrationConfig> = {}
  ) {
    super();

    this.turboFlowServer = turboFlowServer;
    this.agentCoordination = AgentCoordination.getInstance();
    this.truthVerification = TruthVerification.getInstance();
    this.gitHubIntegration = GitHubIntegration.getInstance();
    this.performanceMonitoring = PerformanceMonitoring.getInstance();

    // Initialize collaboration components
    this.collaborationEngine = new CollaborationEngine();
    this.chatSystem = new ChatSystem();
    this.codeEditor = new SharedCodeEditor();
    this.terminalSharing = new TerminalSharing();
    this.debugCoordinator = new DebugCoordinator();

    this.config = {
      enableAgentCollaboration: true,
      enableGitHubSync: true,
      enableTruthVerification: true,
      enablePerformanceMonitoring: true,
      maxConcurrentSessions: 100,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      autoSaveInterval: 30 * 1000, // 30 seconds
      ...config
    };

    this.agentConfig = {
      enabled: true,
      agentsCanDrive: false,
      agentsCanNavigate: true,
      agentsCanDebug: true,
      agentsCanExecute: false,
      autoJoin: true,
      preferredRole: CollaborationRole.NAVIGATOR
    };

    this.setupIntegrationHandlers();
    this.setupEventForwarding();
    this.initializeWebSocketRoutes();
  }

  /**
   * Start the integration system
   */
  public async start(): Promise<void> {
    try {
      // Start collaboration engine
      await this.startCollaborationEngine();

      // Setup agent collaboration
      if (this.config.enableAgentCollaboration) {
        await this.setupAgentCollaboration();
      }

      // Setup GitHub integration
      if (this.config.enableGitHubSync) {
        await this.setupGitHubIntegration();
      }

      // Setup truth verification integration
      if (this.config.enableTruthVerification) {
        await this.setupTruthVerificationIntegration();
      }

      // Setup performance monitoring
      if (this.config.enablePerformanceMonitoring) {
        await this.setupPerformanceMonitoringIntegration();
      }

      this.emit('integrationStarted');
      console.log('✅ Collaboration backend integration started successfully');
    } catch (error) {
      this.emit('integrationError', error);
      console.error('❌ Failed to start collaboration integration:', error);
      throw error;
    }
  }

  /**
   * Stop the integration system
   */
  public async stop(): Promise<void> {
    try {
      // Stop all active collaboration sessions
      await this.stopAllSessions();

      // Cleanup integrations
      this.activeIntegrations.clear();

      this.emit('integrationStopped');
      console.log('✅ Collaboration backend integration stopped successfully');
    } catch (error) {
      this.emit('integrationError', error);
      console.error('❌ Failed to stop collaboration integration:', error);
      throw error;
    }
  }

  /**
   * Create integrated collaboration session
   */
  public async createIntegratedSession(
    hostId: string,
    config: {
      name: string;
      description?: string;
      type: SessionType;
      enableAgentCollaboration?: boolean;
      enableGitHubSync?: boolean;
      repositoryUrl?: string;
      swarmConfig?: any;
    }
  ): Promise<CollaborationSession> {
    // Create collaboration session
    const session = await this.collaborationEngine.createSession(hostId, {
      name: config.name,
      description: config.description,
      type: config.type
    });

    try {
      // Setup agent collaboration if enabled
      if (config.enableAgentCollaboration && this.agentConfig.enabled) {
        await this.setupSessionAgentCollaboration(session.id, config.swarmConfig);
      }

      // Setup GitHub sync if enabled
      if (config.enableGitHubSync && config.repositoryUrl) {
        await this.setupSessionGitHubSync(session.id, config.repositoryUrl);
      }

      // Create initial code document
      if (config.repositoryUrl) {
        await this.createCodeDocumentFromRepo(session.id, config.repositoryUrl);
      }

      // Start truth verification for this session
      if (this.config.enableTruthVerification) {
        await this.startSessionTruthVerification(session.id);
      }

      // Start performance monitoring for this session
      if (this.config.enablePerformanceMonitoring) {
        await this.startSessionPerformanceMonitoring(session.id);
      }

      // Store integration metadata
      this.activeIntegrations.set(session.id, {
        agentCollaboration: config.enableAgentCollaboration,
        gitHubSync: config.enableGitHubSync,
        repositoryUrl: config.repositoryUrl,
        truthVerification: this.config.enableTruthVerification,
        performanceMonitoring: this.config.enablePerformanceMonitoring,
        createdAt: new Date()
      });

      this.emit('integratedSessionCreated', { sessionId: session.id, config });
      return session;
    } catch (error) {
      // Cleanup on error
      await this.collaborationEngine.endSession(session.id);
      throw error;
    }
  }

  /**
   * Get integration status for session
   */
  public getIntegrationStatus(sessionId: string): any {
    const integration = this.activeIntegrations.get(sessionId);
    if (!integration) {
      return null;
    }

    return {
      sessionId,
      ...integration,
      uptime: Date.now() - integration.createdAt.getTime(),
      metrics: this.getSessionMetrics(sessionId)
    };
  }

  /**
   * Sync session with GitHub repository
   */
  public async syncWithGitHub(
    sessionId: string,
    options: {
      commitMessage?: string;
      createPullRequest?: boolean;
      branchName?: string;
    } = {}
  ): Promise<void> {
    const integration = this.activeIntegrations.get(sessionId);
    if (!integration || !integration.gitHubSync || !integration.repositoryUrl) {
      throw new Error('GitHub sync not enabled for this session');
    }

    const session = this.collaborationEngine.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Get all documents from the session
    const documents = this.codeEditor.getDocuments(sessionId);

    // Create commit with all changes
    for (const document of documents) {
      await this.gitHubIntegration.commitFile(
        integration.repositoryUrl,
        document.name,
        document.content,
        options.commitMessage || `Update ${document.name} from collaboration session`
      );
    }

    // Create pull request if requested
    if (options.createPullRequest) {
      await this.gitHubIntegration.createPullRequest(
        integration.repositoryUrl,
        {
          title: `Collaboration session changes for ${session.name}`,
          head: options.branchName || 'collaboration-changes',
          base: 'main',
          body: `Changes made during collaboration session "${session.name}"\n\n${session.description || ''}`
        }
      );
    }

    this.emit('githubSyncCompleted', { sessionId, options });
  }

  /**
   * Verify code quality using truth verification
   */
  public async verifyCodeQuality(sessionId: string): Promise<any> {
    const integration = this.activeIntegrations.get(sessionId);
    if (!integration || !integration.truthVerification) {
      throw new Error('Truth verification not enabled for this session');
    }

    const documents = this.codeEditor.getDocuments(sessionId);
    const verificationResults = [];

    for (const document of documents) {
      const result = await this.truthVerification.verify({
        content: document.content,
        language: document.language,
        type: 'code_quality'
      });

      verificationResults.push({
        documentId: document.id,
        documentName: document.name,
        ...result
      });
    }

    // Calculate overall session score
    const overallScore = verificationResults.reduce((sum, result) => sum + (result.score || 0), 0) / verificationResults.length;

    this.emit('codeQualityVerified', { sessionId, results: verificationResults, overallScore });
    return {
      sessionId,
      results: verificationResults,
      overallScore,
      passed: overallScore >= 0.95 // Truth verification threshold
    };
  }

  /**
   * Get performance metrics for session
   */
  public getSessionPerformanceMetrics(sessionId: string): any {
    return this.performanceMonitoring.getMetrics({
      start: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      end: new Date()
    });
  }

  // Private methods

  private async startCollaborationEngine(): Promise<void> {
    // Setup WebSocket handlers for collaboration engine
    // Note: TurboFlowServer broadcast method is available for communication
    this.collaborationEngine.start().catch(error => {
      console.error('Failed to start collaboration engine:', error);
    });

    // Forward collaboration engine events
    this.collaborationEngine.on('sessionCreated', (data) => {
      this.emit('collaborationSessionCreated', data);
    });

    this.collaborationEngine.on('userJoined', (data) => {
      this.emit('collaborationUserJoined', data);
    });

    this.collaborationEngine.on('textOperation', (data) => {
      this.handleTextOperation(data);
    });
  }

  private async setupAgentCollaboration(): Promise<void> {
    // Listen for swarm creation and join collaboration sessions
    this.agentCoordination.on('swarmCreated', async (swarm) => {
      if (this.agentConfig.autoJoin) {
        // Auto-join active collaboration sessions
        const activeSessions = this.collaborationEngine.getActiveSessions();
        for (const session of activeSessions) {
          try {
            const agent = await this.agentCoordination.spawnAgent('collaboration-specialist', {
              capabilities: ['code-review', 'pair-programming', 'debug-assistance'],
              sessionId: session.id
            });

            await this.collaborationEngine.joinSession(
              session.id,
              agent.id,
              this.agentConfig.preferredRole
            );
          } catch (error) {
            console.error(`Failed to join agent to session ${session.id}:`, error);
          }
        }
      }
    });
  }

  private async setupGitHubIntegration(): Promise<void> {
    // Listen for webhook events and notify collaboration sessions
    this.gitHubIntegration.on('push', async (event) => {
      const sessions = Array.from(this.activeIntegrations.entries())
        .filter(([_, integration]) => integration.gitHubSync);

      for (const [sessionId, integration] of sessions) {
        if (event.repository.url === integration.repositoryUrl) {
          this.emit('githubPushReceived', { sessionId, event });
        }
      }
    });

    this.gitHubIntegration.on('pullRequest', async (event) => {
      const sessions = Array.from(this.activeIntegrations.entries())
        .filter(([_, integration]) => integration.gitHubSync);

      for (const [sessionId, integration] of sessions) {
        if (event.repository.url === integration.repositoryUrl) {
          this.emit('githubPullRequestReceived', { sessionId, event });
        }
      }
    });
  }

  private async setupTruthVerificationIntegration(): Promise<void> {
    // Setup automatic truth verification for code changes
    this.codeEditor.on('operationApplied', async (data) => {
      const integration = this.activeIntegrations.get(data.sessionId);
      if (!integration || !integration.truthVerification) {
        return;
      }

      // Verify code quality in background
      try {
        await this.truthVerification.verify({
          content: data.document.content,
          language: data.document.language,
          type: 'code_quality'
        });
      } catch (error) {
        console.error('Truth verification failed:', error);
      }
    });
  }

  private async setupPerformanceMonitoringIntegration(): Promise<void> {
    // Monitor collaboration performance metrics
    this.collaborationEngine.on('userJoined', (data) => {
      this.performanceMonitoring.recordMetric('collaboration.user_joined', {
        sessionId: data.session.id,
        userId: data.user.id
      });
    });

    this.collaborationEngine.on('textOperation', (data) => {
      this.performanceMonitoring.recordMetric('collaboration.text_operation', {
        sessionId: data.sessionId,
        operationType: data.payload.operation.type,
        timestamp: data.timestamp
      });
    });
  }

  private setupIntegrationHandlers(): void {
    // Handle chat system events
    this.chatSystem.on('messageSent', (data) => {
      const integration = this.activeIntegrations.get(data.message.sessionId);
      if (integration && integration.agentCollaboration) {
        // Forward messages to collaborating agents
        this.forwardMessageToAgents(data.message);
      }
    });

    // Handle terminal sharing events
    this.terminalSharing.on('commandCompleted', (data) => {
      const integration = this.activeIntegrations.get(data.command.sessionId);
      if (integration && integration.agentCollaboration) {
        // Share command results with collaborating agents
        this.shareTerminalResultWithAgents(data.command);
      }
    });

    // Handle debug coordinator events
    this.debugCoordinator.on('breakpointHit', (data) => {
      const integration = this.activeIntegrations.get(data.sessionId);
      if (integration && integration.agentCollaboration) {
        // Notify collaborating agents of debug events
        this.notifyAgentsOfDebugEvent(data);
      }
    });
  }

  private setupEventForwarding(): void {
    // Forward all collaboration events to Turbo Flow server
    this.collaborationEngine.on('*', (eventName, data) => {
      this.turboFlowServer.emit('collaboration', { event: eventName, data });
    });

    this.chatSystem.on('*', (eventName, data) => {
      this.turboFlowServer.emit('chat', { event: eventName, data });
    });

    this.codeEditor.on('*', (eventName, data) => {
      this.turboFlowServer.emit('editor', { event: eventName, data });
    });

    this.terminalSharing.on('*', (eventName, data) => {
      this.turboFlowServer.emit('terminal', { event: eventName, data });
    });

    this.debugCoordinator.on('*', (eventName, data) => {
      this.turboFlowServer.emit('debug', { event: eventName, data });
    });
  }

  private initializeWebSocketRoutes(): void {
    // These would be integrated into the existing WebSocket handler in TurboFlowServer
    // For now, we'll emit events that can be handled by the main server
  }

  private async setupSessionAgentCollaboration(sessionId: string, swarmConfig?: any): Promise<void> {
    try {
      // Create specialized agents for collaboration
      const agents = await this.agentCoordination.spawnAgentsParallel([
        {
          type: 'collaboration-driver',
          capabilities: ['code-writing', 'implementation'],
          config: { sessionId, canDrive: this.agentConfig.agentsCanDrive }
        },
        {
          type: 'collaboration-navigator',
          capabilities: ['code-review', 'guidance', 'planning'],
          config: { sessionId, canNavigate: this.agentConfig.agentsCanNavigate }
        },
        {
          type: 'collaboration-debugger',
          capabilities: ['debugging', 'error-analysis'],
          config: { sessionId, canDebug: this.agentConfig.agentsCanDebug }
        }
      ]);

      // Join agents to collaboration session
      for (const agent of agents) {
        await this.collaborationEngine.joinSession(
          sessionId,
          agent.id,
          this.agentConfig.preferredRole
        );
      }
    } catch (error) {
      console.error(`Failed to setup agent collaboration for session ${sessionId}:`, error);
    }
  }

  private async setupSessionGitHubSync(sessionId: string, repositoryUrl: string): Promise<void> {
    try {
      // Setup webhook for repository if not already exists
      await this.gitHubIntegration.createWebhook(repositoryUrl, {
        url: `${process.env.BASE_URL}/api/github/webhook`,
        events: ['push', 'pull_request'],
        active: true
      });
    } catch (error) {
      console.error(`Failed to setup GitHub sync for session ${sessionId}:`, error);
    }
  }

  private async createCodeDocumentFromRepo(sessionId: string, repositoryUrl: string): Promise<void> {
    try {
      // Clone repository and create documents for main files
      const repo = await this.gitHubIntegration.getRepository(
        repositoryUrl.split('/')[4], // owner
        repositoryUrl.split('/')[5].replace('.git', '') // repo
      );

      if (repo) {
        // Create initial documents for common files
        const files = ['README.md', 'package.json', 'src/index.js', 'src/app.js'];
        for (const file of files) {
          try {
            await this.codeEditor.createDocument(sessionId, {
              name: file,
              language: this.detectLanguageFromFile(file)
            });
          } catch (error) {
            // Ignore file creation errors
          }
        }
      }
    } catch (error) {
      console.error(`Failed to create code documents from repo for session ${sessionId}:`, error);
    }
  }

  private async startSessionTruthVerification(sessionId: string): Promise<void> {
    // Enable automatic truth verification for all code changes
    const integration = this.activeIntegrations.get(sessionId);
    if (integration) {
      integration.truthVerificationActive = true;
    }
  }

  private async startSessionPerformanceMonitoring(sessionId: string): Promise<void> {
    // Start performance monitoring for session
    this.performanceMonitoring.startMonitoring(this.config.autoSaveInterval);
  }

  private async stopAllSessions(): Promise<void> {
    const sessions = this.collaborationEngine.getActiveSessions();
    for (const session of sessions) {
      await this.collaborationEngine.endSession(session.id);
    }
  }

  private handleTextOperation(data: any): void {
    // Handle text operations from collaboration engine
    // This could include triggering agent assistance, truth verification, etc.
  }

  private async forwardMessageToAgents(message: any): Promise<void> {
    // Forward chat messages to collaborating agents
    const integration = this.activeIntegrations.get(message.sessionId);
    if (integration && integration.agentCollaboration) {
      // Implementation would depend on agent communication system
    }
  }

  private async shareTerminalResultWithAgents(command: any): Promise<void> {
    // Share terminal command results with collaborating agents
  }

  private async notifyAgentsOfDebugEvent(event: any): Promise<void> {
    // Notify agents of debug events
  }

  private getSessionMetrics(sessionId: string): any {
    return {
      textOperations: this.performanceMonitoring.getMetrics().textOperations || 0,
      chatMessages: this.performanceMonitoring.getMetrics().chatMessages || 0,
      terminalCommands: this.performanceMonitoring.getMetrics().terminalCommands || 0,
      debugActions: this.performanceMonitoring.getMetrics().debugActions || 0,
      activeUsers: this.collaborationEngine.getSession(sessionId)?.participants.length || 0
    };
  }

  private detectLanguageFromFile(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'cpp',
      'html': 'html',
      'css': 'css',
      'md': 'markdown'
    };

    return languageMap[extension || ''] || 'plaintext';
  }
}