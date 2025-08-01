import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverApi } from '@/app/lib/api';
import ModelDataTable from '../../components/data/ModelDataTable';
import BackToSchemasButton from '../../components/schema/BackToSchemasButton';

interface ModelPageProps {
	params: Promise<{
		model: string;
	}>;
}

export default async function ModelPage({ params }: ModelPageProps) {
	const { model } = await params;

	// Get cookies from Next.js headers
	const cookieStore = await cookies();
	const cookieHeader = cookieStore.toString();

	// Check if the model exists by fetching schema names
	const schemaResponse = await serverApi.schema.getSchemaNames(cookieHeader);

	if (schemaResponse.error || !schemaResponse.data) {
		// If we can't fetch schema names, show an error
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-3xl font-bold tracking-tight text-red-600">
						Error Loading Schema
					</h1>
					<p className="text-muted-foreground">
						Failed to validate model existence: {schemaResponse.error}
					</p>
				</div>
			</div>
		);
	}

	// Check if the model exists in the available schema names
	const availableModels = schemaResponse.data;
	if (!availableModels.includes(model)) {
		// Model doesn't exist, trigger 404
		notFound();
	}

	// Fetch model schema and initial data for initial render
	const [modelSchemaResponse, initialDataResponse] = await Promise.all([
		serverApi.schema.getEntitySchema(model, cookieHeader),
		serverApi.data.getEntityData(model, { skip: 0, limit: 10 }, cookieHeader),
	]);

	return (
		<div className="space-y-6">
			<BackToSchemasButton />
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold tracking-tight capitalize">
						{model.replace(/_/g, ' ')} Management
					</h1>
					<p className="text-muted-foreground">
						Manage and view {model.replace(/_/g, ' ')} data
					</p>
				</div>
			</div>

			{modelSchemaResponse.error || initialDataResponse.error ? (
				<div className="rounded-lg border bg-card p-6">
					<h3 className="font-semibold mb-4 text-red-600">Error Loading Data</h3>
					<div className="space-y-3">
						{modelSchemaResponse.error && (
							<div className="bg-red-50 border border-red-200 rounded p-4">
								<p className="text-sm text-red-800">Schema Error: {modelSchemaResponse.error}</p>
							</div>
						)}
						{initialDataResponse.error && (
							<div className="bg-red-50 border border-red-200 rounded p-4">
								<p className="text-sm text-red-800">Data Error: {initialDataResponse.error}</p>
							</div>
						)}
					</div>
				</div>
			) : (
				<>
					{/* Dynamic Data Table */}
					<ModelDataTable
						model={model}
						initialData={initialDataResponse.data || []}
						initialSchema={modelSchemaResponse.data}
					/>
				</>
			)}
		</div>
	);
}
