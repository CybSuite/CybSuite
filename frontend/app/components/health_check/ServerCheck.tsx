// Server Component example - fetches data on the server
import { fetchHealthCheck, fetchTestData, fetchSystemInfo } from '../../lib/serverCheckApi';

export default async function ServerCheck() {
  // These API calls happen on the server during build/request time
  const healthResponse = await fetchHealthCheck();
  const testResponse = await fetchTestData();
  const systemResponse = await fetchSystemInfo();

  return (
    <div className="p-6 bg-purple-50 rounded-lg mb-6">
      <h2 className="text-xl font-semibold mb-4">🔧 Server-Side Data (SSR) - Health App</h2>
      <div className="space-y-4">
        
        {/* Health Check Data */}
        <div className="p-4 bg-white rounded">
          <h3 className="font-semibold mb-2">Health Check (Server-side)</h3>
          {healthResponse.error ? (
            <p className="text-red-600">❌ Error: {healthResponse.error}</p>
          ) : (
            <div className="text-green-600">
              <p>✅ Status: {healthResponse.data?.status}</p>
              <p>📝 Message: {healthResponse.data?.message}</p>
              <p>🚀 Version: {healthResponse.data?.version}</p>
              <p>🌍 Environment: {healthResponse.data?.environment}</p>
              <p>🐍 Python: {healthResponse.data?.system_info?.python_version?.split(' ')[0]}</p>
              <p>🌐 Django: {healthResponse.data?.system_info?.django_version}</p>
              <p>💻 Platform: {healthResponse.data?.system_info?.platform}</p>
              <p>⚙️ Dev Mode: {healthResponse.data?.dev_mode ? 'Enabled' : 'Disabled'}</p>
            </div>
          )}
        </div>

        {/* Test Data */}
        <div className="p-4 bg-white rounded">
          <h3 className="font-semibold mb-2">Test Data (Server-side)</h3>
          {testResponse.error ? (
            <p className="text-red-600">❌ Error: {testResponse.error}</p>
          ) : (
            <div className="text-blue-600">
              <p>📡 Method: {testResponse.data?.method}</p>
              <p>💬 Message: {testResponse.data?.message}</p>
              {testResponse.data?.data && (
                <div className="mt-2">
                  <p className="text-sm">📅 Timestamp: {testResponse.data.data.timestamp}</p>
                  <p className="text-sm">🖥️ Server: {testResponse.data.data.server}</p>
                  <p className="text-sm">🌍 Environment: {testResponse.data.environment || 'development'}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Info */}
        <div className="p-4 bg-white rounded">
          <h3 className="font-semibold mb-2">System Information (Server-side)</h3>
          {systemResponse.error ? (
            <p className="text-yellow-600">⚠️ {systemResponse.error}</p>
          ) : (
            <div className="text-indigo-600">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold">System:</p>
                  <p>Python: {systemResponse.data?.system?.python_version}</p>
                </div>
                <div>
                  <p className="font-semibold">Django:</p>
                  <p>Version: {systemResponse.data?.system?.django_version}</p>
                  <p>Debug: {systemResponse.data?.system?.debug ? 'On' : 'Off'}</p>
                  <p>Dev Mode: {systemResponse.data?.system?.dev_mode ? 'On' : 'Off'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-600 mt-4">
          ℹ️ This data was fetched from the Django Health app during server-side rendering
        </div>
      </div>
    </div>
  );
}
