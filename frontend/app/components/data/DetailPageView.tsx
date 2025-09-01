"use client";

import React from 'react';
import { useRouter } from "next/navigation";
import { EntityRecord, EntitySchema } from '@/app/types/Data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, Edit, Trash2, Link2, Hash, Calendar, List, ToggleLeft, CircleQuestionMark, RefreshCw, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { parseFieldAnnotation, getFieldDisplayName } from '@/app/lib/schema-utils';
import { api } from "@/app/lib/api";
import { EntityFormDialog } from "@/app/components/data/form/EntityFormDialog";
import ModelDataTable from './ModelDataTable';
import { formatFieldValue } from './field-formatters';
import { getRecordTitle, getRecordDisplayName } from '../../lib/record-details-utils';
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
    const router = useRouter();
    const entityDisplayName = schema.name.charAt(0).toUpperCase() + schema.name.slice(1);
    const recordTitle = getRecordTitle(schema, record);

    // Edit state for the edit dialog
    const [editRecord, setEditRecord] = React.useState<EntityRecord | null>(null);
    const [editDialogOpen, setEditDialogOpen] = React.useState(false);

    // Delete confirmation dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [recordsToDelete, setRecordsToDelete] = React.useState<EntityRecord[]>([]);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    // Handle edit button click
    const handleEdit = React.useCallback(() => {
        setEditRecord(record);
        setEditDialogOpen(true);
    }, [record]);

    // Handle delete button click
    const handleDelete = React.useCallback(() => {
        setRecordsToDelete([record]);
        setDeleteDialogOpen(true);
    }, [record]);

    // Handle actual deletion after confirmation
    const handleConfirmDelete = React.useCallback(async () => {
        setIsDeleting(true);
        try {
            // Collect all valid record IDs
            const recordIds = recordsToDelete
                .filter(row => row.id !== undefined && row.id !== null)
                .map(row => row.id as string | number);

            if (recordIds.length === 0) {
                throw new Error('No valid record IDs found for deletion');
            }

            // Use bulk delete API
            const response = await api.data.bulkDeleteRecords(model, recordIds);

            if (response.error) {
                throw new Error(response.error);
            }

            // Check if there were any failures
            if (response.data && response.data.failed_count > 0) {
                const errorMessage = `Successfully deleted ${response.data.deleted_count} records, but ${response.data.failed_count} failed: ${response.data.errors.join(', ')}`;
                console.warn(errorMessage);
                // You might want to show a toast notification here
            }

            // Navigate back to the model list page after successful deletion
            router.push(`/data/${model}`);

            // Close dialog and reset state
            setDeleteDialogOpen(false);
            setRecordsToDelete([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete records');
        } finally {
            setIsDeleting(false);
        }
    }, [recordsToDelete, model, router]);

    // Handle cancel deletion
    const handleCancelDelete = React.useCallback(() => {
        setDeleteDialogOpen(false);
        setRecordsToDelete([]);
    }, []);

    // Function to render individual field row
    const renderFieldRow = (field: any, record: EntityRecord) => {
        const fieldName = field.name;
        const fieldValue = record[fieldName];
        const displayName = getFieldDisplayName(field);
        const typeInfo = parseFieldAnnotation(field);

        // Check if field is empty/null
        const isEmpty = fieldValue === null || fieldValue === undefined ||
            (typeof fieldValue === 'string' && fieldValue.trim() === '') ||
            (Array.isArray(fieldValue) && fieldValue.length === 0);

        // Get styling based on field type and empty state
        const getFieldStyling = () => {
            if (isEmpty) {
                return {
                    containerClass: 'opacity-50',
                    labelClass: 'text-gray-400',
                    valueClass: 'text-gray-400 italic',
                    iconClass: 'text-gray-300',
                    badgeClass: 'bg-gray-100 text-gray-400 border-gray-200'
                };
            }

            if (typeInfo.isRelation) {
                return {
                    containerClass: 'bg-blue-50/30',
                    labelClass: 'text-blue-900 font-medium',
                    valueClass: 'text-blue-800',
                    iconClass: 'text-blue-600',
                    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200'
                };
            }

            if (typeInfo.variant === 'number') {
                return {
                    containerClass: 'bg-purple-50/30',
                    labelClass: 'text-purple-900 font-medium',
                    valueClass: 'text-purple-800 font-mono',
                    iconClass: 'text-purple-600',
                    badgeClass: 'bg-purple-100 text-purple-700 border-purple-200'
                };
            }

            if (typeInfo.variant === 'boolean') {
                return {
                    containerClass: 'bg-green-50/30',
                    labelClass: 'text-green-900 font-medium',
                    valueClass: 'text-green-800 font-semibold',
                    iconClass: 'text-green-600',
                    badgeClass: 'bg-green-100 text-green-700 border-green-200'
                };
            }

            if (typeInfo.variant === 'date') {
                return {
                    containerClass: 'bg-orange-50/30',
                    labelClass: 'text-orange-900 font-medium',
                    valueClass: 'text-orange-800',
                    iconClass: 'text-orange-600',
                    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200'
                };
            }

            if (typeInfo.baseType === 'dict') {
                return {
                    containerClass: 'bg-indigo-50/30',
                    labelClass: 'text-indigo-900 font-medium',
                    valueClass: 'text-indigo-800 font-mono text-sm',
                    iconClass: 'text-indigo-600',
                    badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200'
                };
            }

            // Check if it's an enum field (has choices)
            if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
                return {
                    containerClass: 'bg-emerald-50/30',
                    labelClass: 'text-emerald-900 font-medium',
                    valueClass: 'text-emerald-800',
                    iconClass: 'text-emerald-600',
                    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200'
                };
            }

            // Default text fields
            return {
                containerClass: 'bg-slate-50/30',
                labelClass: 'text-slate-900 font-medium',
                valueClass: 'text-slate-800',
                iconClass: 'text-slate-600',
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
            };
        };

        // Get appropriate icon for field type
        const getFieldIcon = () => {
            if (typeInfo.isRelation) return <Link2 className="h-4 w-4" />;
            if (typeInfo.variant === 'boolean') return <ToggleLeft className="h-4 w-4" />;
            if (typeInfo.variant === 'number') return <Hash className="h-4 w-4" />;
            if (typeInfo.variant === 'date') return <Calendar className="h-4 w-4" />;
            if (typeInfo.isArray || typeInfo.baseType === 'dict') return <List className="h-4 w-4" />;
            return null;
        };

        // Render field value with special handling for different types
        const renderFieldValue = () => {
            if (isEmpty) {
                return <span>No data available</span>;
            }

            // Handle dict fields with accordion
            if (typeInfo.baseType === 'dict' && fieldValue && typeof fieldValue === 'object') {
                const dictKeys = Object.keys(fieldValue);
                const dictPreview = dictKeys.length > 0 ?
                    `${dictKeys.length} ${dictKeys.length === 1 ? 'property' : 'properties'}` :
                    'Empty object';

                return (
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="dict-content" className="border-none">
                            <AccordionTrigger className="py-1 text-xs text-indigo-600 hover:text-indigo-700 hover:no-underline">
                                <span className="text-indigo-700 font-medium">{dictPreview}</span>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-1">
                                <div className="bg-indigo-50 rounded-md p-3 border border-indigo-200">
                                    <pre className="text-xs text-indigo-800 whitespace-pre-wrap break-words overflow-hidden">
                                        {JSON.stringify(fieldValue, null, 2)}
                                    </pre>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                );
            }

            // Handle enum fields with badges
            if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
                return (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                        {fieldValue}
                    </Badge>
                );
            }

            // Handle array fields with badges
            if (typeInfo.isArray && Array.isArray(fieldValue)) {
                const maxDisplayItems = 4;
                const itemsToShow = fieldValue.slice(0, maxDisplayItems);
                const remainingCount = fieldValue.length - maxDisplayItems;

                return (
                    <div className="flex flex-wrap gap-1">
                        {itemsToShow.map((item, index) => {
                            const displayText = typeof item === 'object' && item !== null ?
                                (item.repr || item.name || JSON.stringify(item)) :
                                String(item);

                            const truncatedText = displayText.length > 30 ?
                                `${displayText.substring(0, 30)}...` :
                                displayText;

                            const needsTooltip = displayText.length > 30;

                            // Get the ID and entity type for linking
                            const itemId = typeof item === 'object' && item !== null ? item.id : item;
                            const linkedEntityType = typeInfo.referencedEntity;

                            const badgeContent = (
                                <div className="flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    {truncatedText}
                                </div>
                            );

                            const badgeElement = linkedEntityType && itemId ? (
                                <Link key={index} href={`/data/${linkedEntityType}/${itemId}`} className="no-underline">
                                    <Badge
                                        variant="outline"
                                        className="text-xs bg-blue-100 text-blue-700 border-blue-200 max-w-xs truncate hover:bg-blue-200 transition-colors cursor-pointer"
                                    >
                                        {badgeContent}
                                    </Badge>
                                </Link>
                            ) : (
                                <Badge
                                    key={index}
                                    variant="outline"
                                    className="text-xs bg-blue-100 text-blue-700 border-blue-200 max-w-xs truncate"
                                >
                                    {badgeContent}
                                </Badge>
                            );

                            if (needsTooltip) {
                                return (
                                    <Tooltip key={index}>
                                        <TooltipTrigger asChild>
                                            {badgeElement}
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-md break-words">{displayText}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            }

                            return badgeElement;
                        })}

                        {/* Show +n badge if there are more items */}
                        {remainingCount > 0 && (
                            remainingCount <= 5 ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge
                                            variant="outline"
                                            className="text-xs bg-gray-100 text-gray-600 border-gray-300 font-medium"
                                        >
                                            +{remainingCount}
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="max-w-md">
                                            <p className="font-medium mb-2">Additional {remainingCount} items:</p>
                                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                                {fieldValue.slice(maxDisplayItems).map((item, index) => {
                                                    const displayText = typeof item === 'object' && item !== null ?
                                                        (item.repr || item.name || JSON.stringify(item)) :
                                                        String(item);
                                                    return (
                                                        <p key={index} className="text-sm break-words">
                                                            • {displayText}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            ) : (
                                <Badge
                                    variant="outline"
                                    className="text-xs bg-gray-100 text-gray-600 border-gray-300 font-medium"
                                >
                                    +{remainingCount}
                                </Badge>
                            )
                        )}
                    </div>
                );
            }

            // Default formatting
            return formatFieldValue(fieldValue, field);
        };

        const styling = getFieldStyling();

        return (
            <div key={fieldName} className={`px-6 py-4 hover:bg-gray-50/50 transition-colors ${styling.containerClass}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <div className={"mt-0.5 " + styling.iconClass}>
                            {getFieldIcon()}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-2">
                                <h3 className={`text-sm ${styling.labelClass}`}>
                                    {displayName}
                                </h3>
                                {field.description && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <CircleQuestionMark className="text-gray-400 w-3 h-3" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{field.description}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                            <div className={`mt-1 text-sm ${styling.valueClass}`}>
                                {renderFieldValue()}
                            </div>
                        </div>
                    </div>
                    <div className="self-start flex items-center space-x-2 ml-4">
                        {typeInfo.isRelation && !isEmpty && (
                            <ScrollToTableButton
                                entityType={typeInfo.referencedEntity || field.name.replace(/s$/, '')}
                                fieldName={field.name}
                            />
                        )}
                        {typeInfo.isRelation && (
                            <Badge variant="outline" className={`text-xs ${styling.badgeClass}`}>
                                {typeInfo.isArray ? `Multi: ${Array.isArray(fieldValue) ? fieldValue.length : 0}` : 'Single'}
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <ScrollToTop />
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href={`/data/${model}`}>
                        <Button variant="ghost" size="lg" className="cursor-pointer">
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
                        <p className="text-sm text-gray-500">{entityDisplayName.replace(/_/g, ' ')} Details</p>
                    </div>
                </div>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={handleEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                </div>
            </div>

            {/* Main content - Compact two-column list-style field display */}
            <div className="space-y-6">
                <Card className="overflow-hidden">
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                            {/* Left Column */}
                            <div className="divide-y divide-gray-100">
                                {Object.values(schema.fields)
                                    .filter(field => field.name !== 'id')
                                    .filter((_, index) => index % 2 === 0) // Even indices (0, 2, 4...)
                                    .map((field) => {
                                        return renderFieldRow(field, record);
                                    })}
                            </div>

                            {/* Right Column */}
                            <div className="divide-y divide-gray-100">
                                {Object.values(schema.fields)
                                    .filter(field => field.name !== 'id')
                                    .filter((_, index) => index % 2 === 1) // Odd indices (1, 3, 5...)
                                    .map((field) => {
                                        return renderFieldRow(field, record);
                                    })}
                            </div>
                        </div>

                        {/* Fallback message if no fields to show */}
                        {Object.values(schema.fields).filter(field => field.name !== 'id').length === 0 && (
                            <div className="px-6 py-12 text-center text-gray-500 col-span-2">
                                No field information available for this record.
                            </div>
                        )}
                    </CardContent>
                </Card>
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

            {/* Edit Dialog */}
            {editRecord && (
                <EntityFormDialog
                    entity={model}
                    mode="edit"
                    editRecord={editRecord}
                    recordId={editRecord.id || editRecord.uuid}
                    open={editDialogOpen}
                    onOpenChange={(open) => {
                        setEditDialogOpen(open);
                        if (!open) {
                            setEditRecord(null);
                        }
                    }}
                    onSuccess={() => {
                        // Refresh the page after successful edit
                        setEditDialogOpen(false);
                        setEditRecord(null);
                        // Force page refresh to show updated data
                        window.location.reload();
                    }}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this record?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {recordsToDelete.length > 0 && (
                        <div className="py-4">
                            <p className="text-sm text-gray-600 mb-2">Record to be deleted:</p>
                            <div className="border rounded p-2 bg-gray-50">
                                <div className="text-sm py-1 font-medium">
                                    {getRecordDisplayName(recordsToDelete[0])}
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="py-2">
                            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                                {error}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={handleCancelDelete}
                            disabled={isDeleting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Record
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
