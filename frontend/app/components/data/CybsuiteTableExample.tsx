"use client";

import { useState } from "react";
import CybsuiteTable from "@/app/components/data/CybsuiteTable";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { CalendarIcon, User, Shield, AlertCircle } from "lucide-react";

// Example data structure for cybersecurity findings
interface SecurityFinding {
    id: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    status: "open" | "in-progress" | "resolved" | "false-positive";
    assignee: string;
    createdAt: string;
    updatedAt: string;
    category: string;
    score: number;
}

// Mock data
const mockData: SecurityFinding[] = [
    {
        id: "1",
        title: "SQL Injection vulnerability in login form",
        severity: "critical",
        status: "open",
        assignee: "John Doe",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16",
        category: "Web Application",
        score: 9.5,
    },
    {
        id: "2",
        title: "Outdated SSL certificate on main server",
        severity: "high",
        status: "in-progress",
        assignee: "Jane Smith",
        createdAt: "2024-01-14",
        updatedAt: "2024-01-17",
        category: "Infrastructure",
        score: 7.8,
    },
    {
        id: "3",
        title: "Missing security headers in API responses",
        severity: "medium",
        status: "resolved",
        assignee: "Bob Johnson",
        createdAt: "2024-01-10",
        updatedAt: "2024-01-18",
        category: "API Security",
        score: 5.2,
    },
    {
        id: "4",
        title: "Weak password policy implementation",
        severity: "medium",
        status: "open",
        assignee: "Alice Brown",
        createdAt: "2024-01-12",
        updatedAt: "2024-01-12",
        category: "Authentication",
        score: 6.1,
    },
    {
        id: "5",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
    {
        id: "6",
        title: "SQL Injection vulnerability in login form",
        severity: "critical",
        status: "open",
        assignee: "John Doe",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16",
        category: "Web Application",
        score: 9.5,
    },
    {
        id: "7",
        title: "Outdated SSL certificate on main server",
        severity: "high",
        status: "in-progress",
        assignee: "Jane Smith",
        createdAt: "2024-01-14",
        updatedAt: "2024-01-17",
        category: "Infrastructure",
        score: 7.8,
    },
    {
        id: "8",
        title: "Missing security headers in API responses",
        severity: "medium",
        status: "resolved",
        assignee: "Bob Johnson",
        createdAt: "2024-01-10",
        updatedAt: "2024-01-18",
        category: "API Security",
        score: 5.2,
    },
    {
        id: "9",
        title: "Weak password policy implementation",
        severity: "medium",
        status: "open",
        assignee: "Alice Brown",
        createdAt: "2024-01-12",
        updatedAt: "2024-01-12",
        category: "Authentication",
        score: 6.1,
    },
    {
        id: "10",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
    {
        id: "11",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
    {
        id: "12",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
    {
        id: "13",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
    {
        id: "14",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
    {
        id: "15",
        title: "Unpatched third-party library dependencies",
        severity: "low",
        status: "false-positive",
        assignee: "Charlie Wilson",
        createdAt: "2024-01-08",
        updatedAt: "2024-01-19",
        category: "Dependencies",
        score: 3.4,
    },
];

const severityColors = {
    critical: "destructive",
    high: "destructive",
    medium: "default",
    low: "secondary",
} as const;

const statusColors = {
    open: "destructive",
    "in-progress": "default",
    resolved: "secondary",
    "false-positive": "outline",
} as const;

export default function CybsuiteTableExample() {
    const [notifications, setNotifications] = useState<string[]>([]);

    // Define custom columns with rich metadata for filtering and sorting
    const columns: ColumnDef<SecurityFinding>[] = [
        {
            id: "title",
            accessorKey: "title",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Title" />
            ),
            cell: ({ row }) => (
                <div className="max-w-[300px]">
                    <div className="font-medium truncate">{row.getValue("title")}</div>
                    <div className="text-sm text-muted-foreground">ID: {row.original.id}</div>
                </div>
            ),
            meta: {
                label: "Title",
                placeholder: "Search titles...",
                variant: "text",
                icon: AlertCircle,
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
        {
            id: "severity",
            accessorKey: "severity",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Severity" />
            ),
            cell: ({ row }) => {
                const severity = row.getValue("severity") as keyof typeof severityColors;
                return (
                    <Badge variant={severityColors[severity]}>
                        {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </Badge>
                );
            },
            meta: {
                label: "Severity",
                variant: "select",
                options: [
                    { label: "Critical", value: "critical", count: 1 },
                    { label: "High", value: "high", count: 1 },
                    { label: "Medium", value: "medium", count: 2 },
                    { label: "Low", value: "low", count: 1 },
                ],
                icon: Shield,
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
        {
            id: "status",
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Status" />
            ),
            cell: ({ row }) => {
                const status = row.getValue("status") as keyof typeof statusColors;
                return (
                    <Badge variant={statusColors[status]}>
                        {status.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                );
            },
            meta: {
                label: "Status",
                variant: "select",
                options: [
                    { label: "Open", value: "open", count: 2 },
                    { label: "In Progress", value: "in-progress", count: 1 },
                    { label: "Resolved", value: "resolved", count: 1 },
                    { label: "False Positive", value: "false-positive", count: 1 },
                ],
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
        {
            id: "assignee",
            accessorKey: "assignee",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Assignee" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{row.getValue("assignee")}</span>
                </div>
            ),
            meta: {
                label: "Assignee",
                placeholder: "Search assignees...",
                variant: "text",
                icon: User,
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
        {
            id: "score",
            accessorKey: "score",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Risk Score" />
            ),
            cell: ({ row }) => {
                const score = row.getValue("score") as number;
                return (
                    <div className="text-right font-mono">
                        {score.toFixed(1)}
                    </div>
                );
            },
            meta: {
                label: "Risk Score",
                variant: "range",
                range: [0, 10] as [number, number],
                unit: "",
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
        {
            id: "createdAt",
            accessorKey: "createdAt",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Created" />
            ),
            cell: ({ row }) => {
                const date = row.getValue("createdAt") as string;
                return (
                    <div className="flex items-center space-x-2">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{date}</span>
                    </div>
                );
            },
            meta: {
                label: "Created Date",
                variant: "date",
                icon: CalendarIcon,
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
        {
            id: "category",
            accessorKey: "category",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Category" />
            ),
            cell: ({ row }) => row.getValue("category"),
            meta: {
                label: "Category",
                variant: "select",
                options: [
                    { label: "Web Application", value: "Web Application" },
                    { label: "Infrastructure", value: "Infrastructure" },
                    { label: "API Security", value: "API Security" },
                    { label: "Authentication", value: "Authentication" },
                    { label: "Dependencies", value: "Dependencies" },
                ],
            },
            enableColumnFilter: true,
            enableSorting: true,
        },
    ];

    const handleRowAction = (action: string, rows: SecurityFinding[]) => {
        const rowIds = rows.map(row => row.id).join(", ");
        let message = "";

        switch (action) {
            case "view":
                message = `Viewing finding: ${rows[0]?.title}`;
                break;
            case "edit":
                message = `Editing finding: ${rows[0]?.title}`;
                break;
            case "delete":
                message = `Deleting ${rows.length} finding(s): ${rowIds}`;
                break;
            case "export":
                message = `Exporting ${rows.length} finding(s) to CSV`;
                break;
            default:
                message = `${action} action performed on ${rows.length} finding(s)`;
        }

        setNotifications(prev => [...prev, message]);

        // Auto-remove notification after 3 seconds
        setTimeout(() => {
            setNotifications(prev => prev.slice(1));
        }, 3000);
    };

    return (
        <div className="container mx-auto py-6 space-y-6">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold">Security Findings Dashboard</h1>
                <p className="text-muted-foreground">
                    Comprehensive data table with filtering, sorting, pagination, and bulk actions
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm">
                    <h3 className="font-semibold text-blue-900 mb-2">💡 How to use the table features:</h3>
                    <ul className="text-blue-800 space-y-1">
                        <li><strong>Global Search:</strong> Use the search bar above the table to search across all columns</li>
                        <li><strong>Column Sorting:</strong> Click on any column header to sort (click again to reverse order)</li>
                        <li><strong>Multi-Column Sorting:</strong> Hold Shift and click multiple column headers</li>
                        <li><strong>Row Selection:</strong> Use checkboxes to select rows for bulk actions</li>
                        <li><strong>Column Visibility:</strong> Use the "View" dropdown in the toolbar to show/hide columns</li>
                        <li><strong>Clear Actions:</strong> Use "Clear Sort" and "Clear Filters" buttons when they appear</li>
                    </ul>
                </div>
            </div>

            {/* Notifications */}
            {notifications.length > 0 && (
                <div className="space-y-2">
                    {notifications.map((notification, index) => (
                        <div key={index} className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                            {notification}
                        </div>
                    ))}
                </div>
            )}

            {/* Full-featured data table */}
            <CybsuiteTable
                data={mockData}
                columns={columns}
                enableRowSelection={true}
                enableFiltering={true}
                enableSorting={true}
                enablePagination={true}
                enableGlobalSearch={true}
                pageSize={10}
                onRowAction={handleRowAction}
                tableId="main-findings-table"
            />

            {/* Second independent table with different settings */}
            <div className="space-y-4">
                <h2 className="text-2xl font-semibold">High Priority Findings</h2>
                <p className="text-muted-foreground">
                    Independent table showing only critical and high severity findings
                </p>
                <CybsuiteTable
                    data={mockData.filter(item => item.severity === "critical" || item.severity === "high")}
                    columns={columns}
                    enableRowSelection={true}
                    enableFiltering={true}
                    enableSorting={true}
                    enablePagination={false}
                    enableGlobalSearch={true}
                    pageSize={5}
                    onRowAction={handleRowAction}
                    tableId="high-priority-table"
                />
            </div>

            {/* Third table with basic auto-generated columns */}
            <div className="space-y-4">
                <h2 className="text-2xl font-semibold">Basic Auto-Generated Table</h2>
                <p className="text-muted-foreground">
                    Table with automatically generated columns from data structure - no pagination
                </p>
                <CybsuiteTable
                    data={mockData}
                    enableRowSelection={false}
                    enableFiltering={true}
                    enableSorting={true}
                    enablePagination={false}
                    enableGlobalSearch={true}
                    pageSize={5}
                    tableId="basic-table"
                />
            </div>
        </div>
    );
}
