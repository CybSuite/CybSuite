import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { isComingSoonRoute, is404Route } from '@/app/lib/navigation-routes';
import ComingSoonPage from '@/app/components/navigation/ComingSoonPage';

interface CatchAllPageProps {
	params: Promise<{
		slug: string[];
	}>;
}

export async function generateMetadata({ params }: CatchAllPageProps): Promise<Metadata> {
	const { slug } = await params;
	const path = `/${slug.join('/')}`;

	try {
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();
		const isComingSoon = await isComingSoonRoute(path, cookieHeader);

		if (isComingSoon) {
			return {
				title: 'Coming Soon - CybSuite',
				description: 'This feature is currently under development.',
			};
		}
	} catch (error) {
		// Silent fallback for metadata generation
	}

	return {
		title: 'Page Not Found - CybSuite',
		description: 'The requested page could not be found.',
	};
}

export default async function CatchAllPage({ params }: CatchAllPageProps) {
	const { slug } = await params;
	const path = `/${slug.join('/')}`;

	try {
		const cookieStore = await cookies();
		const cookieHeader = cookieStore.toString();

		// Check if this is a coming soon route (defined in backend but not frontend)
		const isComingSoon = await isComingSoonRoute(path, cookieHeader);

		if (isComingSoon) {
			// Extract feature name from path for better UX
			const featureName = slug[slug.length - 1];
			const categoryName = slug.length > 1 ? slug[0] : undefined;

			const title = featureName
				? `${featureName.charAt(0).toUpperCase()}${featureName.slice(1)} - Coming Soon`
				: 'Coming Soon';

			const description = categoryName
				? `The ${featureName} page in the ${categoryName} section is currently unavailable.`
				: 'This page is currently under development and will be available soon.';

			return (
				<ComingSoonPage
					title={title}
					description={description}
					feature={featureName}
				/>
			);
		}

		// Check if this is truly a 404 (doesn't exist anywhere)
		const is404 = await is404Route(path, cookieHeader);

		if (is404) {
			notFound(); // This will render the 404 page
		}

		// If we reach here, there might be an issue with route detection
		// Show 404 as fallback since we can't determine the route status
		notFound();

	} catch (error) {
		// On any error, show 404 page
		notFound();
	}
}
