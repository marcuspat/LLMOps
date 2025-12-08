/**
 * API Client Service for Turbo Flow Backend Communication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, QueryParams } from '../types/frontend';

export class ApiClient {
  private client: AxiosInstance;
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Handle unauthorized access
          this.clearToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  // Generic HTTP methods
  async get<T>(endpoint: string, params?: QueryParams): Promise<ApiResponse<T>> {
    const config: AxiosRequestConfig = {};
    if (params) {
      config.params = this.buildQueryParams(params);
    }

    try {
      const response = await this.client.get<ApiResponse<T>>(endpoint, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async post<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async put<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async patch<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.patch<ApiResponse<T>>(endpoint, data, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(endpoint, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // File upload
  async upload<T>(endpoint: string, file: File, onProgress?: (progress: number) => void): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await this.client.post<ApiResponse<T>>(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      });
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // Streaming response
  async *stream(endpoint: string, data?: any): AsyncGenerator<any, void, unknown> {
    try {
      const response = await this.client.post(endpoint, data, {
        responseType: 'stream',
        adapter: 'fetch' as any, // Use fetch adapter for streaming
      });

      if (!response.body) {
        throw new Error('Streaming not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              yield JSON.parse(line);
            } catch {
              yield line;
            }
          }
        }
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  private buildQueryParams(params: QueryParams): string {
    const searchParams = new URLSearchParams();

    // Add pagination params
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());

    // Add sort params
    if (params.sort) {
      searchParams.append('sort', params.sort.field);
      searchParams.append('order', params.sort.direction);
    }

    // Add search
    if (params.search) searchParams.append('search', params.search);

    // Add filters
    if (params.filter) {
      Object.entries(params.filter).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(`${key}[]`, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      });
    }

    return searchParams.toString();
  }

  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.error?.message || error.response.data?.message || 'An error occurred';
      return new Error(`API Error (${error.response.status}): ${message}`);
    } else if (error.request) {
      // Network error
      return new Error('Network error: Unable to connect to the server');
    } else {
      // Other error
      return new Error(`Error: ${error.message}`);
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export individual service modules for different API endpoints
export * from './agents';
export * from './swarms';
export * from './tasks';
export * from './github';
export * from './security';
export * from './performance';
export * from './auth';
export * from './collaboration';
export * from './configuration';
export * from './notifications';