interface SettingsSectionPageProps {
  params: {
    section: string;
  };
}

export default function SettingsSectionPage({ params }: SettingsSectionPageProps) {
  const { section } = params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight capitalize">
          {section.replace(/_/g, ' ')} Settings
        </h1>
        <p className="text-muted-foreground">
          Configure {section.replace(/_/g, ' ')} settings
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="font-semibold mb-4">Configuration</h3>
        <p className="text-sm text-muted-foreground mb-4">
          This page would display {section.replace(/_/g, ' ')} configuration options.
        </p>
        <div className="bg-muted rounded p-4">
          <p className="text-sm">Section: <code className="bg-background px-2 py-1 rounded">{section}</code></p>
        </div>
      </div>

      {section === 'databases' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-6">
            <h4 className="font-semibold">Database Connections</h4>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Manage database connections and settings
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
        </div>
      )}
    </div>
  );
}
