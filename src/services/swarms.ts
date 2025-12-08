/**
 * Swarms API Service
 */

import { apiClient } from './api';
import { Swarm, SwarmTopology, SwarmStatus, SwarmStrategy, ApiResponse, QueryParams } from '../types/frontend';

export interface SwarmFilters {
  status?: SwarmStatus[];
  topology?: SwarmTopology[];
  strategy?: SwarmStrategy[];
  search?: string;
}

export interface CreateSwarmRequest {
  name: string;
  topology: SwarmTopology;
  maxAgents: number;
  strategy: SwarmStrategy;
  enableAutoScaling?: boolean;
  resourceLimits?: {
    maxCpuUsage: number;
    maxMemoryUsage: number;
    maxTasksPerAgent: number;
  };
}

export interface UpdateSwarmRequest {
  name?: string;
  maxAgents?: number;
  strategy?: SwarmStrategy;
  enableAutoScaling?: boolean;
  resourceLimits?: {
    maxCpuUsage?: number;
    maxMemoryUsage?: number;
    maxTasksPerAgent?: number;
  };
}

export interface SwarmMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  throughput: number;
  efficiency: number;
  uptime: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
  };
}

export class SwarmsService {
  /**
   * Get all swarms with optional filtering and pagination
   */
  async getSwarms(params?: QueryParams & { filters?: SwarmFilters }): Promise<ApiResponse<Swarm[]>> {
    return apiClient.get('/swarms', params);
  }

  /**
   * Get a specific swarm by ID
   */
  async getSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.get(`/swarms/${id}`);
  }

  /**
   * Create a new swarm
   */
  async createSwarm(data: CreateSwarmRequest): Promise<ApiResponse<Swarm>> {
    return apiClient.post('/swarms', data);
  }

  /**
   * Update an existing swarm
   */
  async updateSwarm(id: string, data: UpdateSwarmRequest): Promise<ApiResponse<Swarm>> {
    return apiClient.put(`/swarms/${id}`, data);
  }

  /**
   * Delete a swarm
   */
  async deleteSwarm(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/swarms/${id}`);
  }

  /**
   * Initialize a swarm
   */
  async initializeSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/initialize`);
  }

  /**
   * Start a swarm
   */
  async startSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/start`);
  }

  /**
   * Stop a swarm
   */
  async stopSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/stop`);
  }

  /**
   * Destroy a swarm
   */
  async destroySwarm(id: string): Promise<ApiResponse<void>> {
    return apiClient.post(`/swarms/${id}/destroy`);
  }

  /**
   * Get swarm metrics
   */
  async getSwarmMetrics(id: string, timeRange?: { start: Date; end: Date }): Promise<ApiResponse<SwarmMetrics>> {
    const params = timeRange ? { timeRange } : undefined;
    return apiClient.get(`/swarms/${id}/metrics`, params);
  }

  /**
   * Get swarm health status
   */
  async getSwarmHealth(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/swarms/${id}/health`);
  }

  /**
   * Scale swarm up or down
   */
  async scaleSwarm(id: string, targetAgents: number): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/scale`, { targetAgents });
  }

  /**
   * Auto-scale swarm
   */
  async autoScaleSwarm(id: string, enabled: boolean): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/auto-scale`, { enabled });
  }

  /**
   * Optimize swarm topology
   */
  async optimizeSwarmTopology(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/optimize-topology`);
  }

  /**
   * Get swarm configuration
   */
  async getSwarmConfig(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/swarms/${id}/config`);
  }

  /**
   * Update swarm configuration
   */
  async updateSwarmConfig(id: string, config: any): Promise<ApiResponse<Swarm>> {
    return apiClient.put(`/swarms/${id}/config`, config);
  }

  /**
   * Get swarm logs
   */
  async getSwarmLogs(id: string, params?: { lines?: number; offset?: number; level?: string }): Promise<ApiResponse<string[]>> {
    return apiClient.get(`/swarms/${id}/logs`, params);
  }

  /**
   * Get swarm events
   */
  async getSwarmEvents(id: string, params?: { limit?: number; offset?: number; type?: string }): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/swarms/${id}/events`, params);
  }

  /**
   * Restart swarm
   */
  async restartSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/restart`);
  }

  /**
   * Pause swarm
   */
  async pauseSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/pause`);
  }

  /**
   * Resume swarm
   */
  async resumeSwarm(id: string): Promise<ApiResponse<Swarm>> {
    return apiClient.post(`/swarms/${id}/resume`);
  }

  /**
   * Get swarm performance data
   */
  async getSwarmPerformance(id: string, timeRange?: { start: Date; end: Date }): Promise<ApiResponse<any>> {
    const params = timeRange ? { timeRange } : undefined;
    return apiClient.get(`/swarms/${id}/performance`, params);
  }

  /**
   * Get swarm resource utilization
   */
  async getSwarmResourceUtilization(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/swarms/${id}/resources`);
  }

  /**
   * Execute task on swarm
   */
  async executeSwarmTask(id: string, task: any): Promise<ApiResponse<any>> {
    return apiClient.post(`/swarms/${id}/execute`, task);
  }
}

export const swarmsService = new SwarmsService();