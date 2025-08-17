import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverApi } from '@/app/lib/api';
import ModelDataTable from '../../components/data/ModelDataTable';

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

	// Fetch model schema, initial data, and form schema for initial render
	const [modelSchemaResponse, initialDataResponse, formSchemaResponse] = await Promise.all([
		serverApi.schema.getEntitySchema(model, cookieHeader),
		serverApi.data.getEntityData(model, { skip: 0, limit: 10 }, cookieHeader),
		serverApi.form.getFormSchema(model, cookieHeader),
	]);

	// Pre-load field options for relation and enum fields if form schema is available
	let preloadedFieldOptions = {};
	if (formSchemaResponse.data && !formSchemaResponse.error) {
		const optionsToLoad = formSchemaResponse.data.fields.filter(
			(field: any) => field.type === 'relation' || field.type === 'enum'
		);

		if (optionsToLoad.length > 0) {
			const optionsPromises = optionsToLoad.map(async (field: any) => {
				try {
					let optionsResponse;

					// For relation fields, use the data options endpoint with the related entity
					if (field.type === 'relation' && field.relation_entity) {
						optionsResponse = await serverApi.data.getEntityOptions(field.relation_entity, undefined, cookieHeader);
						if (optionsResponse.error || !optionsResponse.data) {
							console.error(`Failed to load options for relation field ${field.name}:`, optionsResponse.error);
							return { fieldName: field.name, options: [] };
						}
						// Convert the response format from {id, repr} to {value, label}
						// Ensure the ID is properly handled as the value
						const options = optionsResponse.data.map((item: any) => ({
							value: item.id, // Keep as number if it's a number, don't convert to string here
							label: item.repr
						}));
						return { fieldName: field.name, options };
					} else {
						// For enum fields, use the form options endpoint
						optionsResponse = await serverApi.form.getFieldOptions(model, field.name, cookieHeader);
						return {
							fieldName: field.name,
							options: optionsResponse.error ? [] : optionsResponse.data.options
						};
					}
				} catch (error) {
					console.error(`Failed to load options for field ${field.name}:`, error);
					return { fieldName: field.name, options: [] };
				}
			});

			const optionsResults = await Promise.all(optionsPromises);
			preloadedFieldOptions = optionsResults.reduce((acc: any, result) => {
				acc[result.fieldName] = result.options;
				return acc;
			}, {});
		}
	}

	return (
		<div className="space-y-6">
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

			{modelSchemaResponse.error || initialDataResponse.error || formSchemaResponse.error ? (
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
						{formSchemaResponse.error && (
							<div className="bg-red-50 border border-red-200 rounded p-4">
								<p className="text-sm text-red-800">Form Schema Error: {formSchemaResponse.error}</p>
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
						initialFormSchema={formSchemaResponse.data}
						initialFieldOptions={preloadedFieldOptions}
						showAddButton
					/>
				</>
			)}
		</div>
	);
}
