'use client';

import React from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { parseFieldAnnotation } from '@/app/lib/schema-utils';

// Helper function to format field values for display
export function formatFieldValue(
    value: any,
    field: any
): React.ReactElement | string {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 italic">No data available</span>;
    }

    const typeInfo = parseFieldAnnotation(field);

    // Handle relations
    if (typeInfo.isRelation) {
        if (Array.isArray(value)) {
            // Many-to-many relation
            if (value.length === 0) {
                return <span className="text-gray-400 italic">No items linked</span>;
            }

            const displayItems = value.slice(0, 5);
            const remainingCount = value.length - 5;

            return (
                <div className="flex flex-wrap gap-1">
                    {displayItems.map((item, index) => {
                        const repr = typeof item === 'object' && item.repr ? item.repr : String(item);
                        const identifier = typeof item === 'object' && item.pretty_id ? item.pretty_id :
                            (typeof item === 'object' && item.id ? String(item.id) : String(item));

                        return (
                            <Link
                                key={index}
                                href={`/data/${typeInfo.referencedEntity || field.name}/${encodeURIComponent(identifier)}`}
                                target="_blank"
                            >
                                <Badge
                                    variant="secondary"
                                    className="text-xs cursor-pointer hover:bg-blue-200 transition-colors flex items-center gap-1"
                                    title={`Click to view ${repr} details`}
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    {repr}
                                </Badge>
                            </Link>
                        );
                    })}
                    {remainingCount > 0 && (
                        <Badge
                            variant="outline"
                            className="text-xs text-gray-500 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => {
                                // Scroll to table for this relation type
                                const entityType = typeInfo.referencedEntity || field.name.replace(/s$/, ''); // Remove trailing 's'
                                const tableId = `table-${entityType}`;
                                document.getElementById(tableId)?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            +{remainingCount} more
                        </Badge>
                    )}
                </div>
            );
        } else if (typeof value === 'object' && value.repr) {
            // Single relation
            const identifier = value.pretty_id ? value.pretty_id : (value.id ? String(value.id) : '');
            return (
                <Link
                    href={`/data/${typeInfo.referencedEntity || field.name}/${encodeURIComponent(identifier)}`}
                    target="_blank"
                >
                    <Badge
                        variant="outline"
                        className="text-sm cursor-pointer hover:bg-blue-100 transition-colors flex items-center gap-1"
                        title={`Click to view ${value.repr} details`}
                    >
                        <ExternalLink className="h-3 w-3" />
                        {value.repr}
                    </Badge>
                </Link>
            );
        }
    }

    // Handle arrays
    if (Array.isArray(value)) {
        if (value.length === 0) {
            return <span className="text-gray-400 italic">No items in list</span>;
        }

        const displayItems = value.slice(0, 5);
        const remainingCount = value.length - 5;

        return (
            <div className="space-y-1">
                <ul className="list-disc list-inside space-y-1 text-sm">
                    {displayItems.map((item, index) => (
                        <li key={index} className="text-gray-700">
                            {String(item)}
                        </li>
                    ))}
                </ul>
                {remainingCount > 0 && (
                    <div className="text-xs text-gray-500 ml-4">
                        + {remainingCount} more item{remainingCount !== 1 ? 's' : ''}
                    </div>
                )}
            </div>
        );
    }

    // Handle booleans
    if (typeof value === 'boolean') {
        return (
            <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${value ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className={value ? 'text-green-700' : 'text-gray-500'}>
                    {value ? 'Yes' : 'No'}
                </span>
            </div>
        );
    }

    // Handle objects (JSON)
    if (typeof value === 'object') {
        return (
            <details className="bg-gray-50 rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                    View JSON data
                </summary>
                <pre className="text-xs mt-2 overflow-auto max-h-32">
                    {JSON.stringify(value, null, 2)}
                </pre>
            </details>
        );
    }

    // Handle long text
    const stringValue = String(value);
    if (stringValue.length > 100) {
        return (
            <details>
                <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    {stringValue.substring(0, 100)}...
                </summary>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                    {stringValue}
                </div>
            </details>
        );
    }

    // Default: convert to string
    return <span className="text-gray-700">{stringValue}</span>;
}
