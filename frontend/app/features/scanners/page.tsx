import { Suspense } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScannersList, getScannersData } from './ScannersList'
import ScannerControlsClient from './ScannerControlsClient'

// Server-side rendered page component
export default async function ScannersPage() {
	// Fetch scanners data on the server
	const scanners = await getScannersData()

	return (
		<div className="container mx-auto p-6 space-y-6">
			{/* Page Header - Static, rendered on server */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Security Scanners</h1>
				<p className="text-gray-600">
					Manage and run security scanning tools to discover vulnerabilities and gather intelligence.
				</p>
			</div>

			<div className="space-y-2 container max-w-5xl mx-auto">
				{/* Client component for dynamic functionality */}
				<Suspense fallback={
					<div className="flex items-center justify-center h-64">
						<RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
						<span className="ml-2 text-lg">Loading scanner controls...</span>
					</div>
				}>
					<ScannerControlsClient scanners={scanners} />
				</Suspense>

				{/* Server-rendered scanners list */}
				<Suspense fallback={
					<div className="flex items-center justify-center h-32">
						<RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
						<span className="ml-2">Loading scanners list...</span>
					</div>
				}>
					<ScannersList scanners={scanners} />
				</Suspense>
			</div>
		</div>
	)
}

// Error boundary component for server-side errors
export function ErrorBoundary({ error }: { error: Error }) {
	return (
		<div className="container mx-auto p-6">
			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					Error loading scanners page: {error.message}
				</AlertDescription>
			</Alert>
		</div>
	)
}
