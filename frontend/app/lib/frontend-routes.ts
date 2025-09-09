/**
 * Frontend route definitions and initialization
 * This file maintains a list of all existing frontend routes
 * and initializes the navigation routes manager
 */

import { initializeNavigationRoutes } from "./navigation-routes";

/**
 * List of all existing frontend routes
 * Add new routes here as they are implemented
 */
export const EXISTING_FRONTEND_ROUTES = [
  // Root
  "/",

  // Data routes
  "/data",

  // Health check
  "/health_check",

  // Data table test
  "/data-table-test",

  // Placeholder (for testing)
  "/placeholder",

  // Settings
  "/settings",

  // Controls
  "/controls",

  // Schema
  "/schema",

  // Add any dynamic data routes that exist
  // Note: Dynamic routes like /data/[entity] should be handled separately
];

/**
 * Dynamic route patterns that exist in the frontend
 * These are patterns that should be checked dynamically
 */
export const DYNAMIC_ROUTE_PATTERNS = [
  "/data/[model]", // Main data entity routes
  // Add other dynamic patterns as they are implemented
];

/**
 * Check if a dynamic route pattern matches a given path
 */
export const matchesDynamicPattern = (
  path: string,
  pattern: string
): boolean => {
  // Convert Next.js pattern to regex
  const regexPattern = pattern
    .replace(/\[([^\]]+)\]/g, "([^/]+)") // [slug] -> ([^/]+)
    .replace(/\[\.\.\.[^\]]+\]/g, "(.*)"); // [...slug] -> (.*)

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(path);
};

/**
 * Check if a path matches any existing dynamic route
 */
export const matchesExistingDynamicRoute = (path: string): boolean => {
  return DYNAMIC_ROUTE_PATTERNS.some((pattern) =>
    matchesDynamicPattern(path, pattern)
  );
};

/**
 * Get all routes that should be considered as existing
 * This includes static routes and checks for dynamic route patterns
 */
export const getAllExistingRoutes = (
  additionalPaths: string[] = []
): string[] => {
  const allRoutes = [...EXISTING_FRONTEND_ROUTES];

  // Add additional paths that match dynamic patterns
  additionalPaths.forEach((path) => {
    if (matchesExistingDynamicRoute(path)) {
      allRoutes.push(path);
    }
  });

  return allRoutes;
};

/**
 * Initialize the navigation routes manager with current frontend routes
 * This should be called during app startup
 */
export const initializeFrontendRoutes = (additionalPaths: string[] = []) => {
  const existingRoutes = getAllExistingRoutes(additionalPaths);
  initializeNavigationRoutes(existingRoutes);
};

/**
 * Check if a specific path exists as a frontend route
 */
export const pathExistsInFrontend = (path: string): boolean => {
  // Check static routes
  if (EXISTING_FRONTEND_ROUTES.includes(path)) {
    return true;
  }

  // Check dynamic patterns
  return matchesExistingDynamicRoute(path);
};
