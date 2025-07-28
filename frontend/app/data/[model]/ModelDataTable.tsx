"use client";

import * as React from "react";
import { ColumnDef, SortingFn } from "@tanstack/react-table";
import CybsuiteTable from "@/app/components/data/CybsuiteTable";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RelationLink } from "@/app/components/data/RelationLink";
import { api } from "@/app/lib/api";
import { EntityRecord, EntitySchema } from "@/app/types/Data";
import {
  parseFieldAnnotation,
  isHiddenInitially,
  getFieldDisplayName,
  formatFieldValue,
  getFilterOptions,
  fetchRelationOptions
} from "@/app/lib/schema-utils";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Custom sorting function for relation fields
const relationSortingFn: SortingFn<EntityRecord> = (rowA, rowB, columnId) => {
  const getRelationString = (value: any): string => {
    if (!value) return '';

    if (Array.isArray(value)) {
      // For many-to-many relations, join all repr values
      return value.map(item =>
        typeof item === 'object' && item !== null && 'repr' in item ? item.repr : String(item)
      ).join(', ');
    } else if (typeof value === 'object' && value !== null && 'repr' in value) {
      // For single relations, use the repr value
      return value.repr;
    }

    return String(value);
  };

  const aValue = getRelationString(rowA.getValue(columnId));
  const bValue = getRelationString(rowB.getValue(columnId));

  return aValue.localeCompare(bValue);
};

interface ModelDataTableProps {
  model: string;
  initialData?: EntityRecord[];
  initialSchema?: EntitySchema;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

export default function ModelDataTable({
  model,
  initialData = [],
  initialSchema,
}: ModelDataTableProps) {
  const [data, setData] = React.useState<EntityRecord[]>(initialData);
  const [schema, setSchema] = React.useState<EntitySchema | undefined>(initialSchema);
  const [columns, setColumns] = React.useState<ColumnDef<EntityRecord>[]>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({});
  const [relationOptions, setRelationOptions] = React.useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [loading, setLoading] = React.useState(!initialData.length);
  const [error, setError] = React.useState<string | null>(null);
  const [tableKey, setTableKey] = React.useState(`${model}-table-initial`);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  // Fetch schema if not provided
  const fetchSchema = React.useCallback(async () => {
    try {
      setError(null);

      // Fetch schema if not provided
      if (!schema) {
        const schemaResponse = await api.schema.getEntitySchema(model);
        if (schemaResponse.error) {
          throw new Error(`Schema error: ${schemaResponse.error}`);
        }
        setSchema(schemaResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schema information');
    }
  }, [model, schema]);

  // Fetch relation options for fields that reference other entities
  const fetchRelationOptionsForSchema = React.useCallback(async (schemaData: EntitySchema) => {
    const optionsToFetch: Record<string, string> = {};

    // Find all relation fields that need options
    Object.values(schemaData.fields).forEach(field => {
      const typeInfo = parseFieldAnnotation(field);
      if (typeInfo.isRelation && typeInfo.referencedEntity) {
        optionsToFetch[field.name] = typeInfo.referencedEntity;
      }
    });

    // Skip if no relation fields or if we already have options for all fields
    const fieldNames = Object.keys(optionsToFetch);
    if (fieldNames.length === 0) return;

    const alreadyHaveAllOptions = fieldNames.every(fieldName =>
      relationOptions[fieldName] && relationOptions[fieldName].length > 0
    );
    if (alreadyHaveAllOptions) return;

    // Fetch options for each relation field
    const fetchPromises = Object.entries(optionsToFetch).map(async ([fieldName, referencedEntity]) => {
      // Skip if we already have options for this field
      if (relationOptions[fieldName] && relationOptions[fieldName].length > 0) {
        return { fieldName, options: relationOptions[fieldName] };
      }

      const options = await fetchRelationOptions(referencedEntity, api);
      return { fieldName, options };
    });

    try {
      const results = await Promise.all(fetchPromises);
      const newRelationOptions: Record<string, Array<{ label: string; value: string }>> = {};

      results.forEach(({ fieldName, options }) => {
        newRelationOptions[fieldName] = options;
      });

      setRelationOptions(prev => ({ ...prev, ...newRelationOptions }));
    } catch (err) {
      console.warn('Failed to fetch some relation options:', err);
    }
  }, [relationOptions]); // Add relationOptions as dependency to check existing options

  // Fetch data from API
  const fetchData = React.useCallback(async (pageIndex = 0, pageSize = 10) => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.data.getEntityData(model, {
        skip: pageIndex * pageSize,
        limit: pageSize,
      });

      if (response.error) {
        throw new Error(`Data error: ${response.error}`);
      }

      setData(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [model]);

  // Generate columns based on schema and fields
  const generateColumns = React.useCallback((): ColumnDef<EntityRecord>[] => {
    if (!schema || !schema.fields) return [];

    // Get ALL fields (don't filter out hidden ones - they just start as hidden)
    return Object.values(schema.fields).map((fieldSchema): ColumnDef<EntityRecord> => {
      const fieldName = fieldSchema.name;
      const typeInfo = parseFieldAnnotation(fieldSchema);
      const displayName = getFieldDisplayName(fieldSchema);
      const staticOptions = getFilterOptions(fieldSchema, typeInfo);

      // Get dynamic options for relation fields
      const dynamicOptions = typeInfo.isRelation ? relationOptions[fieldName] : undefined;
      const filterOptions = dynamicOptions || staticOptions;

      return {
        id: fieldName,
        accessorKey: fieldName as keyof EntityRecord,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={displayName} />
        ),
        cell: ({ row }) => {
          const value = row.getValue(fieldName);

          // Special handling for relations with links
          if (typeInfo.isRelation && typeInfo.referencedEntity) {
            return (
              <RelationLink
                value={value}
                entityName={typeInfo.referencedEntity}
                isArray={typeInfo.isArray}
              />
            );
          }

          const formattedValue = formatFieldValue(value, typeInfo);

          // Add tooltip for long text and truncate
          if (typeInfo.variant === 'text' && formattedValue.length > 50) {
            return (
              <div className="truncate max-w-[200px]" title={formattedValue}>
                {formattedValue}
              </div>
            );
          }

          return <span>{formattedValue}</span>;
        },
        meta: {
          label: displayName,
          placeholder: `Search ${displayName.toLowerCase()}...`,
          variant: typeInfo.isRelation ?
                   (typeInfo.isArray ? 'multiSelect' : 'select') :
                   typeInfo.variant,
          options: filterOptions,
        },
        enableColumnFilter:
          // Enable filtering for:
          fieldSchema.in_filter_query ||           // Explicitly marked as filterable
          typeInfo.variant === 'boolean' ||        // Boolean fields
          !!filterOptions ||                       // Fields with options (choices, examples, relations)
          typeInfo.variant === 'text' ||           // Text fields for search
          typeInfo.variant === 'number' ||         // Number fields for comparison
          typeInfo.variant === 'date',             // Date fields for range filtering
        enableSorting: true, // Enable sorting for all columns including relations
        ...(typeInfo.isRelation && { sortingFn: relationSortingFn }), // Only add sortingFn for relations
        size: typeInfo.variant === 'date' ? 120 :
              typeInfo.variant === 'number' ? 100 :
              typeInfo.variant === 'boolean' ? 80 :
              typeInfo.isRelation ? 150 : undefined,
      };
    });
  }, [schema, relationOptions]);

  // Update columns when schema or relation options change - force immediate update
  React.useEffect(() => {
    if (schema && schema.fields) {
      const newColumns = generateColumns();
      setColumns(newColumns);

      // Force table re-render by updating the key
      const newTableKey = `${model}-table-${Date.now()}-${Object.keys(relationOptions).length}`;
      setTableKey(newTableKey);
    }
  }, [schema, relationOptions, generateColumns, model]);

  // Initialize columns immediately if we have initial schema
  React.useEffect(() => {
    if (initialSchema && columns.length === 0) {
      // Just trigger the main column generation - don't create separate columns here
      // The generateColumns function will handle everything properly including relation options
      setSchema(initialSchema);
    }
  }, [initialSchema]); // Remove columns.length dependency to avoid infinite loop

  // Initial data fetch
  React.useEffect(() => {
    const init = async () => {
      await fetchSchema();
      if (initialData.length === 0) {
        await fetchData(pagination.pageIndex, pagination.pageSize);
      }
    };
    init();
  }, [fetchSchema, fetchData, pagination.pageIndex, pagination.pageSize, initialData.length]);

  // Fetch relation options when schema changes
  React.useEffect(() => {
    if (schema) {
      fetchRelationOptionsForSchema(schema);
    }
  }, [schema]); // Remove fetchRelationOptionsForSchema from dependencies to avoid infinite loop

  // Initialize relation options for initial schema
  React.useEffect(() => {
    if (initialSchema) {
      fetchRelationOptionsForSchema(initialSchema);
    }
  }, [initialSchema]); // Remove fetchRelationOptionsForSchema from dependencies to avoid infinite loop

  // Initialize column visibility based on hidden_in_list
  React.useEffect(() => {
    const schemaToUse = schema || initialSchema;
    if (schemaToUse && schemaToUse.fields) {
      const visibility: Record<string, boolean> = {};
      Object.values(schemaToUse.fields).forEach(field => {
        // Set visibility to false if hidden_in_list is true
        visibility[field.name] = !isHiddenInitially(field);
      });
      setColumnVisibility(visibility);
    }
  }, [schema, initialSchema]);

  // Handle row actions
  const handleRowAction = React.useCallback(async (action: string, rows: EntityRecord[]) => {
    console.log(`Action: ${action}`, rows);

    switch (action) {
      case 'view':
        console.log('View rows:', rows);
        break;
      case 'edit':
        console.log('Edit rows:', rows);
        break;
      case 'delete':
        if (confirm(`Are you sure you want to delete ${rows.length} record(s)?`)) {
          try {
            // Delete each selected record
            for (const row of rows) {
              if (row.id) {
                const response = await api.data.deleteRecord(model, row.id);
                if (response.error) {
                  throw new Error(`Failed to delete record ${row.id}: ${response.error}`);
                }
              }
            }
            // Refresh data after deletion
            await fetchData(pagination.pageIndex, pagination.pageSize);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete records');
          }
        }
        break;
      case 'export':
        console.log('Export rows:', rows);
        // Implement export functionality
        break;
    }
  }, [model, fetchData, pagination.pageIndex, pagination.pageSize]);

  // Retry function
  const retry = React.useCallback(() => {
    fetchSchema();
    fetchData(pagination.pageIndex, pagination.pageSize);
  }, [fetchSchema, fetchData, pagination.pageIndex, pagination.pageSize]);

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 p-4 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (loading && data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={retry} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {columns.length > 0 ? (
        <CybsuiteTable
          key={tableKey}
          data={data}
          columns={columns}
          pageSize={pagination.pageSize}
          enableSorting={true}
          enableFiltering={true}
          enablePagination={true}
          enableRowSelection={true}
          enableGlobalSearch={true}
          onRowAction={handleRowAction}
          tableId={`${model}-table`}
          initialColumnVisibility={columnVisibility}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
