import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { serverApi } from '@/app/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import ControlDefDetailsPageView from '@/app/components/data/ControlDefDetailsPageView';

interface PageProps {
    pretty_id: string;
    isObservation?: boolean;
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
async function DetailPageContent({ pretty_id, isObservation }: { pretty_id: string, isObservation?: boolean }) {
    const model = "control_definition";

    try {
        // Fetch schema, record data, and related data
        const [schemaResponse, recordResponse, relatedResponse] = await Promise.all([
            serverApi.schema.getEntitySchema(model, undefined, true),
            serverApi.data.getRecordDetail("control_definition_w_controls", pretty_id, undefined, false, isObservation),
            serverApi.data.getRelatedRecords("control_definition_w_controls", pretty_id, undefined, true, isObservation)
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
            <ControlDefDetailsPageView
                schema={schema}
                record={record}
                relatedData={relatedData}
                relatedSchemas={relatedSchemas}
                isObservation={isObservation}
            />
        );
    } catch (error) {
        console.error('Error loading detail page:', error);
        notFound();
    }
}

// Main page component with SSR
export default async function DetailPage({ pretty_id, isObservation }: PageProps) {
    return (
        <Suspense fallback={<DetailPageSkeleton />}>
            <DetailPageContent pretty_id={pretty_id} isObservation={isObservation} />
        </Suspense>
    );
}
