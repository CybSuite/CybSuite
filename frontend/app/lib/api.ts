// API configuration and utilities for connecting to Django backend
import { HealthCheckResponse, TestResponse, SystemInfoResponse, HealthRootResponse } from '../types/HealthCheck';
import { NavigationResponse } from '../types/Navigation';
import { EntityRecord, EntitySchema, DataCountResponse, FieldSchema, FullSchemaResponse } from '../types/Data';

// Get the appropriate base URL based on environment
export function getApiBaseUrl(): string {
  // Server-side: use internal URL
  if (typeof window === 'undefined') {
    const serverUrl = process.env.DJANGO_API_URL || 'http://backend:8000';
    return serverUrl;
  }
  // Client-side: use public URL
  const clientUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return clientUrl;
}

const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiBaseUrl();
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      // Only include credentials on client-side
      ...(typeof window !== 'undefined' && { credentials: 'include' as RequestCredentials }),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        return {
          data: undefined,
          error: `Expected JSON response but got ${contentType || 'unknown'}. Response: ${text.substring(0, 100)}...`,
          status: response.status,
        };
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          data: undefined,
          error: data.message || `HTTP error! status: ${response.status}`,
          status: response.status,
        };
      }

      return {
        data,
        error: undefined,
        status: response.status,
      };
    } catch (error) {
      return {
        data: undefined,
        error: error instanceof Error ? error.message : 'Network error',
        status: 0,
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Create default instances for different environments
export const apiClient = new ApiClient(API_BASE_URL);

// Server-side API client factory (for use in Server Components, API routes, etc.)
export function createServerApiClient(cookies?: string): ApiClient {
  const serverUrl = process.env.DJANGO_API_URL || 'http://backend:8000';

  // Create a custom API client that includes cookies
  class ServerApiClient extends ApiClient {
    constructor(baseUrl: string, private cookieHeader?: string) {
      super(baseUrl);
    }

    protected async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
      const config: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          ...(this.cookieHeader && { 'Cookie': this.cookieHeader }),
        },
      };
      return super.request(endpoint, config);
    }
  }

  return new ServerApiClient(serverUrl, cookies);
}

// Convenience functions for common API calls (works in both client and server)
export const api = {
  // Navigation endpoints
  navigation: {
    getNavigation: () => apiClient.get<NavigationResponse>('/api/v1/nav_links/'),
  },

  // Schema endpoints
  schema: {
    getSchemaNames: () => apiClient.get<string[]>('/api/v1/schema/names/'),
    getFullSchema: () => apiClient.get<FullSchemaResponse>('/api/v1/schema/full/'),
    getEntitySchema: (entity: string) => apiClient.get<EntitySchema>(`/api/v1/schema/entity/${entity}/`),
    getEntityFieldNames: (entity: string) => apiClient.get<string[]>(`/api/v1/schema/entity/${entity}/names/`),
    getFieldDetails: (entity: string, field: string) => apiClient.get<FieldSchema>(`/api/v1/schema/field/${entity}/${field}/`),
    getCategories: () => apiClient.get<string[]>('/api/v1/schema/categories/'),
    getTags: () => apiClient.get<string[]>('/api/v1/schema/tags/'),
  },

  // Data endpoints
  data: {
    getEntityData: (entity: string, params?: { skip?: number; limit?: number; search?: string; filters?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.skip !== undefined) searchParams.set('skip', params.skip.toString());
      if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.filters) searchParams.set('filters', params.filters);

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/entity/${entity}/${queryString ? `?${queryString}` : ''}`;
      return apiClient.get<EntityRecord[]>(endpoint);
    },
    getEntityOptions: (entity: string, params?: { limit?: number; search?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/options/${entity}/${queryString ? `?${queryString}` : ''}`;
      return apiClient.get<Array<{ id: string | number; repr: string }>>(endpoint);
    },
    getRecord: (entity: string, id: string | number) => apiClient.get<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`),
    getRecordDetail: (entity: string, id: string | number) => apiClient.get<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`),
    createRecord: (entity: string, data: Partial<EntityRecord>) => apiClient.post<EntityRecord>(`/api/v1/data/record/${entity}/`, data),
    updateRecord: (entity: string, id: string | number, data: Partial<EntityRecord>) => apiClient.put<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`, data),
    patchRecord: (entity: string, id: string | number, data: Partial<EntityRecord>) => apiClient.patch<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`, data),
    deleteRecord: (entity: string, id: string | number) => apiClient.delete<{ success: boolean }>(`/api/v1/data/${entity}/${id}/`),
    getCount: (entity: string) => apiClient.get<DataCountResponse>(`/api/v1/data/count/${entity}/`),
    createNew: (entity: string, data: Partial<EntityRecord>) => apiClient.post<EntityRecord>(`/api/v1/data/new/${entity}/`, data),
    upsertRecord: (entity: string, data: Partial<EntityRecord>) => apiClient.post<EntityRecord>(`/api/v1/data/feed/${entity}/`, data),
    updateByData: (entity: string, data: Partial<EntityRecord> & { id: string | number }) => apiClient.post<EntityRecord>(`/api/v1/data/update/${entity}/`, data),
  },

  // Health app endpoints (development only)
  health: {
    root: () => apiClient.get<HealthRootResponse>('/health/'),
    check: () => apiClient.get<HealthCheckResponse>('/health/check/'),
    system: () => apiClient.get<SystemInfoResponse>('/health/system/'),
    test: {
      get: () => {
        if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_ENABLE_DEBUG) {
          return Promise.resolve({
            data: undefined,
            error: 'Health endpoints are disabled in production',
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.get<TestResponse>('/health/test/');
      },
      post: (data: any) => {
        if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_ENABLE_DEBUG) {
          return Promise.resolve({
            data: undefined,
            error: 'Health endpoints are disabled in production',
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.post<TestResponse>('/health/test/', data);
      },
    },
  },

  // Legacy endpoints (backward compatibility)
  legacy: {
    healthCheck: () => {
      // Try new endpoint first, fallback to legacy
      if (process.env.NODE_ENV === 'development') {
        return apiClient.get<HealthCheckResponse>('/api/health/check/');
      }
      return Promise.resolve({
        data: undefined,
        error: 'Health endpoints are only available in development',
        status: 404,
      } as ApiResponse<HealthCheckResponse>);
    },
    test: {
      get: () => {
        if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_ENABLE_DEBUG) {
          return Promise.resolve({
            data: undefined,
            error: 'Test endpoints are disabled in production',
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.get<TestResponse>('/test/');
      },
      post: (data: any) => {
        if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_ENABLE_DEBUG) {
          return Promise.resolve({
            data: undefined,
            error: 'Test endpoints are disabled in production',
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.post<TestResponse>('/test/', data);
      },
    },
  },
};


// Server-side API functions
export const serverApi = {
  // Navigation endpoints
  navigation: {
    getNavigation: (cookies?: string) => createServerApiClient(cookies).get<NavigationResponse>('/api/v1/nav_links/'),
  },

  // Schema endpoints
  schema: {
    getSchemaNames: (cookies?: string) => createServerApiClient(cookies).get<string[]>('/api/v1/schema/names/'),
    getFullSchema: (cookies?: string) => createServerApiClient(cookies).get<FullSchemaResponse>('/api/v1/schema/full/'),
    getEntitySchema: (entity: string, cookies?: string) => createServerApiClient(cookies).get<EntitySchema>(`/api/v1/schema/entity/${entity}/`),
    getEntityFieldNames: (entity: string, cookies?: string) => createServerApiClient(cookies).get<string[]>(`/api/v1/schema/entity/${entity}/names/`),
    getFieldDetails: (entity: string, field: string, cookies?: string) => createServerApiClient(cookies).get<FieldSchema>(`/api/v1/schema/field/${entity}/${field}/`),
    getCategories: (cookies?: string) => createServerApiClient(cookies).get<string[]>('/api/v1/schema/categories/'),
    getTags: (cookies?: string) => createServerApiClient(cookies).get<string[]>('/api/v1/schema/tags/'),
  },

  // Data endpoints
  data: {
    getEntityData: (entity: string, params?: { skip?: number; limit?: number; search?: string; filters?: string }, cookies?: string) => {
      const searchParams = new URLSearchParams();
      if (params?.skip !== undefined) searchParams.set('skip', params.skip.toString());
      if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
      if (params?.search) searchParams.set('search', params.search);
      if (params?.filters) searchParams.set('filters', params.filters);

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/entity/${entity}/${queryString ? `?${queryString}` : ''}`;
      return createServerApiClient(cookies).get<EntityRecord[]>(endpoint);
    },
    getRecord: (entity: string, id: string | number, cookies?: string) => createServerApiClient(cookies).get<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`),
    getRecordDetail: (entity: string, id: string | number, cookies?: string) => createServerApiClient(cookies).get<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`),
    createRecord: (entity: string, data: Partial<EntityRecord>, cookies?: string) => createServerApiClient(cookies).post<EntityRecord>(`/api/v1/data/record/${entity}/`, data),
    updateRecord: (entity: string, id: string | number, data: Partial<EntityRecord>, cookies?: string) => createServerApiClient(cookies).put<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`, data),
    patchRecord: (entity: string, id: string | number, data: Partial<EntityRecord>, cookies?: string) => createServerApiClient(cookies).patch<EntityRecord>(`/api/v1/data/record/${entity}/${id}/`, data),
    deleteRecord: (entity: string, id: string | number, cookies?: string) => createServerApiClient(cookies).delete<{ success: boolean }>(`/api/v1/data/${entity}/${id}/`),
    getCount: (entity: string, cookies?: string) => createServerApiClient(cookies).get<DataCountResponse>(`/api/v1/data/count/${entity}/`),
    createNew: (entity: string, data: Partial<EntityRecord>, cookies?: string) => createServerApiClient(cookies).post<EntityRecord>(`/api/v1/data/new/${entity}/`, data),
    upsertRecord: (entity: string, data: Partial<EntityRecord>, cookies?: string) => createServerApiClient(cookies).post<EntityRecord>(`/api/v1/data/feed/${entity}/`, data),
    updateByData: (entity: string, data: Partial<EntityRecord> & { id: string | number }, cookies?: string) => createServerApiClient(cookies).post<EntityRecord>(`/api/v1/data/update/${entity}/`, data),
  },

  // Health app endpoints
  health: {
    root: (cookies?: string) => createServerApiClient(cookies).get<HealthRootResponse>('/health/'),
    check: (cookies?: string) => createServerApiClient(cookies).get<HealthCheckResponse>('/health/check/'),
    system: (cookies?: string) => createServerApiClient(cookies).get<SystemInfoResponse>('/health/system/'),
    test: {
      get: (cookies?: string) => {
        if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_ENDPOINTS) {
          return Promise.resolve({
            data: undefined,
            error: 'Health endpoints are disabled in production',
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return createServerApiClient(cookies).get<TestResponse>('/health/test/');
      },
      post: (data: any, cookies?: string) => {
        if (process.env.NODE_ENV === 'production' && !process.env.ENABLE_TEST_ENDPOINTS) {
          return Promise.resolve({
            data: undefined,
            error: 'Health endpoints are disabled in production',
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return createServerApiClient(cookies).post<TestResponse>('/health/test/', data);
      },
    },
  },
};

export default apiClient;
