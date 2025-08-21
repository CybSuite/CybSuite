"use client";

import * as React from "react";
import { ColumnDef, SortingState, VisibilityState, RowSelectionState, OnChangeFn } from "@tanstack/react-table";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableActionBar } from "@/components/data-table/data-table-action-bar";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu";
import { Search, X, Download, Edit, Trash2, Eye, Pencil, Loader2 } from "lucide-react";
import { LocalFilterMenu } from "./LocalFilterMenu";
import { LocalSortList } from "./LocalSortList";

export interface CybsuiteTableServerProps<TData> {
    data: TData[];
    columns?: ColumnDef<TData>[];
    loading?: boolean;
    pageSize?: number;
    currentPage?: number;
    totalCount?: number;
    filteredCount?: number;
    enableSorting?: boolean;
    enableFiltering?: boolean;
    enablePagination?: boolean;
    enableRowSelection?: boolean;
    enableGlobalSearch?: boolean;
    onRowAction?: (action: string, rows: TData[]) => void;
    tableId?: string;
    initialColumnVisibility?: Record<string, boolean>;

    // Server-side control handlers
    onPageChange?: (pageIndex: number, pageSize: number) => void;
    onSortChange?: OnChangeFn<SortingState>;
    onFilterChange?: (filters: any) => void;
    onSearchChange?: (search: string) => void;

    // External row selection control
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: (rowSelection: RowSelectionState) => void;

    // Current server state
    currentSort?: SortingState;
    currentFilters?: any;
    currentSearch?: string;
}

function CybsuiteTableServer<TData extends { id?: string | number }>({
    data,
    columns: providedColumns,
    loading = false,
    pageSize = 10,
    currentPage = 0,
    totalCount = 0,
    filteredCount,
    enableSorting = true,
    enableFiltering = true,
    enablePagination = true,
    enableRowSelection = true,
    enableGlobalSearch = true,
    onRowAction,
    tableId = "default",
    initialColumnVisibility = {},
    onPageChange,
    onSortChange,
    onFilterChange,
    onSearchChange,
    rowSelection: externalRowSelection,
    onRowSelectionChange: externalOnRowSelectionChange,
    currentSort = [],
    currentFilters,
    currentSearch = ""
}: CybsuiteTableServerProps<TData>) {

    // Track if component is mounted to prevent SSR hydration issues
    const [isMounted, setIsMounted] = React.useState(false);

    // Use local state for UI-only concerns
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(initialColumnVisibility);

    // Use external row selection if provided, otherwise use internal state
    const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});
    const rowSelection = externalRowSelection !== undefined ? externalRowSelection : internalRowSelection;

    // Local filter state for the filter menu
    const [filters, setFilters] = React.useState<Record<string, any>>(currentFilters || {});

    // Ref for search input to maintain focus
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    const handleRowSelectionChange = (updaterOrValue: any) => {
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
    };

    // Server-side pagination state - simple object
    const pagination = {
        pageIndex: currentPage,
        pageSize: pageSize,
    };

    // Search input state (local UI state)
    const [searchInputValue, setSearchInputValue] = React.useState(currentSearch);

    // Debounced search handler - remove useCallback
    const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const handleSearchInputChange = (value: string) => {
        setSearchInputValue(value);

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout for debounced search
        searchTimeoutRef.current = setTimeout(() => {
            if (onSearchChange) {
                onSearchChange(value);
            }
        }, 300);
    };

    // Clean up search timeout on unmount
    React.useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Handle sorting changes - remove useCallback
    const handleSortingChange = (newSorting: SortingState) => {
        onSortChange?.(newSorting);
    };

    // Update search input when external search changes
    React.useEffect(() => {
        setSearchInputValue(currentSearch);
    }, [currentSearch]);

    // Update local filters when external filters change
    React.useEffect(() => {
        setFilters(currentFilters || {});
    }, [currentFilters]);

    // Set mounted flag after hydration
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    // Update column visibility when new columns are provided
    React.useEffect(() => {
        if (Object.keys(initialColumnVisibility).length > 0 && providedColumns) {
            setColumnVisibility(initialColumnVisibility);
        }
    }, [providedColumns, initialColumnVisibility]);

    // Selection column - remove useMemo
    const selectionColumn: ColumnDef<TData> = {
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
    };

    // Final columns array - simplified
    const cols: ColumnDef<TData>[] = [];
    if (enableRowSelection) {
        cols.push(selectionColumn);
    }
    if (providedColumns) {
        cols.push(...providedColumns);
    }
    const finalColumns = cols;

    // Create table instance (server-controlled)
    const table = useReactTable({
        data: data || [],
        columns: finalColumns,
        state: {
            sorting: currentSort,
            columnVisibility,
            rowSelection,
            pagination,
        },
        pageCount: enablePagination ? Math.ceil((filteredCount || totalCount || 0) / (pageSize || 10)) : -1,
        onSortingChange: onSortChange,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: handleRowSelectionChange,
        onPaginationChange: (updater) => {
            // Handle pagination changes by calling onPageChange
            if (typeof updater === 'function') {
                const newPagination = updater(pagination);
                onPageChange?.(newPagination.pageIndex, newPagination.pageSize);
            } else {
                onPageChange?.(updater.pageIndex, updater.pageSize);
            }
        },
        getCoreRowModel: getCoreRowModel(),
        getRowId: (row: TData, index: number) => row.id?.toString() || index.toString(),
        enableRowSelection: enableRowSelection,
        enableColumnFilters: enableFiltering,
        enableGlobalFilter: enableGlobalSearch,
        enableSorting: enableSorting,
        manualPagination: true, // Server-side pagination
        manualSorting: true,    // Server-side sorting
        manualFiltering: true,  // Server-side filtering
    });

    const selectedRowsCount = React.useMemo(() => {
        if (!isMounted) return 0;
        return Object.keys(rowSelection).filter(key => rowSelection[key]).length;
    }, [isMounted, rowSelection]);

    // Advanced toolbar component - remove complex memoization to prevent infinite loops
    const hasActiveFilters = currentFilters && Object.keys(currentFilters).length > 0 &&
        (currentFilters.advancedFilters?.length > 0 || Object.keys(currentFilters).some(key => key !== 'advancedFilters' && key !== 'globalLogic'));
    const hasActiveSorting = currentSort && currentSort.length > 0;
    const hasActiveSearch = currentSearch && currentSearch.trim().length > 0;

    const toolbar = (
        <div className="flex items-center justify-between w-full">
            <div className="flex flex-1 items-center space-x-2">
                {enableGlobalSearch && (
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            placeholder="Search all columns..."
                            value={isMounted ? searchInputValue : ""}
                            onChange={(event) => isMounted && handleSearchInputChange(event.target.value)}
                            className="pl-8 w-[300px]"
                            disabled={!isMounted}
                        />
                        {loading && (
                            <div className="absolute right-8 top-2.5">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {isMounted && searchInputValue && !loading && (
                            <Button
                                variant="ghost"
                                onClick={() => handleSearchInputChange("")}
                                className="absolute right-0 top-0 h-full px-3 py-0 hover:bg-transparent"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                )}

                <div className="ml-auto">
                    {enableFiltering && (
                        <LocalFilterMenu
                            table={table}
                            columns={providedColumns}
                            isServerManaged={true}
                            currentServerFilters={filters}
                            onServerFiltersChange={onFilterChange}
                        />
                    )}

                    {enableSorting && (
                        <LocalSortList
                            table={table}
                            columns={providedColumns}
                            sorting={currentSort}
                            onSortingChange={handleSortingChange}
                            isServerManaged={true}
                        />
                    )}

                    {(hasActiveFilters || hasActiveSorting || hasActiveSearch) && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                // Clear all server-side states
                                if (onSortChange) onSortChange([]);
                                if (onSearchChange) onSearchChange("");
                                if (onFilterChange) onFilterChange({});

                                // Clear local filter state
                                setFilters({});

                                // Reset search input
                                if (searchInputRef.current) {
                                    searchInputRef.current.value = "";
                                }
                            }}
                            disabled={loading}
                        >
                            <X className="h-4 w-4" />
                            Clear All
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            <DataTableAdvancedToolbar table={table} columns={providedColumns}>
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
                            disabled={loading}
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
                            disabled={loading}
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
                            disabled={loading}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete ({selectedRowsCount})
                        </Button>
                    </div>
                </DataTableActionBar>
            )}

            <div className="relative overflow-hidden rounded-md border">
                {loading && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Loading...</span>
                        </div>
                    </div>
                )}
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
                        {loading ? (
                            Array.from({ length: pageSize }).map((_, index) => (
                                <TableRow key={index}>
                                    {finalColumns.map((_, colIndex) => (
                                        <TableCell key={colIndex}>
                                            <Skeleton className="h-1 w-full" />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <ContextMenu key={row.id}>
                                    <ContextMenuTrigger asChild>
                                        <TableRow
                                            data-state={row.getIsSelected() && "selected"}
                                            className="cursor-context-menu"
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

export default CybsuiteTableServer;
