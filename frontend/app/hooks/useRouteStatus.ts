"use client";

import { useState, useEffect } from "react";
import { navigationRoutes } from "@/app/lib/navigation-routes";

interface RouteStatus {
  isComingSoon: boolean;
  is404: boolean;
  isLoading: boolean;
  error?: string;
}

/**
 * Hook to check the status of a route (coming soon, 404, or exists)
 */
export function useRouteStatus(path: string): RouteStatus {
  const [status, setStatus] = useState<RouteStatus>({
    isComingSoon: false,
    is404: false,
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    const checkRouteStatus = async () => {
      try {
        setStatus((prev) => ({ ...prev, isLoading: true, error: undefined }));

        const [isComingSoon, is404] = await Promise.all([
          navigationRoutes.isComingSoon(path),
          navigationRoutes.is404(path),
        ]);

        if (isMounted) {
          setStatus({
            isComingSoon,
            is404,
            isLoading: false,
          });
        }
      } catch (error) {
        if (isMounted) {
          setStatus({
            isComingSoon: false,
            is404: false,
            isLoading: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    };

    checkRouteStatus();

    return () => {
      isMounted = false;
    };
  }, [path]);

  return status;
}

/**
 * Hook to get debug information about the navigation routes system
 */
export function useNavigationDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<{
    backendRoutes: string[];
    frontendRoutes: string[];
    isLoading: boolean;
  }>({
    backendRoutes: [],
    frontendRoutes: [],
    isLoading: true,
  });

  useEffect(() => {
    const loadDebugInfo = async () => {
      try {
        // Trigger a fetch of backend routes if needed
        await navigationRoutes.fetchBackendRoutes();

        setDebugInfo({
          backendRoutes: navigationRoutes.getBackendRoutes(),
          frontendRoutes: navigationRoutes.getFrontendRoutes(),
          isLoading: false,
        });
      } catch (error) {
        console.warn("Failed to load debug info:", error);
        setDebugInfo((prev) => ({ ...prev, isLoading: false }));
      }
    };

    loadDebugInfo();
  }, []);

  return debugInfo;
}
