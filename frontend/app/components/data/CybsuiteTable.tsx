"use client";

import * as React from "react";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableActionBar } from "@/components/data-table/data-table-action-bar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Download, Eye, Pencil, Search, X, Edit } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    type ColumnDef,
    type ColumnFiltersState,
    type SortingState,
    type VisibilityState,
    type RowSelectionState,
    type PaginationState,
    useReactTable,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    flexRender,
} from "@tanstack/react-table";

// Import our separated components
import { LocalFilterMenu } from "./LocalFilterMenu";
import { LocalSortList } from "./LocalSortList";

export interface CybsuiteTableProps<TData> {
    data: TData[];
    columns?: ColumnDef<TData>[];
    currentEntity?: string;
    pageSize?: number;
    enableSorting?: boolean;
    enableFiltering?: boolean;
    enablePagination?: boolean;
    enableRowSelection?: boolean;
    enableGlobalSearch?: boolean;
    onRowAction?: (action: string, rows: TData[]) => void;
    tableId?: string;
    initialColumnVisibility?: Record<string, boolean>;
    // External row selection control
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: (rowSelection: RowSelectionState) => void;
    // Table state callback for export functionality
    onTableStateChange?: (state: {
        columnFilters: any[];
        globalFilter: any;
        filteredRowCount: number;
        filteredRecords: any[];
    }) => void;
}

export default function CybsuiteTable<TData extends { id?: string | number }>({
    data,
    columns: providedColumns = [],
    currentEntity = "",
    pageSize = 10,
    enableSorting = true,
    enableFiltering = true,
    enablePagination = true,
    enableRowSelection = false,
    enableGlobalSearch = true,
    onRowAction,
    tableId = "data-table",
    initialColumnVisibility = {},
    rowSelection: externalRowSelection,
    onRowSelectionChange: externalOnRowSelectionChange,
    onTableStateChange,
}: CybsuiteTableProps<TData>) {

    // Track if component is mounted to prevent SSR hydration issues
    const [isMounted, setIsMounted] = React.useState(false);
    const [hasAdvancedFilters, setHasAdvancedFilters] = React.useState(false);

    // Use local state for table independence
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);

    // Use external row selection if provided, otherwise use internal state
    const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});
    const rowSelection = externalRowSelection !== undefined ? externalRowSelection : internalRowSelection;

    const handleRowSelectionChange = React.useCallback((updaterOrValue: any) => {
        if (externalOnRowSelectionChange) {
            // External control
            if (typeof updaterOrValue === 'function') {
                const newValue = updaterOrValue(externalRowSelection || {});
                externalOnRowSelectionChange(newValue);
            } else {
                externalOnRowSelectionChange(updaterOrValue);
            }
        } else {
            // Internal control
            setInternalRowSelection(updaterOrValue);
        }
    }, [externalRowSelection, externalOnRowSelectionChange]);

    const [pagination, setPagination] = React.useState<PaginationState>({
        pageIndex: 0,
        pageSize: pageSize,
    });
    const [globalFilter, setGlobalFilter] = React.useState<any>(undefined);

    // Update pagination when pageSize prop changes
    React.useEffect(() => {
        setPagination(prev => ({
            pageIndex: 0, // Reset to first page when page size changes
            pageSize: pageSize,
        }));
    }, [pageSize]);

    // Helper function to convert dict values to searchable strings
    const dictToString = React.useCallback((value: any): string => {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'object' && !Array.isArray(value)) {
            // Convert dict to JSON string for searching
            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        }
        return String(value);
    }, []);

    // Custom global filter function that handles our advanced filters
    const customGlobalFilterFn = React.useCallback((row: any, columnId: string, filterValue: any) => {
        // If no filter value, show all rows
        if (!filterValue) {
            return true;
        }

        // Check if this is our advanced filter object
        if (typeof filterValue === 'object' && filterValue.advancedFilters) {
            const validFilters = filterValue.advancedFilters;
            const logic = filterValue.globalLogic;

            try {
                const results = validFilters.map((filter: any) => {
                    try {
                        // Access the cell value from the row data
                        // In TanStack Table's global filter, row is the row data object
                        // Handle dotted field names (e.g., "details.hello") by direct property access
                        const cellValue = row.original[filter.column];
                        const filterValueToUse = filter.value;

                        // Apply different filtering logic based on operator
                        switch (filter.operator) {
                            case 'contains':
                                if (filter.caseSensitive) {
                                    return dictToString(cellValue).includes(dictToString(filterValueToUse));
                                } else {
                                    return dictToString(cellValue).toLowerCase().includes(dictToString(filterValueToUse).toLowerCase());
                                }

                            case 'does_not_contain':
                                if (filter.caseSensitive) {
                                    return !dictToString(cellValue).includes(dictToString(filterValueToUse));
                                } else {
                                    return !dictToString(cellValue).toLowerCase().includes(dictToString(filterValueToUse).toLowerCase());
                                }

                            case 'is':
                                if (filter.caseSensitive) {
                                    return dictToString(cellValue) === dictToString(filterValueToUse);
                                } else {
                                    return dictToString(cellValue).toLowerCase() === dictToString(filterValueToUse).toLowerCase();
                                }

                            case 'is_not':
                                if (filter.caseSensitive) {
                                    return dictToString(cellValue) !== dictToString(filterValueToUse);
                                } else {
                                    return dictToString(cellValue).toLowerCase() !== dictToString(filterValueToUse).toLowerCase();
                                }

                            case 'is_empty':
                                return !cellValue || dictToString(cellValue).trim() === '';

                            case 'is_not_empty':
                                return cellValue && dictToString(cellValue).trim() !== '';

                            case 'equals':
                                if (!filterValueToUse && filterValueToUse !== 0) return true;
                                return Number(cellValue) === Number(filterValueToUse);

                            case 'not_equals':
                                if (!filterValueToUse && filterValueToUse !== 0) return true;
                                return Number(cellValue) !== Number(filterValueToUse);

                            case 'greater_than':
                                if (!filterValueToUse && filterValueToUse !== 0) return true;
                                return Number(cellValue) > Number(filterValueToUse);

                            case 'less_than':
                                if (!filterValueToUse && filterValueToUse !== 0) return true;
                                return Number(cellValue) < Number(filterValueToUse);

                            case 'greater_equal':
                                if (!filterValueToUse && filterValueToUse !== 0) return true;
                                return Number(cellValue) >= Number(filterValueToUse);

                            case 'less_equal':
                                if (!filterValueToUse && filterValueToUse !== 0) return true;
                                return Number(cellValue) <= Number(filterValueToUse);

                            case 'has_any_of':
                                if (!Array.isArray(filterValueToUse) || filterValueToUse.length === 0) return true;

                                // Handle many-to-many relations: extract IDs from objects
                                let cellValues: any[] = [];
                                if (Array.isArray(cellValue)) {
                                    cellValues = cellValue.map((item: any) =>
                                        typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : String(item)
                                    );
                                } else if (cellValue) {
                                    const extractedValue = typeof cellValue === 'object' && cellValue !== null && 'id' in cellValue ? String(cellValue.id) : String(cellValue);
                                    cellValues = [extractedValue];
                                }

                                // Ensure filter values are also strings for consistent comparison
                                const filterValuesAsStrings = filterValueToUse.map((fv: any) => String(fv));

                                return filterValuesAsStrings.some((fv: string) => cellValues.includes(fv));

                            case 'has_none_of':
                                if (!Array.isArray(filterValueToUse) || filterValueToUse.length === 0) return true;

                                // Handle many-to-many relations: extract IDs from objects
                                let cellValues2: any[] = [];
                                if (Array.isArray(cellValue)) {
                                    cellValues2 = cellValue.map((item: any) =>
                                        typeof item === 'object' && item !== null && 'id' in item ? String(item.id) : String(item)
                                    );
                                } else if (cellValue) {
                                    const extractedValue = typeof cellValue === 'object' && cellValue !== null && 'id' in cellValue ? String(cellValue.id) : String(cellValue);
                                    cellValues2 = [extractedValue];
                                }

                                // Ensure filter values are also strings for consistent comparison
                                const filterValuesAsStrings2 = filterValueToUse.map((fv: any) => String(fv));

                                return !filterValuesAsStrings2.some((fv: string) => cellValues2.includes(fv));

                            case 'is_on':
                                if (!filterValueToUse) return true;
                                try {
                                    const cellDate = new Date(cellValue);
                                    const filterDate = new Date(filterValueToUse);
                                    return cellDate.toDateString() === filterDate.toDateString();
                                } catch {
                                    return false;
                                }

                            case 'is_before':
                                if (!filterValueToUse) return true;
                                try {
                                    return new Date(cellValue) < new Date(filterValueToUse);
                                } catch {
                                    return false;
                                }

                            case 'is_after':
                                if (!filterValueToUse) return true;
                                try {
                                    return new Date(cellValue) > new Date(filterValueToUse);
                                } catch {
                                    return false;
                                }

                            case 'is_between':
                                if (!filterValueToUse || typeof filterValueToUse !== 'object' || !filterValueToUse.start || !filterValueToUse.end) return true;
                                try {
                                    const cellDate = new Date(cellValue);
                                    const startDate = new Date(filterValueToUse.start);
                                    const endDate = new Date(filterValueToUse.end);
                                    return cellDate >= startDate && cellDate <= endDate;
                                } catch {
                                    return false;
                                }

                            default:
                                // Unknown operator, return true to avoid filtering out rows
                                console.warn(`Unknown filter operator: ${filter.operator}`);
                                return true;
                        }
                    } catch (error) {
                        console.error('Error in filter condition:', error);
                        return false;
                    }
                });

                // Apply global logic (AND/OR)
                try {
                    if (logic === 'and') {
                        return results.every((result: any) => result);
                    } else {
                        return results.some((result: any) => result);
                    }
                } catch (error) {
                    console.error('Error in global logic:', error);
                    return false;
                }
            } catch (error) {
                console.error('Error in global filter function:', error);
                return true; // Return true to avoid filtering out rows when there's an error
            }
        }

        // Handle regular string search (global search)
        if (typeof filterValue === 'string') {
            const searchValue = filterValue.toLowerCase();

            // Search across all visible columns in the row data
            // Since flattened fields are now top-level properties, this should work correctly
            return Object.values(row.original).some((value: any) =>
                dictToString(value).toLowerCase().includes(searchValue)
            );
        }

        return true;
    }, [dictToString]);

    // Ref for advanced filter reset
    const advancedFilterRef = React.useRef<{ resetFilters: () => void } | null>(null);

    // Set mounted flag after hydration
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    // Update column visibility when new columns are provided
    React.useEffect(() => {
        // Only update if we have initial visibility and columns have changed
        if (Object.keys(initialColumnVisibility).length > 0 && providedColumns) {
            setColumnVisibility(initialColumnVisibility);
        }
    }, [providedColumns, initialColumnVisibility]);

    // Default columns if none provided
    const defaultColumns = React.useMemo<ColumnDef<TData>[]>(() => {
        if (!data || data.length === 0) return [];

        const sampleRow = data[0];
        if (!sampleRow || typeof sampleRow !== 'object') return [];

        return Object.keys(sampleRow).map((key) => {
            const title = key.charAt(0).toUpperCase() + key.slice(1);
            return {
                id: key,
                // Use accessor function for fields with dots to handle flattened fields
                accessorFn: key.includes('.')
                    ? (row: TData) => row[key as keyof TData]
                    : undefined,
                // Use accessorKey for normal fields without dots
                accessorKey: key.includes('.') ? undefined : key,
                header: ({ column }) => (
                    enableSorting ? (
                        <DataTableColumnHeader column={column} title={title} />
                    ) : (
                        <div>{title}</div>
                    )
                ),
                cell: ({ row }) => {
                    const value = row.getValue(key);
                    return <div className="truncate">{String(value)}</div>;
                },
                meta: {
                    label: title,
                    placeholder: `Search ${key}...`,
                    variant: "text" as const,
                },
                enableColumnFilter: enableFiltering,
                enableSorting: enableSorting,
            };
        });
    }, [data, enableFiltering, enableSorting]);

    // Selection column
    const selectionColumn = React.useMemo<ColumnDef<TData>>(() => ({
        id: "select",
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && "indeterminate")
                }
                onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value: boolean) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
        size: 40,
    }), []);

    // Final columns array
    const columns = React.useMemo(() => {
        const cols: ColumnDef<TData>[] = [];

        if (enableRowSelection) {
            cols.push(selectionColumn);
        }

        cols.push(...(providedColumns || defaultColumns));

        return cols;
    }, [providedColumns, defaultColumns, enableRowSelection, selectionColumn]);

    // Create table instance
    const table = useReactTable({
        data: data || [],
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
            globalFilter,
        },
        pageCount: enablePagination ? Math.ceil((data || []).length / pagination.pageSize) : -1,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: handleRowSelectionChange,
        onPaginationChange: setPagination,
        onGlobalFilterChange: setGlobalFilter,
        globalFilterFn: customGlobalFilterFn,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        getRowId: (row: TData, index: number) => row.id?.toString() || index.toString(),
        enableRowSelection: enableRowSelection,
        enableColumnFilters: enableFiltering,
        enableGlobalFilter: enableGlobalSearch,
        enableSorting: enableSorting,
        manualPagination: false,
        manualSorting: false,
        manualFiltering: false,
    });

    // Notify parent of table state changes for export functionality
    React.useEffect(() => {
        if (onTableStateChange && isMounted) {
            const tableState = table.getState();
            const filteredRows = table.getFilteredRowModel().rows;

            onTableStateChange({
                columnFilters: tableState.columnFilters,
                globalFilter: tableState.globalFilter,
                filteredRowCount: filteredRows.length,
                filteredRecords: filteredRows.map(row => row.original)
            });
        }
    }, [onTableStateChange, table, isMounted, columnFilters, globalFilter]);

    const selectedRowsCount = React.useMemo(() => {
        if (!isMounted) return 0;
        return table.getFilteredSelectedRowModel().rows.length;
    }, [table, isMounted, rowSelection]);

    // Global search component
    const globalSearchInput = React.useMemo(() => {
        // Check if globalFilter is a string (regular search) or object (advanced filters)
        const searchValue = typeof globalFilter === 'string' ? globalFilter : '';
        const hasAdvancedFiltersActive = globalFilter && typeof globalFilter === 'object' && globalFilter.advancedFilters;

        return (
            <div className="flex items-center space-x-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search all columns..."
                        value={isMounted ? searchValue : ""}
                        onChange={(event) => isMounted && setGlobalFilter(String(event.target.value))}
                        className="pl-8 w-[300px]"
                        disabled={!isMounted || hasAdvancedFiltersActive}
                    />
                    {isMounted && searchValue && (
                        <Button
                            variant="ghost"
                            onClick={() => setGlobalFilter("")}
                            className="absolute right-0 top-0 h-full px-3 py-0 hover:bg-transparent"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                    {hasAdvancedFiltersActive && (
                        <div className="absolute right-2 top-2.5 text-xs text-muted-foreground">
                            Advanced filters active
                        </div>
                    )}
                </div>
            </div>
        );
    }, [globalFilter, setGlobalFilter, isMounted]);

    // Toolbar with DiceUI components + global search
    const toolbar = React.useMemo(() => (
        <div className="flex items-center justify-between w-full">
            <div className="flex flex-1 items-center space-x-2">
                {enableGlobalSearch && globalSearchInput}

                <div className="ml-auto">
                    {enableFiltering && (
                        <LocalFilterMenu
                            ref={advancedFilterRef}
                            table={table}
                            onFiltersChange={setHasAdvancedFilters}
                            currentEntity={currentEntity}
                        />
                    )}

                    {enableSorting && (
                        <LocalSortList table={table} sorting={sorting} onSortingChange={setSorting} />
                    )}

                    {isMounted && (sorting.length > 0 || columnFilters.length > 0 || globalFilter || hasAdvancedFilters) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setSorting([]);
                                setColumnFilters([]);
                                setGlobalFilter(undefined);
                                advancedFilterRef.current?.resetFilters();
                            }}
                        >
                            <X className="h-4 w-4" />
                            Clear All
                        </Button>
                    )}
                </div>
            </div>
        </div>
    ), [isMounted, sorting, columnFilters, globalFilter, enableSorting, enableFiltering, globalSearchInput, table, hasAdvancedFilters]);

    return (
        <div className="space-y-4">
            <DataTableAdvancedToolbar table={table}>
                {toolbar}
            </DataTableAdvancedToolbar>

            {enableRowSelection && selectedRowsCount > 0 && isMounted && (
                <DataTableActionBar table={table} visible={selectedRowsCount > 0}>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
                                onRowAction?.("export", selectedRows);
                            }}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Export ({selectedRowsCount})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
                                onRowAction?.("bulkUpdate", selectedRows);
                            }}
                        >
                            <Edit className="mr-2 h-4 w-4" />
                            Bulk Update ({selectedRowsCount})
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
                                onRowAction?.("delete", selectedRows);
                            }}
                            className="text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete ({selectedRowsCount})
                        </Button>
                    </div>
                </DataTableActionBar>
            )}

            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id} colSpan={header.colSpan}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef.header,
                                                header.getContext(),
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <ContextMenu key={row.id}>
                                    <ContextMenuTrigger asChild>
                                        <TableRow
                                            data-state={row.getIsSelected() && "selected"}
                                            className="cursor-context-menu hover:bg-muted/100 transition-colors"
                                            onDoubleClick={() => onRowAction?.("view", [row.original])}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>
                                                    {flexRender(
                                                        cell.column.columnDef.cell,
                                                        cell.getContext(),
                                                    )}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    </ContextMenuTrigger>
                                    {onRowAction && (
                                        <ContextMenuContent>
                                            <ContextMenuItem onClick={() => onRowAction("view", [row.original])}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                <div className="flex flex-col">
                                                    <span>View</span>
                                                    <span className="text-xs text-muted-foreground">Double-click on row</span>
                                                </div>
                                            </ContextMenuItem>
                                            <ContextMenuItem onClick={() => onRowAction("edit", [row.original])}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Edit
                                            </ContextMenuItem>
                                            <ContextMenuItem
                                                onClick={() => onRowAction("delete", [row.original])}
                                                variant="destructive"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </ContextMenuItem>
                                        </ContextMenuContent>
                                    )}
                                </ContextMenu>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={table.getAllColumns().length}
                                    className="h-24 text-center"
                                >
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex flex-col gap-2.5">
                <DataTablePagination table={table} />
            </div>
        </div>
    );
}
