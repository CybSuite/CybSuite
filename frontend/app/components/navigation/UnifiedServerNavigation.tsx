import { Navigation } from './Navigation';
import { Sidebar } from './Sidebar';
import { initializeFromNavigationData } from '../../lib/navigation-routes';
import { EXISTING_FRONTEND_ROUTES } from '../../lib/frontend-routes';
import { getNavigationData } from '../../lib/navigation-data';

/**
 * Fetches navigation data once and uses it for navigation UI and routes manager
 */
export async function UnifiedServerNavigation() {
	const navigationData = await getNavigationData();

	// Initialize the navigation routes manager with the fetched data
	initializeFromNavigationData(navigationData, EXISTING_FRONTEND_ROUTES);

	return <Navigation navigationData={navigationData} />;
}

/**
 * Unified sidebar component that uses the same cached navigation data
 */
export async function UnifiedServerSidebar({ className }: { className?: string }) {
	const navigationData = await getNavigationData();

	return <Sidebar sidebarData={navigationData.sidebar} className={className} />;
}
