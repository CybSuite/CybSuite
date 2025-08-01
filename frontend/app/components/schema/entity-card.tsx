'use client';

import { useRouter } from 'next/navigation';
import { EntitySchema, FieldSchema } from '../../types/Data';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../../../components/ui/table';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '../../../components/ui/accordion';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '../../../components/ui/tooltip';
import { Key, Link2, Hash, Tag, Eye, ExternalLink } from 'lucide-react';
import { useCallback } from 'react';

interface EntityCardProps {
    entity: EntitySchema;
    isHighlighted?: boolean;
    onCategoryFilter?: (category: string) => void;
    onTagFilter?: (tag: string) => void;
    onEntityScroll?: (entityName: string) => void;
    idSuffix?: string;
}

export function EntityCard({
    entity,
    isHighlighted = false,
    onCategoryFilter,
    onTagFilter,
    onEntityScroll,
    idSuffix = ''
}: EntityCardProps) {
    const router = useRouter();

    const getFieldIcon = useCallback((field: FieldSchema) => {
        if (field.unique) return <Key className="h-3 w-3 text-yellow-500" />;
        if (field.referenced_entity) return <Link2 className="h-3 w-3 text-blue-500" />;
        if (field.indexed) return <Hash className="h-3 w-3 text-green-500" />;
        return null;
    }, []);

    const getFieldTypeBadge = useCallback((annotation: string) => {
        if (annotation.includes('str')) return <Badge variant="secondary" className="hover:bg-secondary">String</Badge>;
        if (annotation.includes('int')) return <Badge variant="secondary" className="hover:bg-secondary">Integer</Badge>;
        if (annotation.includes('bool')) return <Badge variant="secondary" className="hover:bg-secondary">Boolean</Badge>;
        if (annotation.includes('datetime')) return <Badge variant="secondary" className="hover:bg-secondary">DateTime</Badge>;
        if (annotation.includes('Entity')) return <Badge variant="outline" className="hover:bg-accent">Relation</Badge>;
        if (annotation.includes('set')) return <Badge variant="outline" className="hover:bg-accent">Set</Badge>;
        return <Badge variant="secondary" className="hover:bg-secondary">Unknown</Badge>;
    }, []);

    const navigateToEntityData = useCallback((entityName: string) => {
        router.push(`/data/${entityName}`);
    }, [router]);

    return (
        <div
            id={`entity-${entity.name}${idSuffix}`}
            className={`rounded-lg border bg-card transition-all duration-500 w-full min-w-0 ${isHighlighted
                    ? 'animate-pulse scale-105 border-blue-500 shadow-lg'
                    : ''
                }`}
        >
            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={entity.name} className="border-none">
                    <div className="px-6 py-4">
                        <div className="flex items-center space-x-3 w-full mb-4">
                            <div className="mr-auto flex items-center space-x-3">
                                <h3 className="text-lg font-semibold text-left">{entity.name}</h3>
                                <div className="flex items-center space-x-2">
                                    <Badge variant="outline" className="text-xs">
                                        {Object.keys(entity.fields).length} fields
                                    </Badge>
                                    {entity.category && (
                                        <Badge
                                            variant="default"
                                            className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCategoryFilter?.(entity.category);
                                            }}
                                        >
                                            {entity.category}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigateToEntityData(entity.name);
                                }}
                            >
                                <Eye className="h-3 w-3 mr-1" />
                                View Data
                            </Button>
                            <AccordionTrigger className="hover:no-underline p-4 cursor-pointer"></AccordionTrigger>
                        </div>
                        {entity.tags && entity.tags.length > 0 && (
                            <div className="flex items-center space-x-1 flex-wrap mb-4">
                                <Tag className="h-3 w-3 text-muted-foreground" />
                                {entity.tags.map((tag, index) => (
                                    <Badge
                                        key={index}
                                        variant="secondary"
                                        className="text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onTagFilter?.(tag);
                                        }}
                                    >
                                        {tag}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    <AccordionContent className="px-6 pb-6">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[120px] min-w-[120px]">Field Name</TableHead>
                                        <TableHead className="w-[80px] min-w-[80px]">Type</TableHead>
                                        <TableHead className="w-[140px] min-w-[140px]">Description</TableHead>
                                        <TableHead className="w-[120px] min-w-[120px] text-center">Properties</TableHead>
                                        <TableHead className="w-[100px] min-w-[100px]">Referenced Entity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.keys(entity.fields).sort().map((fieldName) => {
                                        const field = entity.fields[fieldName];
                                        return (
                                            <TableRow key={field.name}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        {getFieldIcon(field)}
                                                        <span className="truncate">{field.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {getFieldTypeBadge(field.annotation)}
                                                </TableCell>
                                                <TableCell className="w-[140px] min-w-[140px] max-w-[140px]">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="truncate cursor-help overflow-hidden text-ellipsis whitespace-nowrap">
                                                                {field.description || 'No description'}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent className="max-w-sm">
                                                            <p className="whitespace-pre-wrap break-words">
                                                                {field.description || 'No description'}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {field.unique && (
                                                            <Badge className="text-xs bg-yellow-100 text-yellow-800">
                                                                Unique
                                                            </Badge>
                                                        )}
                                                        {field.indexed && (
                                                            <Badge className="text-xs bg-green-100 text-green-800">
                                                                Indexed
                                                            </Badge>
                                                        )}
                                                        {field.nullable && (
                                                            <Badge className="text-xs bg-gray-100 text-gray-700">
                                                                Nullable
                                                            </Badge>
                                                        )}
                                                        {!field.nullable && (
                                                            <Badge className="text-xs bg-red-100 text-red-800">
                                                                Required
                                                            </Badge>
                                                        )}
                                                        {field.hidden_in_list && (
                                                            <Badge className="text-xs bg-purple-100 text-purple-800">
                                                                Hidden in List
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {field.referenced_entity && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Badge
                                                                    className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer transition-colors truncate"
                                                                    onClick={() => field.referenced_entity && onEntityScroll?.(field.referenced_entity)}
                                                                >
                                                                    <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                                                                    <span className="truncate">{field.referenced_entity}</span>
                                                                </Badge>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Click to scroll to {field.referenced_entity}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
