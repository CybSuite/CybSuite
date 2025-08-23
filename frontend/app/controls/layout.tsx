'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface ControlsLayoutProps {
	children: React.ReactNode;
}

export default function ControlsLayout({ children }: ControlsLayoutProps) {
	const pathname = usePathname();
	const router = useRouter();

	// Determine the active tab based on the current pathname
	const getActiveTab = () => {
		if (pathname.includes('/execsum')) return 'execsum';
		if (pathname.includes('/control_definitions') || pathname.includes('/controls/controls')) return 'controls';
		if (pathname.includes('/observation_definitions') || pathname.includes('/controls/observations')) return 'observations';
		return 'neutral';
	};

	const activeTab = getActiveTab();

	const handleTabChange = (value: string) => {
		switch (value) {
			case 'execsum':
				router.push('/controls/execsum');
				break;
			case 'controls':
				router.push('/controls/control_definitions');
				break;
			case 'observations':
				router.push('/controls/observation_definitions');
				break;
		}
	};

	return (
		<div className="container mx-auto p-6 pt-0">
			<Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
				<TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-gray-200/50 p-1 text-muted-foreground w-auto">
					<TabsTrigger value="execsum" className={`px-4 py-2 hover:bg-gray-200/75 transition duration-200 ${activeTab !== "execsum" ? "cursor-pointer" : ""}`}>Executive Summary</TabsTrigger>
					<TabsTrigger value="controls" className={`px-4 py-2 hover:bg-gray-200/75 transition duration-200 ${activeTab !== "controls" ? "cursor-pointer" : ""}`}>Controls</TabsTrigger>
					<TabsTrigger value="observations" className={`px-4 py-2 hover:bg-gray-200/75 transition duration-200 ${activeTab !== "observations" ? "cursor-pointer" : ""}`}>Observations</TabsTrigger>
				</TabsList>

				<TabsContent value="execsum" className="mt-6">
					{activeTab === 'execsum' && children}
				</TabsContent>

				<TabsContent value="controls" className="mt-6">
					{activeTab === 'controls' && children}
				</TabsContent>

				<TabsContent value="observations" className="mt-6">
					{activeTab === 'observations' && children}
				</TabsContent>

				<TabsContent value="neutral" className="mt-6">
					{children}
				</TabsContent>
			</Tabs>
		</div>
	);
}
