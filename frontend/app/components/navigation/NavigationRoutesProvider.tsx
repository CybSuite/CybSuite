'use client';

import { useEffect } from 'react';
import { initializeFrontendRoutes } from '@/app/lib/frontend-routes';

/**
 * Client-side provider that initializes the navigation routes system
 * This should be included early in the app lifecycle
 */
export function NavigationRoutesProvider({ children }: { children: React.ReactNode }) {
	useEffect(() => {
		// Initialize frontend routes on client side
		initializeFrontendRoutes();
	}, []);

	return <>{children}</>;
}
