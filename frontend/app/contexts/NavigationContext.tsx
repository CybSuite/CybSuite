'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { NavigationResponse } from '../types/Navigation';

interface NavigationContextType {
	navigationData: NavigationResponse | null;
	isLoading: boolean;
	error: string | null;
}

const NavigationContext = createContext<NavigationContextType>({
	navigationData: null,
	isLoading: true,
	error: null,
});

export const useNavigationContext = () => {
	const context = useContext(NavigationContext);
	if (context === undefined) {
		throw new Error('useNavigationContext must be used within a NavigationProvider');
	}
	return context;
};

interface NavigationProviderProps {
	children: React.ReactNode;
	initialData?: NavigationResponse;
}

export function NavigationProvider({ children, initialData }: NavigationProviderProps) {
	const [navigationData, setNavigationData] = useState<NavigationResponse | null>(initialData || null);
	const [isLoading, setIsLoading] = useState(!initialData);
	const [error, _] = useState<string | null>(null);

	useEffect(() => {
		if (initialData) {
			setNavigationData(initialData);
			setIsLoading(false);
		}
	}, [initialData]);

	const value = {
		navigationData,
		isLoading,
		error,
	};

	return (
		<NavigationContext.Provider value={value}>
			{children}
		</NavigationContext.Provider>
	);
}
