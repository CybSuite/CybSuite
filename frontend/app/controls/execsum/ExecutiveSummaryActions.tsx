"use client";

import React, { useState } from 'react';
import { Button } from "../../../components/ui/button";
import { RefreshCw, Download, ExternalLink } from "lucide-react";
import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils";
import { api } from "../../lib/api";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ExecutiveSummaryActionsProps {
    type?: 'controls' | 'observations';
    showRefresh?: boolean;
    showDownload?: boolean;
    showRetry?: boolean;
}

export default function ExecutiveSummaryActions({
    type,
    showRefresh = false,
    showDownload = false,
    showRetry = false
}: ExecutiveSummaryActionsProps) {
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);

    const handleViewAll = () => {
        if (type === 'controls') {
            router.push('/controls/control_definitions');
        } else if (type === 'observations') {
            router.push('/controls/observation_definitions');
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        // Refresh the page to trigger SSR refetch
        router.refresh();
        setTimeout(() => setRefreshing(false), 1000);
    };

    const handleDownload = (format: 'json' | 'xlsx' | 'html') => {
        const downloadUrl = api.reports.downloadReport(format === "html" ? "html" : `controls_${format}`);
        window.open(downloadUrl, '_blank');
    };

    const handleRetry = () => {
        router.refresh();
    };

    // View All button for TopControlsCard
    if (type && !showRefresh && !showDownload && !showRetry) {
        return (
            <Button
                variant="ghost"
                size="sm"
                onClick={handleViewAll}
                className="text-xs"
            >
                View All
                <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
        );
    }

    // Header actions
    if (showRefresh || showDownload) {
        return (
            <div className="flex items-center gap-2">
                {showRefresh && (
                    <Button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        variant="outline"
                        size="sm"
                    >
                        <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                        Refresh
                    </Button>
                )}
                {showDownload && (
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <Download className="h-4 w-4 mr-2" />
                                Download
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-fit" align="end">
                            <DropdownMenuItem onSelect={() => handleDownload('json')}>JSON</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDownload('xlsx')}>Excel</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleDownload('html')}>HTML</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        );
    }

    // Error state retry button
    if (showRetry) {
        return (
            <div className="flex items-center gap-4">
                <Button onClick={handleRetry}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                </Button>
            </div>
        );
    }

    return null;
}
