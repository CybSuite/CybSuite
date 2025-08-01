'use client';

import { useRouter } from 'next/navigation';
import { Button } from '../../../components/ui/button';
import { ArrowLeft, Database } from 'lucide-react';

export default function BackToSchemasButton() {
	const router = useRouter();

	const handleBackToSchemas = () => {
		router.push('/data');
	};

	return (
		<Button
			variant="outline"
			onClick={handleBackToSchemas}
			className="flex items-center space-x-2"
		>
			<ArrowLeft className="h-4 w-4" />
			<span>Back to Data Management</span>
		</Button>
	);
}
