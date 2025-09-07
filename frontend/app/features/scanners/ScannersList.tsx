'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Radar, Play, RefreshCw, ChevronDown, Filter } from 'lucide-react'
import { Badge } from "@/components/ui/badge";
import {
    Combobox,
    ComboboxAnchor,
    ComboboxBadgeItem,
    ComboboxBadgeList,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxLabel,
    ComboboxTrigger,
} from "@/components/ui/combobox";

export interface Scanner {
    name: string
    description: string | null
    tags: string[]
}

interface ScannersListProps {
    scanners: Scanner[]
    onStartScan?: (scannerName: string) => Promise<void>
    onScanAll?: (scannerNames: string[]) => Promise<void>
    startingScan?: string | null
    isScannigAll?: boolean
    scanStatus?: {
        status: string
        scanner_name?: string
    }
}

// Server component for static scanners list
export function ScannersList({ scanners, onStartScan, onScanAll, startingScan, isScannigAll, scanStatus }: ScannersListProps) {
    const [selectedTags, setSelectedTags] = useState<string[]>([])

    // Get all unique tags from all scanners
    const allTags = useMemo(() => {
        const tagSet = new Set<string>()
        scanners.forEach(scanner => {
            scanner.tags?.forEach(tag => tagSet.add(tag))
        })
        return Array.from(tagSet).map(tag => ({
            label: tag,
            value: tag
        })).sort((a, b) => a.label.localeCompare(b.label))
    }, [scanners])

    // Filter scanners based on selected tags (OR operation)
    const filteredScanners = useMemo(() => {
        if (selectedTags.length === 0) {
            return scanners
        }

        return scanners.filter(scanner => {
            return scanner.tags?.some(tag => selectedTags.includes(tag))
        })
    }, [scanners, selectedTags])

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-semibold">Available Scanners</CardTitle>
                        <CardDescription className="text-sm">
                            Information about available security scanners.
                        </CardDescription>
                    </div>

                    {/* Tag Filter */}
                    {allTags.length > 0 && (
                        <div className="flex items-center space-x-2">
                            <Filter className="h-4 w-4 text-gray-500" />
                            <Combobox
                                value={selectedTags}
                                onValueChange={setSelectedTags}
                                className="w-[300px]"
                                multiple
                                autoHighlight
                            >
                                <ComboboxLabel className="sr-only">Filter by tags</ComboboxLabel>
                                <ComboboxAnchor className="h-full min-h-9 flex-wrap px-2 py-1">
                                    <ComboboxBadgeList>
                                        {selectedTags.map((tag) => {
                                            const option = allTags.find((t) => t.value === tag)
                                            if (!option) return null

                                            return (
                                                <ComboboxBadgeItem key={tag} value={tag} className="text-xs">
                                                    {option.label}
                                                </ComboboxBadgeItem>
                                            )
                                        })}
                                    </ComboboxBadgeList>
                                    <ComboboxInput
                                        placeholder="Filter by tags..."
                                        className="h-auto min-w-16 flex-1 text-sm"
                                    />
                                    <ComboboxTrigger className="absolute top-2.5 right-1.5">
                                        <ChevronDown className="h-3 w-3" />
                                    </ComboboxTrigger>
                                </ComboboxAnchor>
                                <ComboboxContent>
                                    <ComboboxEmpty>No tags found.</ComboboxEmpty>
                                    {allTags.map((tag) => (
                                        <ComboboxItem key={tag.value} value={tag.value}>
                                            {tag.label}
                                        </ComboboxItem>
                                    ))}
                                </ComboboxContent>
                            </Combobox>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                {/* Show filter status */}
                {selectedTags.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-blue-800">
                                <strong>Filtered by tags:</strong>{' '}
                                {selectedTags.map((tag, index) => (
                                    <span key={tag}>
                                        {tag}{index < selectedTags.length - 1 ? ', ' : ''}
                                    </span>
                                ))}{' '}
                                <span className="text-blue-600">
                                    ({filteredScanners.length} of {scanners.length} scanners)
                                </span>
                            </p>
                            <div className="flex items-center space-x-2">
                                {onScanAll && filteredScanners.length > 1 && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => onScanAll(filteredScanners.map(s => s.name))}
                                        disabled={scanStatus?.status === 'running' || isScannigAll}
                                        className="text-xs p-3"
                                    >
                                        {isScannigAll ? (
                                            <>
                                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                Scanning All...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3 w-3 mr-1" />
                                                Scan All ({filteredScanners.length})
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedTags([])}
                                    className="text-xs p-3"
                                >
                                    Clear filters
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Show scan all status for all scanners */}
                {!selectedTags.length && onScanAll && filteredScanners.length > 1 && (
                    <div className="mb-4 flex justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => onScanAll(filteredScanners.map(s => s.name))}
                            disabled={scanStatus?.status === 'running' || isScannigAll}
                            className="text-sm"
                        >
                            {isScannigAll ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Scanning All Scanners...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Scan All Scanners ({filteredScanners.length})
                                </>
                            )}
                        </Button>
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Scanner Name</TableHead>
                            <TableHead className="text-center">Tags</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredScanners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center py-6">
                                    <div className="flex flex-col items-center space-y-2">
                                        <Radar className="h-6 w-6 text-gray-400" />
                                        <p className="text-sm text-gray-500">
                                            {selectedTags.length > 0
                                                ? "No scanners match the selected tags"
                                                : "No scanners available"
                                            }
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredScanners.map((scanner) => {
                                const isCurrentScanner = scanStatus?.scanner_name === scanner.name
                                const isScanning = scanStatus?.status === 'running'
                                const isStartingThis = startingScan === scanner.name
                                const canStart = onStartScan && !isScanning && !isStartingThis && !isScannigAll

                                return (
                                    <TableRow key={scanner.name}>
                                        <TableCell className="font-medium text-sm">{scanner.name}</TableCell>
                                        <TableCell className="text-gray-600 text-sm text-center">
                                            {!scanner.tags || scanner.tags.length === 0 ? (
                                                <span>—</span>
                                            ) : (
                                                <div className="flex justify-center gap-1">
                                                    {scanner.tags.map((tag, index) => (
                                                        <Badge key={scanner.name + index} variant="outline" className="p-1">
                                                            {tag}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-gray-600 text-sm">{scanner.description}</TableCell>
                                        <TableCell className="text-center">
                                            {onStartScan ? (
                                                <Button
                                                    size="sm"
                                                    variant={isCurrentScanner && isScanning ? "secondary" : "default"}
                                                    onClick={() => onStartScan(scanner.name)}
                                                    disabled={!canStart}
                                                    className="min-w-[80px]"
                                                >
                                                    {isStartingThis ? (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                            Starting...
                                                        </>
                                                    ) : isCurrentScanner && isScanning ? (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                            Running...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="h-3 w-3 mr-1" />
                                                            Run
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
