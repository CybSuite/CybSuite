// API configuration and utilities for connecting to Django backend
import {
  HealthCheckResponse,
  TestResponse,
  SystemInfoResponse,
  HealthRootResponse,
} from "../types/HealthCheck";
import { NavigationResponse } from "../types/Navigation";
import {
  EntityRecord,
  EntitySchema,
  DataCountResponse,
  FieldSchema,
  FullSchemaResponse,
} from "../types/Data";

// Get the appropriate base URL based on environment
export function getApiBaseUrl(): string {
  // Server-side: use internal URL
  if (typeof window === "undefined") {
    const serverUrl = process.env.DJANGO_API_URL || "http://backend:8000";
    return serverUrl;
  }
  // Client-side: use public URL
  const clientUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  return clientUrl;
}

const API_BASE_URL = getApiBaseUrl();

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  // Enhanced error fields for validation errors
  field_errors?: Record<string, string[]>;
  details?: string[] | string;
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
        "Content-Type": "application/json",
        ...options.headers,
      },
      // Only include credentials on client-side
      ...(typeof window !== "undefined" && {
        credentials: "include" as RequestCredentials,
      }),
      ...options,
    };

    try {
      const response = await fetch(url, config);

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text.substring(0, 200));
        return {
          data: undefined,
          error: `Expected JSON response but got ${
            contentType || "unknown"
          }. Response: ${text.substring(0, 100)}...`,
          status: response.status,
        };
      }

      const data = await response.json();

      if (!response.ok) {
        // Handle enhanced error responses from backend
        const errorResponse: ApiResponse<T> = {
          data: undefined,
          status: response.status,
        };

        // Check if backend returned structured validation errors
        if (data.field_errors) {
          errorResponse.field_errors = data.field_errors;
          errorResponse.error = data.error || "Validation failed";
        } else if (data.details) {
          errorResponse.details = data.details;
          errorResponse.error = data.error || "Request failed";
        } else {
          // Fallback to simple error message
          errorResponse.error =
            data.error ||
            data.message ||
            `HTTP error! status: ${response.status}`;
        }

        return errorResponse;
      }

      return {
        data,
        error: undefined,
        status: response.status,
      };
    } catch (error) {
      return {
        data: undefined,
        error: error instanceof Error ? error.message : "Network error",
        status: 0,
      };
    }
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }

  async deleteWithBody<T>(
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

// Create default instances for different environments
export const apiClient = new ApiClient(API_BASE_URL);

// Server-side API client factory (for use in Server Components, API routes, etc.)
export function createServerApiClient(cookies?: string): ApiClient {
  const serverUrl = process.env.DJANGO_API_URL || "http://backend:8000";

  // Create a custom API client that includes cookies
  class ServerApiClient extends ApiClient {
    constructor(baseUrl: string, private cookieHeader?: string) {
      super(baseUrl);
    }

    protected async request<T>(
      endpoint: string,
      options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
      const config: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          ...(this.cookieHeader && { Cookie: this.cookieHeader }),
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
    getNavigation: (cookies?: string) =>
      cookies
        ? createServerApiClient(cookies).get<NavigationResponse>(
            "/api/v1/nav_links/"
          )
        : apiClient.get<NavigationResponse>("/api/v1/nav_links/"),
  },

  // Schema endpoints
  schema: {
    getSchemaNames: () => apiClient.get<string[]>("/api/v1/schema/names/"),
    getFullSchema: () =>
      apiClient.get<FullSchemaResponse>("/api/v1/schema/full/"),
    getEntitySchema: (entity: string, flattenDict = false) => {
      const params = flattenDict ? "?flatten_dict=true" : "";
      return apiClient.get<EntitySchema>(
        `/api/v1/schema/entity/${entity}/${params}`
      );
    },
    getEntityFieldNames: (entity: string) =>
      apiClient.get<string[]>(`/api/v1/schema/entity/${entity}/names/`),
    getFieldDetails: (entity: string, field: string) =>
      apiClient.get<FieldSchema>(`/api/v1/schema/field/${entity}/${field}/`),
    getCategories: () => apiClient.get<string[]>("/api/v1/schema/categories/"),
    getTags: () => apiClient.get<string[]>("/api/v1/schema/tags/"),
  },

  // Form endpoints
  form: {
    getFormSchema: (entity: string) =>
      apiClient.get<any>(`/api/v1/form/schema/${entity}/`),
    getFieldOptions: (entity: string, fieldName: string) =>
      apiClient.get<any>(`/api/v1/form/options/${entity}/${fieldName}/`),
  },

  // Data endpoints
  data: {
    getEntityData: (
      entity: string,
      params?: {
        skip?: number;
        limit?: number;
        search?: string;
        filters?: string;
        flattenDict?: boolean;
        // Server-side table management
        sortBy?: string;
        sortDesc?: boolean;
        serverSearch?: string;
        serverFilters?: string;
        isObservation?: boolean;
      }
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.skip !== undefined)
        searchParams.set("skip", params.skip.toString());
      if (params?.limit !== undefined)
        searchParams.set("limit", params.limit.toString());
      if (params?.search) searchParams.set("search", params.search);
      if (params?.filters) searchParams.set("filters", params.filters);
      if (params?.flattenDict) searchParams.set("flatten_dict", "true");

      // Server-side table management parameters
      if (params?.sortBy) searchParams.set("sort_by", params.sortBy);
      if (params?.sortDesc !== undefined)
        searchParams.set("sort_desc", params.sortDesc.toString());
      if (params?.serverSearch)
        searchParams.set("server_search", params.serverSearch);
      if (params?.serverFilters)
        searchParams.set("server_filters", params.serverFilters);
      if (params?.isObservation)
        searchParams.set("isObservation", params.isObservation.toString());

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/entity/${entity}/${
        queryString ? `?${queryString}` : ""
      }`;
      return apiClient.get<
        | {
            data: EntityRecord[];
            pagination?: {
              total: number;
              filtered: number;
              skip: number;
              limit: number | null;
              has_next: boolean;
              has_prev: boolean;
            };
          }
        | EntityRecord[]
      >(endpoint);
    },
    getEntityOptions: (
      entity: string,
      params?: { limit?: number; search?: string }
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.limit !== undefined)
        searchParams.set("limit", params.limit.toString());
      if (params?.search) searchParams.set("search", params.search);

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/options/${entity}/${
        queryString ? `?${queryString}` : ""
      }`;
      return apiClient.get<Array<{ id: string | number; repr: string }>>(
        endpoint
      );
    },
    getRecord: (entity: string, id: string | number, flattenDict = false) => {
      const params = flattenDict ? "?flatten_dict=true" : "";
      return apiClient.get<EntityRecord>(
        `/api/v1/data/record/${entity}/${id}/${params}`
      );
    },
    getRecordDetail: (
      entity: string,
      id: string | number,
      flattenDict = false
    ) => {
      const params = flattenDict ? "?flatten_dict=true" : "";
      return apiClient.get<EntityRecord>(
        `/api/v1/data/record/${entity}/${id}/${params}`
      );
    },
    getRelatedRecords: (entity: string, id: string | number) => {
      return apiClient.get<{
        relatedData: Record<string, EntityRecord[]>;
        relatedSchemas: Record<string, EntitySchema>;
      }>(`/api/v1/data/related/${entity}/${id}/`);
    },
    createRecord: (entity: string, data: Partial<EntityRecord>) =>
      apiClient.post<EntityRecord>(`/api/v1/data/record/${entity}/`, data),
    updateRecord: (
      entity: string,
      id: string | number,
      data: Partial<EntityRecord>
    ) => apiClient.put<EntityRecord>(`/api/v1/data/update/${entity}/`, data),
    patchRecord: (
      entity: string,
      id: string | number,
      data: Partial<EntityRecord>
    ) => apiClient.patch<EntityRecord>(`/api/v1/data/record/${entity}/`, data),
    deleteRecord: (entity: string, id: string | number) =>
      apiClient.delete<{ success: boolean }>(`/api/v1/data/${entity}/${id}/`),
    bulkDeleteRecords: (entity: string, ids: (string | number)[]) =>
      apiClient.deleteWithBody<{
        status: string;
        deleted_count: number;
        failed_count: number;
        deleted_ids: (string | number)[];
        failed_ids: (string | number)[];
        errors: string[];
        message: string;
      }>(`/api/v1/data/bulk-delete/${entity}/`, { ids }),
    bulkUpdateRecords: (
      entity: string,
      ids: (string | number)[],
      data: Partial<EntityRecord>
    ) =>
      apiClient.post<{
        status: string;
        updated_count: number;
        failed_count: number;
        updated_ids: (string | number)[];
        failed_ids: (string | number)[];
        errors: string[];
        updated_fields: string[];
        message: string;
      }>(`/api/v1/data/bulk-update/${entity}/`, { ids, data }),
    getCount: (entity: string) =>
      apiClient.get<DataCountResponse>(`/api/v1/data/count/${entity}/`),
    createNew: (entity: string, data: Partial<EntityRecord>) =>
      apiClient.post<EntityRecord>(`/api/v1/data/new/${entity}/`, data),
    upsertRecord: (entity: string, data: Partial<EntityRecord>) =>
      apiClient.post<EntityRecord>(`/api/v1/data/feed/${entity}/`, data),
    updateByData: (
      entity: string,
      data: Partial<EntityRecord> & { id: string | number }
    ) => apiClient.post<EntityRecord>(`/api/v1/data/update/${entity}/`, data),
  },

  // Health app endpoints (development only)
  health: {
    root: () => apiClient.get<HealthRootResponse>("/health/"),
    check: () => apiClient.get<HealthCheckResponse>("/health/check/"),
    system: () => apiClient.get<SystemInfoResponse>("/health/system/"),
    test: {
      get: () => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.NEXT_PUBLIC_ENABLE_DEBUG
        ) {
          return Promise.resolve({
            data: undefined,
            error: "Health endpoints are disabled in production",
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.get<TestResponse>("/health/test/");
      },
      post: (data: any) => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.NEXT_PUBLIC_ENABLE_DEBUG
        ) {
          return Promise.resolve({
            data: undefined,
            error: "Health endpoints are disabled in production",
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.post<TestResponse>("/health/test/", data);
      },
    },
  },

  // Report endpoints
  reports: {
    getReporters: () =>
      apiClient.get<Array<{ name: string }>>("/api/v1/plugins/reporters/"),
    getReportData: (reporterName: string, params?: { latest_run?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.latest_run !== undefined)
        searchParams.set("latest_run", params.latest_run.toString());

      const queryString = searchParams.toString();
      return apiClient.get<any>(
        `/api/v1/report/data/${reporterName}/${
          queryString ? `?${queryString}` : ""
        }`
      );
    },
    downloadReport: (
      reporterName: string,
      params?: { latest_run?: number }
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.latest_run !== undefined)
        searchParams.set("latest_run", params.latest_run.toString());

      const queryString = searchParams.toString();

      // Return the download URL instead of making the request here
      return `${API_BASE_URL}/api/v1/report/${reporterName}/${
        queryString ? `?${queryString}` : ""
      }`;
    },
  },

  // Scanner endpoints
  scanners: {
    getScanners: () =>
      apiClient.get<
        Array<{ name: string; description: string | null; tags: string[] }>
      >("/api/v1/plugins/scanners/"),
    startScan: (scannerName: string) =>
      apiClient.post<{ status: string; scanner_name: string; message: string }>(
        "/api/v1/scan/",
        { scanner_name: scannerName }
      ),
    startMultiScan: (scannerNames: string[]) =>
      apiClient.post<{
        status: string;
        scanner_names: string[];
        total_scanners: number;
        message: string;
      }>("/api/v1/scan/", { scanner_names: scannerNames }),
    getScanStatus: () =>
      apiClient.get<{
        status: "idle" | "running" | "completed" | "failed";
        scanner_name: string | null;
        scanner_names?: string[];
        start_time: string | null;
        end_time: string | null;
        progress: number;
        message: string;
        results: any | null;
        error: string | null;
        multi_scan?: boolean;
        current_scanner?: string;
        scanned_scanners?: string[];
      }>("/api/v1/scan/status/"),
  },

  // Legacy endpoints (backward compatibility)
  legacy: {
    healthCheck: () => {
      // Try new endpoint first, fallback to legacy
      if (process.env.NODE_ENV === "development") {
        return apiClient.get<HealthCheckResponse>("/api/health/check/");
      }
      return Promise.resolve({
        data: undefined,
        error: "Health endpoints are only available in development",
        status: 404,
      } as ApiResponse<HealthCheckResponse>);
    },
    test: {
      get: () => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.NEXT_PUBLIC_ENABLE_DEBUG
        ) {
          return Promise.resolve({
            data: undefined,
            error: "Test endpoints are disabled in production",
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.get<TestResponse>("/test/");
      },
      post: (data: any) => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.NEXT_PUBLIC_ENABLE_DEBUG
        ) {
          return Promise.resolve({
            data: undefined,
            error: "Test endpoints are disabled in production",
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return apiClient.post<TestResponse>("/test/", data);
      },
    },
  },
};

// Server-side API functions
export const serverApi = {
  // Navigation endpoints
  navigation: {
    getNavigation: (cookies?: string) =>
      createServerApiClient(cookies).get<NavigationResponse>(
        "/api/v1/nav_links/"
      ),
  },

  // Schema endpoints
  schema: {
    getSchemaNames: (cookies?: string) =>
      createServerApiClient(cookies).get<string[]>("/api/v1/schema/names/"),
    getFullSchema: (cookies?: string) =>
      createServerApiClient(cookies).get<FullSchemaResponse>(
        "/api/v1/schema/full/"
      ),
    getEntitySchema: (
      entity: string,
      cookies?: string,
      flattenDict?: boolean,
      isObservation?: boolean
    ) => {
      const params = new URLSearchParams();
      if (flattenDict) params.set("flatten_dict", "true");
      if (isObservation) params.set("isObservation", "true");
      return createServerApiClient(cookies).get<EntitySchema>(
        `/api/v1/schema/entity/${entity}/${
          params.toString ? `?${params.toString()}` : ""
        }`
      );
    },
    getEntityFieldNames: (entity: string, cookies?: string) =>
      createServerApiClient(cookies).get<string[]>(
        `/api/v1/schema/entity/${entity}/names/`
      ),
    getFieldDetails: (entity: string, field: string, cookies?: string) =>
      createServerApiClient(cookies).get<FieldSchema>(
        `/api/v1/schema/field/${entity}/${field}/`
      ),
    getCategories: (cookies?: string) =>
      createServerApiClient(cookies).get<string[]>(
        "/api/v1/schema/categories/"
      ),
    getTags: (cookies?: string) =>
      createServerApiClient(cookies).get<string[]>("/api/v1/schema/tags/"),
  },

  // Form endpoints
  form: {
    getFormSchema: (entity: string, cookies?: string) =>
      createServerApiClient(cookies).get<any>(`/api/v1/form/schema/${entity}/`),
    getFieldOptions: (entity: string, fieldName: string, cookies?: string) =>
      createServerApiClient(cookies).get<any>(
        `/api/v1/form/options/${entity}/${fieldName}/`
      ),
  },

  // Data endpoints
  data: {
    getEntityData: (
      entity: string,
      params?: {
        skip?: number;
        limit?: number;
        search?: string;
        filters?: string;
        flattenDict?: boolean;
        isObservation?: boolean;
      },
      cookies?: string
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.skip !== undefined)
        searchParams.set("skip", params.skip.toString());
      if (params?.limit !== undefined)
        searchParams.set("limit", params.limit.toString());
      if (params?.search) searchParams.set("search", params.search);
      if (params?.filters) searchParams.set("filters", params.filters);
      if (params?.flattenDict) searchParams.set("flatten_dict", "true");
      if (params?.isObservation) searchParams.set("isObservation", "true");

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/entity/${entity}/${
        queryString ? `?${queryString}` : ""
      }`;
      return createServerApiClient(cookies).get<
        | {
            data: EntityRecord[];
            pagination?: {
              total: number;
              filtered: number;
              skip: number;
              limit: number | null;
              has_next: boolean;
              has_prev: boolean;
            };
          }
        | EntityRecord[]
      >(endpoint);
    },
    getEntityOptions: (
      entity: string,
      params?: { limit?: number; search?: string },
      cookies?: string
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.limit !== undefined)
        searchParams.set("limit", params.limit.toString());
      if (params?.search) searchParams.set("search", params.search);

      const queryString = searchParams.toString();
      const endpoint = `/api/v1/data/options/${entity}/${
        queryString ? `?${queryString}` : ""
      }`;
      return createServerApiClient(cookies).get<
        Array<{ id: string | number; repr: string }>
      >(endpoint);
    },
    getRecord: (
      entity: string,
      id: string | number,
      cookies?: string,
      flattenDict = false
    ) => {
      const params = flattenDict ? "?flatten_dict=true" : "";
      return createServerApiClient(cookies).get<EntityRecord>(
        `/api/v1/data/record/${entity}/${id}/${params}`
      );
    },
    getRecordDetail: (
      entity: string,
      id: string | number,
      cookies?: string,
      flattenDict = false,
      isObservation?: boolean
    ) => {
      const params = new URLSearchParams();
      if (flattenDict) params.set("flatten_dict", "true");
      if (isObservation) params.set("isObservation", "true");

      return createServerApiClient(cookies).get<EntityRecord>(
        `/api/v1/data/record/${entity}/${id}/${
          params.toString() ? `?${params.toString()}` : ""
        }`
      );
    },
    getRelatedRecords: (
      entity: string,
      id: string | number,
      cookies?: string,
      flatten_dict?: boolean,
      isObservation?: boolean
    ) => {
      const params = new URLSearchParams();
      if (flatten_dict) params.set("flatten_dict", "true");
      if (isObservation) params.set("isObservation", "true");

      return createServerApiClient(cookies).get<{
        relatedData: Record<string, EntityRecord[]>;
        relatedSchemas: Record<string, EntitySchema>;
      }>(
        `/api/v1/data/related/${entity}/${id}/` +
          (params.toString() ? `?${params.toString()}` : "")
      );
    },
    createRecord: (
      entity: string,
      data: Partial<EntityRecord>,
      cookies?: string
    ) =>
      createServerApiClient(cookies).post<EntityRecord>(
        `/api/v1/data/record/${entity}/`,
        data
      ),
    updateRecord: (
      entity: string,
      id: string | number,
      data: Partial<EntityRecord>,
      cookies?: string
    ) =>
      createServerApiClient(cookies).put<EntityRecord>(
        `/api/v1/data/record/${entity}/${id}/`,
        data
      ),
    patchRecord: (
      entity: string,
      id: string | number,
      data: Partial<EntityRecord>,
      cookies?: string
    ) =>
      createServerApiClient(cookies).patch<EntityRecord>(
        `/api/v1/data/record/${entity}/${id}/`,
        data
      ),
    deleteRecord: (entity: string, id: string | number, cookies?: string) =>
      createServerApiClient(cookies).delete<{ success: boolean }>(
        `/api/v1/data/${entity}/${id}/`
      ),
    getCount: (entity: string, cookies?: string) =>
      createServerApiClient(cookies).get<DataCountResponse>(
        `/api/v1/data/count/${entity}/`
      ),
    createNew: (
      entity: string,
      data: Partial<EntityRecord>,
      cookies?: string
    ) =>
      createServerApiClient(cookies).post<EntityRecord>(
        `/api/v1/data/new/${entity}/`,
        data
      ),
    upsertRecord: (
      entity: string,
      data: Partial<EntityRecord>,
      cookies?: string
    ) =>
      createServerApiClient(cookies).post<EntityRecord>(
        `/api/v1/data/feed/${entity}/`,
        data
      ),
    updateByData: (
      entity: string,
      data: Partial<EntityRecord> & { id: string | number },
      cookies?: string
    ) =>
      createServerApiClient(cookies).post<EntityRecord>(
        `/api/v1/data/update/${entity}/`,
        data
      ),
  },

  // Health app endpoints
  health: {
    root: (cookies?: string) =>
      createServerApiClient(cookies).get<HealthRootResponse>("/health/"),
    check: (cookies?: string) =>
      createServerApiClient(cookies).get<HealthCheckResponse>("/health/check/"),
    system: (cookies?: string) =>
      createServerApiClient(cookies).get<SystemInfoResponse>("/health/system/"),
    test: {
      get: (cookies?: string) => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.ENABLE_TEST_ENDPOINTS
        ) {
          return Promise.resolve({
            data: undefined,
            error: "Health endpoints are disabled in production",
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return createServerApiClient(cookies).get<TestResponse>(
          "/health/test/"
        );
      },
      post: (data: any, cookies?: string) => {
        if (
          process.env.NODE_ENV === "production" &&
          !process.env.ENABLE_TEST_ENDPOINTS
        ) {
          return Promise.resolve({
            data: undefined,
            error: "Health endpoints are disabled in production",
            status: 404,
          } as ApiResponse<TestResponse>);
        }
        return createServerApiClient(cookies).post<TestResponse>(
          "/health/test/",
          data
        );
      },
    },
  },

  // Report endpoints
  reports: {
    getReporters: (cookies?: string) =>
      createServerApiClient(cookies).get<Array<{ name: string }>>(
        "/api/v1/plugins/reporters/"
      ),
    getReportData: (
      reporterName: string,
      params?: { latest_run?: number },
      cookies?: string
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.latest_run !== undefined)
        searchParams.set("latest_run", params.latest_run.toString());

      const queryString = searchParams.toString();
      return createServerApiClient(cookies).get<any>(
        `/api/v1/report/data/${reporterName}/${
          queryString ? `?${queryString}` : ""
        }`
      );
    },
    getDownloadUrl: (
      reporterName: string,
      params?: { latest_run?: number }
    ) => {
      const searchParams = new URLSearchParams();
      if (params?.latest_run !== undefined)
        searchParams.set("latest_run", params.latest_run.toString());

      const queryString = searchParams.toString();
      const serverUrl = process.env.DJANGO_API_URL || "http://backend:8000";

      return `${serverUrl}/api/v1/report/${reporterName}/${
        queryString ? `?${queryString}` : ""
      }`;
    },
  },

  // Scanner endpoints
  scanners: {
    getScanners: (cookies?: string) =>
      createServerApiClient(cookies).get<
        Array<{ name: string; description: string }>
      >("/api/v1/plugins/scanners/"),
    startScan: (scannerName: string, cookies?: string) =>
      createServerApiClient(cookies).post<{
        status: string;
        scanner_name: string;
        message: string;
      }>("/api/v1/scan/", { scanner_name: scannerName }),
    getScanStatus: (cookies?: string) =>
      createServerApiClient(cookies).get<{
        status: "idle" | "running" | "completed" | "failed";
        scanner_name: string | null;
        start_time: string | null;
        end_time: string | null;
        progress: number;
        message: string;
        results: any | null;
        error: string | null;
      }>("/api/v1/scan/status/"),
  },
};

export default apiClient;
