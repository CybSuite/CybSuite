'use client';

import { useState, useMemo, useEffect } from 'react';
import { EntitySchema } from '../../types/Data';
import { ScrollToTop } from '../navigation/scroll-to-top';
import { SchemaFilters } from './schema-filters';
import { SchemaStats } from './schema-stats';
import { EntityList } from './entity-list';
import { SchemaGraph } from './schema-graph';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { List, Network } from 'lucide-react';

interface SchemaOverviewProps {
    entities: EntitySchema[];
    categories: string[];
    tags: string[];
}

export function SchemaOverview({ entities, categories, tags }: SchemaOverviewProps) {
    // View state
    const [viewMode, setViewMode] = useState<'list' | 'graph'>('list');

    // Highlighted entity state for scroll-to-entity functionality
    const [highlightedEntity, setHighlightedEntity] = useState<string | null>(null);

    // Filter states
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Sort entities alphabetically by name
    const sortedEntities = [...entities].sort((a, b) => a.name.localeCompare(b.name));

    // Filter entities based on selected filters
    const filteredEntities = useMemo(() => {
        return sortedEntities.filter((entity) => {
            // Category filter
            if (selectedCategories.length > 0 && !selectedCategories.includes(entity.category)) {
                return false;
            }

            // Tags filter
            if (selectedTags.length > 0) {
                const hasMatchingTag = entity.tags?.some(tag => selectedTags.includes(tag));
                if (!hasMatchingTag) return false;
            }

            // Search filter (entity name and field names/display names)
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const entityNameMatch = entity.name.toLowerCase().includes(query);

                const fieldNameMatch = Object.values(entity.fields).some(field =>
                    field.name.toLowerCase().includes(query) ||
                    field.display_name?.toLowerCase().includes(query) ||
                    field.pretty_name?.toLowerCase().includes(query)
                );

                if (!entityNameMatch && !fieldNameMatch) return false;
            }

            return true;
        });
    }, [sortedEntities, selectedCategories, selectedTags, searchQuery]);

    const hasActiveFilters = selectedCategories.length > 0 || selectedTags.length > 0 || searchQuery.trim().length > 0;

    // Handle filter changes from SchemaFilters component
    const handleFiltersChange = (filters: {
        selectedCategories: string[];
        selectedTags: string[];
        searchQuery: string;
    }) => {
        setSelectedCategories(filters.selectedCategories);
        setSelectedTags(filters.selectedTags);
        setSearchQuery(filters.searchQuery);
    };

    // Handle adding category to filter
    const addCategoryFilter = (category: string) => {
        if (!selectedCategories.includes(category)) {
            setSelectedCategories(prev => [...prev, category]);
        }
    };

    // Handle adding tag to filter
    const addTagFilter = (tag: string) => {
        if (!selectedTags.includes(tag)) {
            setSelectedTags(prev => [...prev, tag]);
        }
    };

    // Handle internal scroll (from clicking entity links within the schema page)
    const handleInternalScroll = (entityName: string) => {
        // Update highlighted entity for internal scrolling
        setHighlightedEntity(entityName);
        // Update URL hash without triggering page reload
        window.history.replaceState(null, '', `#entity-${entityName}`);
    };

    // Clear all filters
    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedTags([]);
        setSearchQuery('');
    };

    // Handle URL hash to scroll to specific entity
    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash;
            if (hash && hash.startsWith('#entity-')) {
                const entityName = hash.replace('#entity-', '');
                setHighlightedEntity(entityName);

                // Set view mode to list if it's currently graph
                if (viewMode === 'graph') {
                    setViewMode('list');
                }
            }
        };

        // Handle initial hash on page load
        handleHashChange();

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange);

        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [viewMode]);

    return (
        <div className="space-y-4">
            <ScrollToTop />

            <SchemaFilters
                categories={categories}
                tags={tags}
                searchQuery={searchQuery}
                selectedCategories={selectedCategories}
                selectedTags={selectedTags}
                hasActiveFilters={hasActiveFilters}
                onFiltersChange={handleFiltersChange}
            />

            <SchemaStats
                entities={sortedEntities}
                filteredEntities={filteredEntities}
                hasActiveFilters={hasActiveFilters}
            />

            {/* View Mode Toggle */}
            <div className="flex justify-center">
                <ToggleGroup
                    type="single"
                    value={viewMode}
                    onValueChange={(value) => {
                        if (value) setViewMode(value as 'list' | 'graph');
                    }}
                    variant="outline"
                    className="bg-background"
                >
                    <ToggleGroupItem value="list" aria-label="List view">
                        <List className="h-4 w-4 mr-2" />
                        List
                    </ToggleGroupItem>
                    <ToggleGroupItem value="graph" aria-label="Graph view">
                        <Network className="h-4 w-4 mr-2" />
                        Graph
                    </ToggleGroupItem>
                </ToggleGroup>
            </div>

            {/* Conditional rendering based on view mode */}
            {viewMode === 'list' ? (
                <EntityList
                    entities={sortedEntities}
                    filteredEntities={filteredEntities}
                    highlightedEntity={highlightedEntity}
                    hasActiveFilters={hasActiveFilters}
                    onCategoryFilter={addCategoryFilter}
                    onTagFilter={addTagFilter}
                    onClearFilters={clearFilters}
                    onEntityScroll={handleInternalScroll}
                />
            ) : (
                <SchemaGraph
                    entities={filteredEntities}
                />
            )}
        </div>
    );
}
