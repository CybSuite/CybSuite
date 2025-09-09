import { NavigationResponse } from "../types/Navigation";
import { api } from "./api";

interface RouteDefinition {
  path: string;
  exists: boolean;
  fromBackend: boolean;
}

class NavigationRoutesManager {
  private static instance: NavigationRoutesManager;
  private backendRoutes: Set<string> = new Set();
  private frontendRoutes: Set<string> = new Set();
  private routesCache: Map<string, RouteDefinition> = new Map();
  private lastFetch: number = 0;
  private cacheExpiry: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): NavigationRoutesManager {
    if (!NavigationRoutesManager.instance) {
      NavigationRoutesManager.instance = new NavigationRoutesManager();
    }
    return NavigationRoutesManager.instance;
  }

  /**
   * Initialize routes from navigation data (avoids duplicate fetch)
   */
  public initializeFromNavigationData(navigation: NavigationResponse): void {
    this.extractRoutesFromNavigation(navigation);
    this.lastFetch = Date.now();
  }

  /**
   * Fetch navigation data from backend and extract all routes (fallback method)
   */
  public async fetchBackendRoutes(cookies?: string): Promise<void> {
    try {
      // Add navigation API endpoint to the main API client
      const response = await api.navigation.getNavigation(cookies);

      if (response.data) {
        this.extractRoutesFromNavigation(response.data);
        this.lastFetch = Date.now();
      }
    } catch (error) {
      console.warn("Failed to fetch backend navigation routes:", error);
    }
  }

  /**
   * Extract all route paths from navigation response
   */
  private extractRoutesFromNavigation(navigation: NavigationResponse): void {
    this.backendRoutes.clear();

    // Extract routes from navbar items
    navigation.navbar_items.forEach((menuItem) => {
      menuItem.items.forEach((item) => {
        if (item.url && item.url !== "/placeholder") {
          this.backendRoutes.add(item.url);
        }
      });
    });

    // Extract routes from sidebar items
    navigation.sidebar.items.forEach((item) => {
      if (item.url && item.url !== "/placeholder") {
        this.backendRoutes.add(item.url);
      }
    });

    // Extract user menu routes
    if (
      navigation.user_menu?.settings?.url &&
      navigation.user_menu.settings.url !== "/placeholder"
    ) {
      this.backendRoutes.add(navigation.user_menu.settings.url);
    }
  }

  /**
   * Register frontend routes that actually exist
   * This should be called during app initialization with all existing routes
   */
  public registerFrontendRoutes(routes: string[]): void {
    this.frontendRoutes.clear();
    routes.forEach((route) => this.frontendRoutes.add(route));
  }

  /**
   * Check if cache needs refresh
   */
  private needsCacheRefresh(): boolean {
    return Date.now() - this.lastFetch > this.cacheExpiry;
  }

  /**
   * Determine the type of a route (exists, coming soon, or 404)
   */
  public async getRouteDefinition(
    path: string,
    cookies?: string
  ): Promise<RouteDefinition> {
    // Normalize path (remove trailing slash, ensure leading slash)
    const normalizedPath =
      path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;

    // Check cache first
    if (this.routesCache.has(normalizedPath) && !this.needsCacheRefresh()) {
      return this.routesCache.get(normalizedPath)!;
    }

    // Only refresh backend routes if we haven't initialized them yet and cache needs refresh
    if (this.needsCacheRefresh() && this.backendRoutes.size === 0) {
      await this.fetchBackendRoutes(cookies);
    }

    // Determine route definition
    const existsInFrontend = this.frontendRoutes.has(normalizedPath);
    const existsInBackend = this.backendRoutes.has(normalizedPath);

    const definition: RouteDefinition = {
      path: normalizedPath,
      exists: existsInFrontend,
      fromBackend: existsInBackend,
    };

    // Cache the result
    this.routesCache.set(normalizedPath, definition);

    return definition;
  }

  /**
   * Check if a route should show "coming soon" page
   */
  public async isComingSoon(path: string, cookies?: string): Promise<boolean> {
    const definition = await this.getRouteDefinition(path, cookies);
    return definition.fromBackend && !definition.exists;
  }

  /**
   * Check if a route is a 404 (doesn't exist in backend or frontend)
   */
  public async is404(path: string, cookies?: string): Promise<boolean> {
    const definition = await this.getRouteDefinition(path, cookies);
    return !definition.fromBackend && !definition.exists;
  }

  /**
   * Get all backend routes (for debugging)
   */
  public getBackendRoutes(): string[] {
    return Array.from(this.backendRoutes);
  }

  /**
   * Get all frontend routes (for debugging)
   */
  public getFrontendRoutes(): string[] {
    return Array.from(this.frontendRoutes);
  }
}

// Export singleton instance
export const navigationRoutes = NavigationRoutesManager.getInstance();

// Utility functions for easy use
export const isComingSoonRoute = async (
  path: string,
  cookies?: string
): Promise<boolean> => {
  return navigationRoutes.isComingSoon(path, cookies);
};

export const is404Route = async (
  path: string,
  cookies?: string
): Promise<boolean> => {
  return navigationRoutes.is404(path, cookies);
};

export const initializeNavigationRoutes = (frontendRoutes: string[]) => {
  navigationRoutes.registerFrontendRoutes(frontendRoutes);
};

export const initializeFromNavigationData = (
  navigationData: NavigationResponse,
  frontendRoutes: string[]
) => {
  navigationRoutes.initializeFromNavigationData(navigationData);
  navigationRoutes.registerFrontendRoutes(frontendRoutes);
};
