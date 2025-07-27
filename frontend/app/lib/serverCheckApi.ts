// Server-side data fetching utilities for Next.js App Router
import { createServerApiClient, ApiResponse, getApiBaseUrl } from './api';
import { HealthCheckResponse, TestResponse, SystemInfoResponse } from '../types/HealthCheck';

const baseUrl = getApiBaseUrl();

// Server-side data fetching functions
export async function fetchHealthCheck(): Promise<ApiResponse<HealthCheckResponse>> {
  const urls = [
    `${baseUrl}/health/check/`,
  ];

  for (const url of urls) {
    try {
      console.log('Trying server-side health check with URL:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      console.log('Response status:', response.status);
      console.log('Response content-type:', response.headers.get('content-type'));

      if (!response.ok) {
        const text = await response.text();
        console.error('Non-OK response:', text);
        continue; // Try next URL
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        continue; // Try next URL
      }

      const data = await response.json();
      console.log('Successful health check response:', data);

      return {
        data,
        error: undefined,
        status: response.status,
      };
    } catch (error) {
      console.error(`Failed to fetch health check from ${url}:`, error);
      // Continue to next URL
    }
  }

  // If all URLs failed
  return {
    data: undefined,
    error: 'Failed to connect to Django health check from server-side. Health app may not be enabled.',
    status: 0,
  };
}

export async function fetchTestData(): Promise<ApiResponse<TestResponse>> {
  // Check if test endpoints are enabled
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_TEST_ENDPOINTS !== 'true') {
    return {
      data: undefined,
      error: 'Test endpoints are disabled in production mode',
      status: 404,
    };
  }

  const urls = [
    `${baseUrl}/health/test/`,
  ];

  for (const url of urls) {
    try {
      console.log('Trying server-side test fetch with URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        continue;
      }

      const data = await response.json();
      return {
        data,
        error: undefined,
        status: response.status,
      };
    } catch (error) {
      console.error(`Failed to fetch test data from ${url}:`, error);
    }
  }

  return {
    data: undefined,
    error: 'Failed to connect to Django health test endpoint from server-side.',
    status: 0,
  };
}

export async function fetchSystemInfo(): Promise<ApiResponse<SystemInfoResponse>> {
  // Check if available in development
  if (process.env.NODE_ENV === 'production') {
    return {
      data: undefined,
      error: 'System info is only available in development mode',
      status: 404,
    };
  }

  const urls = [
    `${baseUrl}/health/system/`,
  ];

  for (const url of urls) {
    try {
      console.log('Trying server-side system info fetch with URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        continue;
      }

      const data = await response.json();
      return {
        data,
        error: undefined,
        status: response.status,
      };
    } catch (error) {
      console.error(`Failed to fetch system info from ${url}:`, error);
    }
  }

  return {
    data: undefined,
    error: 'Failed to connect to Django health system endpoint from server-side.',
    status: 0,
  };
}

export async function postTestData(data: any): Promise<ApiResponse<TestResponse>> {
  const client = createServerApiClient();
  return client.post<TestResponse>('/test/', data);
}

// Generic server-side fetch function
export async function serverFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const client = createServerApiClient();

  switch (options.method?.toUpperCase()) {
    case 'POST':
      return client.post<T>(endpoint, options.body ? JSON.parse(options.body as string) : undefined);
    case 'PUT':
      return client.put<T>(endpoint, options.body ? JSON.parse(options.body as string) : undefined);
    case 'PATCH':
      return client.patch<T>(endpoint, options.body ? JSON.parse(options.body as string) : undefined);
    case 'DELETE':
      return client.delete<T>(endpoint);
    default:
      return client.get<T>(endpoint);
  }
}

// Cache wrapper for server-side fetching (Next.js 13+ caching)
export async function cachedServerFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  cacheOptions: { revalidate?: number; tags?: string[] } = {}
): Promise<ApiResponse<T>> {
  const client = createServerApiClient();
  const baseUrl = process.env.DJANGO_API_URL || 'http://backend:8000';
  const url = `${baseUrl}${endpoint}`;

  const fetchOptions: RequestInit = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
    // Add Next.js caching options
    next: {
      revalidate: cacheOptions.revalidate,
      tags: cacheOptions.tags,
    },
  };

  try {
    const response = await fetch(url, fetchOptions);
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
