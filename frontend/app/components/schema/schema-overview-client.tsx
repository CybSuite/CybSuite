'use client';

import { useState, useMemo } from 'react';
import { EntitySchema } from '../../types/Data';
import { ScrollToTop } from './scroll-to-top';
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

    // Clear all filters
    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedTags([]);
        setSearchQuery('');
    };

    return (
        <div className="space-y-4">
            <ScrollToTop />

            <SchemaFilters
                categories={categories}
                tags={tags}
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
                    highlightedEntity={null}
                    hasActiveFilters={hasActiveFilters}
                    onCategoryFilter={addCategoryFilter}
                    onTagFilter={addTagFilter}
                    onClearFilters={clearFilters}
                />
            ) : (
                <SchemaGraph
                    entities={filteredEntities}
                />
            )}
        </div>
    );
}
