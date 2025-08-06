'use client';

import React from 'react';
import { EntityRecord, EntitySchema } from '@/app/types/Data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Edit, Trash2, Link2, Hash, Calendar, List, ToggleLeft, ExternalLink, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { parseFieldAnnotation, getFieldDisplayName } from '@/app/lib/schema-utils';
import ModelDataTable from './ModelDataTable';

interface DetailPageProps {
    schema: EntitySchema;
    record: EntityRecord;
    model: string;
    relatedData: Record<string, any[]>;
    relatedSchemas: Record<string, EntitySchema>;
}

// Helper function to format field values for display
function formatFieldValue(
    value: any,
    field: any,
    onRelationClick?: (entityType: string, identifier: string) => void
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

// Component to get record title
function getRecordTitle(schema: EntitySchema, record: EntityRecord): string {
    const entityDisplayName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);

    // First, try to find a field marked as repr
    const reprField = Object.values(schema.fields).find(field => (field as any).repr);
    if (reprField && record[reprField.name]) {
        const reprValue = record[reprField.name];
        if (typeof reprValue === 'object' && reprValue.repr) {
            return String(reprValue.repr);
        }
        return String(reprValue);
    }

    // If no repr field, try common name fields
    const nameFields = ['name', 'title', 'label', 'hostname', 'ip'];
    for (const fieldName of nameFields) {
        if (record[fieldName]) {
            const fieldValue = record[fieldName];
            if (typeof fieldValue === 'object' && fieldValue.repr) {
                return String(fieldValue.repr);
            }
            return String(fieldValue);
        }
    }

    // Fallback to pretty_id if available
    if (record.pretty_id) {
        return String(record.pretty_id);
    }

    // Last resort: use entity name with ID
    return `${entityDisplayName} #${record.id}`;
}

// Client component for scroll behavior
function ScrollToTableButton({ entityType, fieldName }: { entityType: string; fieldName: string }) {
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

export default function DetailPageView({ schema, record, model, relatedData, relatedSchemas }: DetailPageProps) {
    const entityDisplayName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
    const recordTitle = getRecordTitle(schema, record);

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href={`/data/${model}`}>
                        <Button variant="ghost" size="lg">
                            <ArrowLeft className="h-8 w-8" />
                        </Button>
                    </Link>
                    <div className="min-w-0 flex-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <h1 className="text-2xl font-bold text-gray-900 truncate">
                                    {recordTitle.length > 60 ? `${recordTitle.substring(0, 60)}...` : recordTitle}
                                </h1>
                            </TooltipTrigger>
                            {recordTitle.length > 60 && (
                                <TooltipContent side="bottom" className="max-w-md">
                                    <p className="break-words">{recordTitle}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                        <p className="text-sm text-gray-500">{entityDisplayName} Details</p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Main content - Individual cards for each field */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {Object.values(schema.fields)
                    .filter(field => {
                        // Skip ID field only
                        return field.name !== 'id';
                    })
                    .map((field) => {
                        const fieldName = field.name;
                        const fieldValue = record[fieldName];
                        const displayName = getFieldDisplayName(field);
                        const typeInfo = parseFieldAnnotation(field);

                        // Determine card variant based on field type
                        const getCardVariant = () => {
                            if (typeInfo.isRelation) return 'border-blue-200 bg-blue-50/30';
                            if (typeInfo.variant === 'boolean') return 'border-green-200 bg-green-50/30';
                            if (typeInfo.variant === 'number') return 'border-purple-200 bg-purple-50/30';
                            if (typeInfo.variant === 'date') return 'border-orange-200 bg-orange-50/30';
                            return 'border-gray-200 bg-white';
                        };

                        // Get appropriate icon for field type
                        const getFieldIcon = () => {
                            if (typeInfo.isRelation) return <Link2 className="h-4 w-4 text-blue-600" />;
                            if (typeInfo.variant === 'boolean') return <ToggleLeft className="h-4 w-4 text-green-600" />;
                            if (typeInfo.variant === 'number') return <Hash className="h-4 w-4 text-purple-600" />;
                            if (typeInfo.variant === 'date') return <Calendar className="h-4 w-4 text-orange-600" />;
                            if (typeInfo.isArray) return <List className="h-4 w-4 text-gray-600" />;
                            return null;
                        };

                        return (
                            <Card key={fieldName} className={`transition-shadow hover:shadow-md ${getCardVariant()}`}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base font-medium text-gray-800 flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            {getFieldIcon()}
                                            <span>{displayName}</span>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            {typeInfo.isRelation && (
                                                <ScrollToTableButton
                                                    entityType={typeInfo.referencedEntity || field.name.replace(/s$/, '')}
                                                    fieldName={field.name}
                                                />
                                            )}
                                            {typeInfo.isRelation && (
                                                <Badge variant="outline" className="text-xs">
                                                    {typeInfo.isArray ? `Multi: ${Array.isArray(fieldValue) ? fieldValue.length : 0}` : 'Single'}
                                                </Badge>
                                            )}
                                        </div>
                                    </CardTitle>
                                    {field.description && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            {field.description}
                                        </p>
                                    )}
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="text-sm">
                                        {formatFieldValue(fieldValue, field)}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}

                {/* Fallback message if no fields to show */}
                {Object.values(schema.fields).filter(field => field.name !== 'id').length === 0 && (
                    <div className="col-span-full">
                        <Card className="border-dashed border-gray-300">
                            <CardContent className="p-12 text-center">
                                <p className="text-gray-500">No field information available for this record.</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>

            {/* Related Entity Tables */}
            {Object.entries(relatedData).map(([entityType, records]) => {
                const relatedSchema = relatedSchemas[entityType];
                if (!relatedSchema) return null;

                return (
                    <React.Fragment key={entityType}>
                        <div className="my-12">
                            <div className="border-t border-gray-200"></div>
                        </div>
                        <div id={`table-${entityType}`} className="space-y-6 mb-12">
                            <div className="flex items-center space-x-2">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Related {entityType.charAt(0).toUpperCase() + entityType.slice(1)} Records
                                </h2>
                                <Badge variant="outline" className="text-sm">
                                    {records.length} item{records.length !== 1 ? 's' : ''}
                                </Badge>
                            </div>

                            <div className="transition-all duration-300">
                                <ModelDataTable
                                    model={entityType}
                                    initialData={records}
                                    isStaticData={true} // Use initial data without fetching
                                    initialSchema={relatedSchema}
                                    showSeeAllButton={true}
                                    showRefreshButton={false}
                                />
                            </div>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
