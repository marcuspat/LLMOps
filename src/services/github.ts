/**
 * GitHub API Service
 */

import { apiClient } from './api';
import { ApiResponse, QueryParams } from '../types/frontend';

export interface GitHubRepo {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  private: boolean;
  defaultBranch: string;
  hooks: GitHubHook[];
  lastSync?: Date;
  status?: 'connected' | 'disconnected' | 'syncing' | 'error';
}

export interface GitHubHook {
  id: string;
  name: string;
  events: string[];
  active: boolean;
  config: {
    url: string;
    contentType: string;
    secret?: string;
  };
}

export interface GitHubPullRequest {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  baseBranch: string;
  headBranch: string;
  url: string;
  createdAt: Date;
  updatedAt: Date;
  reviews: GitHubReview[];
  checks: GitHubCheck[];
  mergeable?: boolean;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

export interface GitHubReview {
  id: string;
  user: string;
  state: 'approved' | 'changes_requested' | 'commented' | 'pending';
  body: string;
  submittedAt: Date;
}

export interface GitHubCheck {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | null;
  startedAt?: Date;
  completedAt?: Date;
  detailsUrl?: string;
  externalId?: string;
}

export interface GitHubIssue {
  id: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  author: string;
  assignees: string[];
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
  milestone?: string;
  body?: string;
  comments?: number;
}

export interface GitHubRelease {
  id: number;
  tag: string;
  name: string;
  description: string;
  author: string;
  createdAt: Date;
  publishedAt: Date;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

export interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  downloadCount: number;
  contentType: string;
  createdAt: Date;
  downloadUrl: string;
}

export interface GitHubWorkflow {
  id: string;
  name: string;
  status: 'success' | 'failure' | 'pending' | 'in_progress';
  trigger: string;
  lastRun: Date;
  duration?: number;
  url: string;
  workflowId: string;
  branch: string;
}

export interface GitHubSettings {
  autoMerge: boolean;
  requireReviews: boolean;
  requiredReviewers: number;
  autoDeploy: boolean;
  deployBranch: string;
  notifications: boolean;
  webhookUrl?: string;
  syncInterval?: number;
}

export interface ConnectRepoRequest {
  owner: string;
  name: string;
  accessToken?: string;
  settings?: Partial<GitHubSettings>;
}

export interface CreateWebhookRequest {
  events: string[];
  url: string;
  secret?: string;
  active?: boolean;
}

export interface GitHubStats {
  totalRepos: number;
  totalPRs: number;
  totalIssues: number;
  totalReleases: number;
  activeWorkflows: number;
  lastSync: Date;
}

export class GitHubService {
  /**
   * Get all connected repositories
   */
  async getRepos(params?: QueryParams): Promise<ApiResponse<GitHubRepo[]>> {
    return apiClient.get('/github/repos', params);
  }

  /**
   * Get a specific repository
   */
  async getRepo(id: string): Promise<ApiResponse<GitHubRepo>> {
    return apiClient.get(`/github/repos/${id}`);
  }

  /**
   * Connect a new repository
   */
  async connectRepo(data: ConnectRepoRequest): Promise<ApiResponse<GitHubRepo>> {
    return apiClient.post('/github/repos/connect', data);
  }

  /**
   * Disconnect a repository
   */
  async disconnectRepo(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/github/repos/${id}`);
  }

  /**
   * Sync repository data
   */
  async syncRepo(id: string): Promise<ApiResponse<GitHubRepo>> {
    return apiClient.post(`/github/repos/${id}/sync`);
  }

  /**
   * Get repository pull requests
   */
  async getPullRequests(repoId: string, params?: QueryParams): Promise<ApiResponse<GitHubPullRequest[]>> {
    return apiClient.get(`/github/repos/${repoId}/pulls`, params);
  }

  /**
   * Get a specific pull request
   */
  async getPullRequest(repoId: string, prNumber: number): Promise<ApiResponse<GitHubPullRequest>> {
    return apiClient.get(`/github/repos/${repoId}/pulls/${prNumber}`);
  }

  /**
   * Create pull request review
   */
  async createPRReview(repoId: string, prNumber: number, data: {
    body: string;
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
    comments?: Array<{
      path: string;
      line?: number;
      body: string;
    }>;
  }): Promise<ApiResponse<GitHubReview>> {
    return apiClient.post(`/github/repos/${repoId}/pulls/${prNumber}/reviews`, data);
  }

  /**
   * Merge pull request
   */
  async mergePR(repoId: string, prNumber: number, data?: {
    commitTitle?: string;
    commitMessage?: string;
    mergeMethod?: 'merge' | 'squash' | 'rebase';
  }): Promise<ApiResponse<any>> {
    return apiClient.put(`/github/repos/${repoId}/pulls/${prNumber}/merge`, data);
  }

  /**
   * Get repository issues
   */
  async getIssues(repoId: string, params?: QueryParams): Promise<ApiResponse<GitHubIssue[]>> {
    return apiClient.get(`/github/repos/${repoId}/issues`, params);
  }

  /**
   * Create issue
   */
  async createIssue(repoId: string, data: {
    title: string;
    body?: string;
    labels?: string[];
    assignees?: string[];
    milestone?: number;
  }): Promise<ApiResponse<GitHubIssue>> {
    return apiClient.post(`/github/repos/${repoId}/issues`, data);
  }

  /**
   * Update issue
   */
  async updateIssue(repoId: string, issueNumber: number, data: {
    title?: string;
    body?: string;
    state?: 'open' | 'closed';
    labels?: string[];
    assignees?: string[];
    milestone?: number | null;
  }): Promise<ApiResponse<GitHubIssue>> {
    return apiClient.patch(`/github/repos/${repoId}/issues/${issueNumber}`, data);
  }

  /**
   * Get repository releases
   */
  async getReleases(repoId: string, params?: QueryParams): Promise<ApiResponse<GitHubRelease[]>> {
    return apiClient.get(`/github/repos/${repoId}/releases`, params);
  }

  /**
   * Create release
   */
  async createRelease(repoId: string, data: {
    tag: string;
    name: string;
    body?: string;
    draft?: boolean;
    prerelease?: boolean;
    targetCommitish?: string;
  }): Promise<ApiResponse<GitHubRelease>> {
    return apiClient.post(`/github/repos/${repoId}/releases`, data);
  }

  /**
   * Get repository webhooks
   */
  async getWebhooks(repoId: string): Promise<ApiResponse<GitHubHook[]>> {
    return apiClient.get(`/github/repos/${repoId}/webhooks`);
  }

  /**
   * Create webhook
   */
  async createWebhook(repoId: string, data: CreateWebhookRequest): Promise<ApiResponse<GitHubHook>> {
    return apiClient.post(`/github/repos/${repoId}/webhooks`, data);
  }

  /**
   * Update webhook
   */
  async updateWebhook(repoId: string, hookId: string, data: Partial<GitHubHook>): Promise<ApiResponse<GitHubHook>> {
    return apiClient.patch(`/github/repos/${repoId}/webhooks/${hookId}`, data);
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(repoId: string, hookId: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/github/repos/${repoId}/webhooks/${hookId}`);
  }

  /**
   * Get repository workflows
   */
  async getWorkflows(repoId: string, params?: QueryParams): Promise<ApiResponse<GitHubWorkflow[]>> {
    return apiClient.get(`/github/repos/${repoId}/workflows`, params);
  }

  /**
   * Trigger workflow
   */
  async triggerWorkflow(repoId: string, workflowId: string, data: {
    ref: string;
    inputs?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    return apiClient.post(`/github/repos/${repoId}/workflows/${workflowId}/dispatches`, data);
  }

  /**
   * Get repository settings
   */
  async getSettings(repoId: string): Promise<ApiResponse<GitHubSettings>> {
    return apiClient.get(`/github/repos/${repoId}/settings`);
  }

  /**
   * Update repository settings
   */
  async updateSettings(repoId: string, settings: Partial<GitHubSettings>): Promise<ApiResponse<GitHubSettings>> {
    return apiClient.put(`/github/repos/${repoId}/settings`, settings);
  }

  /**
   * Get GitHub statistics
   */
  async getStats(): Promise<ApiResponse<GitHubStats>> {
    return apiClient.get('/github/stats');
  }

  /**
   * Search repositories
   */
  async searchRepos(query: string, params?: {
    sort?: 'stars' | 'forks' | 'updated';
    order?: 'asc' | 'desc';
    type?: 'all' | 'public' | 'private' | 'forks' | 'sources' | 'member';
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get('/github/search/repos', { q: query, ...params });
  }

  /**
   * Get repository content
   */
  async getContent(repoId: string, path: string, ref?: string): Promise<ApiResponse<any>> {
    const params = ref ? { ref } : undefined;
    return apiClient.get(`/github/repos/${repoId}/contents/${path}`, params);
  }

  /**
   * Create or update file
   */
  async createOrUpdateFile(repoId: string, path: string, data: {
    content: string;
    message: string;
    branch?: string;
    sha?: string;
  }): Promise<ApiResponse<any>> {
    return apiClient.put(`/github/repos/${repoId}/contents/${path}`, data);
  }

  /**
   * Delete file
   */
  async deleteFile(repoId: string, path: string, data: {
    message: string;
    branch?: string;
    sha: string;
  }): Promise<ApiResponse<void>> {
    return apiClient.delete(`/github/repos/${repoId}/contents/${path}`, { data });
  }

  /**
   * Get commit history
   */
  async getCommits(repoId: string, params?: {
    sha?: string;
    path?: string;
    since?: string;
    until?: string;
  }): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/github/repos/${repoId}/commits`, params);
  }

  /**
   * Get branches
   */
  async getBranches(repoId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/github/repos/${repoId}/branches`);
  }

  /**
   * Get tags
   */
  async getTags(repoId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/github/repos/${repoId}/tags`);
  }

  /**
   * Get repository contributors
   */
  async getContributors(repoId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/github/repos/${repoId}/contributors`);
  }

  /**
   * Get repository languages
   */
  async getLanguages(repoId: string): Promise<ApiResponse<Record<string, number>>> {
    return apiClient.get(`/github/repos/${repoId}/languages`);
  }
}

export const githubService = new GitHubService();