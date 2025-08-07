'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, ChevronDown } from 'lucide-react';
import { NavigationResponse } from '../../types/Navigation';
import { cn } from '@/lib/utils';
import { cookieUtils } from '../../lib/cookies';

interface NavigationProps {
	navigationData: NavigationResponse;
}

export function Navigation({ navigationData }: NavigationProps) {
	const [mounted, setMounted] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const pathname = usePathname();

	// Ensure hydration consistency
	useEffect(() => {
		setMounted(true);
	}, []);

	// Function to check if a navigation item is currently active
	const isItemActive = (itemUrl: string) => {
		if (itemUrl.endsWith('/')) {
			itemUrl = itemUrl.slice(0, -1); // Remove trailing slash for comparison
		}

		// Handle exact matches
		if (pathname === itemUrl) {
			return true;
		}

		// Handle nested paths (e.g., /data/hosts should match /data/hosts/123)
		if (pathname.startsWith(itemUrl + '/')) {
			return true;
		}

		return false;
	};

	// Function to check if any item in a menu is active
	const hasActiveMenuItem = (menuItems: any[]) => {
		return menuItems.some(item => isItemActive(item.url));
	};

	const handleAppSwitch = (appName: string) => {
		if (isLoading) return;
		setIsLoading(true);

		// Remove existing cookies
		cookieUtils.remove('nav_app');
		cookieUtils.remove('nav_app', { domain: window.location.hostname });

		// Set new cookie
		cookieUtils.set('nav_app', appName, {
			path: '/',
			sameSite: 'lax',
			maxAge: 365 * 24 * 60 * 60 // 1 year
		});

		// Use a more reliable page refresh
		window.location.reload();
	};

	const getColorClass = (color: string) => {
		const colorMap: { [key: string]: string } = {
			gray: 'bg-gray-500',
			orange: 'bg-orange-500',
			blue: 'bg-blue-500',
			green: 'bg-green-500',
			black: 'bg-black',
			red: 'bg-red-500',
			purple: 'bg-purple-500',
			yellow: 'bg-yellow-500',
		};
		return colorMap[color] || 'bg-gray-500';
	};

	// Prevent hydration mismatch by not rendering until mounted
	if (!mounted) {
		return (
			<header className="border-b bg-white">
				<div className="flex h-16 items-center px-4">
					<div className="flex items-center space-x-4">
						<div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
					</div>
					<div className="mx-6 flex space-x-4">
						<div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
						<div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
					</div>
				</div>
			</header>
		);
	}

	return (
		<header className="border-b bg-white">
			<div className="flex h-16 items-center px-4">
				{/* Logo */}
				<div className="flex items-center space-x-4">
					<Link href="/" className="text-xl font-bold text-gray-800">
						CybSuite
					</Link>
				</div>

				{/* Main Navigation */}
				<NavigationMenu className="mx-6" orientation="horizontal" viewport={false}>
					<NavigationMenuList>
						{navigationData.navbar_items.map((menuItem, index) => {
							const hasSelectedItem = hasActiveMenuItem(menuItem.items);
							const uniqueKey = `nav-${index}-${menuItem.name}`;

							// Check if this menu item should be rendered as a simple link
							const isSingleItemWithSameName = menuItem.items.length === 1 &&
								menuItem.items[0].name === menuItem.name;

							if (isSingleItemWithSameName) {
								// Render as a simple navigation link
								const item = menuItem.items[0];
								const isActive = isItemActive(item.url);
								return (
									<NavigationMenuItem key={menuItem.name}>
										<NavigationMenuLink asChild>
											<Link
												href={item.url}
												className={cn(
													"h-9 px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50",
													isActive && "bg-blue-300 text-accent-foreground font-semibold hover:bg-blue-400"
												)}
											>
												{menuItem.name}
											</Link>
										</NavigationMenuLink>
									</NavigationMenuItem>
								);
							}

							return (
								<NavigationMenuItem key={menuItem.name}>
									<NavigationMenuTrigger
										className={cn(
											"h-9 transition-colors",
											hasSelectedItem && "bg-blue-300 text-accent-foreground font-semibold hover:bg-blue-400"
										)}
										data-selected={hasSelectedItem}
									>
										{menuItem.name}
									</NavigationMenuTrigger>
									<NavigationMenuContent>
										<div className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
											{menuItem.items.map((item, itemIndex) => (
												<NavigationMenuLink key={`${uniqueKey}-item-${itemIndex}-${item.name}`} asChild>
													<Link
														href={item.url}
														className={cn(
															'block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
															isItemActive(item.url) && 'bg-blue-300 text-accent-foreground font-medium'
														)}
													>
														<div className="flex items-center justify-between">
															<div className="text-sm font-medium leading-none">
																{item.name}
															</div>
															{item.has_sidebar && (
																<Badge variant="outline" className="text-xs">
																	Sidebar
																</Badge>
															)}
														</div>
													</Link>
												</NavigationMenuLink>
											))}
										</div>
									</NavigationMenuContent>
								</NavigationMenuItem>
							);
						})}
					</NavigationMenuList>
				</NavigationMenu>

				{/* App Switcher */}
				<div className="ml-auto flex items-center space-x-4">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="flex items-center space-x-2"
								disabled={isLoading}
							>
								<div
									className={cn(
										'h-3 w-3 rounded-full',
										getColorClass(navigationData.current_app.color)
									)}
								/>
								<span className="font-medium">{navigationData.current_app.name}</span>
								<ChevronDown className={cn("h-4 w-4", isLoading && "animate-spin")} />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							{navigationData.available_apps.map((app) => (
								<DropdownMenuItem
									key={app.name}
									onClick={() => handleAppSwitch(app.name)}
									className="flex items-center space-x-2"
									disabled={isLoading || app.name === navigationData.current_app.name}
								>
									<div
										className={cn(
											'h-3 w-3 rounded-full',
											getColorClass(app.color)
										)}
									/>
									<span>{app.name}</span>
									{app.name === navigationData.current_app.name && (
										<Badge variant="secondary" className="ml-auto">
											Active
										</Badge>
									)}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				{/* User Menu */}
				<div className="ml-3 flex items-center space-x-4">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<Settings className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem asChild>
								<Link href={navigationData.user_menu.settings.url}>
									{navigationData.user_menu.settings.name}
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</header>
	);
}
