'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Download, AlertCircle } from 'lucide-react'

interface ExportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    entity: string
    selectedRecords?: any[]
    schema?: any
    onExport?: (exportData: ExportData) => void
    // Table management context
    isServerManaged?: boolean
    availableRecords?: any[] // All records available in client-managed table
    // Filter context
    currentFilters?: any
    currentSearch?: string
    hasActiveFilters?: boolean
    totalFilteredRecords?: number // Total count ignoring pagination
}

export interface ExportData {
    format: string
    fields: string[]
    // New options for enhanced export
    exportScope: 'all' | 'filtered' | 'selected'
    includeFilters?: boolean
    serverFilters?: {
        search?: string
        filters?: any
    }
    availableRecordIds?: number[] // For client-managed tables
    recordIds?: number[]
}

interface Formatter {
    name: string
    description: string | null
}

export function ExportDialog({
    open,
    onOpenChange,
    entity,
    selectedRecords = [],
    schema,
    onExport,
    isServerManaged = false,
    availableRecords = [],
    currentFilters = {},
    currentSearch = '',
    hasActiveFilters = false,
    totalFilteredRecords,
}: ExportDialogProps) {
    const [formatters, setFormatters] = useState<Formatter[]>([])
    const [selectedFormat, setSelectedFormat] = useState<string>('')
    const [selectedFields, setSelectedFields] = useState<string[]>([])
    const [exportScope, setExportScope] = useState<'all' | 'filtered' | 'selected'>('all')
    const [loading, setLoading] = useState(false)
    const [formattersLoading, setFormattersLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Available fields from schema
    const availableFields = React.useMemo(() => {
        if (!schema?.fields) return []

        return Object.entries(schema.fields)
            .filter(([fieldName, fieldData]: [string, any]) =>
                !fieldName.startsWith('_') && // Skip internal fields
                !fieldData.hidden_in_list // Skip hidden fields
            )
            .map(([fieldName, fieldData]: [string, any]) => ({
                name: fieldName,
                label: fieldData.label || fieldName,
                type: fieldData.type
            }))
    }, [schema])

    // Load formatters on mount
    useEffect(() => {
        if (open) {
            loadFormatters()
        }
    }, [open])

    // Reset state when dialog opens
    useEffect(() => {
        if (open) {
            setSelectedFormat('')
            setSelectedFields([])
            setExportScope('all')
            setError(null)

            // Auto-select common fields if available
            if (availableFields.length > 0) {
                const commonFields = availableFields
                    .filter(field => ['id', 'name', 'title', 'description', 'created_at', 'updated_at'].includes(field.name))
                    .map(field => field.name)

                if (commonFields.length > 0) {
                    setSelectedFields(commonFields)
                } else {
                    // Select first 5 fields as default
                    setSelectedFields(availableFields.slice(0, 5).map(field => field.name))
                }
            }
        }
    }, [open, availableFields, selectedRecords])

    const loadFormatters = async () => {
        try {
            setFormattersLoading(true)
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/plugins/formatters/`)
            if (!response.ok) {
                throw new Error(`Failed to load formatters: ${response.status} ${response.statusText}`)
            }
            const formattersData = await response.json()
            setFormatters(formattersData)

            // Auto-select CSV if available
            const csvFormatter = formattersData.find((f: Formatter) => f.name === 'csv')
            if (csvFormatter) {
                setSelectedFormat('csv')
            } else if (formattersData.length > 0) {
                setSelectedFormat(formattersData[0].name)
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            setError(`Failed to load export formats: ${errorMessage}`)
        } finally {
            setFormattersLoading(false)
        }
    }

    const handleFieldToggle = (fieldName: string, checked: boolean) => {
        if (checked) {
            setSelectedFields(prev => [...prev, fieldName])
        } else {
            setSelectedFields(prev => prev.filter(f => f !== fieldName))
        }
    }

    const handleSelectAllFields = () => {
        if (selectedFields.length === availableFields.length) {
            setSelectedFields([])
        } else {
            setSelectedFields(availableFields.map(field => field.name))
        }
    }

    const handleExport = async () => {
        if (!selectedFormat) {
            setError('Please select an export format')
            return
        }

        if (selectedFields.length === 0) {
            setError('Please select at least one field to export')
            return
        }

        try {
            setLoading(true)
            setError(null)

            const shouldIncludeFilters = isServerManaged && exportScope === 'filtered' && hasActiveFilters;

            const exportData: ExportData = {
                format: selectedFormat,
                fields: selectedFields,
                exportScope,
                includeFilters: shouldIncludeFilters,
                serverFilters: shouldIncludeFilters ? {
                    filters: currentFilters,
                    search: currentSearch
                } : undefined,
                availableRecordIds: !isServerManaged ?
                    availableRecords.map(record => record.id) : undefined,
                recordIds: exportScope === 'selected' ?
                    selectedRecords.map(record => record.id) : undefined
            }

            if (onExport) {
                await onExport(exportData)
            }

            onOpenChange(false)
        } catch (err) {
            setError('Export failed. Please try again.')
            console.error('Export error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Export {entity} Data</DialogTitle>
                    <DialogDescription>
                        Configure your export settings and download the data in your preferred format.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Export Scope */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Export Scope</Label>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    id="export-all"
                                    name="exportScope"
                                    checked={exportScope === 'all'}
                                    onChange={() => setExportScope('all')}
                                    className="h-4 w-4"
                                />
                                <Label htmlFor="export-all" className="text-sm">
                                    Export all records
                                </Label>
                            </div>
                            {hasActiveFilters && (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="export-filtered"
                                        name="exportScope"
                                        checked={exportScope === 'filtered'}
                                        onChange={() => setExportScope('filtered')}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="export-filtered" className="text-sm">
                                        Export filtered records ({isServerManaged ? totalFilteredRecords || 'unknown' : availableRecords.length} records)
                                    </Label>
                                </div>
                            )}
                            {selectedRecords.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="radio"
                                        id="export-selected"
                                        name="exportScope"
                                        checked={exportScope === 'selected'}
                                        onChange={() => setExportScope('selected')}
                                        className="h-4 w-4"
                                    />
                                    <Label htmlFor="export-selected" className="text-sm">
                                        Export selected records ({selectedRecords.length} selected)
                                    </Label>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Export Format</Label>
                        {formattersLoading ? (
                            <div className="flex items-center space-x-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm text-gray-500">Loading formats...</span>
                            </div>
                        ) : (
                            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select export format" />
                                </SelectTrigger>
                                <SelectContent>
                                    {formatters.map((formatter) => (
                                        <SelectItem key={formatter.name} value={formatter.name}>
                                            <div className="text-left">
                                                <div className="font-medium">{formatter.name.toUpperCase()}</div>
                                                {formatter.description && (
                                                    <div className="text-xs text-gray-500">
                                                        {formatter.description}
                                                    </div>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Field Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Fields to Export</Label>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAllFields}
                                disabled={availableFields.length === 0}
                            >
                                {selectedFields.length === availableFields.length ? 'Deselect All' : 'Select All'}
                            </Button>
                        </div>

                        <ScrollArea className="h-48 border rounded-md p-3">
                            <div className="space-y-2">
                                {availableFields.map((field) => (
                                    <div key={field.name} className="flex items-center space-x-2">
                                        <Checkbox
                                            id={`field-${field.name}`}
                                            checked={selectedFields.includes(field.name)}
                                            onCheckedChange={(checked) =>
                                                handleFieldToggle(field.name, checked as boolean)
                                            }
                                        />
                                        <Label
                                            htmlFor={`field-${field.name}`}
                                            className="text-sm flex-1 cursor-pointer"
                                        >
                                            <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                                                {field.name}
                                            </span>
                                            {field.label !== field.name && (
                                                <span className="ml-2 text-gray-600">
                                                    {field.label}
                                                </span>
                                            )}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>

                        <div className="text-xs text-gray-500">
                            {selectedFields.length} of {availableFields.length} fields selected
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleExport}
                        disabled={loading || !selectedFormat || selectedFields.length === 0}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Exporting...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
