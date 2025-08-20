"use client";

import type { Table } from "@tanstack/react-table";
import { Check, ChevronsUpDown, Settings2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  columns?: any[]; // Add columns prop as backup
}

export function DataTableViewOptions<TData>({
  table,
  columns: directColumns,
}: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(() => {
    try {
      let allColumns: any[] = [];

      if (directColumns && directColumns.length > 0) {
        // Use direct columns if provided (for server-managed mode)
        allColumns = directColumns.map((col, index) => ({
          id: col.id || col.accessorKey || `column-${index}`,
          columnDef: col,
          accessorFn: col.accessorFn || col.accessorKey,
          getCanHide: () => col.enableHiding !== false,
          getIsVisible: () => table.getState().columnVisibility[col.id || col.accessorKey || `column-${index}`] !== false,
          toggleVisibility: (value?: boolean) => {
            const columnId = col.id || col.accessorKey || `column-${index}`;
            table.setColumnVisibility(prev => ({
              ...prev,
              [columnId]: value ?? !prev[columnId]
            }));
          }
        }));
      } else if (table && table.getAllColumns) {
        // Fallback to table columns
        allColumns = table.getAllColumns();
      } else {
        return [];
      }

      return allColumns.filter(
        (column: any) =>
          typeof column.accessorFn !== "undefined" && column.getCanHide(),
      );
    } catch {
      return [];
    }
  }, [table, directColumns]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Toggle columns"
          role="combobox"
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 lg:flex"
        >
          <Settings2 />
          View
          <ChevronsUpDown className="ml-auto opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-0">
        <Command>
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem
                  key={column.id}
                  onSelect={() =>
                    column.toggleVisibility(!column.getIsVisible())
                  }
                >
                  <span className="truncate">
                    {column.columnDef.meta?.label ?? column.id}
                  </span>
                  <Check
                    className={cn(
                      "ml-auto size-4 shrink-0",
                      column.getIsVisible() ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
