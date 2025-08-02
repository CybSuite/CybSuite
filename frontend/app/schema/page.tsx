import { cookies } from 'next/headers';
import { serverApi } from '../lib/api';
import { SchemaOverview } from '../components/schema';

export default async function DataPage() {
	// Get cookies for server-side API calls
	const cookieStore = await cookies();
	const cookieString = cookieStore.toString();

	try {
		// Fetch all data on the server side
		const [schemaResponse, categoriesResponse, tagsResponse] = await Promise.all([
			serverApi.schema.getFullSchema(cookieString),
			serverApi.schema.getCategories(cookieString),
			serverApi.schema.getTags(cookieString)
		]);

		// Check for errors in any of the responses
		if (schemaResponse.error) {
			throw new Error(`Failed to fetch schema: ${schemaResponse.error}`);
		}
		if (categoriesResponse.error) {
			throw new Error(`Failed to fetch categories: ${categoriesResponse.error}`);
		}
		if (tagsResponse.error) {
			throw new Error(`Failed to fetch tags: ${tagsResponse.error}`);
		}

		// Extract data from responses
		const entities = schemaResponse.data?.entities || [];
		const categories = categoriesResponse.data || [];
		const tags = tagsResponse.data || [];

		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
					<p className="text-muted-foreground">
						Explore the application schema
					</p>
				</div>

				<div className="space-y-8">
					<div>
						<h2 className="text-2xl font-semibold mb-4">Schema Overview</h2>
						<SchemaOverview
							entities={entities}
							categories={categories}
							tags={tags}
						/>
					</div>
				</div>
			</div>
		);
	} catch (error) {
		console.error('Error fetching schema data:', error);

		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
					<p className="text-muted-foreground">
						Explore the application schema
					</p>
				</div>

				<div className="space-y-8">
					<div className="rounded-lg border bg-card p-6">
						<div className="text-center text-red-500">
							<h3 className="text-lg font-semibold mb-2">Error Loading Schema</h3>
							<p>Failed to load schema data: {error instanceof Error ? error.message : 'Unknown error'}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}
}
