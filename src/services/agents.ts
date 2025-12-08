/**
 * Agents API Service
 */

import { apiClient } from './api';
import { Agent, AgentStatus, AgentType, ApiResponse, QueryParams } from '../types/frontend';

export interface AgentFilters {
  status?: AgentStatus[];
  type?: AgentType[];
  swarmId?: string;
  search?: string;
}

export interface CreateAgentRequest {
  name: string;
  type: AgentType;
  capabilities?: string[];
  swarmId?: string;
  resources?: {
    cpu?: number;
    memory?: number;
    storage?: number;
    network?: number;
  };
}

export interface UpdateAgentRequest {
  name?: string;
  capabilities?: string[];
  status?: AgentStatus;
  resources?: {
    cpu?: number;
    memory?: number;
    storage?: number;
    network?: number;
  };
}

export class AgentsService {
  /**
   * Get all agents with optional filtering and pagination
   */
  async getAgents(params?: QueryParams & { filters?: AgentFilters }): Promise<ApiResponse<Agent[]>> {
    return apiClient.get('/agents', params);
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(id: string): Promise<ApiResponse<Agent>> {
    return apiClient.get(`/agents/${id}`);
  }

  /**
   * Create a new agent
   */
  async createAgent(data: CreateAgentRequest): Promise<ApiResponse<Agent>> {
    return apiClient.post('/agents', data);
  }

  /**
   * Update an existing agent
   */
  async updateAgent(id: string, data: UpdateAgentRequest): Promise<ApiResponse<Agent>> {
    return apiClient.put(`/agents/${id}`, data);
  }

  /**
   * Delete an agent
   */
  async deleteAgent(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/agents/${id}`);
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(id: string, timeRange?: { start: Date; end: Date }): Promise<ApiResponse<any>> {
    const params = timeRange ? { timeRange } : undefined;
    return apiClient.get(`/agents/${id}/metrics`, params);
  }

  /**
   * Start an agent
   */
  async startAgent(id: string): Promise<ApiResponse<Agent>> {
    return apiClient.post(`/agents/${id}/start`);
  }

  /**
   * Stop an agent
   */
  async stopAgent(id: string): Promise<ApiResponse<Agent>> {
    return apiClient.post(`/agents/${id}/stop`);
  }

  /**
   * Restart an agent
   */
  async restartAgent(id: string): Promise<ApiResponse<Agent>> {
    return apiClient.post(`/agents/${id}/restart`);
  }

  /**
   * Get agent logs
   */
  async getAgentLogs(id: string, params?: { lines?: number; offset?: number }): Promise<ApiResponse<string[]>> {
    return apiClient.get(`/agents/${id}/logs`, params);
  }

  /**
   * Get agent capabilities
   */
  async getAgentCapabilities(): Promise<ApiResponse<string[]>> {
    return apiClient.get('/agents/capabilities');
  }

  /**
   * Get agent types
   */
  async getAgentTypes(): Promise<ApiResponse<AgentType[]>> {
    return apiClient.get('/agents/types');
  }

  /**
   * Assign agent to swarm
   */
  async assignToSwarm(agentId: string, swarmId: string): Promise<ApiResponse<Agent>> {
    return apiClient.post(`/agents/${agentId}/assign`, { swarmId });
  }

  /**
   * Remove agent from swarm
   */
  async removeFromSwarm(agentId: string): Promise<ApiResponse<Agent>> {
    return apiClient.post(`/agents/${agentId}/unassign`);
  }

  /**
   * Get agent performance data
   */
  async getAgentPerformance(id: string, timeRange?: { start: Date; end: Date }): Promise<ApiResponse<any>> {
    const params = timeRange ? { timeRange } : undefined;
    return apiClient.get(`/agents/${id}/performance`, params);
  }

  /**
   * Execute command on agent
   */
  async executeCommand(id: string, command: string, args?: string[]): Promise<ApiResponse<any>> {
    return apiClient.post(`/agents/${id}/execute`, { command, args });
  }

  /**
   * Get agent configuration
   */
  async getAgentConfig(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/agents/${id}/config`);
  }

  /**
   * Update agent configuration
   */
  async updateAgentConfig(id: string, config: any): Promise<ApiResponse<Agent>> {
    return apiClient.put(`/agents/${id}/config`, config);
  }
}

export const agentsService = new AgentsService();