'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

interface ScrollToTableButtonProps {
    entityType: string;
    fieldName: string;
}

// Client component for scroll behavior
export function ScrollToTableButton({ entityType, fieldName }: ScrollToTableButtonProps) {
    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => {
                const tableId = `table-${entityType}`;
                document.getElementById(tableId)?.scrollIntoView({ behavior: 'smooth' });
            }}
            title={`Scroll to ${entityType || fieldName} table`}
        >
            <ChevronDown className="h-3 w-3 mr-1" />
            Table
        </Button>
    );
}
