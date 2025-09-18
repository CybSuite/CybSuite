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
import { Radar, Play, RefreshCw, ChevronDown, Filter, Search } from 'lucide-react'
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
    const [nameFilter, setNameFilter] = useState<string>('')
    const [selectedScanners, setSelectedScanners] = useState<Set<string>>(new Set())

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

    // Filter scanners based on selected tags (OR operation) and name filter
    const filteredScanners = useMemo(() => {
        let filtered = scanners

        // Apply name filter
        if (nameFilter.trim()) {
            filtered = filtered.filter(scanner =>
                scanner.name.toLowerCase().includes(nameFilter.toLowerCase()) ||
                (scanner.description && scanner.description.toLowerCase().includes(nameFilter.toLowerCase()))
            )
        }

        // Apply tag filter
        if (selectedTags.length > 0) {
            filtered = filtered.filter(scanner => {
                return scanner.tags?.some(tag => selectedTags.includes(tag))
            })
        }

        return filtered
    }, [scanners, selectedTags, nameFilter])

    // Functions to handle scanner selection
    const handleScannerSelect = (scannerName: string, checked: boolean) => {
        setSelectedScanners(prev => {
            const newSet = new Set(prev)
            if (checked) {
                newSet.add(scannerName)
            } else {
                newSet.delete(scannerName)
            }
            return newSet
        })
    }

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedScanners(new Set(filteredScanners.map(scanner => scanner.name)))
        } else {
            setSelectedScanners(new Set())
        }
    }

    const isAllSelected = filteredScanners.length > 0 && selectedScanners.size === filteredScanners.length
    const isIndeterminate = selectedScanners.size > 0 && selectedScanners.size < filteredScanners.length

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
                                {(selectedTags.length > 0 || nameFilter.trim()) && (
                                    <span className="ml-1 bg-blue-500 text-white text-xs rounded-full px-1.5 py-0.5">
                                        {selectedTags.length + (nameFilter.trim() ? 1 : 0)}
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
                                        Search
                                    </label>
                                    <div className="flex items-center space-x-2">
                                        <Search className="h-4 w-4 text-gray-500" />
                                        <Input
                                            placeholder="Search scanners..."
                                            value={nameFilter}
                                            onChange={(e) => setNameFilter(e.target.value)}
                                            className="flex-1"
                                        />
                                    </div>
                                </div>

                                {/* Tag Filter */}
                                {allTags.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-gray-700">
                                            Filter by tags
                                        </label>
                                        <Combobox
                                            value={selectedTags}
                                            onValueChange={setSelectedTags}
                                            className="w-full"
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
                                                    placeholder="Select tags..."
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

                                {/* Clear Filters Button */}
                                {(selectedTags.length > 0 || nameFilter.trim()) && (
                                    <div className="pt-2 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setSelectedTags([])
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
                {(selectedTags.length > 0 || nameFilter.trim()) && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-blue-800">
                                {nameFilter.trim() && (
                                    <p className="mb-1">
                                        <strong>Search:</strong> "{nameFilter}"
                                    </p>
                                )}
                                {selectedTags.length > 0 && (
                                    <p className={nameFilter.trim() ? "mb-1" : ""}>
                                        <strong>Filtered by tags:</strong>{' '}
                                        {selectedTags.map((tag, index) => (
                                            <span key={tag}>
                                                {tag}{index < selectedTags.length - 1 ? ', ' : ''}
                                            </span>
                                        ))}
                                    </p>
                                )}
                                <span className="text-blue-600">
                                    ({filteredScanners.length} of {scanners.length} scanners)
                                </span>
                            </div>
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
                                                Running All...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3 w-3 mr-1" />
                                                Run All ({filteredScanners.length})
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedTags([])
                                        setNameFilter('')
                                    }}
                                    className="text-xs p-3"
                                >
                                    Clear filters
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Selected Scanners Actions */}
                {selectedScanners.size > 0 && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-green-800">
                                <strong>{selectedScanners.size}</strong> scanner{selectedScanners.size === 1 ? '' : 's'} selected
                            </div>
                            <div className="flex items-center space-x-2">
                                {onScanAll && selectedScanners.size > 0 && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => {
                                            onScanAll(Array.from(selectedScanners))
                                            setSelectedScanners(new Set()) // Clear selection after starting scan
                                        }}
                                        disabled={scanStatus?.status === 'running' || isScannigAll}
                                        className="text-xs p-3"
                                    >
                                        {isScannigAll ? (
                                            <>
                                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                Scanning Selected...
                                            </>
                                        ) : (
                                            <>
                                                <Play className="h-3 w-3 mr-1" />
                                                Run Selected ({selectedScanners.size})
                                            </>
                                        )}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedScanners(new Set())}
                                    className="text-xs p-3"
                                >
                                    Clear selection
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Show scan all status for all scanners */}
                {!selectedTags.length && !nameFilter.trim() && onScanAll && filteredScanners.length > 1 && (
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
                                    Running All Scanners...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-2" />
                                    Run All Scanners ({filteredScanners.length})
                                </>
                            )}
                        </Button>
                    </div>
                )}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={isAllSelected}
                                    onCheckedChange={handleSelectAll}
                                    aria-label="Select all scanners"
                                    {...(isIndeterminate && { "data-state": "indeterminate" })}
                                />
                            </TableHead>
                            <TableHead>Scanner Name</TableHead>
                            <TableHead className="text-center">Tags</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredScanners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-6">
                                    <div className="flex flex-col items-center space-y-2">
                                        <Radar className="h-6 w-6 text-gray-400" />
                                        <p className="text-sm text-gray-500">
                                            {selectedTags.length > 0 || nameFilter.trim()
                                                ? "No scanners match the current filters"
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
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedScanners.has(scanner.name)}
                                                onCheckedChange={(checked) => handleScannerSelect(scanner.name, checked as boolean)}
                                                aria-label={`Select ${scanner.name}`}
                                            />
                                        </TableCell>
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
