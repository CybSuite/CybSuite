'use client';

import { useState } from 'react';
import { Input } from '../../../components/ui/input';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxTrigger,
} from '../../../components/ui/combobox';
import { Search, X, Filter } from 'lucide-react';

interface SchemaFiltersProps {
    categories: string[];
    tags: string[];
    onFiltersChange: (filters: {
        selectedCategories: string[];
        selectedTags: string[];
        searchQuery: string;
    }) => void;
}

export function SchemaFilters({ categories, tags, onFiltersChange }: SchemaFiltersProps) {
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const hasActiveFilters = selectedCategories.length > 0 || selectedTags.length > 0 || searchQuery.trim().length > 0;

    // Notify parent component of filter changes
    const notifyFiltersChange = (newCategories = selectedCategories, newTags = selectedTags, newSearch = searchQuery) => {
        onFiltersChange({
            selectedCategories: newCategories,
            selectedTags: newTags,
            searchQuery: newSearch,
        });
    };

    const handleCategoryChange = (newCategories: string[]) => {
        setSelectedCategories(newCategories);
        notifyFiltersChange(newCategories, selectedTags, searchQuery);
    };

    const handleTagChange = (newTags: string[]) => {
        setSelectedTags(newTags);
        notifyFiltersChange(selectedCategories, newTags, searchQuery);
    };

    const handleSearchChange = (newSearch: string) => {
        setSearchQuery(newSearch);
        notifyFiltersChange(selectedCategories, selectedTags, newSearch);
    };

    const clearFilters = () => {
        setSelectedCategories([]);
        setSelectedTags([]);
        setSearchQuery('');
        notifyFiltersChange([], [], '');
    };

    return (
        <div className="rounded-lg border bg-card p-6 relative">
            <div className="flex items-center gap-2 mb-4">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Filters</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search Filter */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Search</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search entities and fields..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Categories</label>
                    <div className="space-y-2">
                        <Combobox
                            multiple
                            value={selectedCategories}
                            onValueChange={handleCategoryChange}
                        >
                            <ComboboxTrigger className="w-full h-9 border border-input bg-transparent px-3 py-2 shadow-xs rounded-md">
                                <ComboboxInput placeholder="Select categories..." className="border-none shadow-none bg-transparent w-full" />
                            </ComboboxTrigger>
                            <ComboboxContent>
                                <ComboboxEmpty>No categories found.</ComboboxEmpty>
                                {categories?.map((category) => (
                                    <ComboboxItem key={category} value={category}>
                                        {category}
                                    </ComboboxItem>
                                ))}
                            </ComboboxContent>
                        </Combobox>
                        {selectedCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {selectedCategories.map((category) => (
                                    <Badge key={category} variant="secondary" className="text-xs">
                                        {category}
                                        <button
                                            onClick={() => handleCategoryChange(selectedCategories.filter(c => c !== category))}
                                            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-1"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tags Filter */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Tags</label>
                    <div className="space-y-2">
                        <Combobox
                            multiple
                            value={selectedTags}
                            onValueChange={handleTagChange}
                        >
                            <ComboboxTrigger className="w-full h-9 border border-input bg-transparent px-3 py-2 shadow-xs rounded-md">
                                <ComboboxInput placeholder="Select tags..." className="border-none shadow-none bg-transparent w-full" />
                            </ComboboxTrigger>
                            <ComboboxContent>
                                <ComboboxEmpty>No tags found.</ComboboxEmpty>
                                {tags?.map((tag) => (
                                    <ComboboxItem key={tag} value={tag}>
                                        {tag}
                                    </ComboboxItem>
                                ))}
                            </ComboboxContent>
                        </Combobox>
                        {selectedTags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {selectedTags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                        <button
                                            onClick={() => handleTagChange(selectedTags.filter(t => t !== tag))}
                                            className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-1"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Clear Button - Bottom Right */}
            {hasActiveFilters && (
                <div className="w-full flex justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="h-8 px-3 mt-3 text-xs bg-background border shadow-sm hover:bg-accent cursor-pointer"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Clear
                    </Button>
                </div>
            )}
        </div>
    );
}
