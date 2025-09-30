import { Suspense } from 'react'
import { RefreshCw } from 'lucide-react'
import { Scanner } from '@/app/components/features/ScannersList'
import ScannersManager from '@/app/components/features/ScannersManager'
import { api } from '@/app/lib/api'

// Server-side rendered page component
export default async function ScannersPage() {
	// Fetch scanners data on the server
	const scanners = await getScannersData()

	return (
		<div className="container mx-auto p-8 space-y-8 max-w-none">
			{/* Page Header - Static, rendered on server */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Security Scanners</h1>
				<p className="text-gray-600">
					Manage and run security scanning tools to discover vulnerabilities and gather intelligence.
				</p>
			</div>

			<div className="space-y-4">
				{/* Unified scanner management with both controls and list */}
				<Suspense fallback={
					<div className="flex items-center justify-center h-64">
						<RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
						<span className="ml-2 text-lg">Loading scanners...</span>
					</div>
				}>
					<ScannersManager scanners={scanners} />
				</Suspense>
			</div>
		</div>
	)
}

// Server action to fetch scanners
async function getScannersData(): Promise<Scanner[]> {
	try {
		const response = await api.scanners.getScanners()

		if (response.error) {
			console.error('Failed to load scanners:', response.error)
			return []
		}

		return response.data || []
	} catch (error) {
		console.error('Error fetching scanners:', error)
		return []
	}
}
