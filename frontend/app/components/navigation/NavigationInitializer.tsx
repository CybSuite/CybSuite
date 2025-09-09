import { cookies } from 'next/headers';
import { NavigationResponse } from '../../types/Navigation';
import { initializeFromNavigationData } from '../../lib/navigation-routes';
import { EXISTING_FRONTEND_ROUTES } from '../../lib/frontend-routes';

// Default navigation data for fallback
const defaultNavigationData: NavigationResponse = {
	current_app: {
		name: 'Base UI',
		color: 'gray',
		is_selected: true,
	},
	available_apps: [
		{ name: 'Base UI', color: 'gray', is_selected: true },
		{ name: 'Pentest Internal', color: 'orange', is_selected: false },
		{ name: 'Pentest Web', color: 'blue', is_selected: false },
		{ name: 'Pentest External', color: 'green', is_selected: false },
		{ name: 'Configuration Review', color: 'black', is_selected: false },
	],
	navbar_items: [
		{
			name: 'Explore',
			items: [
				{ name: 'Hosts', url: '/data/host', is_selected: false, has_sidebar: false },
				{ name: 'Services', url: '/data/service', is_selected: false, has_sidebar: false },
				{ name: 'DNS', url: '/placeholder', is_selected: false, has_sidebar: false },
				{ name: 'Passwords', url: '/data/password', is_selected: false, has_sidebar: false },
			]
		},
		{
			name: 'Missions',
			items: [
				{ name: 'Clients', url: '/data/client', is_selected: false, has_sidebar: false },
				{ name: 'Missions', url: '/data/mission', is_selected: false, has_sidebar: false },
			]
		},
		{
			name: 'Reporting',
			items: [
				{ name: 'Observations', url: '/data/observation', is_selected: false, has_sidebar: false },
				{ name: 'Controls', url: '/placeholder', is_selected: false, has_sidebar: false },
				{ name: 'Reporting', url: '/placeholder', is_selected: false, has_sidebar: false },
			]
		},
	],
	sidebar: {
		has_sidebar: false,
		items: [],
	},
	user_menu: {
		settings: {
			name: 'Settings',
			url: '/settings',
			is_selected: false,
		},
	},
	meta: {
		current_view: '',
		current_url_name: '',
		namespace: null,
	},
};

/**
 * Fetches navigation data and initializes the navigation routes manager
 * This prevents duplicate API calls throughout the app
 */
export async function NavigationInitializer() {
	let navigationData = defaultNavigationData;

	try {
		// Get cookies from Next.js headers
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		// Direct fetch call to avoid module loading issues
		const serverUrl = process.env.DJANGO_API_URL || 'http://backend:8000';
		const url = `${serverUrl}/api/v1/nav_links/`;

		const response = await fetch(url, {
			headers: {
				'Content-Type': 'application/json',
				...(cookieHeader && { 'Cookie': cookieHeader }),
			},
		});

		if (response.ok) {
			navigationData = await response.json();
		} else {
			console.error('HTTP error! status:', response.status);
		}
	} catch (error) {
		console.error('Error fetching navigation data, using fallback:', error);
	}

	// Initialize the navigation routes manager with the fetched data
	initializeFromNavigationData(navigationData, EXISTING_FRONTEND_ROUTES);

	return null; // This component doesn't render anything
}
