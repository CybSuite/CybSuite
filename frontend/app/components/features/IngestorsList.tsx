'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Database, Play, RefreshCw, ChevronDown, Filter, Search, Upload } from 'lucide-react'
import { Badge } from "@/components/ui/badge";

export interface Ingestor {
    name: string
    description: string | null
    autodetect_is_file?: boolean
    autodetect_is_dir?: boolean
}

interface IngestorsListProps {
    ingestors: Ingestor[]
    onStartIngest?: (ingestorName: string, files: File[]) => Promise<void>
    onIngestAll?: (ingestorNames: string[], files: File[]) => Promise<void>
    startingIngest?: string | null
    isIngestingAll?: boolean
    ingestStatus?: {
        status: string
        ingestor_name?: string
    }
    uploadedFiles: File[]
    autoDetectedIngestors: { [fileName: string]: string[] }
}

// Client component for ingestors list
export function IngestorsList({
    ingestors,
    onStartIngest,
    onIngestAll,
    startingIngest,
    isIngestingAll,
    ingestStatus,
    uploadedFiles,
    autoDetectedIngestors
}: IngestorsListProps) {
    const [nameFilter, setNameFilter] = useState<string>('')
    const [selectedIngestors, setSelectedIngestors] = useState<Set<string>>(new Set())

    // Filter ingestors based on name filter
    const filteredIngestors = useMemo(() => {
        let filtered = ingestors

        // Apply name filter
        if (nameFilter.trim()) {
            filtered = filtered.filter(ingestor =>
                ingestor.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
                (ingestor.description && ingestor.description.toLowerCase().includes(nameFilter.toLowerCase()))
            )
        }

        return filtered
    }, [ingestors, nameFilter])

    // Functions to handle ingestor selection
    const handleIngestorSelect = (ingestorName: string, checked: boolean) => {
        setSelectedIngestors(prev => {
            const newSet = new Set(prev)
            if (checked) {
                newSet.add(ingestorName)
            } else {
                newSet.delete(ingestorName)
            }
            return newSet
        })
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIngestors(new Set(filteredIngestors.map(ingestor => ingestor.name)))
        } else {
            setSelectedIngestors(new Set())
        }
    }

    const isAllSelected = filteredIngestors.length > 0 && selectedIngestors.size === filteredIngestors.length
    const isIndeterminate = selectedIngestors.size > 0 && selectedIngestors.size < filteredIngestors.length

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Available Ingestors</CardTitle>
                        <CardDescription className="text-sm">
                            Data processing engines for various security file formats.
                        </CardDescription>
                    </div>

                    {/* Filters Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex items-center space-x-2"
                            >
                                <Filter className="h-4 w-4" />
                                <span>Filters</span>
                                <ChevronDown className="h-4 w-4" />
                                {nameFilter.trim() && (
                                    <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">
                                        1
                                    </span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-medium text-sm mb-2">Search Filters</h4>
                                </div>

                                {/* Name Filter */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Search by name or description
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <Search className="h-4 w-4 text-gray-500" />
                                        <Input
                                            placeholder="Search ingestors..."
                                            value={nameFilter}
                                            onChange={(e) => setNameFilter(e.target.value)}
                                            className="flex-1"
                                        />
                                    </div>
                                </div>

                                {/* Clear Filters Button */}
                                {nameFilter.trim() && (
                                    <div className="pt-2 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setNameFilter('')
                                            }}
                                            className="w-full"
                                        >
                                            Clear all filters
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {/* Show filter status */}
                {nameFilter.trim() && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-blue-800">
                                <p className="mb-1">
                                    <strong>Search:</strong> "{nameFilter}"
                                </p>
                            </div>
                            <span className="text-blue-600">
                                ({filteredIngestors.length} of {ingestors.length} ingestors)
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {onIngestAll && filteredIngestors.length > 1 && uploadedFiles.length > 0 && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => onIngestAll(filteredIngestors.map(s => s.name), uploadedFiles)}
                                    disabled={ingestStatus?.status === 'running' || isIngestingAll}
                                    className="text-xs p-3"
                                >
                                    {isIngestingAll ? (
                                        <>
                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                            Ingesting All...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-3 w-3 mr-1" />
                                            Ingest All ({filteredIngestors.length})
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setNameFilter('')
                                }}
                                className="text-xs p-3"
                            >
                                Clear filters
                            </Button>
                        </div>
                    </div>
                )}

                {/* Selected Ingestors Actions */}
                {selectedIngestors.size > 0 && uploadedFiles.length > 0 && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-green-800">
                                <strong>{selectedIngestors.size}</strong> ingestor{selectedIngestors.size === 1 ? '' : 's'} selected
                                {' '}• <strong>{uploadedFiles.length}</strong> file{uploadedFiles.length === 1 ? '' : 's'} uploaded
                            </div>
                            <div className="flex items-center space-x-2">
                                {onIngestAll && selectedIngestors.size > 0 && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                            onIngestAll(Array.from(selectedIngestors), uploadedFiles)
                                            setSelectedIngestors(new Set()) // Clear selection after starting ingest
                                        }}
                                        disabled={ingestStatus?.status === 'running' || isIngestingAll}
                                        className="text-xs p-3"
                                    >
                                        {isIngestingAll ? (
                                            <>
                                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                Ingesting Selected...
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="h-3 w-3 mr-1" />
                                                Ingest Selected ({selectedIngestors.size})
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedIngestors(new Set())}
                                    className="text-xs p-3"
                                >
                                    Clear selection
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Show ingest all status for all ingestors */}
                {!nameFilter.trim() && onIngestAll && filteredIngestors.length > 1 && uploadedFiles.length > 0 && (
                    <div className="mb-4 flex justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onIngestAll(filteredIngestors.map(s => s.name), uploadedFiles)}
                            disabled={ingestStatus?.status === 'running' || isIngestingAll}
                            className="text-sm"
                        >
                            {isIngestingAll ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Ingesting All Ingestors...
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Ingest All Ingestors ({filteredIngestors.length})
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Auto-detection Results */}
                {uploadedFiles.length > 0 && Object.keys(autoDetectedIngestors).length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                        <h4 className="font-medium text-sm mb-2 text-yellow-800">Auto-detected Ingestors</h4>
                        <div className="space-y-1">
                            {Object.entries(autoDetectedIngestors).map(([fileName, detectedIngestors]) => (
                                <div key={fileName} className="text-sm text-yellow-700">
                                    <strong>{fileName}:</strong>{' '}
                                    {detectedIngestors.length > 0 ? (
                                        detectedIngestors.map((ingestor, index) => (
                                            <Badge key={ingestor} variant="secondary" className="ml-1">
                                                {ingestor}
                                            </Badge>
                                        ))
                                    ) : (
                                        <span className="text-gray-500">No auto-detection matches</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Select all ingestors"
                                    {...(isIndeterminate && { "data-state": "indeterminate" })}
                                />
                            </TableHead>
                            <TableHead>Ingestor Name</TableHead>
                            <TableHead className="text-center">Type</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredIngestors.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6">
                                    <div className="flex flex-col items-center space-y-2">
                                        <Database className="h-6 w-6 text-gray-400" />
                                        <p className="text-sm text-gray-500">
                                            {nameFilter.trim()
                                                ? "No ingestors match the current filters"
                                                : "No ingestors available"
                                            }
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredIngestors.map((ingestor) => {
                                const isCurrentIngestor = ingestStatus?.ingestor_name === ingestor.name
                                const isIngesting = ingestStatus?.status === 'running'
                                const isStartingThis = startingIngest === ingestor.name
                                const canStart = onStartIngest && !isIngesting && !isStartingThis && !isIngestingAll && uploadedFiles.length > 0

                                return (
                                    <TableRow key={ingestor.name}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIngestors.has(ingestor.name)}
                                                onCheckedChange={(checked) => handleIngestorSelect(ingestor.name, checked as boolean)}
                                                aria-label={`Select ${ingestor.name}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium text-sm">{ingestor.name}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="text-xs">
                                                {ingestor.autodetect_is_file ? 'File' : ingestor.autodetect_is_dir ? 'Directory' : 'Mixed'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-600 text-sm">{ingestor.description}</TableCell>
                                        <TableCell className="text-center">
                                            {onStartIngest ? (
                                                <Button
                                                    size="sm"
                                                    variant={isCurrentIngestor && isIngesting ? "secondary" : "default"}
                                                    onClick={() => onStartIngest(ingestor.name, uploadedFiles)}
                                                    disabled={!canStart}
                                                    className="min-w-[80px]"
                                                >
                                                    {isStartingThis ? (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                            Starting...
                                                        </>
                                                    ) : isCurrentIngestor && isIngesting ? (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                            Running...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload className="h-3 w-3 mr-1" />
                                                            Ingest
                                                        </>
                                                    )}
                                                </Button>
                                            ) : (
                                                <Badge variant="secondary" className="text-xs">Ready</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
