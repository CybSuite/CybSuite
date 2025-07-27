export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your CybSuite application
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Database Configuration</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Configure database connections and settings
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="text-sm">Primary Database</span>
              <span className="text-sm text-green-600">Connected</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="text-sm">Cache Database</span>
              <span className="text-sm text-green-600">Connected</span>
            </div>
          </div>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-4">Application Settings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            General application configuration
          </p>
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="text-sm">Debug Mode</span>
              <span className="text-sm text-blue-600">Enabled</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-muted rounded">
              <span className="text-sm">API Version</span>
              <span className="text-sm">v1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
