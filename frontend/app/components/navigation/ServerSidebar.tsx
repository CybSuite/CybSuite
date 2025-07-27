import { Sidebar } from './Sidebar';
import { Sidebar as SidebarData } from '../../types/Navigation';
import { cookies } from 'next/headers';

// Default sidebar data for fallback
const defaultSidebarData: SidebarData = {
  has_sidebar: false,
  items: [],
};

interface ServerSidebarProps {
  className?: string;
}

export async function ServerSidebar({ className }: ServerSidebarProps) {
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

    if (!response.ok) {
      console.error('HTTP error! status:', response.status);
      return <Sidebar sidebarData={defaultSidebarData} className={className} />;
    }

    const data = await response.json();
    return <Sidebar sidebarData={data.sidebar} className={className} />;
  } catch (error) {
    console.error('Error fetching sidebar data:', error);
    return <Sidebar sidebarData={defaultSidebarData} className={className} />;
  }
}
