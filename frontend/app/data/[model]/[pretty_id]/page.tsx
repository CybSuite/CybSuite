import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { serverApi } from '@/app/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
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
			{/* Header skeleton */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<Skeleton className="h-12 w-12" /> {/* Back button */}
					<div className="min-w-0 flex-1">
						<Skeleton className="h-8 w-80 mb-1" /> {/* Title */}
						<Skeleton className="h-4 w-40" /> {/* Subtitle */}
					</div>
				</div>
				<div className="flex items-center space-x-2">
					<Skeleton className="h-9 w-16" /> {/* Edit button */}
					<Skeleton className="h-9 w-20" /> {/* Delete button */}
					<Skeleton className="h-9 w-9" /> {/* Menu button */}
				</div>
			</div>

			{/* Main content skeleton - matches DetailPageView's compact two-column list layout */}
			<div className="space-y-6">
				<Card className="overflow-hidden">
					<CardContent className="p-0">
						<div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
							{/* Left column skeleton fields */}
							<div className="divide-y divide-gray-100">
								{Array.from({ length: 6 }).map((_, i) => (
									<div key={`left-${i}`} className="px-6 py-4">
										<div className="flex items-center justify-between">
											<div className="flex items-start space-x-3 min-w-0 flex-1">
												<Skeleton className="h-4 w-4 mt-0.5" /> {/* Field icon */}
												<div className="min-w-0 flex-1">
													<div className="flex items-center space-x-2">
														<Skeleton className="h-4 w-24" /> {/* Field label */}
													</div>
													<Skeleton className="h-5 w-32 mt-1" /> {/* Field value */}
												</div>
											</div>
											<div className="self-start flex items-center space-x-2 ml-4">
												<Skeleton className="h-6 w-16" /> {/* Badge */}
											</div>
										</div>
									</div>
								))}
							</div>

							{/* Right column skeleton fields */}
							<div className="divide-y divide-gray-100">
								{Array.from({ length: 6 }).map((_, i) => (
									<div key={`right-${i}`} className="px-6 py-4">
										<div className="flex items-center justify-between">
											<div className="flex items-start space-x-3 min-w-0 flex-1">
												<Skeleton className="h-4 w-4 mt-0.5" /> {/* Field icon */}
												<div className="min-w-0 flex-1">
													<div className="flex items-center space-x-2">
														<Skeleton className="h-4 w-28" /> {/* Field label */}
													</div>
													<Skeleton className="h-5 w-40 mt-1" /> {/* Field value */}
												</div>
											</div>
											<div className="self-start flex items-center space-x-2 ml-4">
												<Skeleton className="h-6 w-20" /> {/* Badge */}
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Related entity tables skeleton */}
			<div className="space-y-6">
				{Array.from({ length: 2 }).map((_, i) => (
					<div key={`related-${i}`} className="space-y-6">
						<div className="my-12">
							<div className="border-t border-gray-200"></div>
						</div>
						<div className="space-y-6 mb-12">
							<div className="flex items-center space-x-2">
								<Skeleton className="h-8 w-48" /> {/* Related table title */}
								<Skeleton className="h-6 w-16" /> {/* Item count badge */}
							</div>
							<Card>
								<CardContent className="p-6">
									{/* Table header skeleton */}
									<div className="flex items-center justify-between mb-4">
										<Skeleton className="h-6 w-32" />
										<div className="flex space-x-2">
											<Skeleton className="h-8 w-24" />
											<Skeleton className="h-8 w-8" />
										</div>
									</div>
									{/* Table rows skeleton */}
									<div className="space-y-3">
										{Array.from({ length: 3 }).map((_, j) => (
											<div key={j} className="flex items-center space-x-4 py-2 border-b border-gray-100">
												<Skeleton className="h-4 w-4" />
												<Skeleton className="h-4 w-24" />
												<Skeleton className="h-4 w-32" />
												<Skeleton className="h-4 w-20" />
												<div className="ml-auto">
													<Skeleton className="h-6 w-16" />
												</div>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

// Server component that fetches data and passes to client
async function DetailPageContent({ model, pretty_id }: { model: string; pretty_id: string }) {
	try {
		// Fetch schema, record data, and related data
		const [schemaResponse, recordResponse, relatedResponse] = await Promise.all([
			serverApi.schema.getEntitySchema(model),
			serverApi.data.getRecordDetail(model, pretty_id),
			serverApi.data.getRelatedRecords(model, pretty_id)
		]);

		if (schemaResponse.error) {
			console.error('Schema error:', schemaResponse.error);
			notFound();
		}

		if (recordResponse.error) {
			console.error('Record error:', recordResponse.error);
			notFound();
		}

		if (relatedResponse.error) {
			console.error('Related records error:', relatedResponse.error);
			notFound();
		}

		const schema = schemaResponse.data!;
		const record = recordResponse.data!;
		const { relatedData, relatedSchemas } = relatedResponse.data!;

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
