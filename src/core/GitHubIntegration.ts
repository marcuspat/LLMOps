import {
  GitHubRepo,
  GitHubHook,
  GitHubPullRequest,
  ApiResponse,
  WebSocketMessage,
  MessageType
} from '../types/index.js';
import { EventEmitter } from 'events';

/**
 * GitHub Integration Layer
 * Handles webhooks, API connections, and repository management
 */
export class GitHubIntegration extends EventEmitter {
  private static instance: GitHubIntegration;
  private apiToken: string;
  private webhookSecret: string;
  private repositories: Map<string, GitHubRepo> = new Map();
  private webhooks: Map<string, GitHubHook> = new Map();
  private rateLimitTracker: RateLimitTracker;

  private constructor() {
    super();
    this.rateLimitTracker = new RateLimitTracker();
  }

  public static getInstance(): GitHubIntegration {
    if (!GitHubIntegration.instance) {
      GitHubIntegration.instance = new GitHubIntegration();
    }
    return GitHubIntegration.instance;
  }

  /**
   * Initialize GitHub integration with authentication
   */
  public async initialize(config: GitHubConfig): Promise<void> {
    this.apiToken = config.apiToken;
    this.webhookSecret = config.webhookSecret;

    // Validate authentication
    const authResult = await this.validateAuthentication();
    if (!authResult.success) {
      throw new Error(`GitHub authentication failed: ${authResult.error?.message}`);
    }

    // Load existing repositories
    await this.loadRepositories();

    this.emit('initialized', { timestamp: new Date() });
  }

  /**
   * Create webhook for repository
   */
  public async createWebhook(repoId: string, hookConfig: HookConfig): Promise<GitHubHook> {
    const repo = this.repositories.get(repoId);
    if (!repo) {
      throw new Error(`Repository ${repoId} not found`);
    }

    const webhook: GitHubHook = {
      id: this.generateId('hook'),
      name: 'Turbo Flow Webhook',
      events: ['push', 'pull_request', 'issues', 'release'],
      active: true,
      config: {
        ...hookConfig,
        contentType: 'application/json'
      }
    };

    // Register webhook with GitHub API
    const response = await this.makeGitHubRequest(
      `POST /repos/${repo.fullName}/hooks`,
      webhook
    );

    if (response.success && response.data) {
      const createdHook = response.data as GitHubHook;
      this.webhooks.set(createdHook.id, createdHook);
      repo.hooks.push(createdHook);
      this.emit('webhookCreated', { repoId, webhook: createdHook });
      return createdHook;
    } else {
      throw new Error(`Failed to create webhook: ${response.error?.message}`);
    }
  }

  /**
   * Handle incoming webhook from GitHub
   */
  public async handleWebhook(payload: any, signature: string): Promise<void> {
    // Verify webhook signature
    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const eventType = payload.headers?.['x-github-event'];
    const body = payload.body;

    // Emit structured message for event handling
    const message: WebSocketMessage = {
      type: MessageType.GITHUB_WEBHOOK,
      id: this.generateId('webhook'),
      payload: {
        eventType,
        repository: body?.repository,
        sender: body?.sender,
        action: body?.action,
        data: body
      },
      timestamp: new Date()
    };

    this.emit('webhookReceived', message);

    // Route to specific event handlers
    switch (eventType) {
      case 'push':
        await this.handlePushEvent(body);
        break;
      case 'pull_request':
        await this.handlePullRequestEvent(body);
        break;
      case 'issues':
        await this.handleIssuesEvent(body);
        break;
      case 'release':
        await this.handleReleaseEvent(body);
        break;
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
  }

  /**
   * Get repository information
   */
  public async getRepository(owner: string, name: string): Promise<GitHubRepo | null> {
    const fullName = `${owner}/${name}`;

    // Check cache first
    const cached = this.repositories.get(fullName);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    // Fetch from GitHub API
    const response = await this.makeGitHubRequest(`GET /repos/${fullName}`);

    if (response.success && response.data) {
      const repo = this.mapGitHubRepo(response.data);
      this.repositories.set(fullName, repo);
      return repo;
    }

    return null;
  }

  /**
   * Create pull request
   */
  public async createPullRequest(
    owner: string,
    name: string,
    prData: PullRequestData
  ): Promise<GitHubPullRequest> {
    const fullName = `${owner}/${name}`;
    const response = await this.makeGitHubRequest(
      `POST /repos/${fullName}/pulls`,
      prData
    );

    if (response.success && response.data) {
      const pr = this.mapPullRequest(response.data);
      this.emit('pullRequestCreated', { repository: fullName, pullRequest: pr });
      return pr;
    } else {
      throw new Error(`Failed to create pull request: ${response.error?.message}`);
    }
  }

  /**
   * Update pull request status
   */
  public async updatePullRequestStatus(
    owner: string,
    name: string,
    prNumber: number,
    status: PRStatusUpdate
  ): Promise<void> {
    const fullName = `${owner}/${name}`;

    // Create commit status
    await this.makeGitHubRequest(
      `POST /repos/${fullName}/statuses/${status.sha}`,
      {
        state: status.state,
        target_url: status.targetUrl,
        description: status.description,
        context: status.context
      }
    );

    this.emit('pullRequestStatusUpdated', {
      repository: fullName,
      prNumber,
      status
    });
  }

  /**
   * Get pull request with detailed information
   */
  public async getPullRequest(owner: string, name: string, prNumber: number): Promise<GitHubPullRequest | null> {
    const fullName = `${owner}/${name}`;
    const response = await this.makeGitHubRequest(
      `GET /repos/${fullName}/pulls/${prNumber}`
    );

    if (response.success && response.data) {
      return this.mapPullRequest(response.data);
    }

    return null;
  }

  /**
   * Merge pull request
   */
  public async mergePullRequest(
    owner: string,
    name: string,
    prNumber: number,
    mergeOptions: MergeOptions = {}
  ): Promise<boolean> {
    const fullName = `${owner}/${name}`;
    const response = await this.makeGitHubRequest(
      `PUT /repos/${fullName}/pulls/${prNumber}/merge`,
      mergeOptions
    );

    const success = response.success && response.data?.merged === true;

    if (success) {
      this.emit('pullRequestMerged', {
        repository: fullName,
        prNumber,
        mergeOptions
      });
    }

    return success;
  }

  /**
   * Create issue
   */
  public async createIssue(
    owner: string,
    name: string,
    issueData: IssueData
  ): Promise<any> {
    const fullName = `${owner}/${name}`;
    const response = await this.makeGitHubRequest(
      `POST /repos/${fullName}/issues`,
      issueData
    );

    if (response.success) {
      this.emit('issueCreated', {
        repository: fullName,
        issue: response.data
      });
    }

    return response;
  }

  /**
   * Get repository contents
   */
  public async getContents(
    owner: string,
    name: string,
    path: string = '',
    ref?: string
  ): Promise<any> {
    const fullName = `${owner}/${name}`;
    const url = `GET /repos/${fullName}/contents/${path}${ref ? `?ref=${ref}` : ''}`;

    const response = await this.makeGitHubRequest(url);
    return response;
  }

  /**
   * Create or update file
   */
  public async createOrUpdateFile(
    owner: string,
    name: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<any> {
    const fullName = `${owner}/${name}`;
    const body = {
      message,
      content: Buffer.from(content).toString('base64'),
      sha
    };

    const response = await this.makeGitHubRequest(
      `PUT /repos/${fullName}/contents/${path}`,
      body
    );

    if (response.success) {
      this.emit('fileUpdated', {
        repository: fullName,
        path,
        message
      });
    }

    return response;
  }

  /**
   * Get repository workflow runs
   */
  public async getWorkflowRuns(
    owner: string,
    name: string,
    status?: string,
    branch?: string
  ): Promise<any> {
    const fullName = `${owner}/${name}`;
    let url = `GET /repos/${fullName}/actions/runs`;

    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (branch) params.append('branch', branch);
    if (params.toString()) url += `?${params.toString()}`;

    const response = await this.makeGitHubRequest(url);
    return response;
  }

  /**
   * Trigger workflow run
   */
  public async triggerWorkflow(
    owner: string,
    name: string,
    workflowId: string,
    inputs?: Record<string, any>
  ): Promise<any> {
    const fullName = `${owner}/${name}`;
    const body = {
      ref: 'main', // Default branch
      inputs
    };

    const response = await this.makeGitHubRequest(
      `POST /repos/${fullName}/actions/workflows/${workflowId}/dispatches`,
      body
    );

    if (response.success) {
      this.emit('workflowTriggered', {
        repository: fullName,
        workflowId,
        inputs
      });
    }

    return response;
  }

  /**
   * Search repositories
   */
  public async searchRepositories(query: string, options: SearchOptions = {}): Promise<any> {
    const searchQuery = new URLSearchParams({
      q: query,
      sort: options.sort || 'updated',
      order: options.order || 'desc',
      per_page: String(options.perPage || 10),
      page: String(options.page || 1)
    });

    const response = await this.makeGitHubRequest(
      `GET /search/repositories?${searchQuery.toString()}`
    );

    return response;
  }

  /**
   * Get user information
   */
  public async getUser(username?: string): Promise<any> {
    const endpoint = username ? `GET /users/${username}` : 'GET /user';
    const response = await this.makeGitHubRequest(endpoint);
    return response;
  }

  // Private methods

  private async validateAuthentication(): Promise<ApiResponse> {
    try {
      const response = await this.makeGitHubRequest('GET /user');
      return response;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Unknown authentication error'
        },
        timestamp: new Date()
      };
    }
  }

  private async loadRepositories(): Promise<void> {
    // Load repositories from cache or API
    // This would integrate with storage in a real implementation
    console.log('Loading repositories...');
  }

  private verifyWebhookSignature(payload: any, signature: string): boolean {
    // Implement HMAC signature verification
    // This would use crypto module to verify the signature
    return true; // Placeholder
  }

  private async makeGitHubRequest(endpoint: string, data?: any): Promise<ApiResponse> {
    // Check rate limit
    if (this.rateLimitTracker.isRateLimited()) {
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'GitHub API rate limit exceeded'
        },
        timestamp: new Date()
      };
    }

    try {
      const [method, path] = endpoint.split(' ');
      const url = `https://api.github.com${path}`;

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `token ${this.apiToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Turbo-Flow/1.0.0'
        }
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
        options.body = JSON.stringify(data);
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/json'
        };
      }

      const response = await fetch(url, options);
      const rateLimitInfo = this.parseRateLimitHeaders(response);

      // Update rate limit tracker
      this.rateLimitTracker.updateRateLimit(rateLimitInfo);

      if (response.ok) {
        const responseData = await response.json();
        return {
          success: true,
          data: responseData,
          timestamp: new Date()
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: {
            code: response.status.toString(),
            message: errorData.message || `HTTP ${response.status}`,
            details: errorData
          },
          timestamp: new Date()
        };
      }
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Unknown network error'
        },
        timestamp: new Date()
      };
    }
  }

  private parseRateLimitHeaders(response: Response): RateLimitInfo {
    return {
      limit: parseInt(response.headers.get('X-RateLimit-Limit') || '5000'),
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '5000'),
      reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0'),
      used: parseInt(response.headers.get('X-RateLimit-Used') || '0')
    };
  }

  private mapGitHubRepo(data: any): GitHubRepo {
    return {
      id: data.id.toString(),
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      url: data.html_url,
      private: data.private,
      defaultBranch: data.default_branch,
      hooks: []
    };
  }

  private mapPullRequest(data: any): GitHubPullRequest {
    return {
      id: data.id.toString(),
      number: data.number,
      title: data.title,
      state: data.state as 'open' | 'closed',
      author: data.user.login,
      baseBranch: data.base.ref,
      headBranch: data.head.ref,
      url: data.html_url,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at)
    };
  }

  private isCacheValid(repo: GitHubRepo): boolean {
    // Implement cache validation logic
    // For now, return false to always fetch fresh data
    return false;
  }

  private async handlePushEvent(body: any): Promise<void> {
    const { ref, repository, commits, pusher } = body;

    this.emit('pushEvent', {
      repository: repository.full_name,
      branch: ref.replace('refs/heads/', ''),
      commits: commits.length,
      pusher: pusher.name,
      timestamp: new Date()
    });
  }

  private async handlePullRequestEvent(body: any): Promise<void> {
    const { action, pull_request, repository } = body;

    const pr = this.mapPullRequest(pull_request);

    this.emit('pullRequestEvent', {
      action,
      repository: repository.full_name,
      pullRequest: pr,
      timestamp: new Date()
    });

    // Auto-trigger verification for new PRs
    if (action === 'opened') {
      this.emit('verificationRequired', {
        type: 'pull_request',
        repository: repository.full_name,
        pullRequestNumber: pr.number
      });
    }
  }

  private async handleIssuesEvent(body: any): Promise<void> {
    const { action, issue, repository } = body;

    this.emit('issuesEvent', {
      action,
      repository: repository.full_name,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        state: issue.state,
        author: issue.user.login
      },
      timestamp: new Date()
    });
  }

  private async handleReleaseEvent(body: any): Promise<void> {
    const { action, release, repository } = body;

    this.emit('releaseEvent', {
      action,
      repository: repository.full_name,
      release: {
        id: release.id,
        tagName: release.tag_name,
        name: release.name,
        draft: release.draft,
        prerelease: release.prerelease
      },
      timestamp: new Date()
    });
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Supporting classes

class RateLimitTracker {
  private rateLimitInfo: RateLimitInfo = {
    limit: 5000,
    remaining: 5000,
    reset: 0,
    used: 0
  };

  isRateLimited(): boolean {
    return this.rateLimitInfo.remaining <= 10;
  }

  updateRateLimit(info: RateLimitInfo): void {
    this.rateLimitInfo = info;
  }

  getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  getTimeUntilReset(): number {
    return Math.max(0, this.rateLimitInfo.reset * 1000 - Date.now());
  }
}

// Type definitions
interface GitHubConfig {
  apiToken: string;
  webhookSecret: string;
  baseUrl?: string;
}

interface HookConfig {
  url: string;
  secret?: string;
  contentType?: string;
}

interface PullRequestData {
  title: string;
  head: string;
  base: string;
  body?: string;
  draft?: boolean;
}

interface PRStatusUpdate {
  sha: string;
  state: 'pending' | 'success' | 'error' | 'failure';
  targetUrl?: string;
  description: string;
  context: string;
}

interface MergeOptions {
  commitTitle?: string;
  commitMessage?: string;
  mergeMethod?: 'merge' | 'squash' | 'rebase';
}

interface IssueData {
  title: string;
  body?: string;
  labels?: string[];
  assignees?: string[];
}

interface SearchOptions {
  sort?: 'stars' | 'forks' | 'updated';
  order?: 'asc' | 'desc';
  perPage?: number;
  page?: number;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}