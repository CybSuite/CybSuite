"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef, SortingFn, SortingState, OnChangeFn } from "@tanstack/react-table";
import CybsuiteTable from "@/app/components/data/CybsuiteTable";
import CybsuiteTableServer from "@/app/components/data/CybsuiteTableServer";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { RelationLink } from "@/app/components/data/RelationLink";
import { EntityFormDialog } from "@/app/components/data/form/EntityFormDialog";
import { BulkUpdateDialog } from "@/app/components/data/form/BulkUpdateDialog";
import { ExportDialog, type ExportData } from "./ExportDialog";
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
import { AlertCircle, RefreshCw, ExternalLink, Trash2, TableProperties, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";

// Helper function to render tags as badges
const renderTagBadges = (value: any, maxDisplay: number = 3) => {
	let tags: string[] = [];

	if (Array.isArray(value)) {
		tags = value.map(String);
	} else if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) {
				tags = parsed.map(String);
			} else {
				tags = [String(parsed)];
			}
		} catch {
			tags = [value];
		}
	} else if (value !== null && value !== undefined) {
		tags = [String(value)];
	}

	if (tags.length === 0) {
		return <span className="text-gray-400">—</span>;
	}

	const displayTags = tags.slice(0, maxDisplay);
	const remainingCount = tags.length - maxDisplay;
	const remainingTags = tags.slice(maxDisplay);

	return (
		<div className="flex flex-wrap gap-1">
			{displayTags.map((tag, index) => (
				<Badge key={index} variant="secondary" className="text-xs">
					{tag}
				</Badge>
			))}
			{remainingCount > 0 && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Badge variant="outline" className="text-xs">
							+{remainingCount}
						</Badge>
					</TooltipTrigger>
					<TooltipContent side="top" className="max-w-md">
						<div className="flex flex-wrap gap-1 min-w-0">
							{remainingTags.map((tag, index) => (
								<Badge key={index} variant="secondary" className="text-xs whitespace-nowrap">
									{tag}
								</Badge>
							))}
						</div>
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
};

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

// Helper function to get the identifier for detail page navigation
const getRecordIdentifier = (record: EntityRecord): string => {
	// Prefer pretty_id if available, otherwise fall back to numeric id
	if (record.pretty_id && typeof record.pretty_id === 'string') {
		// URL encode the pretty_id for safe use in URLs
		return encodeURIComponent(record.pretty_id);
	}
	return String(record.id);
};

// Helper function to get the string representation of a record
const getRecordDisplayName = (record: EntityRecord): string => {
	// Prefer repr (string representation) if available
	if (record.repr && typeof record.repr === 'string') {
		return record.repr;
	}
	// Fall back to pretty_id if available
	if (record.pretty_id && typeof record.pretty_id === 'string') {
		return record.pretty_id;
	}
	// Fall back to numeric id
	if (record.id) {
		return `ID: ${record.id}`;
	}
	// Last resort
	return 'Unknown record';
};

interface ModelDataTableProps {
	model: string;
	initialData?: EntityRecord[];
	initialSchema?: EntitySchema;
	initialFormSchema?: any; // Form schema from server
	initialFieldOptions?: Record<string, any[]>; // Preloaded field options
	initialPagination?: any; // Initial pagination data from server
	isStaticData?: boolean; // If true, do not fetch data from API, just use initialData
	flattenDictColumn?: boolean; // If true, flatten dict fields into columns
	showSeeAllButton?: boolean;
	showRefreshButton?: boolean;
	showAddButton?: boolean;
	showSchemaButton?: boolean;
	isServerManaged?: boolean; // If true, use server-side table management
	isObservation?: boolean; // If true, add query param "is_observation=true" when fetching data
	customDataFetchModelName?: string; // If provided, use this model name for data fetching (will be placed directly in the API call)
	customViewUrlPrefix?: string; // If provided, use this URL prefix for view navigation (will be concatinated with the record id/pretty_id)
	customFieldOptionsEntityName?: string; // If provided, use this as an entity name when fetching fields options
}

export default function ModelDataTable({
	model,
	initialData = [],
	initialSchema,
	initialFormSchema,
	initialFieldOptions = {},
	initialPagination,
	isStaticData = false,
	flattenDictColumn = false,
	showSeeAllButton = false,
	showRefreshButton = true,
	showAddButton = false,
	showSchemaButton = false,
	isServerManaged = false,
	isObservation = false,
	customDataFetchModelName = undefined,
	customViewUrlPrefix = undefined,
	customFieldOptionsEntityName = undefined,
}: ModelDataTableProps) {
	const router = useRouter();
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

	// Server-side state
	const [totalCount, setTotalCount] = React.useState(
		initialPagination?.total || 0
	);
	const [filteredCount, setFilteredCount] = React.useState<number | undefined>(
		initialPagination?.filtered
	);
	const [currentSort, setCurrentSort] = React.useState<SortingState>([]);
	const [currentSearch, setCurrentSearch] = React.useState("");
	const [currentFilters, setCurrentFilters] = React.useState<any>({});

	// Memoize data to prevent unnecessary re-renders
	const memoizedData = React.useMemo(() => data, [data]);

	// Memoize table props object to prevent unnecessary re-renders
	const tableProps = React.useMemo(() => ({
		enableSorting: true,
		enableFiltering: true,
		enablePagination: true,
		enableRowSelection: true,
		enableGlobalSearch: true,
	}), []);

	const memoizedTableId = React.useMemo(() => `${model}-table`, [model]);

	// State for manual refreshes only
	const [refreshTrigger, setRefreshTrigger] = React.useState(0);

	// Edit state for the edit dialog
	const [editRecord, setEditRecord] = React.useState<EntityRecord | null>(null);
	const [editDialogOpen, setEditDialogOpen] = React.useState(false);

	// Bulk update state
	const [bulkUpdateDialogOpen, setBulkUpdateDialogOpen] = React.useState(false);
	const [selectedRecordsForBulkUpdate, setSelectedRecordsForBulkUpdate] = React.useState<EntityRecord[]>([]);

	// Delete confirmation dialog state
	const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
	const [recordsToDelete, setRecordsToDelete] = React.useState<EntityRecord[]>([]);
	const [isDeleting, setIsDeleting] = React.useState(false);

	// Row selection state
	const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({});

	// Export dialog state
	const [exportDialogOpen, setExportDialogOpen] = React.useState(false);
	const [exportSelectedRecords, setExportSelectedRecords] = React.useState<EntityRecord[]>([]);
	const [hasClientFilters, setHasClientFilters] = React.useState(false);

	// Client table state tracking for proper filter detection
	const [clientTableState, setClientTableState] = React.useState<{
		columnFilters: any[];
		globalFilter: any;
		filteredRowCount: number;
		filteredRecords: any[];
	} | null>(null);

	// Handle client table state changes
	const handleClientTableStateChange = React.useCallback((state: {
		columnFilters: any[];
		globalFilter: any;
		filteredRowCount: number;
		filteredRecords: any[];
	}) => {
		setClientTableState(state);
		// Update hasClientFilters based on actual table state
		const globalFilterValue = state.globalFilter || '';

		// Check for active filters - handle both simple string and advanced filter object
		let hasActiveFilters = state.columnFilters.length > 0;

		if (!hasActiveFilters && globalFilterValue) {
			if (typeof globalFilterValue === 'string') {
				hasActiveFilters = globalFilterValue.trim() !== '';
			} else if (typeof globalFilterValue === 'object' && globalFilterValue !== null) {
				// Handle advanced filter object structure
				const filterObj = globalFilterValue as any;
				if (filterObj.advancedFilters && Array.isArray(filterObj.advancedFilters)) {
					hasActiveFilters = filterObj.advancedFilters.length > 0;
				}
			}
		}

		setHasClientFilters(hasActiveFilters);
	}, []);

	// Note: Client table filter detection is handled via handleClientTableStateChange callback

	// Fetch schema if not provided
	const fetchSchema = React.useCallback(async () => {
		try {
			setError(null);

			// Fetch schema if not provided
			if (!schema) {
				const schemaResponse = await api.schema.getEntitySchema(model, flattenDictColumn);
				if (schemaResponse.error) {
					throw new Error(`Schema error: ${schemaResponse.error}`);
				}
				setSchema(schemaResponse.data);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch schema information');
		}
	}, [model, schema, flattenDictColumn]);

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

	// Fetch data from API - simplified stable version
	const fetchData = React.useCallback(async (pageIndex = 0, pageSize = 10, serverParams?: {
		search?: string;
		filters?: any;
		sort?: SortingState;
	}) => {
		try {
			setLoading(true);
			setError(null);

			if (isServerManaged) {
				// Server-side mode - pass server-side parameters
				const response = await api.data.getEntityData(customDataFetchModelName ? customDataFetchModelName : model, {
					skip: pageIndex * pageSize,
					limit: pageSize,
					flattenDict: flattenDictColumn,
					serverSearch: serverParams?.search,
					serverFilters: serverParams?.filters ? JSON.stringify(serverParams.filters) : undefined,
					sortBy: serverParams?.sort && serverParams.sort.length > 0 ? serverParams.sort[0].id : undefined,
					sortDesc: serverParams?.sort && serverParams.sort.length > 0 ? serverParams.sort[0].desc : false,
					isObservation
				});

				if (response.error) {
					throw new Error(`Data error: ${response.error}`);
				}

				// Handle both old and new response formats
				if (Array.isArray(response.data)) {
					setData(response.data || []);
				} else if (response.data && 'data' in response.data) {
					setData(response.data.data || []);
					if (response.data.pagination) {
						setTotalCount(response.data.pagination.total || 0);
						setFilteredCount(response.data.pagination.filtered || 0);
					}
				} else {
					setData([]);
				}
			} else {
				// Client-side mode
				const response = await api.data.getEntityData(model, {
					skip: pageIndex * pageSize,
					limit: pageSize,
					flattenDict: flattenDictColumn,
				});

				if (response.error) {
					throw new Error(`Data error: ${response.error}`);
				}

				if (Array.isArray(response.data)) {
					setData(response.data || []);
				} else if (response.data && 'data' in response.data) {
					setData(response.data.data || []);
				} else {
					setData([]);
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch data');
		} finally {
			setLoading(false);
		}
	}, [model, flattenDictColumn, isServerManaged]); // Include isServerManaged but make it stable

	// Create ref for fetchData to avoid dependency issues
	const fetchDataRef = React.useRef(fetchData);
	fetchDataRef.current = fetchData;

	// Generate columns based on schema and fields
	const generateColumns = React.useCallback((): ColumnDef<EntityRecord>[] => {
		if (!schema || !schema.fields) return [];

		// Get ALL fields (don't filter out hidden ones - they just start as hidden)
		const allFields = Object.values(schema.fields);

		// Filter out original dict fields if flattenDictColumn is true
		const fieldsToShow = flattenDictColumn
			? allFields.filter(fieldSchema => {
				const typeInfo = parseFieldAnnotation(fieldSchema);
				// Keep non-dict fields and flattened dict fields (those with dots)
				return typeInfo.baseType !== 'dict' || fieldSchema.name.includes('.');
			})
			: allFields;

		return fieldsToShow.map((fieldSchema): ColumnDef<EntityRecord> => {
			const fieldName = fieldSchema.name;
			const typeInfo = parseFieldAnnotation(fieldSchema);
			const displayName = getFieldDisplayName(fieldSchema);
			const staticOptions = getFilterOptions(fieldSchema, typeInfo);

			// Get dynamic options for relation fields
			const dynamicOptions = typeInfo.isRelation ? relationOptions[fieldName] : undefined;
			const filterOptions = dynamicOptions || staticOptions;

			return {
				id: fieldName,
				// Use accessor function for fields with dots to handle flattened fields
				...(fieldName.includes('.')
					? { accessorFn: (row: EntityRecord) => row[fieldName as keyof EntityRecord] }
					: { accessorKey: fieldName as keyof EntityRecord }
				),
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

					// Special handling for array fields that are not relations (tags, etc.)
					if (typeInfo.isArray && !typeInfo.isRelation) {
						return renderTagBadges(value);
					}

					// Special handling for dict fields - render inline with tooltip
					if (typeInfo.baseType === 'dict' && value !== null && value !== undefined) {
						const dictStr = typeof value === 'string' ? value : JSON.stringify(value);
						const truncatedStr = dictStr.length > 100 ? dictStr.slice(0, 100) + '...' : dictStr;

						// Format the dict for tooltip display
						let formattedDict = '';
						try {
							const parsed = typeof value === 'string' ? JSON.parse(value) : value;
							formattedDict = JSON.stringify(parsed, null, 2);
						} catch {
							formattedDict = dictStr;
						}

						return (
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="text-sm font-mono">
										{truncatedStr}
									</span>
								</TooltipTrigger>
								<TooltipContent className="max-w-md">
									<pre className="text-xs whitespace-pre-wrap break-words">
										{formattedDict}
									</pre>
								</TooltipContent>
							</Tooltip>
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
						// Map datetime to date for table filtering compatibility
						(typeInfo.variant === 'datetime' ? 'date' : typeInfo.variant),
					options: filterOptions,
					nullable: fieldSchema.nullable,
					relatedEntity: typeInfo.isRelation ? typeInfo.referencedEntity : undefined,
				} as any, // Use 'as any' to allow custom properties
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
	}, [schema, relationOptions, flattenDictColumn]);

	// Update columns when schema or relation options change
	React.useEffect(() => {
		if (schema && schema.fields) {
			const newColumns = generateColumns();
			setColumns(newColumns);

			// Only force table re-render for client-side tables by updating the key
			// Server-managed tables maintain their own state and don't need remounting
			if (!isServerManaged) {
				const newTableKey = `${model}-table-${Date.now()}-${Object.keys(relationOptions).length}`;
				setTableKey(newTableKey);
			}
		}
	}, [schema, relationOptions, generateColumns, model, isServerManaged]);

	// Initialize columns immediately if we have initial schema
	React.useEffect(() => {
		if (initialSchema && columns.length === 0) {
			// Just trigger the main column generation - don't create separate columns here
			// The generateColumns function will handle everything properly including relation options
			setSchema(initialSchema);
		}
	}, [initialSchema]); // Remove columns.length dependency to avoid infinite loop

	// Initial data fetch - only run once during initialization
	React.useEffect(() => {
		const init = async () => {
			await fetchSchema();
			if (initialData.length === 0 && !isStaticData) {
				if (isServerManaged) {
					// For server-managed tables, do initial fetch only
					await fetchDataRef.current(pagination.pageIndex, pagination.pageSize, {
						search: currentSearch,
						filters: currentFilters,
						sort: currentSort,
					});
				} else {
					await fetchDataRef.current(pagination.pageIndex, pagination.pageSize);
				}
			} else {
				setLoading(false);
			}
		};
		init();
	}, []); // Empty dependency array - run only once

	// Reset pagination when filtered count changes and current page is beyond available data
	React.useEffect(() => {
		if (isServerManaged && filteredCount != null && pagination.pageSize > 0) {
			const maxPage = Math.max(0, Math.ceil(filteredCount / pagination.pageSize) - 1);
			if (pagination.pageIndex > maxPage && maxPage >= 0) {
				setPagination(prev => ({ ...prev, pageIndex: 0 }));
			}
		}
	}, [isServerManaged, filteredCount, pagination.pageSize, pagination.pageIndex]);

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
		switch (action) {
			case 'view':
				if (rows.length > 0) {
					const record = rows[0];
					const identifier = getRecordIdentifier(record);
					// Navigate to the detail page using the record identifier (pretty_id or id)
					if (customViewUrlPrefix) {
						if (customViewUrlPrefix.endsWith("/")) customViewUrlPrefix = customViewUrlPrefix.slice(0, -1);
						router.push(`${customViewUrlPrefix}/${identifier}`);
					} else {
						router.push(`/data/${model}/${identifier}`);
					}
				}
				break;
			case 'edit':
				// Edit functionality - open EntityFormDialog in edit mode
				if (rows.length === 1) {
					const record = rows[0];
					setEditRecord(record);
					setEditDialogOpen(true);
				}
				break;
			case 'bulkUpdate':
				// Bulk update functionality
				if (rows.length === 1) {
					const record = rows[0];
					setEditRecord(record);
					setEditDialogOpen(true);
				} else if (rows.length > 1) {
					setSelectedRecordsForBulkUpdate(rows);
					setBulkUpdateDialogOpen(true);
				}
				break;
			case 'delete':
				// Open confirmation dialog for delete
				setRecordsToDelete(rows);
				setDeleteDialogOpen(true);
				break;
			case 'export':
				// Open export dialog with selected records
				setExportSelectedRecords(rows);
				setExportDialogOpen(true);
				break;
		}
	}, [model, router]);

	// Handle bulk update success
	const handleBulkUpdateSuccess = React.useCallback((updatedCount: number) => {
		// Trigger refresh after successful bulk update
		setRefreshTrigger(prev => prev + 1);
		// Clear row selection after successful update
		setRowSelection({});
		// Close dialog and reset state
		setBulkUpdateDialogOpen(false);
		setSelectedRecordsForBulkUpdate([]);
	}, []);

	// Server-side table handlers - fetch data directly when called
	const handlePageChange = React.useCallback((pageIndex: number, pageSize: number) => {
		setPagination({ pageIndex, pageSize });
		// Directly fetch data for server-managed tables
		if (isServerManaged) {
			fetchDataRef.current(pageIndex, pageSize, {
				search: currentSearch,
				filters: currentFilters,
				sort: currentSort,
			});
		}
	}, [isServerManaged, currentSearch, currentFilters, currentSort]);

	const handleSortChange: OnChangeFn<SortingState> = React.useCallback((updaterOrValue) => {
		const newSort = typeof updaterOrValue === 'function' ? updaterOrValue(currentSort) : updaterOrValue;
		setCurrentSort(newSort);
		// Directly fetch data for server-managed tables
		if (isServerManaged) {
			fetchDataRef.current(pagination.pageIndex, pagination.pageSize, {
				search: currentSearch,
				filters: currentFilters,
				sort: newSort,
			});
		}
	}, [currentSort, isServerManaged, pagination.pageIndex, pagination.pageSize, currentSearch, currentFilters]);

	const handleFilterChange = React.useCallback((filters: any) => {
		setCurrentFilters(filters);
		// Reset to first page when filters change
		setPagination(prev => ({ ...prev, pageIndex: 0 }));
		// Directly fetch data for server-managed tables
		if (isServerManaged) {
			fetchDataRef.current(0, pagination.pageSize, {
				search: currentSearch,
				filters: filters,
				sort: currentSort,
			});
		}
	}, [isServerManaged, pagination.pageSize, currentSearch, currentSort]);

	const handleSearchChange = React.useCallback((search: string) => {
		setCurrentSearch(search);
		// Reset to first page when search changes
		setPagination(prev => ({ ...prev, pageIndex: 0 }));
		// Directly fetch data for server-managed tables
		if (isServerManaged) {
			fetchDataRef.current(0, pagination.pageSize, {
				search: search,
				filters: currentFilters,
				sort: currentSort,
			});
		}
	}, [isServerManaged, pagination.pageSize, currentFilters, currentSort]);

	// Handle manual refreshes via refreshTrigger only
	React.useEffect(() => {
		if (refreshTrigger > 0) {
			if (isServerManaged) {
				fetchDataRef.current(pagination.pageIndex, pagination.pageSize, {
					search: currentSearch,
					filters: currentFilters,
					sort: currentSort,
				});
			} else {
				fetchDataRef.current(pagination.pageIndex, pagination.pageSize);
			}
		}
	}, [refreshTrigger]);

	// Handle actual deletion after confirmation
	const handleConfirmDelete = React.useCallback(async () => {
		setIsDeleting(true);
		try {
			// Collect all valid record IDs
			const recordIds = recordsToDelete
				.filter(row => row.id !== undefined && row.id !== null)
				.map(row => row.id as string | number);

			if (recordIds.length === 0) {
				throw new Error('No valid record IDs found for deletion');
			}

			// Use bulk delete API
			const response = await api.data.bulkDeleteRecords(model, recordIds);

			if (response.error) {
				throw new Error(response.error);
			}

			// Check if there were any failures
			if (response.data && response.data.failed_count > 0) {
				const errorMessage = `Successfully deleted ${response.data.deleted_count} records, but ${response.data.failed_count} failed: ${response.data.errors.join(', ')}`;
				console.warn(errorMessage);
				// You might want to show a toast notification here
			}

			// Refresh data after deletion by triggering a refresh
			setRefreshTrigger(prev => prev + 1);
			// Clear row selection after successful deletion
			setRowSelection({});
			// Close dialog and reset state
			setDeleteDialogOpen(false);
			setRecordsToDelete([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete records');
		} finally {
			setIsDeleting(false);
		}
	}, [recordsToDelete, model]);

	// Handle cancel deletion
	const handleCancelDelete = React.useCallback(() => {
		setDeleteDialogOpen(false);
		setRecordsToDelete([]);
	}, []);

	// Handle export
	const handleExport = React.useCallback(async (exportData: ExportData) => {
		try {
			const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/export/${model}/`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					format: exportData.format,
					fields: exportData.fields,
					export_scope: exportData.exportScope,
					include_filters: exportData.includeFilters,
					server_filters: exportData.serverFilters,
					available_record_ids: exportData.availableRecordIds,
					record_ids: exportData.recordIds,
				}),
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Export failed');
			}

			// Get filename from response headers
			const contentDisposition = response.headers.get('content-disposition');
			const filename = contentDisposition
				? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
				: `${model}_export.${exportData.format}`;

			// Create and trigger download
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Export failed:', error);
			// You might want to show a toast notification here
			throw error; // Re-throw to let ExportDialog handle the error
		}
	}, [model]);

	// Retry function
	const retry = React.useCallback(() => {
		fetchSchema();
		setRefreshTrigger(prev => prev + 1);
	}, [fetchSchema]);

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

	if (loading && data.length === 0 && columns.length === 0) {
		// Only show skeleton loading when we don't have columns yet (initial schema loading)
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
				<div className="flex space-x-2">
					{showAddButton && !isStaticData && (
						<EntityFormDialog
							entity={model}
							initialFormSchema={initialFormSchema}
							initialFieldOptions={initialFieldOptions}
							onSuccess={() => {
								// Refresh the data after successful creation
								retry();
							}}
						/>
					)}

					{showSeeAllButton && (
						<Button
							onClick={() => window.open(`/data/${model}`, '_blank')}
							variant="outline"
							size="lg"
						>
							<ExternalLink className="h-4 w-4 mr-2" />
							See All
						</Button>
					)}
					{showRefreshButton && (
						<Button onClick={retry} variant="outline" size="lg">
							<RefreshCw className="h-4 w-4 mr-2" />
							Refresh
						</Button>
					)}

					{/* Export Button */}
					<Button
						onClick={() => {
							setExportSelectedRecords([]);
							setExportDialogOpen(true);
						}}
						variant="outline"
						size="lg"
					>
						<Download className="h-4 w-4 mr-2" />
						Export
					</Button>

					{showSchemaButton && (
						<Link href={`/schema#entity-${model}`}>
							<Button variant="outline" size="lg">
								<TableProperties className="h-4 w-4 mr-2" />
								View Schema
							</Button>
						</Link>
					)}
				</div>
			</div>

			{columns.length > 0 ? (
				isServerManaged ? (
					<CybsuiteTableServer
						key={tableKey}
						data={memoizedData}
						columns={columns as any}
						currentEntity={model}
						loading={loading}
						pageSize={pagination.pageSize}
						currentPage={pagination.pageIndex}
						totalCount={totalCount}
						filteredCount={filteredCount}
						{...tableProps}
						onRowAction={handleRowAction}
						tableId={memoizedTableId}
						initialColumnVisibility={columnVisibility}
						rowSelection={rowSelection}
						onRowSelectionChange={setRowSelection}
						onPageChange={handlePageChange}
						onSortChange={handleSortChange}
						onFilterChange={handleFilterChange}
						onSearchChange={handleSearchChange}
						currentSort={currentSort}
						currentFilters={currentFilters}
						currentSearch={currentSearch}
					/>
				) : (
					<CybsuiteTable
						key={tableKey}
						data={data}
						columns={columns}
						currentEntity={model}
						pageSize={pagination.pageSize}
						enableSorting={true}
						enableFiltering={true}
						enablePagination={true}
						enableRowSelection={true}
						enableGlobalSearch={true}
						onRowAction={handleRowAction}
						tableId={`${model}-table`}
						initialColumnVisibility={columnVisibility}
						rowSelection={rowSelection}
						onRowSelectionChange={setRowSelection}
						onTableStateChange={handleClientTableStateChange}
					/>
				)
			) : (schema || initialSchema) ? (
				// If we have schema but no columns, it means columns are being generated
				// Show the table container to maintain component structure
				isServerManaged ? (
					<CybsuiteTableServer
						key={tableKey}
						data={[]}
						columns={[]}
						currentEntity={model}
						loading={true}
						pageSize={pagination.pageSize}
						currentPage={pagination.pageIndex}
						totalCount={totalCount}
						filteredCount={filteredCount}
						{...tableProps}
						onRowAction={handleRowAction}
						tableId={memoizedTableId}
						initialColumnVisibility={{}}
						rowSelection={rowSelection}
						onRowSelectionChange={setRowSelection}
						onPageChange={handlePageChange}
						onSortChange={handleSortChange}
						onFilterChange={handleFilterChange}
						onSearchChange={handleSearchChange}
						currentSort={currentSort}
						currentFilters={currentFilters}
						currentSearch={currentSearch}
					/>
				) : (
					<CybsuiteTable
						key={tableKey}
						data={[]}
						columns={[]}
						currentEntity={model}
						pageSize={pagination.pageSize}
						enableSorting={true}
						enableFiltering={true}
						enablePagination={true}
						enableRowSelection={true}
						enableGlobalSearch={true}
						onRowAction={handleRowAction}
						tableId={`${model}-table`}
						initialColumnVisibility={{}}
						rowSelection={rowSelection}
						onRowSelectionChange={setRowSelection}
						onTableStateChange={handleClientTableStateChange}
					/>
				)
			) : (
				// Only show skeleton when we don't have schema yet (initial loading)
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

			{/* Edit Dialog */}
			{editRecord && (
				<EntityFormDialog
					entity={model}
					initialFormSchema={initialFormSchema}
					initialFieldOptions={relationOptions}
					mode="edit"
					editRecord={editRecord}
					recordId={editRecord.id || editRecord.uuid}
					open={editDialogOpen}
					onOpenChange={(open) => {
						setEditDialogOpen(open);
						if (!open) {
							setEditRecord(null);
						}
					}}
					onSuccess={() => {
						// Refresh the data after successful edit
						setEditDialogOpen(false);
						setEditRecord(null);
						retry();
					}}
				/>
			)}

			{/* Bulk Update Dialog */}
			<BulkUpdateDialog
				entity={model}
				recordIds={selectedRecordsForBulkUpdate.map(record => record.id || record.uuid).filter(Boolean)}
				recordCount={selectedRecordsForBulkUpdate.length}
				schema={schema}
				fieldOptions={relationOptions}
				open={bulkUpdateDialogOpen}
				onOpenChange={setBulkUpdateDialogOpen}
				onSuccess={handleBulkUpdateSuccess}
				customFieldOptionsEntityName={customFieldOptionsEntityName}
			/>

			{/* Delete Confirmation Dialog */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Trash2 className="h-5 w-5 text-red-600" />
							Confirm Deletion
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete {recordsToDelete.length} record(s)?
							This action cannot be undone.
						</DialogDescription>
					</DialogHeader>

					{recordsToDelete.length > 0 && (
						<div className="py-4">
							<p className="text-sm text-gray-600 mb-2">Records to be deleted:</p>
							<div className="max-h-32 overflow-y-auto border rounded p-2 bg-gray-50">
								{recordsToDelete.map((record, index) => (
									<div key={record.id || index} className="text-sm py-1">
										{getRecordDisplayName(record)}
									</div>
								))}
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							variant="outline"
							onClick={handleCancelDelete}
							disabled={isDeleting}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleConfirmDelete}
							disabled={isDeleting}
						>
							{isDeleting ? (
								<>
									<RefreshCw className="h-4 w-4 mr-2 animate-spin" />
									Deleting...
								</>
							) : (
								<>
									<Trash2 className="h-4 w-4 mr-2" />
									Delete {recordsToDelete.length} Record(s)
								</>
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Export Dialog */}
			<ExportDialog
				open={exportDialogOpen}
				onOpenChange={setExportDialogOpen}
				entity={model}
				selectedRecords={exportSelectedRecords}
				schema={schema}
				onExport={handleExport}
				isServerManaged={isServerManaged}
				availableRecords={
					!isServerManaged && hasClientFilters && clientTableState?.filteredRecords
						? clientTableState.filteredRecords
						: data
				}
				currentFilters={currentFilters}
				currentSearch={currentSearch}
				hasActiveFilters={
					isServerManaged ?
						(Object.keys(currentFilters).length > 0 || currentSearch.length > 0) :
						hasClientFilters
				}
				totalFilteredRecords={
					isServerManaged ?
						filteredCount || totalCount :
						(clientTableState?.filteredRowCount ?? data.length)
				}
			/>
		</div>
	);
}
