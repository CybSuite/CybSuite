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
import { Switch } from "@/components/ui/switch";
import { api, ApiResponse } from "@/app/lib/api";

interface LocalFilterMenuProps {
    table: any;
    columns?: any[]; // Add columns prop as backup
    currentEntity?: string;
    onFiltersChange?: (hasFilters: boolean) => void;
    // Server-side support
    isServerManaged?: boolean;
    onServerFiltersChange?: (filters: any) => void;
    currentServerFilters?: any;
}

interface FilterItem {
    id: string;
    column: string;
    operator: string;
    value: any;
    negated: boolean;
    fieldPath?: string[]; // Array of field names for recursive foreign key navigation (e.g., ['services', 'service_smbs', 'smbv'])
    caseSensitive?: boolean; // Whether the filter should be case-sensitive (default: false for case-insensitive)
}

const LocalFilterMenu = React.forwardRef<
    { resetFilters: () => void },
    LocalFilterMenuProps
>(({ table, columns: directColumns, onFiltersChange, isServerManaged = false, onServerFiltersChange, currentServerFilters, currentEntity }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [filters, setFilters] = React.useState<any[]>([]);
    const [globalLogic, setGlobalLogic] = React.useState<'and' | 'or'>('and');

    // Initialize filters from server state if in server-managed mode
    React.useEffect(() => {
        if (isServerManaged) {
            if (currentServerFilters?.advancedFilters) {
                const formattedFilters = currentServerFilters.advancedFilters.map((filter: any, index: number) => {
                    // Parse field path from column name if it contains dots
                    let column = filter.column || '';
                    let fieldPath: string[] = [];

                    if (column.includes('.')) {
                        const parts = column.split('.');
                        column = parts[0];
                        fieldPath = parts.slice(1); // Handle nested field paths
                    }

                    return {
                        id: `filter-${index}`,
                        column: column,
                        operator: filter.operator || '',
                        value: filter.value || '',
                        negated: filter.negated || false,
                        fieldPath: fieldPath,
                        caseSensitive: filter.caseSensitive ?? false, // Default to case-insensitive
                    };
                });
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

    // Helper function to check if a column is a foreign key relation
    const isForeignKeyColumn = (column: any) => {
        // Check if the column meta has a relatedEntity specified
        const meta = column?.columnDef?.meta;
        const relatedEntity = meta?.relatedEntity;

        // A column is a foreign key if it has a relatedEntity specified
        return !!relatedEntity;
    };

    const [foreignKeySchemas, setForeignKeySchemas] = React.useState<Record<string, any[]>>({});
    const [loadingSchemas, setLoadingSchemas] = React.useState<Set<string>>(new Set());

    // State for nested foreign key schemas (for recursive field paths)
    const [nestedSchemas, setNestedSchemas] = React.useState<Record<string, any>>({});
    const [loadingNestedSchemas, setLoadingNestedSchemas] = React.useState<Set<string>>(new Set());

    // State for entity options (for foreign key field filtering)
    const [entityOptions, setEntityOptions] = React.useState<Record<string, any[]>>({});
    const [loadingEntityOptions, setLoadingEntityOptions] = React.useState<Set<string>>(new Set()); const foreignKeySchemasRef = React.useRef(foreignKeySchemas);
    const loadingSchemasRef = React.useRef(loadingSchemas);

    React.useEffect(() => {
        foreignKeySchemasRef.current = foreignKeySchemas;
    }, [foreignKeySchemas]);

    React.useEffect(() => {
        loadingSchemasRef.current = loadingSchemas;
    }, [loadingSchemas]);

    const fetchForeignKeySchema = React.useCallback(async (column: any) => {
        const columnId = column.id;

        // Don't fetch if already cached or loading
        if (foreignKeySchemasRef.current[columnId] || loadingSchemasRef.current.has(columnId)) {
            return;
        }

        // Start loading
        setLoadingSchemas(prev => new Set([...prev, columnId]));

        try {
            // Extract the related entity name from the column metadata
            const meta = column?.columnDef?.meta;
            let relatedEntity = meta?.relatedEntity || null;

            if (!relatedEntity) {
                return;
            }

            // Fetch the schema for the related entity
            const response: ApiResponse = await api.schema.getEntitySchema(relatedEntity);
            if (response.error) {
                return;
            }

            const schema = await response.data;

            const allSchemaFields = Object.values(schema.fields);

            const fields = allSchemaFields
                .filter((field: any) => {
                    if (currentEntity && field.referenced_entity === currentEntity) {
                        return false;
                    }

                    const hasValidAnnotation = field.annotation && (
                        field.annotation.includes('str') ||
                        field.annotation.includes('int') ||
                        field.annotation.includes('float') ||
                        field.annotation.includes('bool') ||
                        field.annotation.includes('date') ||
                        field.annotation.includes('Entity(')
                    );

                    return hasValidAnnotation;
                })
                .map((field: any) => {
                    // Use the same parseFieldAnnotation logic as main columns to ensure consistency
                    // First check if server provided referenced_entity (prioritize server data)
                    let relatedEntity = field.referenced_entity || null;

                    // Determine variant from annotation and field properties
                    let variant = 'text'; // default
                    let options = undefined; // for enum/select fields

                    if (field.annotation) {
                        if (field.annotation.includes('int')) {
                            variant = 'number';
                        } else if (field.annotation.includes('float')) {
                            variant = 'number';
                        } else if (field.annotation.includes('bool')) {
                            variant = 'boolean';
                        } else if (field.annotation.includes('date')) {
                            variant = 'date';
                        } else if (field.annotation.includes('str')) {
                            // Check if it's an enum field by looking for choices
                            if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
                                variant = 'select';
                                options = field.choices.map((choice: any) => ({
                                    value: choice.value || choice,
                                    label: choice.label || choice.display_name || choice.value || choice
                                }));
                            } else {
                                variant = 'text';
                            }
                        } else if (field.annotation.includes('Entity(')) {
                            // This is a foreign key field - use 'foreignKey' variant
                            variant = 'foreignKey';

                            // If server didn't provide referenced_entity, fallback to annotation parsing
                            if (!relatedEntity) {
                                const entityMatch = field.annotation.match(/Entity\(['"]([^'"]+)['"]\)/);
                                if (entityMatch) {
                                    relatedEntity = entityMatch[1];
                                }
                            }
                        }
                    }

                    return {
                        id: field.name,
                        name: field.name,
                        label: field.display_name || field.pretty_name || field.name,
                        relatedEntity: relatedEntity, // Store related entity name for foreign keys
                        meta: {
                            variant: variant,
                            nullable: field.nullable,
                            description: field.description,
                            options: options, // Include options for select fields
                            relatedEntity: relatedEntity // Also store in meta for consistency
                        }
                    };
                });

            // Cache the result and trigger re-render
            setForeignKeySchemas(prev => ({
                ...prev,
                [columnId]: fields
            }));

        } catch (error) {
            // Silent error handling
        } finally {
            // Remove from loading set
            setLoadingSchemas(prev => {
                const newSet = new Set(prev);
                newSet.delete(columnId);
                return newSet;
            });
        }
    }, []); // Empty dependency array to prevent infinite loops

    // Get available fields from a foreign key relation (synchronous, returns cached data)
    const getForeignKeyFields = React.useCallback((column: any) => {
        const columnId = column.id;
        return foreignKeySchemas[columnId] || [];
    }, [foreignKeySchemas]);

    // Recursive function to fetch schema for a field path and prevent cycles
    const fetchNestedSchema = React.useCallback(async (entityName: string, visitedEntities: Set<string> = new Set()): Promise<any> => {
        // Prevent infinite loops by checking if we've already visited this entity
        if (visitedEntities.has(entityName)) {
            return null;
        }

        // Check if already cached
        if (nestedSchemas[entityName]) {
            return nestedSchemas[entityName];
        }

        // Check if currently loading
        if (loadingNestedSchemas.has(entityName)) {
            return null;
        }

        // Start loading
        setLoadingNestedSchemas(prev => new Set([...prev, entityName]));

        try {
            const response: ApiResponse = await api.schema.getEntitySchema(entityName);
            if (response.error) {
                return null;
            }

            const schema = await response.data;

            // Cache the schema
            setNestedSchemas(prev => ({
                ...prev,
                [entityName]: schema
            }));

            return schema;
        } catch (error) {
            return null;
        } finally {
            setLoadingNestedSchemas(prev => {
                const newSet = new Set(prev);
                newSet.delete(entityName);
                return newSet;
            });
        }
    }, [nestedSchemas, loadingNestedSchemas]);

    // Fetch entity options for foreign key fields
    const fetchEntityOptions = React.useCallback(async (entityName: string) => {
        // Don't fetch if already cached or loading
        if (entityOptions[entityName] || loadingEntityOptions.has(entityName)) {
            return;
        }

        // Add to loading set
        setLoadingEntityOptions(prev => new Set(prev).add(entityName));

        try {
            const response = await api.data.getEntityOptions(entityName);

            if (response.error) {
                return;
            }

            const options = response.data?.map((item: any) => ({
                value: item.id.toString(),
                label: item.repr
            })) || [];

            // Cache the result
            setEntityOptions(prev => ({
                ...prev,
                [entityName]: options
            }));
        } catch (error) {
            // Silent error handling
        } finally {
            // Remove from loading set
            setLoadingEntityOptions(prev => {
                const newSet = new Set(prev);
                newSet.delete(entityName);
                return newSet;
            });
        }
    }, [entityOptions, loadingEntityOptions]);

    // Get entity options (synchronous, returns cached data)
    const getEntityOptions = React.useCallback((entityName: string) => {
        return entityOptions[entityName] || [];
    }, [entityOptions]);

    // Preload foreign key schemas when filteredColumns change
    React.useEffect(() => {
        filteredColumns.forEach(column => {
            if (isForeignKeyColumn(column)) {
                // Trigger schema loading by calling fetchForeignKeySchema
                fetchForeignKeySchema(column);
            }
        });
    }, [filteredColumns]); // Removed fetchForeignKeySchema dependency to prevent infinite loop

    // Component for recursive field path selection
    const FieldPathSelector = ({ filter, column }: { filter: FilterItem, column: any }) => {
        const fieldPath = filter.fieldPath || [];

        // Preload schemas for the current field path
        React.useEffect(() => {
            const loadSchemasForPath = async () => {
                if (!column?.columnDef?.meta?.relatedEntity) return;

                let currentEntityName = column.columnDef.meta.relatedEntity;

                // Load the initial schema
                if (!nestedSchemas[currentEntityName] && !loadingNestedSchemas.has(currentEntityName)) {
                    fetchNestedSchema(currentEntityName);
                }

                // Load schemas for each step in the field path
                for (let i = 0; i < fieldPath.length; i++) {
                    const currentSchema = nestedSchemas[currentEntityName];
                    if (currentSchema) {
                        const fieldName = fieldPath[i];
                        const field = currentSchema.fields[fieldName];
                        if (field && field.referenced_entity) {
                            const nextEntityName = field.referenced_entity;
                            if (!nestedSchemas[nextEntityName] && !loadingNestedSchemas.has(nextEntityName)) {
                                fetchNestedSchema(nextEntityName);
                            }
                            currentEntityName = nextEntityName;
                        }
                    }
                }
            };

            loadSchemasForPath();
        }, [fieldPath, column, nestedSchemas, loadingNestedSchemas, fetchNestedSchema]);

        // Get available fields for the current level (synchronous, no side effects)
        const getAvailableFields = (pathIndex: number) => {
            if (pathIndex === 0) {
                // First level - get fields from the main column's foreign key schema
                return getForeignKeyFields(column);
            } else {
                // Nested level - only return cached data, no side effects
                const currentPath = fieldPath.slice(0, pathIndex);

                let currentEntityName = column?.columnDef?.meta?.relatedEntity;
                if (!currentEntityName) return [];

                // Navigate through the cached schemas only
                for (let i = 0; i < currentPath.length; i++) {
                    const currentSchema = nestedSchemas[currentEntityName];
                    if (!currentSchema) return []; // Schema not loaded yet

                    const fieldName = currentPath[i];
                    const field = currentSchema.fields[fieldName];
                    if (!field) return [];

                    // If this is the last field in the path, return its related fields
                    if (i === currentPath.length - 1) {
                        if (field.referenced_entity) {
                            const targetSchema = nestedSchemas[field.referenced_entity];
                            if (targetSchema) {
                                return Object.values(targetSchema.fields)
                                    .filter((f: any) => {
                                        // Filter out self-references and parent entity references
                                        if (currentEntity && f.referenced_entity === currentEntity) {
                                            return false;
                                        }
                                        // Prevent cycles by checking if referenced entity is already in the path
                                        const entitiesInPath = [column.columnDef.meta.relatedEntity];
                                        let tempEntity = column.columnDef.meta.relatedEntity;
                                        for (let j = 0; j < i; j++) {
                                            const tempSchema = nestedSchemas[tempEntity];
                                            if (tempSchema && tempSchema.fields[currentPath[j]]) {
                                                tempEntity = tempSchema.fields[currentPath[j]].referenced_entity;
                                                if (tempEntity) entitiesInPath.push(tempEntity);
                                            }
                                        }
                                        if (f.referenced_entity && entitiesInPath.includes(f.referenced_entity)) {
                                            return false;
                                        }

                                        const hasValidAnnotation = f.annotation && (
                                            f.annotation.includes('str') ||
                                            f.annotation.includes('int') ||
                                            f.annotation.includes('float') ||
                                            f.annotation.includes('bool') ||
                                            f.annotation.includes('date') ||
                                            f.annotation.includes('Entity(')
                                        );
                                        return hasValidAnnotation;
                                    })
                                    .map((f: any) => {
                                        // Use server-provided referenced_entity first, fallback to annotation parsing
                                        let relatedEntity = f.referenced_entity || null;
                                        let variant = 'text';
                                        let options = undefined;

                                        if (f.annotation) {
                                            if (f.annotation.includes('int')) variant = 'number';
                                            else if (f.annotation.includes('float')) variant = 'number';
                                            else if (f.annotation.includes('bool')) variant = 'boolean';
                                            else if (f.annotation.includes('date')) variant = 'date';
                                            else if (f.annotation.includes('str')) {
                                                if (f.choices && Array.isArray(f.choices) && f.choices.length > 0) {
                                                    variant = 'select';
                                                    options = f.choices.map((choice: any) => ({
                                                        value: choice.value || choice,
                                                        label: choice.label || choice.display_name || choice.value || choice
                                                    }));
                                                } else {
                                                    variant = 'text';
                                                }
                                            } else if (f.annotation.includes('Entity(')) {
                                                variant = 'foreignKey';
                                                if (!relatedEntity) {
                                                    const entityMatch = f.annotation.match(/Entity\(['"]([^'"]+)['"]\)/);
                                                    if (entityMatch) {
                                                        relatedEntity = entityMatch[1];
                                                    }
                                                }
                                            }
                                        }

                                        return {
                                            id: f.name,
                                            name: f.name,
                                            label: f.display_name || f.pretty_name || f.name,
                                            relatedEntity: relatedEntity,
                                            meta: {
                                                variant: variant,
                                                nullable: f.nullable,
                                                description: f.description,
                                                options: options,
                                                relatedEntity: relatedEntity
                                            }
                                        };
                                    });
                            } else {
                                // Target schema not loaded yet
                                return [];
                            }
                        } else {
                            // This field doesn't have sub-fields
                            return [];
                        }
                    } else {
                        // Continue to next level
                        currentEntityName = field.referenced_entity;
                        if (!currentEntityName) return [];
                    }
                }

                return [];
            }
        };

        // Add a new level to the field path
        const addFieldToPath = (fieldName: string, pathIndex: number) => {
            const newPath = [...fieldPath];
            newPath[pathIndex] = fieldName;
            // Remove any levels beyond this one
            const finalPath = newPath.slice(0, pathIndex + 1);
            updateFilter(filter.id, 'fieldPath', finalPath);
        };

        // Remove levels from the field path
        const removeFieldFromPath = (pathIndex: number) => {
            const newPath = fieldPath.slice(0, pathIndex);
            updateFilter(filter.id, 'fieldPath', newPath);
        };

        // Check if we can add another level (if current field is a foreign key)
        const canAddNextLevel = (pathIndex: number) => {
            if (pathIndex >= fieldPath.length) return false;

            const availableFields = getAvailableFields(pathIndex + 1);
            return availableFields.length > 0;
        };

        return (
            <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                    {fieldPath.length > 1 ? "Fields" : "Field"} (optional)
                </label>

                {/* First level selector */}
                <Select
                    value={fieldPath[0] || '__relation_itself__'}
                    onValueChange={(value) => {
                        if (value === '__relation_itself__') {
                            updateFilter(filter.id, 'fieldPath', []);
                        } else {
                            addFieldToPath(value, 0);
                        }
                    }}
                >
                    <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select field..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__relation_itself__">
                            <span className="text-muted-foreground italic">
                                Filter with objects
                            </span>
                        </SelectItem>
                        {getAvailableFields(0).map((field: any) => {
                            const fieldValue = field.id || field.name || `field_${Math.random().toString(36).substr(2, 9)}`;
                            return (
                                <SelectItem key={fieldValue} value={fieldValue}>
                                    <span className="flex items-center">
                                        {field.label || field.name || 'Unnamed Field'}
                                    </span>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>

                {/* Nested level selectors */}
                {fieldPath.map((selectedField, index) => {
                    const availableFields = getAvailableFields(index + 1);
                    const hasNextLevel = fieldPath.length > index + 1;
                    const canAddNext = canAddNextLevel(index);

                    // Check if the current selected field is a foreign key that can have nested fields
                    const currentLevelFields = getAvailableFields(index);
                    const currentSelectedField = currentLevelFields.find(f => (f.id || f.name) === selectedField);
                    const currentFieldIsForeignKey = currentSelectedField?.meta?.variant === 'foreignKey';

                    // Only show continuation if current field is a foreign key
                    const shouldShowContinuation = currentFieldIsForeignKey && (hasNextLevel || canAddNext);

                    return (
                        <div key={index} className="space-y-2">
                            {shouldShowContinuation && (
                                <div className="flex items-center space-x-2">
                                    <div className="w-4 h-px bg-gray-300"></div>
                                    <span className="text-xs text-gray-500">then</span>
                                    <div className="flex-1 h-px bg-gray-300"></div>
                                </div>
                            )}

                            {shouldShowContinuation && (
                                <Select
                                    value={fieldPath[index + 1] || '__stop_here__'}
                                    onValueChange={(value) => {
                                        if (value === '__stop_here__') {
                                            removeFieldFromPath(index + 1);
                                        } else {
                                            addFieldToPath(value, index + 1);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-8 w-full">
                                        <SelectValue placeholder="Select nested field..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__stop_here__">
                                            <span className="text-muted-foreground italic">
                                                Filter with objects
                                            </span>
                                        </SelectItem>
                                        {availableFields.map((field: any) => {
                                            const fieldValue = field.id || field.name || `field_${Math.random().toString(36).substr(2, 9)}`;
                                            return (
                                                <SelectItem key={fieldValue} value={fieldValue}>
                                                    <span className="flex items-center">
                                                        {field.label || field.name || 'Unnamed Field'}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // Preload entity options for foreign key fields when schemas are loaded
    React.useEffect(() => {
        const allFields = Object.values(foreignKeySchemas).flat();

        allFields.forEach((field: any) => {
            if (field.meta?.variant === 'foreignKey' && field.relatedEntity) {
                fetchEntityOptions(field.relatedEntity);
            }
        });
    }, [foreignKeySchemas, fetchEntityOptions]);

    // Get all available columns (only base columns, no foreign key expansion)
    const getAllFilterableColumns = React.useMemo(() => {
        return filteredColumns.map(column => ({
            ...column,
            displayName: column.columnDef.meta?.label,
            isForeignKey: isForeignKeyColumn(column)
        }));
    }, [filteredColumns, foreignKeySchemas]); // Keep foreignKeySchemas dependency for reactivity

    // Filter operators based on column type (only positive operators, negation handled by toggle)
    const getFilterOperators = (columnType: string, nullable: boolean = true) => {
        const baseOperators = (() => {
            switch (columnType) {
                case 'text':
                    return [
                        { value: 'contains', label: 'contains' },
                        { value: 'is', label: 'is' },
                    ];
                case 'select':
                    return [
                        { value: 'has_any_of', label: 'has any of' },
                    ];
                case 'multiSelect':
                    return [
                        { value: 'has_any_of', label: 'has any of' },
                    ];
                case 'foreignKey':
                    // Foreign key relations - only use operators that work with relations
                    return [
                        { value: 'has_any_of', label: 'has any of' },
                    ];
                case 'number':
                case 'range':
                    return [
                        { value: 'equals', label: 'equals (=)' },
                        { value: 'greater_than', label: 'greater than (>)' },
                        { value: 'less_than', label: 'less than (<)' },
                        { value: 'greater_equal', label: 'greater than or equal (≥)' },
                        { value: 'less_equal', label: 'less than or equal (≤)' },
                    ];
                case 'date':
                    return [
                        { value: 'is_on', label: 'is on' },
                        { value: 'is_before', label: 'is before' },
                        { value: 'is_after', label: 'is after' },
                        { value: 'is_between', label: 'is between' },
                    ];
                case 'boolean':
                    return [
                        { value: 'is', label: 'is' },
                    ];
                default:
                    return [
                        { value: 'contains', label: 'contains' },
                        { value: 'is', label: 'is' },
                    ];
            }
        })();

        // Add "is none" operator only for nullable columns
        if (nullable) {
            baseOperators.push({ value: 'is_none', label: 'is none' });
        }

        return baseOperators;
    };

    // Add new filter
    const addFilter = () => {
        const newFilter: FilterItem = {
            id: `filter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            column: '',
            operator: '',
            value: '',
            negated: false,
            fieldPath: [], // Empty path for new filters
            caseSensitive: false, // Default to case-insensitive
        };
        setFilters([...filters, newFilter]);
    };

    // Update filter
    const updateFilter = (filterId: string, field: string, value: any) => {
        setFilters(prevFilters =>
            prevFilters.map(filter => {
                if (filter.id === filterId) {
                    const updatedFilter = { ...filter, [field]: value };

                    // Handle column selection - reset related fields
                    if (field === 'column') {
                        // Reset operator and value when column changes
                        updatedFilter.operator = '';
                        updatedFilter.value = '';
                        // Reset field path
                        updatedFilter.fieldPath = [];
                    }

                    // Handle field path update - reset operator and value
                    if (field === 'fieldPath') {
                        // Reset operator and value when field path changes
                        updatedFilter.operator = '';
                        updatedFilter.value = '';
                    }

                    return updatedFilter;
                }
                return filter;
            })
        );
    };    // Remove filter
    const removeFilter = (filterId: string) => {
        setFilters(prevFilters => prevFilters.filter(filter => filter.id !== filterId));
    };

    // Apply filters to the table (auto-apply on changes)
    const applyFilters = React.useCallback(() => {
        const validFilters = filters.filter(filter => {
            // Basic validation: column and operator must be set
            if (!filter.column || !filter.operator) {
                return false;
            }

            // Special case for operators that don't need values
            if (filter.operator === 'is_none') {
                return true;
            }

            // Special case for "is" operator with empty string value
            if (filter.operator === 'is' && filter.value === '') {
                return true;
            }

            // For other operators, value must not be empty
            // Handle both regular values and object values (like date ranges)
            if (typeof filter.value === 'object' && filter.value !== null) {
                // For object values (like date ranges), check if it has meaningful content
                if (filter.operator === 'is_between' && filter.value.start && filter.value.end) {
                    return true;
                }
                // For array values (like multi-select)
                if (Array.isArray(filter.value) && filter.value.length > 0) {
                    return true;
                }
                return false;
            }

            // For primitive values, check if not empty
            return filter.value !== '' && filter.value !== null && filter.value !== undefined;
        });

        if (isServerManaged) {
            // Server-managed mode: call server callback
            const filterData = {
                advancedFilters: validFilters.map(filter => ({
                    column: filter.fieldPath && filter.fieldPath.length > 0
                        ? `${filter.column}.${filter.fieldPath.join('.')}`
                        : filter.column,
                    operator: filter.operator,
                    value: filter.value,
                    negated: filter.negated,
                    caseSensitive: filter.caseSensitive ?? false, // Default to case-insensitive
                })),
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

    // Helper function to get the final field in a field path
    const getFinalFieldFromPath = (column: any, fieldPath: string[]) => {
        if (!fieldPath || fieldPath.length === 0) {
            return null;
        }

        let currentEntityName = column?.columnDef?.meta?.relatedEntity;
        if (!currentEntityName) return null;

        for (let i = 0; i < fieldPath.length; i++) {
            const currentSchema = nestedSchemas[currentEntityName];
            if (!currentSchema) return null;

            const fieldName = fieldPath[i];
            const field = currentSchema.fields[fieldName];
            if (!field) return null;

            if (i === fieldPath.length - 1) {
                // This is the final field
                let variant = 'text';
                let options = undefined;
                let relatedEntity = field.referenced_entity || null;

                if (field.annotation) {
                    if (field.annotation.includes('int')) variant = 'number';
                    else if (field.annotation.includes('float')) variant = 'number';
                    else if (field.annotation.includes('bool')) variant = 'boolean';
                    else if (field.annotation.includes('date')) variant = 'date';
                    else if (field.annotation.includes('str')) {
                        if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
                            variant = 'select';
                            options = field.choices.map((choice: any) => ({
                                value: choice.value || choice,
                                label: choice.label || choice.display_name || choice.value || choice
                            }));
                        } else {
                            variant = 'text';
                        }
                    } else if (field.annotation.includes('Entity(')) {
                        variant = 'foreignKey';
                        if (!relatedEntity) {
                            const entityMatch = field.annotation.match(/Entity\(['"]([^'"]+)['"]\)/);
                            if (entityMatch) {
                                relatedEntity = entityMatch[1];
                            }
                        }
                    }
                }

                return {
                    id: field.name,
                    name: field.name,
                    label: field.display_name || field.pretty_name || field.name,
                    relatedEntity: relatedEntity,
                    meta: {
                        variant: variant,
                        nullable: field.nullable,
                        description: field.description,
                        options: options,
                        relatedEntity: relatedEntity
                    }
                };
            } else {
                // Continue to next level
                currentEntityName = field.referenced_entity;
                if (!currentEntityName) return null;
            }
        }

        return null;
    };

    // Helper function to determine if case sensitivity toggle should be shown
    const shouldShowCaseSensitivityToggle = (filter: FilterItem) => {
        // Only show for contains and is operators
        if (!['contains', 'is'].includes(filter.operator)) {
            return false;
        }

        // Find column to check its type
        const column = getAllFilterableColumns.find((col: any) => col.id === filter.column);
        let columnType = column?.columnDef?.meta?.variant || column?.columnDef?.meta?.type || 'text';

        // If a field path is selected, get the final field's type
        if (filter.fieldPath && filter.fieldPath.length > 0 && column?.isForeignKey) {
            const finalField = getFinalFieldFromPath(column, filter.fieldPath);
            if (finalField) {
                columnType = finalField.meta?.variant || 'text';
            }
        }

        // Only show for text-based fields (not select, boolean, number, date, etc.)
        // Include 'text', 'string', and default case when type is unspecified
        return ['text', 'string'].includes(columnType) || (!columnType || columnType === 'text');
    };

    // Render filter value input based on operator and column type
    const renderValueInput = (filter: any) => {
        // Find column in the combined list
        const column = getAllFilterableColumns.find((col: any) => col.id === filter.column);
        let columnType = column?.columnDef?.meta?.variant || column?.columnDef?.meta?.type || 'text';
        let fieldOptions = column?.columnDef?.meta?.options || [];

        // If a field path is selected, get the final field's type and options
        if (filter.fieldPath && filter.fieldPath.length > 0 && column?.isForeignKey) {
            const finalField = getFinalFieldFromPath(column, filter.fieldPath);

            if (finalField) {
                columnType = finalField.meta?.variant || 'text';

                // For foreign key fields, fetch entity options
                if (columnType === 'foreignKey' && finalField.relatedEntity) {
                    fieldOptions = getEntityOptions(finalField.relatedEntity);
                    // Trigger fetch if options are not available
                    if (fieldOptions.length === 0) {
                        fetchEntityOptions(finalField.relatedEntity);
                    }
                } else {
                    // For enum/select fields, use predefined options
                    fieldOptions = finalField.meta?.options || [];
                }
            }
        }

        // Operators that don't need value input
        if (['is_none'].includes(filter.operator)) {
            return null;
        }

        if (filter.operator === 'has_any_of' &&
            (columnType === 'select' || columnType === 'multiSelect' || columnType === 'foreignKey')) {
            const options = fieldOptions;
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
                            <div className="max-h-60 overflow-y-auto">
                                <ComboboxEmpty>No options found.</ComboboxEmpty>
                                {options.map((option: any) => {
                                    const optionValue = option.value || `option_${Math.random().toString(36).substr(2, 9)}`;
                                    return (
                                        <ComboboxItem key={optionValue} value={optionValue}>
                                            {option.label || optionValue}
                                        </ComboboxItem>
                                    );
                                })}
                            </div>
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

        // Handle "is" operator for select/enum fields
        if (filter.operator === 'is' &&
            (columnType === 'select' || columnType === 'foreignKey') &&
            fieldOptions.length > 0) {
            return (
                <Select
                    value={filter.value || '__unselected__'}
                    onValueChange={(value) => {
                        if (value === '__unselected__') {
                            updateFilter(filter.id, 'value', '');
                        } else {
                            updateFilter(filter.id, 'value', value);
                        }
                    }}
                >
                    <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select value..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__unselected__">
                            <span className="text-muted-foreground italic">Select...</span>
                        </SelectItem>
                        {fieldOptions.map((option: any) => {
                            const optionValue = option.value || `option_${Math.random().toString(36).substr(2, 9)}`;
                            return (
                                <SelectItem key={optionValue} value={optionValue}>
                                    {option.label || optionValue}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            );
        }

        // Handle boolean fields
        if (columnType === 'boolean') {
            return (
                <Select
                    value={filter.value || '__unselected__'}
                    onValueChange={(value) => {
                        if (value === '__unselected__') {
                            updateFilter(filter.id, 'value', '');
                        } else {
                            updateFilter(filter.id, 'value', value);
                        }
                    }}
                >
                    <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="Select value..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__unselected__">
                            <span className="text-muted-foreground italic">Select...</span>
                        </SelectItem>
                        <SelectItem value="true">True</SelectItem>
                        <SelectItem value="false">False</SelectItem>
                    </SelectContent>
                </Select>
            );
        }

        // Check if we should show case sensitivity toggle for this filter
        const showCaseSensitivityToggle = shouldShowCaseSensitivityToggle(filter);

        if (showCaseSensitivityToggle) {
            // Render input with case sensitivity toggle
            return (
                <div className="relative">
                    <Input
                        placeholder={`Enter ${columnType} value...`}
                        value={filter.value || ''}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        className="h-8 pr-10"
                        type={columnType === 'number' ? 'number' : columnType === 'date' ? 'date' : 'text'}
                    />
                    <Button
                        variant={filter.caseSensitive ? "default" : "ghost"}
                        size="sm"
                        onClick={() => updateFilter(filter.id, 'caseSensitive', !filter.caseSensitive)}
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 text-xs font-mono"
                        title={filter.caseSensitive ? "Case sensitive" : "Case insensitive"}
                    >
                        Aa
                    </Button>
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
                        Add conditions to filter your data.
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

                            <div className={`p-3 border rounded-lg ${filter.isForeignKey ? 'bg-blue-50 border-blue-200' : 'bg-muted/20'}`}>
                                <div className="flex items-start space-x-2">
                                    {/* Foreign Key Indicator */}
                                    {filter.isForeignKey && (
                                        <div className="flex-shrink-0 pt-6">
                                            <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                                Related
                                            </Badge>
                                        </div>
                                    )}

                                    {/* Where (Column Selection) */}
                                    <div className="flex-1 space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground">Where</label>
                                        <Select
                                            value={filter.column}
                                            onValueChange={(value) => {
                                                updateFilter(filter.id, 'column', value);
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-full">
                                                <SelectValue placeholder="Select column..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {getAllFilterableColumns.map((column: any) => {
                                                    const columnValue = column.id || `column_${Math.random().toString(36).substr(2, 9)}`;
                                                    return (
                                                        <SelectItem key={columnValue} value={columnValue}>
                                                            {column.displayName || 'Unnamed Column'}
                                                        </SelectItem>
                                                    );
                                                })}
                                                {loadingSchemas.size > 0 && (
                                                    <div className="px-2 py-1 text-xs text-muted-foreground">
                                                        Loading related field schemas...
                                                    </div>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Foreign Key Field Selection (optional) */}
                                    {filter.column && (() => {
                                        const selectedColumn = getAllFilterableColumns.find((col: any) => col.id === filter.column);
                                        return selectedColumn?.isForeignKey ? (
                                            <div className="flex-1 space-y-2">
                                                <FieldPathSelector filter={filter} column={selectedColumn} />
                                            </div>
                                        ) : null;
                                    })()}

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
                                                        // Find the column in the combined list
                                                        const column = getAllFilterableColumns.find((col: any) => col.id === filter.column);
                                                        let columnType = column?.columnDef?.meta?.variant || column?.columnDef?.meta?.type || 'text';
                                                        let nullable = column?.columnDef?.meta?.nullable !== false; // Default to true if not specified

                                                        // If a field path is selected, get the final field's type instead
                                                        if (filter.fieldPath && filter.fieldPath.length > 0 && column?.isForeignKey) {
                                                            const finalField = getFinalFieldFromPath(column, filter.fieldPath);
                                                            if (finalField) {
                                                                columnType = finalField.meta?.variant || 'text';
                                                                nullable = finalField.meta?.nullable !== false;
                                                            }
                                                        }

                                                        return getFilterOperators(columnType, nullable).map((operator) => {
                                                            const operatorValue = operator.value || `op_${Math.random().toString(36).substr(2, 9)}`;
                                                            return (
                                                                <SelectItem key={operatorValue} value={operatorValue}>
                                                                    {operator.label || operatorValue}
                                                                </SelectItem>
                                                            );
                                                        });
                                                    })()}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    {/* Negation Toggle */}
                                    {filter.column && filter.operator && (
                                        <div className="flex-0 space-y-2">
                                            <span className="block w-full text-center">
                                                <label className="text-xs font-medium text-muted-foreground">Not</label>
                                            </span>
                                            <Switch
                                                checked={filter.negated}
                                                onCheckedChange={(checked: any) => updateFilter(filter.id, 'negated', checked)}
                                                className="h-5 w-8"
                                            />
                                        </div>
                                    )}

                                    {/* Value Input */}
                                    {filter.column && filter.operator && filter.operator !== "is_none" && (
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
                                {/* Show field path summary */}
                                {filter.fieldPath.length > 0 && (
                                    <div className="p-2 bg-blue-50 rounded text-xs">
                                        <span className="text-blue-600">
                                            {filter.column} → {filter.fieldPath.join(' → ')}
                                        </span>
                                    </div>
                                )}
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
