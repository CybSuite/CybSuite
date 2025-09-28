import { Suspense } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Ingestor } from '@/app/components/features/IngestorsList'
import IngestorsManager from '@/app/components/features/IngestorsManager'
import { api } from '@/app/lib/api'

// Server-side rendered page component
export default async function IngestorsPage() {
	// Fetch ingestors data on the server
	const ingestors = await getIngestorsData()

	return (
		<div className="container mx-auto p-8 space-y-8 max-w-none">
			{/* Page Header - Static, rendered on server */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight">Data Ingestors</h1>
				<p className="text-gray-600">
					Upload and process security data files through automated ingestors that extract and store intelligence.
				</p>
			</div>

			<div className="space-y-4">
				{/* Unified ingestor management with both controls and list */}
				<Suspense fallback={
					<div className="flex items-center justify-center h-64">
						<RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
						<span className="ml-2 text-lg">Loading ingestors...</span>
					</div>
				}>
					<IngestorsManager ingestors={ingestors} />
				</Suspense>
			</div>
		</div>
	)
}

// Server action to fetch ingestors
export async function getIngestorsData(): Promise<Ingestor[]> {
	try {
		const response = await api.ingestors.getIngestors()

		if (response.error) {
			console.error('Failed to load ingestors:', response.error)
			return []
		}

		return response.data || []
	} catch (error) {
		console.error('Error fetching ingestors:', error)
		return []
	}
}

// Error boundary component for server-side errors
export function ErrorBoundary({ error }: { error: Error }) {
	return (
		<div className="container mx-auto p-6">
			<Alert>
				<AlertCircle className="h-4 w-4" />
				<AlertDescription>
					Error loading ingestors page: {error.message}
				</AlertDescription>
			</Alert>
		</div>
	)
}
