"use client";

import React from 'react';
import { EntityRecord, EntitySchema } from '@/app/types/Data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Edit, Trash2, Link2, Hash, Calendar, List, ToggleLeft } from 'lucide-react';
import Link from 'next/link';
import { parseFieldAnnotation, getFieldDisplayName } from '@/app/lib/schema-utils';
import ModelDataTable from './ModelDataTable';
import { formatFieldValue } from './field-formatters';
import { getRecordTitle } from './record-utils';
import { ScrollToTableButton } from './ScrollToTableButton';
import { ScrollToTop } from '../navigation/scroll-to-top';

interface DetailPageViewProps {
    schema: EntitySchema;
    record: EntityRecord;
    model: string;
    relatedData: Record<string, any[]>;
    relatedSchemas: Record<string, EntitySchema>;
}

export default function DetailPageView({ schema, record, model, relatedData, relatedSchemas }: DetailPageViewProps) {
    const entityDisplayName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
    const recordTitle = getRecordTitle(schema, record);

    return (
        <div className="container mx-auto p-6 space-y-6">
            <ScrollToTop />
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
