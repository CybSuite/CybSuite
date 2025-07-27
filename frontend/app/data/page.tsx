export default function DataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
        <p className="text-muted-foreground">
          Manage your security assessment data
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Hosts</h3>
          <p className="text-sm text-muted-foreground mt-2">
            View and manage discovered hosts
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Services</h3>
          <p className="text-sm text-muted-foreground mt-2">
            View and manage discovered services
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Observations</h3>
          <p className="text-sm text-muted-foreground mt-2">
            View security observations and findings
          </p>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Clients</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Manage client information
          </p>
        </div>
      </div>
    </div>
  );
}
