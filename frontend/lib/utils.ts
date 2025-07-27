import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Generate a URL to the detail page of an entity
 * @param entityName - The name of the entity model
 * @param entityId - The ID of the entity instance
 * @returns The URL path to the entity detail page
 */
export function getEntityDetailUrl(entityName: string, entityId: string | number): string {
  return `/data/${entityName}/${entityId}`;
}
