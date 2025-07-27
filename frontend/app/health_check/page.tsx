import ServerCheck from '../components/health_check/ServerCheck';
import ClientCheck from '../components/health_check/ClientCheck';
import ProductionStatus from '../components/health_check/ProductionStatus';

export default function HealthCheck() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            CybSuite - Frontend ↔ Backend Connection
          </h1>
          
          {isDevelopment && (
            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <h2 className="text-lg font-semibold mb-2">🔄 Development Mode</h2>
              <p className="text-sm text-gray-700">
                This page demonstrates both server-side (SSR) and client-side (CSR) data fetching 
                from the Django backend. These debug components are only visible in development mode.
              </p>
            </div>
          )}

          {/* Only show debug components in development */}
          {isDevelopment && (
            <>
              {/* Server-side data fetching */}
              <ServerCheck />

              {/* Client-side data fetching */}
              <ClientCheck />
            </>
          )}

          {/* Production content */}
          {!isDevelopment && (
            <ProductionStatus />
          )}

          {/* Configuration Info - always visible but filtered */}
          <div className="p-6 bg-green-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">⚙️ Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2">🌐 Environment</h3>
                <p><strong>Mode:</strong> {isDevelopment ? 'Development' : 'Production'}</p>
                {isDevelopment && (
                  <>
                    <p><strong>Frontend:</strong> http://localhost:3000</p>
                    <p><strong>Backend API:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1</p>
                    <p><strong>Django Admin:</strong> {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/admin</p>
                  </>
                )}
              </div>
              <div>
                <h3 className="font-semibold mb-2">📊 Features</h3>
                <p><strong>API Health Check:</strong> Available</p>
                {isDevelopment && (
                  <>
                    <p><strong>Debug Endpoints:</strong> Enabled</p>
                    <p><strong>Test Components:</strong> Visible</p>
                  </>
                )}
                {!isDevelopment && (
                  <p><strong>Production Mode:</strong> Secure</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
