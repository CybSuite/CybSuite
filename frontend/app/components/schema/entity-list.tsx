'use client';

import { useState, useMemo } from 'react';
import { EntitySchema } from '../../types/Data';
import { EntityCard } from './entity-card';
import { Button } from '../../../components/ui/button';
import { Database } from 'lucide-react';

interface EntityListProps {
    entities: EntitySchema[];
    filteredEntities: EntitySchema[];
    highlightedEntity: string | null;
    hasActiveFilters: boolean;
    onCategoryFilter: (category: string) => void;
    onTagFilter: (tag: string) => void;
    onClearFilters: () => void;
}

export function EntityList({
    entities,
    filteredEntities,
    highlightedEntity,
    hasActiveFilters,
    onCategoryFilter,
    onTagFilter,
    onClearFilters
}: EntityListProps) {
    const [highlightedEntityState, setHighlightedEntityState] = useState<string | null>(highlightedEntity);

    // Handle scrolling to entity and highlighting it
    const scrollToEntity = (entityName: string) => {
        // Try to find the entity in different locations based on screen size and layout
        let element: HTMLElement | null = null;

        // First try the main entity ID (works for left column and right column on large screens)
        element = document.getElementById(`entity-${entityName}`);

        // If not found, try the mobile version (small screens, right column entities)
        if (!element) {
            element = document.getElementById(`entity-${entityName}-mobile`);
        }

        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Trigger the accordion to open if it's closed
            const accordionTrigger = element.querySelector('[data-state="closed"]') as HTMLElement;
            if (accordionTrigger) {
                accordionTrigger.click();
            } else {
                // Alternative: try to find the trigger button
                const triggerButton = element.querySelector('button[data-state="closed"]') as HTMLElement;
                if (triggerButton) {
                    triggerButton.click();
                }
            }

            // Add highlight effect
            setHighlightedEntityState(entityName);
            setTimeout(() => setHighlightedEntityState(null), 2000);
        }
    };

    // Add category filter handler
    const addCategoryFilter = (category: string) => {
        onCategoryFilter(category);
    };

    // Add tag filter handler
    const addTagFilter = (tag: string) => {
        onTagFilter(tag);
    };

    if (filteredEntities.length === 0) {
        return (
            <div className="rounded-lg border bg-card p-12 text-center">
                <div className="flex flex-col items-center space-y-4">
                    <Database className="h-12 w-12 text-muted-foreground" />
                    <div>
                        <h3 className="text-lg font-semibold">No entities found</h3>
                        <p className="text-muted-foreground">
                            No entities match your current filters. Try adjusting your search criteria.
                        </p>
                    </div>
                    {hasActiveFilters && (
                        <Button onClick={onClearFilters} variant="outline">
                            Clear all filters
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col xl:flex-row gap-6">
            {/* Single column for small screens - show all entities */}
            <div className="xl:hidden space-y-6">
                {filteredEntities.map((entity) => (
                    <EntityCard
                        key={entity.name}
                        entity={entity}
                        isHighlighted={highlightedEntityState === entity.name}
                        onCategoryFilter={addCategoryFilter}
                        onTagFilter={addTagFilter}
                        onEntityScroll={scrollToEntity}
                        idSuffix="-mobile"
                    />
                ))}
            </div>

            {/* Left column for large screens - show even indexed entities */}
            <div className="hidden xl:block w-1/2 space-y-6 min-w-0">
                {filteredEntities.filter((_, index) => index % 2 === 0).map((entity) => (
                    <EntityCard
                        key={entity.name}
                        entity={entity}
                        isHighlighted={highlightedEntityState === entity.name}
                        onCategoryFilter={addCategoryFilter}
                        onTagFilter={addTagFilter}
                        onEntityScroll={scrollToEntity}
                    />
                ))}
            </div>

            {/* Right column for large screens - show odd indexed entities */}
            <div className="w-1/2 space-y-6 hidden xl:block min-w-0">
                {filteredEntities.filter((_, index) => index % 2 === 1).map((entity) => (
                    <EntityCard
                        key={entity.name}
                        entity={entity}
                        isHighlighted={highlightedEntityState === entity.name}
                        onCategoryFilter={addCategoryFilter}
                        onTagFilter={addTagFilter}
                        onEntityScroll={scrollToEntity}
                    />
                ))}
            </div>
        </div>
    );
}
