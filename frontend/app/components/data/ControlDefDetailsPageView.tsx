"use client";

import React from 'react';
import { useRouter } from "next/navigation";
import { EntityRecord, EntitySchema } from '@/app/types/Data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
    ArrowLeft,
    Edit,
    Trash2,
    CircleQuestionMark,
    RefreshCw,
    Shield,
    AlertTriangle,
    Target,
    FileText,
    Lightbulb,
    TrendingUp,
    BookCheck,
    ExternalLink,
    Link2,
    Hash,
    Calendar,
    List,
    ToggleLeft
} from 'lucide-react';
import Link from 'next/link';
import { api } from "@/app/lib/api";
import { EntityFormDialog } from "@/app/components/data/form/EntityFormDialog";
import ModelDataTable from './ModelDataTable';
import { getRecordTitle, getRecordDisplayName } from '../../lib/record-details-utils';
import { ScrollToTop } from '../navigation/scroll-to-top';
import { ScrollToTableButton } from './ScrollToTableButton';

// Severity and confidence styling utility
const getSeverityStyle = (severity: string) => {
    const lowerSeverity = (severity || '').toLowerCase();
    switch (lowerSeverity) {
        case 'critical':
            return {
                bg: 'bg-red-100',
                text: 'text-red-800',
                border: 'border-red-300',
                icon: 'text-red-600',
                ring: 'ring-red-200'
            };
        case 'high':
            return {
                bg: 'bg-orange-100',
                text: 'text-orange-800',
                border: 'border-orange-300',
                icon: 'text-orange-600',
                ring: 'ring-orange-200'
            };
        case 'medium':
            return {
                bg: 'bg-yellow-100',
                text: 'text-yellow-800',
                border: 'border-yellow-300',
                icon: 'text-yellow-600',
                ring: 'ring-yellow-200'
            };
        case 'low':
            return {
                bg: 'bg-green-100',
                text: 'text-green-800',
                border: 'border-green-300',
                icon: 'text-green-600',
                ring: 'ring-green-200'
            };
        case 'info':
            return {
                bg: 'bg-blue-100',
                text: 'text-blue-800',
                border: 'border-blue-300',
                icon: 'text-blue-600',
                ring: 'ring-blue-200'
            };
        default:
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-800',
                border: 'border-gray-300',
                icon: 'text-gray-600',
                ring: 'ring-gray-200'
            };
    }
};

// Confidence styling utility
const getConfidenceStyle = (confidence: string) => {
    const lowerConfidence = (confidence || '').toLowerCase();
    switch (lowerConfidence) {
        case 'true_positive':
            return {
                bg: 'bg-green-100',
                text: 'text-green-800',
                border: 'border-green-300',
                icon: 'text-green-600',
                ring: 'ring-green-200'
            };
        case 'certain':
            return {
                bg: 'bg-blue-100',
                text: 'text-blue-800',
                border: 'border-blue-300',
                icon: 'text-blue-600',
                ring: 'ring-blue-200'
            };
        case 'firm':
            return {
                bg: 'bg-indigo-100',
                text: 'text-indigo-800',
                border: 'border-indigo-300',
                icon: 'text-indigo-600',
                ring: 'ring-indigo-200'
            };
        case 'tentative':
            return {
                bg: 'bg-yellow-100',
                text: 'text-yellow-800',
                border: 'border-yellow-300',
                icon: 'text-yellow-600',
                ring: 'ring-yellow-200'
            };
        case 'manual':
            return {
                bg: 'bg-purple-100',
                text: 'text-purple-800',
                border: 'border-purple-300',
                icon: 'text-purple-600',
                ring: 'ring-purple-200'
            };
        case 'false_positive':
            return {
                bg: 'bg-red-100',
                text: 'text-red-800',
                border: 'border-red-300',
                icon: 'text-red-600',
                ring: 'ring-red-200'
            };
        case 'undefined':
        default:
            return {
                bg: 'bg-gray-100',
                text: 'text-gray-800',
                border: 'border-gray-300',
                icon: 'text-gray-600',
                ring: 'ring-gray-200'
            };
    }
};

// Utility functions from DetailPageView
const parseFieldAnnotation = (field: any) => {
    const annotation = field.annotation || field.type || '';

    // Check for array/list annotations
    const isArray = annotation.includes('List[') || annotation.includes('[]') ||
        annotation.includes('Set[') || field.many_to_many || field.is_array;

    // Check for relation annotations - look for Entity() patterns or referenced_entity
    const isRelation = field.referenced_entity || field.relation ||
        annotation.includes('Entity(') ||
        /Set\[Entity\(/.test(annotation) ||
        /List\[Entity\(/.test(annotation);

    // Extract referenced entity from annotation or use referenced_entity field
    let referencedEntity = field.referenced_entity;
    if (!referencedEntity && annotation) {
        const entityMatch = annotation.match(/Entity\((\w+)\)/);
        if (entityMatch) {
            referencedEntity = entityMatch[1].toLowerCase();
        }
    }

    const baseType = field.type;

    let variant = 'text';
    if (annotation.includes('int') || annotation.includes('float') || annotation.includes('Decimal')) {
        variant = 'number';
    } else if (annotation.includes('bool')) {
        variant = 'boolean';
    } else if (annotation.includes('date') || annotation.includes('Date')) {
        variant = 'date';
    } else if (annotation.includes('dict')) {
        variant = 'dict';
    }

    return {
        isArray,
        isRelation,
        baseType,
        variant,
        referencedEntity
    };
};

const getFieldDisplayName = (field: any) => {
    return field.name === "severity" ? "Default Severity" : field.verbose_name || field.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
};

const formatFieldValue = (value: any, field: any) => {
    if (value === null || value === undefined) return 'No data available';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
};

// Function to render individual field row (from DetailPageView)
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

        // Handle enum fields with badges - with special styling
        if (field.choices && Array.isArray(field.choices) && field.choices.length > 0) {
            let badgeClass = "bg-emerald-100 text-emerald-700 border-emerald-200";

            if (fieldName === 'severity') {
                const severityStyle = getSeverityStyle(fieldValue);
                badgeClass = `${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`;
            } else if (fieldName === 'recommendation_difficulty') {
                badgeClass = fieldValue === 'easy' ?
                    "bg-green-50 text-green-700 border-green-200" :
                    fieldValue === 'difficult' ?
                        "bg-red-50 text-red-700 border-red-200" :
                        "bg-yellow-50 text-yellow-700 border-yellow-200";
            }

            return (
                <Badge variant="outline" className={badgeClass}>
                    {fieldValue}
                </Badge>
            );
        }

        // Handle array fields with badges and proper object handling
        if ((typeInfo.isArray || typeInfo.isRelation) && Array.isArray(fieldValue)) {
            const maxDisplayItems = 4;
            const itemsToShow = fieldValue.slice(0, maxDisplayItems);
            const remainingCount = fieldValue.length - maxDisplayItems;

            return (
                <div className="flex flex-wrap gap-1">
                    {itemsToShow.map((item, index) => {
                        // Handle objects with repr, name, id structure
                        const displayText = typeof item === 'object' && item !== null ?
                            (item.repr || item.name || String(item.id) || JSON.stringify(item)) :
                            String(item);

                        const truncatedText = displayText.length > 30 ?
                            `${displayText.substring(0, 30)}...` :
                            displayText;

                        const needsTooltip = displayText.length > 30;

                        // Get the ID and entity type for linking
                        const itemId = typeof item === 'object' && item !== null ?
                            (item.pretty_id || item.id) : item;

                        // Use the referenced entity from schema
                        const linkedEntityType = typeInfo.referencedEntity;

                        const badgeContent = linkedEntityType && itemId ? (
                            <div className="flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                {truncatedText}
                            </div>
                        ) : (
                            <span>{truncatedText}</span>
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
                                className="text-xs bg-gray-100 text-gray-700 border-gray-200 max-w-xs truncate"
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
                                                    (item.repr || item.name || String(item.id) || JSON.stringify(item)) :
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

        // Handle boolean fields
        if (typeof fieldValue === 'boolean') {
            return (
                <Badge
                    variant="outline"
                    className={
                        fieldValue
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-gray-50 text-gray-700 border-gray-200"
                    }
                >
                    {fieldValue ? 'Yes' : 'No'}
                </Badge>
            );
        }

        // Handle text fields (like references)
        if (typeof fieldValue === 'string' && fieldValue.length > 100) {
            return (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                    {fieldValue}
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
                                        <p className="max-w-md">{field.description}</p>
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
                    {typeInfo.isRelation && (
                        <>
                            {fieldName === "controls" ? (
                                <ScrollToTableButton
                                    entityType={typeInfo.referencedEntity || field.name.replace(/s$/, '')}
                                    fieldName={field.name}
                                />
                            ) : (
                                <Badge variant="outline">
                                    <Link href={`/data/${typeInfo.referencedEntity}/`} target="_blank" className="flex items-center gap-2 cursor-pointer">
                                        <ExternalLink className="w-4 h-4" />
                                        See All
                                    </Link>
                                </Badge>
                            )}
                        </>
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

interface ControlDefDetailsPageViewProps {
    schema: EntitySchema;
    record: EntityRecord;
    relatedData: Record<string, any[]>;
    relatedSchemas: Record<string, EntitySchema>;
    isObservation?: boolean;
}

export default function ControlDefDetailsPageView({ schema, record, relatedData, relatedSchemas, isObservation }: ControlDefDetailsPageViewProps) {
    const model = "control_definition";

    const router = useRouter();
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
            router.push(`/controls/control_definitions/`);

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

    return (
        <div className="container mx-auto p-6 space-y-6">
            <ScrollToTop />
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href={isObservation ? `/controls/observation_definitions/` : `/controls/control_definitions/`}>
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
                        <p className="text-sm text-gray-500">{isObservation ? "Observation Definition" : "Control Definition"} Details</p>
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

            {/* Main content - Specialized Control Definition Layout */}
            <div className="space-y-6">
                {/* Controls Stats & Max Severity + Max Confidence */}
                <div className="flex flex-col lg:flex-row gap-3">
                    {/* Control Status Counts */}
                    <Card className="overflow-hidden lg:flex-3 py-4">
                        <CardHeader>
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Shield className="h-4 w-4 text-blue-600" />
                                Controls Summary
                                <span className="ml-auto">
                                    <ScrollToTableButton
                                        entityType="control"
                                        fieldName="controls"
                                    />
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Status Counts */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="text-center p-1 bg-green-50 rounded-lg">
                                    <div className="text-xl font-bold text-green-600">{record.ok_count || "—"}</div>
                                    <div className="text-xs text-green-700">OK</div>
                                </div>

                                <div className="text-center p-2 bg-red-50 rounded-lg">
                                    <div className="text-xl font-bold text-red-600">{record.ko_count || "—"}</div>
                                    <div className="text-xs text-red-700">KO</div>
                                </div>

                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                    <div className="text-xl font-bold text-gray-600">{record.na_count || "—"}</div>
                                    <div className="text-xs text-gray-700">N/A</div>
                                </div>

                                <div className="text-center p-2 bg-blue-50 rounded-lg">
                                    <div className="text-xl font-bold text-blue-600">{record.total_count || "—"}</div>
                                    <div className="text-xs text-blue-700">Total</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-1 lg:flex-2 gap-3">
                        {/* Max Severity */}
                        <Card className="overflow-hidden flex-1 lg:flex-1 py-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    Max Severity
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center pt-0 pb-3">
                                {record.max_severity ? (() => {
                                    const severityStyle = getSeverityStyle(record.max_severity);
                                    return (
                                        <Badge
                                            className={`${severityStyle.bg} ${severityStyle.text} ${severityStyle.border} border px-4 py-2 text-sm font-semibold`}
                                        >
                                            <AlertTriangle className={`h-4 w-4 mr-2 ${severityStyle.icon}`} />
                                            {record.max_severity.toUpperCase()}
                                        </Badge>
                                    )
                                })() : (
                                    <p className="text-gray-400 text-sm">Not Provided</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Max Confidence */}
                        <Card className="overflow-hidden flex-1 lg:flex-1 py-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <BookCheck className="h-4 w-4 text-yellow-600" />
                                    Max Confidence
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center pt-0 pb-3">
                                {record.max_confidence ? (() => {
                                    const confidenceStyle = getConfidenceStyle(record.max_confidence);
                                    return (
                                        <Badge
                                            className={`${confidenceStyle.bg} ${confidenceStyle.text} ${confidenceStyle.border} border px-4 py-2 text-sm font-semibold`}
                                        >
                                            <BookCheck className={`h-4 w-4 mr-2 ${confidenceStyle.icon}`} />
                                            {record.max_confidence.toUpperCase()}
                                        </Badge>
                                    );
                                }
                                )() : (
                                    <p className="text-gray-400 text-sm">Not Provided</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Control information and Impact + Probability */}
                <div className="flex gap-3 items-stretch">
                    <div className="w-3/4 flex items-stretch">
                        {/* Control Details */}
                        <Card className="overflow-hidden w-full py-4">
                            <CardContent className="space-y-6 w-full p-4">
                                <div className="space-y-3">
                                    <div className="text-base font-semibold flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        Control Objective
                                    </div>
                                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm">
                                        {record.control ? (
                                            <>
                                                {record.control}
                                            </>
                                        ) : (
                                            <span className="text-gray-400">
                                                Not Provided
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-base font-semibold flex items-center gap-2">
                                        <Lightbulb className="h-4 w-4 text-green-600" />
                                        Implementation Guidance
                                    </div>
                                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-sm">
                                        {record.control_details ? (
                                            <>
                                                {record.control_details}
                                            </>
                                        ) : (
                                            <span className="text-gray-400">
                                                Not Provided
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="w-1/4 grid grid-rows-1 lg:grid-rows-2 gap-3">
                        {/* Impact */}
                        <Card className="overflow-hidden py-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <Target className="h-4 w-4 text-red-600" />
                                    Impact
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center pt-0 pb-3">
                                {record.impact ? (() => {
                                    const impactStyle = getSeverityStyle(record.impact);
                                    return (
                                        <Badge
                                            className={`${impactStyle.bg} ${impactStyle.text} ${impactStyle.border} border px-4 py-2 text-sm font-semibold`}
                                        >
                                            <Target className={`h-4 w-4 mr-2 ${impactStyle.icon}`} />
                                            {record.impact.toUpperCase()}
                                        </Badge>
                                    );
                                })() : (
                                    <p className="text-gray-400 text-sm">Not Provided</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Probability */}
                        <Card className="overflow-hidden py-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-purple-600" />
                                    Probability
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center pt-0 pb-3">
                                {record.probability ? (() => {
                                    const probabilityStyle = getSeverityStyle(record.probability);
                                    return (
                                        <Badge
                                            className={`${probabilityStyle.bg} ${probabilityStyle.text} ${probabilityStyle.border} border px-4 py-2 text-sm font-semibold`}
                                        >
                                            <TrendingUp className={`h-4 w-4 mr-2 ${probabilityStyle.icon}`} />
                                            {record.probability.toUpperCase()}
                                        </Badge>
                                    );
                                })() : (
                                    <p className="text-gray-400 text-sm">Not Provided</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Additional Information - Collapsible */}
                <Card>
                    <Accordion type="single" collapsible>
                        <AccordionItem value="additional-info">
                            <AccordionTrigger className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <CircleQuestionMark className="h-5 w-5 text-gray-600" />
                                    <span className="text-lg font-semibold">Additional Information</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-0">
                                <Card className="border-0 shadow-none">
                                    <CardContent className="p-0">
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                                            {Object.values(schema.fields)
                                                .filter(field =>
                                                    field.name !== 'id' &&
                                                    field.name !== 'name' &&
                                                    field.name !== 'control' &&
                                                    field.name !== 'control_details' &&
                                                    field.name !== 'impact' &&
                                                    field.name !== 'probability' &&
                                                    field.name !== 'max_severity' &&
                                                    field.name !== 'max_confidence' &&
                                                    field.name !== 'ok_count' &&
                                                    field.name !== 'ko_count' &&
                                                    field.name !== 'na_count' &&
                                                    field.name !== 'total_count'
                                                )
                                                .map((field) => {
                                                    return renderFieldRow(field, record);
                                                })}
                                        </div>

                                        {/* Fallback message if no fields to show */}
                                        {Object.values(schema.fields)
                                            .filter(field =>
                                                field.name !== 'id' &&
                                                field.name !== 'name' &&
                                                field.name !== 'control' &&
                                                field.name !== 'control_details' &&
                                                field.name !== 'impact' &&
                                                field.name !== 'probability' &&
                                                field.name !== 'max_severity' &&
                                                field.name !== 'max_confidence' &&
                                                field.name !== 'ok_count' &&
                                                field.name !== 'ko_count' &&
                                                field.name !== 'na_count' &&
                                                field.name !== 'total_count'
                                            ).length === 0 && (
                                                <div className="px-6 py-12 text-center text-gray-500 col-span-2">
                                                    No additional field information available for this record.
                                                </div>
                                            )}
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </Card>
            </div>

            {/* Control Table */}
            {(() => {
                const entityType = "control";
                const records = relatedData[entityType] || [];
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
                                    {isObservation ? 'Observation' : 'Control'} Records
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
                                    initialSchema={relatedSchemas[entityType]}
                                    showSeeAllButton={true}
                                    showRefreshButton={false}
                                    flattenDictColumn
                                />
                            </div>
                        </div>
                    </React.Fragment>
                );
            })()}

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
