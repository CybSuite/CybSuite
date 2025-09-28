'use client'

import React, { useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import {
    Pause,
    CheckCircle,
    XCircle,
    AlertCircle,
    Database,
    Hourglass,
    Terminal
} from 'lucide-react'
import { useIngestStatus } from '@/app/hooks/useIngestStatus'
import { ProgressBar } from '@/app/components/ProgressBar'
import { Ingestor } from './IngestorsList'

interface IngestorsControlsClientProps {
    ingestors: Ingestor[]
    externalHandleStartIngest?: (ingestorName: string, files: File[]) => Promise<void>
    externalStartingIngest?: string | null
    ingestAllProgress?: {
        current: number
        total: number
        ingestedIngestors: string[]
        currentIngestor: string | null
    }
    uploadedFiles: File[]
}

export default function IngestorsControlsClient({
    ingestors,
    externalHandleStartIngest,
    externalStartingIngest,
    ingestAllProgress,
    uploadedFiles
}: IngestorsControlsClientProps) {
    const logsEndRef = useRef<HTMLDivElement>(null)
    const logsContainerRef = useRef<HTMLDivElement>(null)

    const {
        status: ingestStatus,
        logs,
    } = useIngestStatus()

    // Auto-scroll logs to bottom when new logs are added
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
        }
    }, [logs])

    // Function to scroll logs to bottom (for when accordion opens)
    const scrollLogsToBottom = () => {
        // Use setTimeout to ensure the accordion content is rendered
        setTimeout(() => {
            if (logsContainerRef.current) {
                logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight
            }
        }, 100)
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'running':
                return <Hourglass className="h-4 w-4 animate-spin text-blue-600" />
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-600" />
            default:
                return <Pause className="h-4 w-4 text-gray-400" />
        }
    }

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'running':
                return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'completed':
                return 'bg-green-100 text-green-800 border-green-200'
            case 'failed':
                return 'bg-red-100 text-red-800 border-red-200'
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const DisplayMessage = () => {
        // Check the status first
        if (ingestStatus.status === 'completed') {
            if (ingestStatus.ingestor_name) {
                return (
                    <>
                        Successfully completed ingestion with <span className="font-bold">{ingestStatus.ingestor_name}</span>
                    </>
                )
            }
            return <>Ingestion completed successfully</>
        }

        if (ingestStatus.status === 'failed') {
            if (ingestStatus.ingestor_name) {
                return (
                    <>
                        Failed to complete ingestion with <span className="font-bold">{ingestStatus.ingestor_name}</span>
                    </>
                )
            }
            return <>Ingestion failed</>
        }

        // Multi-ingest progress message (for running status)
        if (ingestAllProgress && ingestAllProgress.total > 0) {
            if (ingestAllProgress.currentIngestor) {
                return (
                    <>
                        Processing with {ingestAllProgress.currentIngestor} ({ingestAllProgress.current}/{ingestAllProgress.total})
                    </>
                )
            }
            return (
                <>
                    Multi-ingest: {ingestAllProgress.current}/{ingestAllProgress.total} ingestors processed
                </>
            )
        }

        // Single ingest message (for running status)
        if (ingestStatus.status === 'running' && ingestStatus.ingestor_name) {
            return (
                <>
                    Processing with <span className="font-bold">{ingestStatus.ingestor_name}</span>
                </>
            )
        }

        // Default to the original message
        return (
            <>{ingestStatus.message}</>
        )
    }

    return (
        <>
            {/* Compact Ingest Status Card */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-500 rounded-lg">
                                <Database className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Ingest Details</CardTitle>
                                <CardDescription className="text-xs text-gray-600">
                                    {uploadedFiles.length > 0
                                        ? `${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'} ready for processing`
                                        : 'Upload files to begin ingestion'
                                    }
                                </CardDescription>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {getStatusIcon(ingestStatus.status)}
                            <Badge className={`text-xs px-2 py-1 ${getStatusBadgeColor(ingestStatus.status)}`}>
                                {ingestStatus.status || 'idle'}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="space-y-3">
                        {/* Current Status Message */}
                        <div className="text-sm text-gray-700">
                            <DisplayMessage />
                        </div>

                        {/* Progress Section */}
                        <div className="space-y-3">
                            {ingestStatus.multi_ingest && ingestStatus.status === 'running' ? (
                                <>
                                    {/* Backend Multi-ingest Progress */}
                                    <div>
                                        <p className="text-base font-medium text-gray-600">Multi-Ingest Progress:</p>
                                        <ProgressBar
                                            mode="single"
                                            progress={ingestStatus.progress || 0}
                                            showMarquee={false}
                                        />
                                        <p className="text-sm text-gray-500 mt-1">
                                            {ingestStatus.current_portion || 0} of {ingestStatus.total_portions || 0} ingestors completed
                                        </p>
                                    </div>

                                    {/* Individual Ingestor Progress (if one is running) */}
                                    {ingestStatus.current_ingestor && (
                                        <div>
                                            <p className="text-base font-medium text-gray-600">Current Ingestor Progress:</p>
                                            <ProgressBar
                                                mode={ingestStatus.display_mode === 'dual' ? 'dual' : 'single'}
                                                progress={ingestStatus.progress_bar || 0}
                                                secondaryProgress={ingestStatus.progress_bar || 0}
                                                showMarquee={!ingestStatus.progress_bar || ingestStatus.progress_bar <= 0}
                                                showSecondaryMarquee={!ingestStatus.total_steps || ingestStatus.total_steps <= 0}
                                                secondaryLabel={ingestStatus.step_label || 'Current Task'}
                                                secondaryStatus={
                                                    ingestStatus.total_steps && ingestStatus.total_steps > 0
                                                        ? `${ingestStatus.progress_bar || 0}%`
                                                        : 'Processing...'
                                                }
                                            />
                                        </div>
                                    )}
                                </>
                            ) : ingestAllProgress && ingestAllProgress.total > 0 ? (
                                <>
                                    {/* Frontend Ingest All Progress (fallback) */}
                                    <div>
                                        <p className="text-base font-medium text-gray-600">Ingest All Progress:</p>
                                        <ProgressBar
                                            mode="single"
                                            progress={ingestAllProgress.total > 0 ? (ingestAllProgress.current / ingestAllProgress.total) * 100 : 0}
                                            showMarquee={false}
                                        />
                                        <p className="text-sm text-gray-500 mt-1">
                                            {ingestAllProgress.current} of {ingestAllProgress.total} ingestors completed
                                        </p>
                                    </div>

                                    {/* Individual Ingestor Progress (if one is running) */}
                                    {ingestAllProgress.currentIngestor && ingestStatus.status === 'running' && (
                                        <div>
                                            <p className="text-base font-medium text-gray-600">Current Ingestor Progress:</p>
                                            <ProgressBar
                                                mode={ingestStatus.display_mode === 'dual' ? 'dual' : 'single'}
                                                progress={ingestStatus.progress || 0}
                                                secondaryProgress={ingestStatus.progress_bar || 0}
                                                showMarquee={!ingestStatus.progress || ingestStatus.progress <= 0}
                                                showSecondaryMarquee={!ingestStatus.total_steps || ingestStatus.total_steps <= 0}
                                                secondaryLabel={ingestStatus.step_label || 'Current Task'}
                                                secondaryStatus={
                                                    ingestStatus.total_steps && ingestStatus.total_steps > 0
                                                        ? `${ingestStatus.progress_bar || 0}%`
                                                        : 'Processing...'
                                                }
                                            />
                                        </div>
                                    )}
                                </>
                            ) : ingestStatus.status === 'running' && (
                                <div>
                                    <p className="text-base font-medium text-gray-600">Progress:</p>
                                    <ProgressBar
                                        mode={ingestStatus.display_mode === 'dual' ? 'dual' : 'single'}
                                        progress={ingestStatus.progress || 0}
                                        secondaryProgress={ingestStatus.progress_bar || 0}
                                        showMarquee={!ingestStatus.progress || ingestStatus.progress <= 0}
                                        showSecondaryMarquee={!ingestStatus.total_steps || ingestStatus.total_steps <= 0}
                                        secondaryLabel={ingestStatus.step_label || 'Current Task'}
                                        secondaryStatus={
                                            ingestStatus.total_steps && ingestStatus.total_steps > 0
                                                ? `${ingestStatus.progress_bar || 0}%`
                                                : 'Processing...'
                                        }
                                    />
                                </div>
                            )}

                            {/* Current Task Message */}
                            {(ingestStatus.status === 'running' || ingestStatus.message) && (
                                <div className="mt-4">
                                    <div className="text-base font-medium text-gray-600 mb-2">Message:</div>
                                    <div className="text-base text-gray-800 bg-gray-50 p-3 rounded border-l-4 border-blue-400">
                                        <DisplayMessage />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Real-time Logs */}
                        <div className="space-y-1">
                            <Accordion type="single" collapsible onValueChange={(value) => {
                                if (value === 'logs') {
                                    scrollLogsToBottom()
                                }
                            }}>
                                <AccordionItem value="logs" className="border-0">
                                    <AccordionTrigger className="hover:no-underline py-2">
                                        <div className="flex items-center space-x-2">
                                            <Terminal className="h-4 w-4 text-gray-600" />
                                            <span className="text-base font-semibold text-gray-900">Execution Logs</span>
                                            {logs.length > 0 && (
                                                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-600 px-2 py-1">
                                                    {logs.length} entries
                                                </Badge>
                                            )}
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="pb-3">
                                        {logs.length > 0 ? (
                                            <div ref={logsContainerRef} className="bg-black rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto">
                                                {logs.slice(-50).map((log) => (
                                                    <div key={log.id} className={`mb-1 ${log.level === 'ERROR' ? 'text-red-400' :
                                                        log.level === 'WARNING' ? 'text-yellow-400' :
                                                            log.level === 'INFO' ? 'text-green-400' :
                                                                'text-gray-300'
                                                        }`}>
                                                        <span className="text-gray-500 text-xs mr-2">
                                                            [{new Date(log.timestamp).toLocaleTimeString()}]
                                                        </span>
                                                        <span>{log.message}</span>
                                                    </div>
                                                ))}
                                                {/* Invisible element to scroll to */}
                                                <div ref={logsEndRef} />
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-500 py-4 text-sm">
                                                No logs available yet. Logs will appear here when ingestion starts.
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>

                        {/* Error Display */}
                        {ingestStatus.error && (
                            <Alert className="border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                    {ingestStatus.error}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    )
}
