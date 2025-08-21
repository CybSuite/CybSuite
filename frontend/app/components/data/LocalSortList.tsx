"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sortable, SortableContent, SortableItem, SortableItemHandle } from "@/components/ui/sortable";
import { ArrowUpDown, ArrowUp, ArrowDown, GripVertical, X, Plus } from "lucide-react";

interface LocalSortListProps<TData> {
    table: any;
    columns?: any[]; // Add columns prop as backup
    sorting: any[];
    onSortingChange: any;
    // Server-side support
    isServerManaged?: boolean;
}

// Local Sort List Component (Exact DiceUI styling with local state + drag and drop)
function LocalSortList<TData>({ table, columns: directColumns, sorting, onSortingChange, isServerManaged = false }: LocalSortListProps<TData>) {
    const [open, setOpen] = React.useState(false);
    const [addColumnOpen, setAddColumnOpen] = React.useState(false);

    const { columnLabels, columns } = React.useMemo(() => {
        const labels = new Map<string, string>();
        const sortingIds = new Set(sorting.map((s: any) => s.id));
        const availableColumns: { id: string; label: string }[] = [];

        try {
            let allColumns: any[] = [];

            if (directColumns && directColumns.length > 0) {
                // Use direct columns if provided (for server-managed mode)
                allColumns = directColumns.map((col, index) => ({
                    id: col.id || col.accessorKey || `column-${index}`,
                    columnDef: col,
                    getCanSort: () => col.enableSorting !== false
                }));
            } else if (table && table.getAllColumns) {
                // Fallback to table columns
                allColumns = table.getAllColumns();
            } else {
                return { columnLabels: labels, columns: availableColumns };
            }

            for (const column of allColumns) {
                if (!column.getCanSort()) continue;

                const label = column.columnDef.meta?.label ?? column.id;
                labels.set(column.id, label);

                if (!sortingIds.has(column.id)) {
                    availableColumns.push({ id: column.id, label });
                }
            }
        } catch {
            // Safe fallback during SSR
        }

        return {
            columnLabels: labels,
            columns: availableColumns,
        };
    }, [sorting, table, directColumns]);

    // Clean up when popup closes
    React.useEffect(() => {
        if (!open) {
            setAddColumnOpen(false);
        }
    }, [open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="border-dashed">
                    <ArrowUpDown className="mr-2 h-4 w-4" />
                    Sort
                    {sorting.length > 0 && (
                        <Badge variant="secondary" className="ml-2 px-1 font-normal">
                            {sorting.length}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3">
                    <div className="text-sm font-medium mb-3">Sort by</div>

                    <Sortable
                        value={sorting.map((s: any) => s.id)}
                        onValueChange={(newOrder: string[]) => {
                            const newSorting = newOrder.map(id =>
                                sorting.find((s: any) => s.id === id)
                            ).filter(Boolean);
                            onSortingChange(newSorting);
                        }}
                    >
                        <SortableContent className="space-y-2">
                            {sorting.map((sort: any) => {
                                const label = columnLabels.get(sort.id) ?? sort.id;

                                return (
                                    <SortableItem
                                        key={sort.id}
                                        value={sort.id}
                                        className="flex items-center gap-2 p-2 rounded-md border bg-background"
                                    >
                                        <SortableItemHandle>
                                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                                        </SortableItemHandle>

                                        <div className="flex-1 text-sm">{label}</div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                onSortingChange((prev: any) =>
                                                    prev.map((s: any) =>
                                                        s.id === sort.id
                                                            ? { ...s, desc: !s.desc }
                                                            : s
                                                    )
                                                );
                                            }}
                                            className="h-6 w-6 p-0"
                                        >
                                            {sort.desc ? (
                                                <ArrowDown className="h-3 w-3" />
                                            ) : (
                                                <ArrowUp className="h-3 w-3" />
                                            )}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                onSortingChange((prev: any) =>
                                                    prev.filter((s: any) => s.id !== sort.id)
                                                );
                                            }}
                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </SortableItem>
                                );
                            })}
                        </SortableContent>
                    </Sortable>

                    <div className="flex gap-2 mt-4">
                        <Popover open={addColumnOpen} onOpenChange={setAddColumnOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={columns.length === 0}
                                    className="flex-1"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add column
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-2" side="bottom" align="start">
                                <div className="space-y-1">
                                    {columns.map((column) => (
                                        <Button
                                            key={column.id}
                                            variant="ghost"
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => {
                                                onSortingChange((prev: any) => [
                                                    ...prev,
                                                    { id: column.id, desc: false }
                                                ]);
                                                setAddColumnOpen(false);
                                            }}
                                        >
                                            {column.label}
                                        </Button>
                                    ))}
                                    {columns.length === 0 && (
                                        <div className="text-xs text-muted-foreground p-2">
                                            All sortable columns are already added
                                        </div>
                                    )}
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSortingChange([])}
                            disabled={sorting.length === 0}
                            className="flex-1"
                        >
                            Clear all
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export { LocalSortList };
