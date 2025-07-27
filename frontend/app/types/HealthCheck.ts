// Type definitions for API responses

export interface HealthCheckResponse {
  status: string;
  message: string;
  version: string;
  environment: string;
  timestamp: string;
  system_info: {
    python_version: string;
    django_version: string;
    platform: string;
    architecture: string;
  };
  dev_mode: boolean;
  debug: boolean;
}

export interface SystemInfoResponse {
  system: {
    python_version: string;
    django_version: string;
    environment: string;
    debug: boolean;
    dev_mode: boolean;
  },
  api: {
    test_endpoints_enabled: boolean;
    cors_allowed_origins: string[];
    allowed_hosts: string[];
  }
}

export interface TestResponse {
  method: string;
  message: string;
  data?: {
    timestamp: string;
    server: string;
    user_agent?: string;
    remote_addr?: string;
  };
  received_data?: any;
  environment?: string;
  timestamp?: string;
  content_type?: string;
  deprecated?: boolean;
  new_endpoint?: string;
}

export interface ApiRootResponse {
  message: string;
  environment: string;
  endpoints: {
    [key: string]: string;
  };
  note?: string;
}

export interface HealthRootResponse {
  message: string;
  environment: string;
  endpoints: {
    health: string;
    system: string;
    test: string;
  };
  warning: string;
  timestamp: string;
}
