export default function Home() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to CybSuite</h1>
        <p className="text-muted-foreground">
          Professional cybersecurity testing and review platform
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Penetration Testing</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Comprehensive internal and external penetration testing tools
          </p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Configuration Review</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Automated configuration analysis for Linux and Microsoft 365
          </p>
        </div>
        
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold">Reporting</h3>
          <p className="text-sm text-muted-foreground mt-2">
            Generate professional security assessment reports
          </p>
        </div>
      </div>
    </div>
  );
}
