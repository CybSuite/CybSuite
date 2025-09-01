'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ControlsPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace('/controls/execsum');
	}, [router]);

	// Return null to avoid any rendering
	return null;
}
