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
                const element = document.getElementById(tableId);
                if (element) {
                    const elementRect = element.getBoundingClientRect();
                    const absoluteElementTop = elementRect.top + window.pageYOffset;
                    const middle = absoluteElementTop - (window.innerHeight / 2) + 150;
                    window.scrollTo({ top: middle, behavior: 'smooth' });
                }
            }}
            title={`Scroll to ${entityType || fieldName} table`}
        >
            <ChevronDown className="h-3 w-3 mr-1" />
            Table
        </Button>
    );
}
