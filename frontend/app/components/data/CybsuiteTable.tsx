"use client";

import * as React from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableActionBar } from "@/components/data-table/data-table-action-bar";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Trash2, Download, Eye, Pencil, Search, X } from "lucide-react";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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
} from "@tanstack/react-table";

// Import our separated components
import { LocalFilterMenu } from "./LocalFilterMenu";
import { LocalSortList } from "./LocalSortList";

export interface CybsuiteTableProps<TData> {
    data: TData[];
    columns?: ColumnDef<TData>[];
    pageSize?: number;
    enableSorting?: boolean;
    enableFiltering?: boolean;
    enablePagination?: boolean;
    enableRowSelection?: boolean;
    enableGlobalSearch?: boolean;
    onRowAction?: (action: string, rows: TData[]) => void;
    tableId?: string;
    initialColumnVisibility?: Record<string, boolean>;
}

export default function CybsuiteTable<TData extends { id?: string | number }>({
    data,
    columns: providedColumns,
    pageSize = 10,
    enableSorting = true,
    enableFiltering = true,
    enablePagination = true,
    enableRowSelection = true,
    enableGlobalSearch = true,
    onRowAction,
    tableId = "default",
    initialColumnVisibility = {}
}: CybsuiteTableProps<TData>) {
    
    // Track if component is mounted to prevent SSR hydration issues
    const [isMounted, setIsMounted] = React.useState(false);
    const [hasAdvancedFilters, setHasAdvancedFilters] = React.useState(false);
    
    // Use local state for table independence
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
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
                        const cellValue = row.original[filter.column];
                        const filterValueToUse = filter.value;

                        // Apply different filtering logic based on operator
                        switch (filter.operator) {
                            case 'contains':
                                return String(cellValue || '').toLowerCase().includes(String(filterValueToUse || '').toLowerCase());
                            
                            case 'does_not_contain':
                                return !String(cellValue || '').toLowerCase().includes(String(filterValueToUse || '').toLowerCase());
                            
                            case 'is':
                                return String(cellValue || '').toLowerCase() === String(filterValueToUse || '').toLowerCase();
                            
                            case 'is_not':
                                return String(cellValue || '').toLowerCase() !== String(filterValueToUse || '').toLowerCase();
                            
                            case 'is_empty':
                                return !cellValue || String(cellValue).trim() === '';
                            
                            case 'is_not_empty':
                                return cellValue && String(cellValue).trim() !== '';
                            
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
            
            // Search across all visible columns
            return Object.values(row.original).some((value: any) => 
                String(value || '').toLowerCase().includes(searchValue)
            );
        }

        return true;
    }, []);

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
        if (data.length === 0) return [];
        
        const sampleRow = data[0];
        return Object.keys(sampleRow).map((key) => {
            const title = key.charAt(0).toUpperCase() + key.slice(1);
            return {
                id: key,
                accessorKey: key,
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

    // Actions column
    const actionsColumn = React.useMemo<ColumnDef<TData>>(() => ({
        id: "actions",
        header: () => <div className="w-10" />,
        cell: ({ row }) => {
            const rowData = row.original;
            
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onRowAction?.("view", [rowData])}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowAction?.("edit", [rowData])}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                            onClick={() => onRowAction?.("delete", [rowData])}
                            className="text-destructive"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
        enableSorting: false,
        enableHiding: false,
        size: 40,
    }), [onRowAction]);

    // Final columns array
    const columns = React.useMemo(() => {
        const cols: ColumnDef<TData>[] = [];
        
        if (enableRowSelection) {
            cols.push(selectionColumn);
        }
        
        cols.push(...(providedColumns || defaultColumns));
        
        if (onRowAction) {
            cols.push(actionsColumn);
        }
        
        return cols;
    }, [providedColumns, defaultColumns, enableRowSelection, selectionColumn, onRowAction, actionsColumn]);

    // Create table instance
    const table = useReactTable({
        data,
        columns,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
            globalFilter,
        },
        pageCount: enablePagination ? Math.ceil(data.length / pagination.pageSize) : -1,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
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

            <DataTable table={table} />
        </div>
    );
}
