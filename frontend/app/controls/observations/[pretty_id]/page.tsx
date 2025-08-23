import { serverApi } from '@/app/lib/api';
import ControlPage from '../../ControlPage';

interface PageProps {
    params: Promise<{
        pretty_id: string;
    }>;
}

// Main page component with SSR
export default async function DetailPage({ params }: PageProps) {
    const { pretty_id } = await params;

    return (
        <ControlPage pretty_id={pretty_id} isObservation={true} />
    );
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
    const model = "control_definition";
    const { pretty_id } = await params;
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
