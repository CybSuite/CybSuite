'use client';

import { useState } from 'react';
import { api } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { HealthCheckResponse, TestResponse, SystemInfoResponse } from '../../types/HealthCheck';

export default function ClientCheck() {
  const [testData, setTestData] = useState('');
  const [postResponse, setPostResponse] = useState<TestResponse | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfoResponse | null>(null);

  // Use the custom hook to fetch health check data on the client
  const { data: healthData, loading: healthLoading, error: healthError, refetch: refetchHealth } = useApi<HealthCheckResponse>(
    () => api.health.check(),
    []
  );

  const handleTestGet = async () => {
    const response = await api.health.test.get();
    if (response.data) {
      setTestData(JSON.stringify(response.data, null, 2));
    }
  };

  const handleTestPost = async () => {
    const response = await api.health.test.post({
      message: 'Hello from Client Component!',
      timestamp: new Date().toISOString(),
      source: 'Next.js Client Component'
    });
    if (response.data) {
      setPostResponse(response.data);
    }
  };

  const handleSystemInfo = async () => {
    const response = await api.health.system();
    if (response.data) {
      setSystemInfo(response.data);
    } else if (response.error) {
      console.error('System info error:', response.error);
    }
  };

  return (
    <div className="p-6 bg-blue-50 rounded-lg mb-6">
      <h2 className="text-xl font-semibold mb-4">🖥️ Client-Side Data (CSR) - Health App</h2>

      {/* Health Check Section */}
      <div className="mb-6 p-4 bg-white rounded">
        <h3 className="font-semibold mb-2">Health Check (Client-side)</h3>
        {healthLoading && <p className="text-blue-600">Loading...</p>}
        {healthError && (
          <div className="text-red-600">
            <p>❌ Error: {healthError}</p>
            <button
              onClick={refetchHealth}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}
        {healthData && (
          <div className="text-green-600">
            <p>✅ Status: {healthData.status}</p>
            <p>📝 Message: {healthData.message}</p>
            <p>🚀 Version: {healthData.version}</p>
            <p>🌍 Environment: {healthData.environment}</p>
            <p>⚙️ Dev Mode: {healthData.dev_mode ? 'Enabled' : 'Disabled'}</p>
            <p>🐛 Debug: {healthData.debug ? 'On' : 'Off'}</p>
          </div>
        )}
      </div>

      {/* Interactive API Test Section */}
      <div className="p-4 bg-white rounded mb-4">
        <h3 className="font-semibold mb-3">Interactive Health API Tests</h3>

        <div className="space-y-3">
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleTestGet}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              Test GET Request
            </button>

            <button
              onClick={handleTestPost}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Test POST Request
            </button>

            <button
              onClick={handleSystemInfo}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
            >
              Get System Info
            </button>
          </div>

          {testData && (
            <div className="p-3 bg-gray-100 rounded">
              <h4 className="font-semibold mb-2 text-sm">GET Response:</h4>
              <pre className="text-xs overflow-x-auto">{testData}</pre>
            </div>
          )}

          {postResponse && (
            <div className="p-3 bg-gray-100 rounded">
              <h4 className="font-semibold mb-2 text-sm">POST Response:</h4>
              <pre className="text-xs overflow-x-auto">{JSON.stringify(postResponse, null, 2)}</pre>
            </div>
          )}

          {systemInfo && (
            <div className="p-3 bg-gray-100 rounded">
              <h4 className="font-semibold mb-2 text-sm">System Information:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold">System:</p>
                  <p>Python version: {systemInfo.system.python_version}</p>
                </div>
                <div>
                  <p className="font-semibold">Django:</p>
                  <p>Version: {systemInfo.system.django_version}</p>
                  <p>Debug: {systemInfo.system.debug ? 'On' : 'Off'}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600 mt-4">
        ℹ️ This data is fetched from the Django Health app on the client after page load (hydration)
      </div>
    </div>
  );
}
