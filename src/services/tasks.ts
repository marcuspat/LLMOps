/**
 * Tasks API Service
 */

import { apiClient } from './api';
import { Task, TaskStatus, TaskType, TaskPriority, ApiResponse, QueryParams } from '../types/frontend';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: TaskType[];
  assignedAgentId?: string;
  swarmId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  search?: string;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  assignedAgentId?: string;
  swarmId?: string;
  dependencies?: string[];
  estimatedDuration?: number;
  metadata?: Record<string, any>;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedAgentId?: string;
  dependencies?: string[];
  estimatedDuration?: number;
  metadata?: Record<string, any>;
}

export interface TaskExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  metrics: {
    duration: number;
    memoryUsed: number;
    cpuUsed: number;
  };
  artifacts: string[];
}

export class TasksService {
  /**
   * Get all tasks with optional filtering and pagination
   */
  async getTasks(params?: QueryParams & { filters?: TaskFilters }): Promise<ApiResponse<Task[]>> {
    return apiClient.get('/tasks', params);
  }

  /**
   * Get a specific task by ID
   */
  async getTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.get(`/tasks/${id}`);
  }

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskRequest): Promise<ApiResponse<Task>> {
    return apiClient.post('/tasks', data);
  }

  /**
   * Update an existing task
   */
  async updateTask(id: string, data: UpdateTaskRequest): Promise<ApiResponse<Task>> {
    return apiClient.put(`/tasks/${id}`, data);
  }

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete(`/tasks/${id}`);
  }

  /**
   * Start task execution
   */
  async startTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${id}/start`);
  }

  /**
   * Pause task execution
   */
  async pauseTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${id}/pause`);
  }

  /**
   * Resume task execution
   */
  async resumeTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${id}/resume`);
  }

  /**
   * Cancel task execution
   */
  async cancelTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${id}/cancel`);
  }

  /**
   * Get task execution logs
   */
  async getTaskLogs(id: string, params?: { lines?: number; offset?: number }): Promise<ApiResponse<string[]>> {
    return apiClient.get(`/tasks/${id}/logs`, params);
  }

  /**
   * Get task execution result
   */
  async getTaskResult(id: string): Promise<ApiResponse<TaskExecutionResult>> {
    return apiClient.get(`/tasks/${id}/result`);
  }

  /**
   * Assign task to agent
   */
  async assignTask(taskId: string, agentId: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${taskId}/assign`, { agentId });
  }

  /**
   * Unassign task from agent
   */
  async unassignTask(taskId: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${taskId}/unassign`);
  }

  /**
   * Get task dependencies
   */
  async getTaskDependencies(id: string): Promise<ApiResponse<Task[]>> {
    return apiClient.get(`/tasks/${id}/dependencies`);
  }

  /**
   * Add task dependencies
   */
  async addTaskDependencies(taskId: string, dependencyIds: string[]): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${taskId}/dependencies`, { dependencyIds });
  }

  /**
   * Remove task dependencies
   */
  async removeTaskDependencies(taskId: string, dependencyIds: string[]): Promise<ApiResponse<Task>> {
    return apiClient.delete(`/tasks/${taskId}/dependencies`, { data: { dependencyIds } });
  }

  /**
   * Get task status history
   */
  async getTaskStatusHistory(id: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/tasks/${id}/status-history`);
  }

  /**
   * Get task timeline
   */
  async getTaskTimeline(id: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/tasks/${id}/timeline`);
  }

  /**
   * Retry failed task
   */
  async retryTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${id}/retry`);
  }

  /**
   * Clone task
   */
  async cloneTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.post(`/tasks/${id}/clone`);
  }

  /**
   * Get task statistics
   */
  async getTaskStats(params?: {
    swarmId?: string;
    agentId?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<ApiResponse<any>> {
    return apiClient.get('/tasks/stats', params);
  }

  /**
   * Get task performance metrics
   */
  async getTaskPerformance(id: string): Promise<ApiResponse<any>> {
    return apiClient.get(`/tasks/${id}/performance`);
  }

  /**
   * Get task artifacts
   */
  async getTaskArtifacts(id: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/tasks/${id}/artifacts`);
  }

  /**
   * Download task artifact
   */
  async downloadTaskArtifact(taskId: string, artifactId: string): Promise<Blob> {
    const response = await apiClient.client.get(`/tasks/${taskId}/artifacts/${artifactId}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Get task comments
   */
  async getTaskComments(id: string): Promise<ApiResponse<any[]>> {
    return apiClient.get(`/tasks/${id}/comments`);
  }

  /**
   * Add task comment
   */
  async addTaskComment(taskId: string, comment: string): Promise<ApiResponse<any>> {
    return apiClient.post(`/tasks/${taskId}/comments`, { comment });
  }

  /**
   * Update task priority
   */
  async updateTaskPriority(taskId: string, priority: TaskPriority): Promise<ApiResponse<Task>> {
    return apiClient.patch(`/tasks/${taskId}/priority`, { priority });
  }

  /**
   * Batch update tasks
   */
  async batchUpdateTasks(taskIds: string[], updates: Partial<UpdateTaskRequest>): Promise<ApiResponse<Task[]>> {
    return apiClient.post('/tasks/batch-update', { taskIds, updates });
  }

  /**
   * Batch delete tasks
   */
  async batchDeleteTasks(taskIds: string[]): Promise<ApiResponse<void>> {
    return apiClient.delete('/tasks/batch-delete', { data: { taskIds } });
  }

  /**
   * Search tasks
   */
  async searchTasks(query: string, filters?: TaskFilters): Promise<ApiResponse<Task[]>> {
    return apiClient.get('/tasks/search', { search: query, filter: filters });
  }

  /**
   * Get task queue
   */
  async getTaskQueue(swarmId?: string): Promise<ApiResponse<Task[]>> {
    const params = swarmId ? { swarmId } : undefined;
    return apiClient.get('/tasks/queue', params);
  }

  /**
   * Get running tasks
   */
  async getRunningTasks(swarmId?: string): Promise<ApiResponse<Task[]>> {
    const params = swarmId ? { swarmId } : undefined;
    return apiClient.get('/tasks/running', params);
  }

  /**
   * Get failed tasks
   */
  async getFailedTasks(params?: {
    swarmId?: string;
    agentId?: string;
    dateRange?: { start: Date; end: Date };
  }): Promise<ApiResponse<Task[]>> {
    return apiClient.get('/tasks/failed', params);
  }
}

export const tasksService = new TasksService();