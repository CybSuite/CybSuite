import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { serverApi } from '@/app/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { parseFieldAnnotation } from '@/app/lib/schema-utils';
import { EntitySchema } from '@/app/types/Data';
import DetailPageView from '@/app/components/data/DetailPageView';

interface PageProps {
	params: Promise<{
		model: string;
		pretty_id: string;
	}>;
}

// Loading component for the detail page
function DetailPageSkeleton() {
	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<Skeleton className="h-10 w-10" />
					<div>
						<Skeleton className="h-8 w-64 mb-2" />
						<Skeleton className="h-4 w-32" />
					</div>
				</div>
				<div className="flex space-x-2">
					<Skeleton className="h-10 w-20" />
					<Skeleton className="h-10 w-20" />
					<Skeleton className="h-10 w-20" />
				</div>
			</div>

			{/* Grid of field cards skeleton */}
			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 12 }).map((_, i) => (
					<Card key={i} className="transition-shadow hover:shadow-md">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<Skeleton className="h-5 w-24" />
								<Skeleton className="h-4 w-12" />
							</div>
							<Skeleton className="h-3 w-32 mt-2" />
						</CardHeader>
						<CardContent className="pt-0">
							<Skeleton className="h-16 w-full" />
						</CardContent>
					</Card>
				))}
			</div>
		</div>
	);
}

// Server component that fetches data and passes to client
async function DetailPageContent({ model, pretty_id }: { model: string; pretty_id: string }) {
	try {
		// Fetch both schema and record data
		const [schemaResponse, recordResponse] = await Promise.all([
			serverApi.schema.getEntitySchema(model),
			serverApi.data.getRecordDetail(model, pretty_id)
		]);

		if (schemaResponse.error) {
			console.error('Schema error:', schemaResponse.error);
			notFound();
		}

		if (recordResponse.error) {
			console.error('Record error:', recordResponse.error);
			notFound();
		}

		const schema = schemaResponse.data!;
		const record = recordResponse.data!;

		// Fetch related data for tables
		const relatedEntities = new Set<string>();

		// Find all relation fields
		Object.values(schema.fields).forEach(field => {
			const typeInfo = parseFieldAnnotation(field);
			if (typeInfo.isRelation && typeInfo.referencedEntity) {
				relatedEntities.add(typeInfo.referencedEntity);
			}
		});

		// Load data and schemas for each related entity
		const relatedDataPromises: Record<string, Promise<any>> = {};
		const relatedSchemaPromises: Record<string, Promise<any>> = {};

		for (const entityType of relatedEntities) {
			relatedSchemaPromises[entityType] = serverApi.schema.getEntitySchema(entityType);
			relatedDataPromises[entityType] = serverApi.data.getEntityData(entityType);
		}

		// Wait for all related data to load
		const [relatedSchemasResults, relatedDataResults] = await Promise.all([
			Promise.allSettled(Object.entries(relatedSchemaPromises).map(async ([entityType, promise]) => ({
				entityType,
				result: await promise
			}))),
			Promise.allSettled(Object.entries(relatedDataPromises).map(async ([entityType, promise]) => ({
				entityType,
				result: await promise
			})))
		]);

		// Process results
		const relatedSchemas: Record<string, EntitySchema> = {};
		const relatedData: Record<string, any[]> = {};

		// Process schema results
		relatedSchemasResults.forEach((result, index) => {
			if (result.status === 'fulfilled' && result.value.result.data) {
				const filteredFields = Object.fromEntries(
					Object.entries(result.value.result.data.fields).filter(
						([, value]: any[]) => value.referenced_entity !== model
					)
				);

				const newData = {
					...result.value.result.data,
					fields: filteredFields,
				};

				relatedSchemas[result.value.entityType] = newData;
			}
		});

		// Process data results and filter for related records
		relatedDataResults.forEach((result, index) => {
			if (result.status === 'fulfilled' && result.value.result.data) {
				const entityType = result.value.entityType;
				const allRecords = result.value.result.data;

				// Filter records that are related to current record
				const filteredRecords = allRecords.filter((relatedRecord: any) => {
					return Object.values(schema.fields).some(field => {
						const typeInfo = parseFieldAnnotation(field);
						const fieldValue = record[field.name];
						if (typeInfo.isRelation && typeInfo.referencedEntity === entityType && fieldValue) {
							if (Array.isArray(fieldValue)) {
								return fieldValue.some(item =>
									(typeof item === 'object' && item.id === relatedRecord.id) ||
									String(item) === String(relatedRecord.id)
								);
							} else if (typeof fieldValue === 'object' && fieldValue.id) {
								return fieldValue.id === relatedRecord.id;
							}
						}
						return false;
					});
				});
				relatedData[entityType] = filteredRecords;
			} else {
				// Ensure the entity has an empty array even if no data
				const entityType = result.status === 'fulfilled' ? result.value.entityType : '';
				if (entityType) {
					relatedData[entityType] = [];
				}
			}
		});

		// Pass the data to the client component
		return (
			<DetailPageView
				schema={schema}
				record={record}
				model={model}
				relatedData={relatedData}
				relatedSchemas={relatedSchemas}
			/>
		);
	} catch (error) {
		console.error('Error loading detail page:', error);
		notFound();
	}
}

// Main page component with SSR
export default async function DetailPage({ params }: PageProps) {
	const { model, pretty_id } = await params;

	return (
		<Suspense fallback={<DetailPageSkeleton />}>
			<DetailPageContent model={model} pretty_id={pretty_id} />
		</Suspense>
	);
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
	const { model, pretty_id } = await params;

	try {
		const recordResponse = await serverApi.data.getRecordDetail(model, pretty_id);
		if (recordResponse.data) {
			const record = recordResponse.data;
			const title = record.pretty_id || `${model} #${record.id}`;
			return {
				title: `${title} - ${model.charAt(0).toUpperCase() + model.slice(1)}`,
				description: `Details for ${model} record: ${title}`,
			};
		}
	} catch (error) {
		console.error('Error generating metadata:', error);
	}

	return {
		title: `${model.charAt(0).toUpperCase() + model.slice(1)} Details`,
		description: `View details for ${model} record`,
	};
}
