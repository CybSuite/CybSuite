"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    ComboboxAnchor,
    ComboboxBadgeItem,
    ComboboxBadgeList,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxTrigger,
} from "@/components/ui/combobox";
import { Root } from "@diceui/combobox";
import { Filter, Plus, X, ChevronDown } from "lucide-react";

interface LocalFilterMenuProps {
    table: any;
    columns?: any[]; // Add columns prop as backup
    onFiltersChange?: (hasFilters: boolean) => void;
    // Server-side support
    isServerManaged?: boolean;
    onServerFiltersChange?: (filters: any) => void;
    currentServerFilters?: any;
}

// Local Filter Menu Component (independent of URL parameters)
const LocalFilterMenu = React.forwardRef<
    { resetFilters: () => void },
    LocalFilterMenuProps
>(({ table, columns: directColumns, onFiltersChange, isServerManaged = false, onServerFiltersChange, currentServerFilters }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [filters, setFilters] = React.useState<any[]>([]);
    const [globalLogic, setGlobalLogic] = React.useState<'and' | 'or'>('and');

    // Initialize filters from server state if in server-managed mode
    React.useEffect(() => {
        if (isServerManaged) {
            if (currentServerFilters?.advancedFilters) {
                const formattedFilters = currentServerFilters.advancedFilters.map((filter: any, index: number) => ({
                    id: `filter-${index}`,
                    column: filter.column || '',
                    operator: filter.operator || '',
                    value: filter.value || '',
                }));
                setFilters(formattedFilters);
                setGlobalLogic(currentServerFilters.globalLogic || 'and');
            } else {
                // If currentServerFilters is empty or undefined, clear local filters
                setFilters([]);
                setGlobalLogic('and');
            }
        }
    }, [isServerManaged, currentServerFilters]);

    const filteredColumns = React.useMemo(() => {
        try {
            let allColumns: any[] = [];

            if (directColumns && directColumns.length > 0) {
                // Use direct columns if provided (for server-managed mode)
                allColumns = directColumns.map((col, index) => ({
                    id: col.id || col.accessorKey || `column-${index}`,
                    columnDef: col
                }));
            } else if (table && table.getAllColumns) {
                // Fallback to table columns
                allColumns = table.getAllColumns();
            } else {
                return [];
            }

            return allColumns.filter((column: any) =>
                column.columnDef.enableColumnFilter && column.columnDef.meta?.label
            );
        } catch {
            return [];
        }
    }, [table, directColumns]);

    // Filter operators based on column type
    const getFilterOperators = (columnType: string) => {
        switch (columnType) {
            case 'text':
                return [
                    { value: 'contains', label: 'contains' },
                    { value: 'does_not_contain', label: 'does not contain' },
                    { value: 'is', label: 'is' },
                    { value: 'is_not', label: 'is not' },
                    { value: 'is_empty', label: 'is empty' },
                    { value: 'is_not_empty', label: 'is not empty' },
                ];
            case 'select':
                return [
                    { value: 'has_any_of', label: 'has any of' },
                    { value: 'has_none_of', label: 'has none of' },
                    { value: 'is_empty', label: 'is empty' },
                    { value: 'is_not_empty', label: 'is not empty' },
                ];
            case 'multiSelect':
                return [
                    { value: 'has_any_of', label: 'has any of' },
                    { value: 'has_none_of', label: 'has none of' },
                    { value: 'is_empty', label: 'is empty' },
                    { value: 'is_not_empty', label: 'is not empty' },
                ];
            case 'number':
            case 'range':
                return [
                    { value: 'equals', label: 'equals' },
                    { value: 'not_equals', label: 'not equals' },
                    { value: 'greater_than', label: 'greater than' },
                    { value: 'less_than', label: 'less than' },
                    { value: 'greater_equal', label: 'greater than or equal' },
                    { value: 'less_equal', label: 'less than or equal' },
                    { value: 'is_empty', label: 'is empty' },
                    { value: 'is_not_empty', label: 'is not empty' },
                ];
            case 'date':
                return [
                    { value: 'is_on', label: 'is on' },
                    { value: 'is_before', label: 'is before' },
                    { value: 'is_after', label: 'is after' },
                    { value: 'is_between', label: 'is between' },
                    { value: 'is_empty', label: 'is empty' },
                    { value: 'is_not_empty', label: 'is not empty' },
                ];
            default:
                return [
                    { value: 'contains', label: 'contains' },
                    { value: 'is', label: 'is' },
                    { value: 'is_empty', label: 'is empty' },
                ];
        }
    };

    // Add new filter
    const addFilter = () => {
        const newFilter = {
            id: Date.now().toString(),
            column: '',
            operator: '',
            value: '',
        };
        setFilters([...filters, newFilter]);
    };

    // Update filter
    const updateFilter = (filterId: string, field: string, value: any) => {
        setFilters(prevFilters =>
            prevFilters.map(filter =>
                filter.id === filterId ? { ...filter, [field]: value } : filter
            )
        );
    };

    // Remove filter
    const removeFilter = (filterId: string) => {
        setFilters(prevFilters => prevFilters.filter(filter => filter.id !== filterId));
    };

    // Apply filters to the table (auto-apply on changes)
    const applyFilters = React.useCallback(() => {
        const validFilters = filters.filter(filter =>
            filter.column && filter.operator &&
            (filter.operator === 'is_empty' || filter.operator === 'is_not_empty' || filter.value !== '')
        );

        if (isServerManaged) {
            // Server-managed mode: call server callback
            const filterData = {
                advancedFilters: validFilters,
                globalLogic
            };
            onServerFiltersChange?.(filterData);
        } else {
            // Local mode: apply to table directly
            if (validFilters.length === 0) {
                table.setGlobalFilter(undefined);
            } else {
                table.setGlobalFilter({ advancedFilters: validFilters, globalLogic });
            }
        }
    }, [filters, globalLogic, table, isServerManaged, onServerFiltersChange]);

    // Auto-apply filters when filters or globalLogic changes (only for local mode)
    React.useEffect(() => {
        if (!isServerManaged) {
            // Only auto-apply for local (client-side) mode
            applyFilters();
        }
        onFiltersChange?.(filters.length > 0);
    }, [applyFilters, filters.length, onFiltersChange, isServerManaged]);

    // Reset filters
    const resetFilters = React.useCallback(() => {
        setFilters([]);
        setGlobalLogic('and');

        if (isServerManaged) {
            // Server-managed mode: call server callback with empty filters
            onServerFiltersChange?.({});
        } else {
            // Local mode: clear table filter
            table.setGlobalFilter(undefined);
        }
    }, [table, isServerManaged, onServerFiltersChange]);

    // Expose reset function to parent
    React.useImperativeHandle(ref, () => ({
        resetFilters
    }), [resetFilters]);

    // Render filter value input based on operator and column type
    const renderValueInput = (filter: any) => {
        const column = filteredColumns.find((col: any) => col.id === filter.column);
        const columnType = column?.columnDef?.meta?.variant || 'text';

        // Operators that don't need value input
        if (['is_empty', 'is_not_empty'].includes(filter.operator)) {
            return null;
        }

        if ((filter.operator === 'has_any_of' || filter.operator === 'has_none_of') &&
            (columnType === 'select' || columnType === 'multiSelect')) {
            const options = column?.columnDef?.meta?.options || [];
            const selectedValues = filter.value || [];

            return (
                <div className="space-y-2">
                    <Root
                        value={selectedValues}
                        onValueChange={(newValues: string[]) => updateFilter(filter.id, 'value', newValues)}
                        multiple
                        autoHighlight
                        onFilter={((ids: string[], inputValue: string) => {
                            return ids.filter((id) =>
                                options.find((item: any) => item.value === id).label.toLowerCase().includes(inputValue.toLowerCase() || '')
                            )
                        })}
                    >
                        <ComboboxAnchor className="h-full min-h-10 flex-wrap px-3 py-2">
                            <ComboboxBadgeList>
                                {selectedValues.map((value: string) => {
                                    const option = options.find((opt: any) => opt.value === value);
                                    return (
                                        <ComboboxBadgeItem key={value} value={value}>
                                            {option?.label || value}
                                        </ComboboxBadgeItem>
                                    );
                                })}
                            </ComboboxBadgeList>
                            <ComboboxInput
                                placeholder="Select..."
                                className="h-auto min-w-20 flex-1"
                            />
                            <ComboboxTrigger className="absolute top-3 right-2">
                                <ChevronDown className="h-4 w-4" />
                            </ComboboxTrigger>
                        </ComboboxAnchor>
                        <ComboboxContent className="w-fit">
                            <ComboboxInput placeholder="Search options..." />
                            <ComboboxEmpty>No options found.</ComboboxEmpty>
                            {options.map((option: any) => (
                                <ComboboxItem key={option.value} value={option.value}>
                                    {option.label}
                                </ComboboxItem>
                            ))}
                        </ComboboxContent>
                    </Root>
                </div>
            );
        }

        // Special handling for date between operator
        if (filter.operator === 'is_between' && columnType === 'date') {
            const dateRange = filter.value || { start: '', end: '' };
            return (
                <div className="space-y-2">
                    <div className="flex space-x-2">
                        <div className="flex-1">
                            <Input
                                placeholder="Start date"
                                value={dateRange.start || ''}
                                onChange={(e) => updateFilter(filter.id, 'value', { ...dateRange, start: e.target.value })}
                                className="h-8"
                                type="date"
                            />
                        </div>
                        <div className="flex-1">
                            <Input
                                placeholder="End date"
                                value={dateRange.end || ''}
                                onChange={(e) => updateFilter(filter.id, 'value', { ...dateRange, end: e.target.value })}
                                className="h-8"
                                type="date"
                            />
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <Input
                placeholder={`Enter ${columnType} value...`}
                value={filter.value || ''}
                onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                className="h-8"
                type={columnType === 'number' ? 'number' : columnType === 'date' ? 'date' : 'text'}
            />
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="border-dashed">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                    {filters.length > 0 && (
                        <Badge variant="secondary" className="ml-2 px-1 font-normal">
                            {filters.length}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="min-w-[600px] w-fit p-0" align="end">
                <div className="p-4 border-b">
                    <h4 className="font-medium mb-1">Filters</h4>
                    <p className="text-sm text-muted-foreground">
                        Add conditions to filter your data
                    </p>
                </div>

                {/* Global Logic Selector */}
                {filters.length > 1 && (
                    <div className="p-4 border-b">
                        <div className="flex items-center space-x-3">
                            <label className="text-sm font-medium">Apply logic:</label>
                            <Select
                                value={globalLogic}
                                onValueChange={(value: 'and' | 'or') => setGlobalLogic(value)}
                            >
                                <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="and">AND</SelectItem>
                                    <SelectItem value="or">OR</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="text-sm text-muted-foreground">
                                ({globalLogic.toUpperCase()} - All conditions must {globalLogic === 'and' ? 'be true' : 'have at least one true'})
                            </span>
                        </div>
                    </div>
                )}

                <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                    {filters.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <p className="text-sm">No filters added yet.</p>
                            <p className="text-xs mt-1">Click "Add filter" to get started.</p>
                        </div>
                    )}

                    {filters.map((filter, index) => (
                        <div key={filter.id} className="space-y-3">
                            {/* Show logic indicator for multiple filters */}
                            {index > 0 && (
                                <div className="flex items-center justify-center">
                                    <Badge variant="outline" className="text-xs">
                                        {globalLogic.toUpperCase()}
                                    </Badge>
                                </div>
                            )}

                            <div className="flex items-start space-x-2 p-3 border rounded-lg bg-muted/20">
                                {/* Where (Column Selection) */}
                                <div className="flex-1 space-y-2">
                                    <label className="text-xs font-medium text-muted-foreground">Where</label>
                                    <Select
                                        value={filter.column}
                                        onValueChange={(value) => {
                                            updateFilter(filter.id, 'column', value);
                                            updateFilter(filter.id, 'operator', '');
                                            updateFilter(filter.id, 'value', '');
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-full">
                                            <SelectValue placeholder="Select column..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredColumns.map((column: any) => (
                                                <SelectItem key={column.id} value={column.id}>
                                                    {column.columnDef.meta?.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Operator */}
                                {filter.column && (
                                    <div className="flex-1 space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Condition</label>
                                        <Select
                                            value={filter.operator}
                                            onValueChange={(value) => {
                                                updateFilter(filter.id, 'operator', value);
                                                updateFilter(filter.id, 'value', '');
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-full">
                                                <SelectValue placeholder="Select condition..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(() => {
                                                    const column = filteredColumns.find((col: any) => col.id === filter.column);
                                                    const columnType = column?.columnDef?.meta?.variant || 'text';
                                                    return getFilterOperators(columnType).map((operator) => (
                                                        <SelectItem key={operator.value} value={operator.value}>
                                                            {operator.label}
                                                        </SelectItem>
                                                    ));
                                                })()}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Value Input */}
                                {filter.column && filter.operator && (
                                    <div className="flex-2 space-y-2">
                                        {filter.operator === 'is_between' ? (
                                            <label className="text-xs font-medium text-muted-foreground">Date range</label>
                                        ) : (
                                            <label className="text-xs font-medium text-muted-foreground">Value</label>
                                        )}
                                        {renderValueInput(filter)}
                                    </div>
                                )}

                                {/* Delete Button */}
                                <div className="pt-6">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeFilter(filter.id)}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="p-4 border-t">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addFilter}
                            className="flex-1"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add filter
                        </Button>
                        {isServerManaged && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={applyFilters}
                                className="flex-1"
                            >
                                Apply filters
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={resetFilters}
                            disabled={filters.length === 0}
                            className="flex-1"
                        >
                            Reset filters
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
});

LocalFilterMenu.displayName = "LocalFilterMenu";

export { LocalFilterMenu };
