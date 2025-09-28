'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { X, Upload, File, FolderOpen, AlertCircle, Play, Check, ChevronsUpDown, HelpCircle } from 'lucide-react'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface FileUploadProps {
    onFilesSelected: (files: File[]) => void
    uploadedFiles: File[]
    onRemoveFile: (index: number) => void
    autoDetectedIngestors: { [fileName: string]: string[] }
    autoDetectEnabled: boolean
    onAutoDetectToggle: (enabled: boolean) => void
    onRunIngest: () => void
    selectedIngestor?: string
    onIngestorSelect?: (ingestorName: string) => void
    availableIngestors?: Array<{ name: string; description: string | null }>
    isIngestRunning?: boolean
    maxFiles?: number
    maxFileSize?: number // in MB
    compressedFileMode?: boolean
    onCompressedFileModeToggle?: (enabled: boolean) => void
}

export function FileUpload({
    onFilesSelected,
    uploadedFiles,
    onRemoveFile,
    autoDetectedIngestors,
    autoDetectEnabled,
    onAutoDetectToggle,
    onRunIngest,
    selectedIngestor,
    onIngestorSelect,
    availableIngestors = [],
    isIngestRunning = false,
    maxFiles,
    maxFileSize = 100,
    compressedFileMode = false,
    onCompressedFileModeToggle
}: FileUploadProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [ingestorComboboxOpen, setIngestorComboboxOpen] = useState(false)

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    const validateFiles = (files: FileList | File[]) => {
        const fileArray = Array.from(files)
        const errors: string[] = []

        // Compressed file extensions
        const compressedExtensions = ['.zip', '.tar', '.tar.gz', '.gz', '.bz2']
        const isCompressedFile = (fileName: string) => {
            return compressedExtensions.some(ext => fileName.toLowerCase().endsWith(ext))
        }

        if (compressedFileMode) {
            // Compressed file mode validation
            fileArray.forEach((file) => {
                // Check if it's actually a compressed file
                if (!isCompressedFile(file.name)) {
                    errors.push(`${file.name} is not a compressed file. Please upload a .zip, .tar, .tar.gz, .gz, or .bz2 file.`)
                }

                // Check size limit for compressed files (500MB)
                if (file.size > 500 * 1024 * 1024) {
                    errors.push(`${file.name} exceeds 500MB limit for compressed files`)
                }
            })
        } else {
            // Regular file mode validation
            fileArray.forEach(file => {
                // Check if it's a directory (webkitRelativePath exists for directories)
                if ((file as any).webkitRelativePath && (file as any).webkitRelativePath.includes('/')) {
                    errors.push(`Folders are not supported. Please upload individual files only.`)
                    return
                }

                // Additional check for file type and size
                if (file.type === '' && file.size % 4096 === 0 && file.size > 0) {
                    errors.push(`${file.name} appears to be a folder. Please upload individual files only.`)
                    return
                }

                // Note: In regular mode, compressed files are allowed but won't be decompressed

                if (file.size > maxFileSize * 1024 * 1024) {
                    errors.push(`${file.name} exceeds ${maxFileSize}MB limit`)
                }
            })
        }

        return errors
    }

    const handleFileSelect = useCallback((files: FileList | File[]) => {
        setUploadError(null)
        const errors = validateFiles(files)

        if (errors.length > 0) {
            setUploadError(errors.join(', '))
            return
        }

        const fileArray = Array.from(files)
        onFilesSelected(fileArray)
    }, [uploadedFiles.length, maxFileSize, compressedFileMode, onFilesSelected])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
            handleFileSelect(files)
        }
    }, [handleFileSelect])

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files)
        }
        // Reset input value to allow selecting the same file again
        e.target.value = ''
    }

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">File Upload</CardTitle>
                <CardDescription className="text-sm">
                    Upload security data files for processing. Toggle "Upload Compressed File" to decompress archives, or leave it off to let ingestors handle compressed files directly.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Controls Section */}
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex gap-4">
                        {/* Compressed File Mode Toggle */}
                        <div className="flex items-center space-x-3">
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="compressed-mode"
                                    checked={compressedFileMode}
                                    onCheckedChange={onCompressedFileModeToggle}
                                />
                                <Label htmlFor="compressed-mode" className="text-sm font-medium">
                                    Upload Compressed File
                                </Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <HelpCircle className="h-4 w-4 text-gray-500" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            <p>When enabled, only compressed files are allowed and will be decompressed. When disabled, all files are accepted as-is.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        </div>

                        {/* Auto-detect toggle - available in all modes */}
                        <>
                            <div className="w-[2px] h-10 bg-gray-200"></div>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id="autodetect-mode"
                                        checked={autoDetectEnabled}
                                        onCheckedChange={onAutoDetectToggle}
                                    />
                                    <Label htmlFor="autodetect-mode" className="text-sm font-medium">
                                        Auto-detect ingestors
                                    </Label>
                                </div>
                            </div>
                        </>

                        {/* Manual Ingestor Selection - show when auto-detect is off */}
                        {!autoDetectEnabled && (
                            <>
                                <div className="w-[2px] h-10 bg-gray-200"></div>
                                <div className="flex items-center space-x-2">
                                    <Label className="text-sm font-medium whitespace-nowrap">
                                        Select Ingestor:
                                    </Label>
                                    <Popover open={ingestorComboboxOpen} onOpenChange={setIngestorComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={ingestorComboboxOpen}
                                                className="w-[300px] justify-between"
                                            >
                                                {selectedIngestor
                                                    ? availableIngestors.find((ingestor) => ingestor.name === selectedIngestor)?.name
                                                    : "Choose an ingestor..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search ingestors..." />
                                                <CommandEmpty>No ingestor found.</CommandEmpty>
                                                <CommandGroup>
                                                    {availableIngestors.map((ingestor) => (
                                                        <CommandItem
                                                            key={ingestor.name}
                                                            value={ingestor.name}
                                                            onSelect={(currentValue) => {
                                                                onIngestorSelect?.(currentValue === selectedIngestor ? "" : currentValue)
                                                                setIngestorComboboxOpen(false)
                                                            }}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    selectedIngestor === ingestor.name ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            <span className="font-medium">{ingestor.name}</span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </>
                        )}
                    </div>

                    <Button
                        onClick={onRunIngest}
                        disabled={uploadedFiles.length === 0 || isIngestRunning || (!autoDetectEnabled && !selectedIngestor)}
                        size="sm"
                        className="min-w-[100px]"
                    >
                        <Play className="h-4 w-4 mr-2" />
                        {isIngestRunning ? 'Running...' : 'Run Ingest'}
                    </Button>
                </div>
                {/* Upload Error */}
                {uploadError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{uploadError}</AlertDescription>
                    </Alert>
                )}

                {/* Drop Zone */}
                <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                        }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="flex flex-col items-center space-y-4">
                        <div className="p-3 bg-gray-100 rounded-full">
                            <Upload className="h-8 w-8 text-gray-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">
                                {compressedFileMode
                                    ? 'Drop compressed files here or click to browse'
                                    : 'Drop files here or click to browse'
                                }
                            </h3>
                            <p className="text-xs text-gray-400 mt-1">
                                {compressedFileMode
                                    ? 'Only compressed files (.zip, .tar, .gz, etc.) will be decompressed. Max 500MB per file'
                                    : `All files accepted (including compressed). Max ${maxFileSize}MB per file`
                                }
                            </p>
                        </div>
                        <input
                            type="file"
                            multiple={true}
                            onChange={handleFileInputChange}
                            className="hidden"
                            id="file-upload"
                            accept={compressedFileMode
                                ? ".zip,.tar,.tar.gz,.gz,.bz2"
                                : undefined
                            }
                        />
                        <Button
                            variant="outline"
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <FolderOpen className="h-4 w-4 mr-2" />
                            Browse Files
                        </Button>
                    </div>
                </div>

                {/* Uploaded Files List */}
                {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-700">
                            Uploaded Files ({uploadedFiles.length})
                        </h4>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {uploadedFiles.map((file, index) => {
                                const detectedIngestors = autoDetectedIngestors[file.name] || []

                                return (
                                    <div
                                        key={`${file.name}-${index}`}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                                    >
                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                            <File className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {file.name}
                                                </p>
                                                <div className="flex items-center space-x-2 mt-1">
                                                    <span className="text-xs text-gray-500">
                                                        {formatFileSize(file.size)}
                                                    </span>
                                                    {autoDetectEnabled ? (
                                                        // Auto-detect mode: show detected ingestors
                                                        detectedIngestors.length > 0 ? (
                                                            <div className="flex items-center space-x-1">
                                                                <span className="text-xs text-gray-500">•</span>
                                                                <span className="text-xs text-green-600">
                                                                    Auto-detected:
                                                                </span>
                                                                {detectedIngestors.map((ingestor, i) => (
                                                                    <Badge
                                                                        key={ingestor}
                                                                        variant="secondary"
                                                                        className="text-xs px-1 py-0"
                                                                    >
                                                                        {ingestor}
                                                                    </Badge>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center space-x-1">
                                                                <span className="text-xs text-gray-500">•</span>
                                                                <span className={`text-xs ${compressedFileMode ? 'text-blue-600' : 'text-orange-600'}`}>
                                                                    {compressedFileMode
                                                                        ? 'Ingestor will be detected after decompression'
                                                                        : 'No compatible ingestor detected'
                                                                    }
                                                                </span>
                                                            </div>
                                                        )
                                                    ) : (
                                                        // Manual mode: show selected ingestor
                                                        selectedIngestor && (
                                                            <div className="flex items-center space-x-1">
                                                                <span className="text-xs text-gray-500">•</span>
                                                                <span className="text-xs text-blue-600">
                                                                    Will use: {selectedIngestor}
                                                                </span>
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => onRemoveFile(index)}
                                            className="flex-shrink-0 ml-2"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Upload Progress - placeholder for future implementation */}
                {/* You can add upload progress here if needed */}
            </CardContent>
        </Card>
    )
}
