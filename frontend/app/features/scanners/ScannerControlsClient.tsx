'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import {
    Play,
    Pause,
    CheckCircle,
    XCircle,
    AlertCircle,
    Radar,
    RefreshCw,
    Hourglass,
    Terminal,
    ChevronsUpDown,
    Check
} from 'lucide-react'
import { api } from '@/app/lib/api'
import { useScanStatus } from '@/app/hooks/useScanStatus'
import { cn } from '@/lib/utils'
import { ProgressBar } from '@/app/components/ProgressBar'
import { Scanner } from './ScannersList'

interface ToastMessage {
    id: string
    type: 'success' | 'error' | 'info'
    message: string
}

interface ScannerControlsClientProps {
    scanners: Scanner[]
    externalHandleStartScan?: (scannerName: string) => Promise<void>
    externalStartingScan?: string | null
    scanAllProgress?: {
        current: number
        total: number
        scannedScanners: string[]
        currentScanner: string | null
    }
}

export default function ScannerControlsClient({
    scanners,
    externalHandleStartScan,
    externalStartingScan,
    scanAllProgress
}: ScannerControlsClientProps) {
    const [startingScan, setStartingScan] = useState<string | null>(null)
    const [alerts, setAlerts] = useState<ToastMessage[]>([])
    const [selectedScanner, setSelectedScanner] = useState<string>("")
    const logsEndRef = useRef<HTMLDivElement>(null)
    const logsContainerRef = useRef<HTMLDivElement>(null)

    // Use external state if provided, otherwise use internal state
    const currentStartingScan = externalStartingScan !== undefined ? externalStartingScan : startingScan

    const {
        status: scanStatus,
        connectionState,
        isConnected,
        requestStatus,
        resetConnection,
        logs,
    } = useScanStatus()

    const showAlert = (type: ToastMessage['type'], message: string) => {
        const id = Math.random().toString(36).substr(2, 9)
        const alert = { id, type, message }
        setAlerts(prev => [...prev, alert])

        // Auto remove after 5 seconds
        setTimeout(() => {
            setAlerts(prev => prev.filter(a => a.id !== id))
        }, 5000)
    }

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

    const handleStartScan = async (scannerName: string) => {
        // If external handler is provided, use it instead
        if (externalHandleStartScan) {
            return externalHandleStartScan(scannerName)
        }

        // Original internal logic
        if (scanStatus.status === 'running') {
            showAlert('error', 'A scan is already running. Please wait for it to complete.')
            return
        }

        // Enhanced WebSocket reconnection logic - try once if not connected
        if (!isConnected && connectionState !== 'connecting') {
            showAlert('info', 'Connecting to real-time updates...')
            resetConnection()

            // Wait for connection attempt - give it a bit more time  
            await new Promise(resolve => setTimeout(resolve, 3000))

            // If still not connected after retry, continue anyway but warn user
            if (!isConnected) {
                showAlert('info', 'Real-time updates may be limited. Scan will proceed.')
            }
        }

        try {
            setStartingScan(scannerName)
            const response = await api.scanners.startScan(scannerName)

            if (response.error) {
                if (response.status === 409) {
                    showAlert('error', 'A scan is already running')
                } else {
                    showAlert('error', response.error)
                }
            } else {
                showAlert('success', `Scan started with ${scannerName}`)
                // Request updated status
                setTimeout(() => requestStatus(), 1000)
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to start scan'
            showAlert('error', errorMsg)
        } finally {
            setStartingScan(null)
        }
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

    const getStatusBadge = (status: string) => {
        const variants = {
            idle: { variant: 'secondary' as const, text: 'Idle' },
            running: { variant: 'default' as const, text: 'Running' },
            completed: { variant: 'default' as const, text: 'Completed' },
            failed: { variant: 'destructive' as const, text: 'Failed' },
        }

        const config = variants[status as keyof typeof variants] || variants.idle

        return (
            <Badge
                variant={config.variant}
                className={status === 'completed' ? 'bg-green-100 text-green-800 hover:bg-green-100' : undefined}
            >
                {getStatusIcon(status)}
                <span className="ml-1">{config.text}</span>
            </Badge>
        )
    }

    const formatTime = (timestamp: string | null) => {
        if (!timestamp) return 'N/A'

        const date = new Date(timestamp)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

        const isToday = dateOnly.getTime() === today.getTime()

        // Format time
        const timeString = date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        })

        // Calculate time ago
        const diffMs = now.getTime() - date.getTime()
        const diffSeconds = Math.floor(diffMs / 1000)
        const diffMinutes = Math.floor(diffSeconds / 60)
        const diffHours = Math.floor(diffMinutes / 60)
        const diffDays = Math.floor(diffHours / 24)

        let timeAgo = ''
        if (diffDays > 0) {
            timeAgo = `${diffDays}d`
        } else if (diffHours > 0) {
            timeAgo = `${diffHours}h`
        } else if (diffMinutes > 0) {
            timeAgo = `${diffMinutes}m`
        } else {
            timeAgo = `${diffSeconds}s`
        }

        if (isToday) {
            return `${timeString} (${timeAgo} ago)`
        } else {
            const dateString = date.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
            return `${dateString} - ${timeString} (${timeAgo} ago)`
        }
    }

    const formatDuration = (startTime: string | null, endTime: string | null) => {
        if (!startTime) return 'N/A'

        const start = new Date(startTime)
        const end = endTime ? new Date(endTime) : new Date()
        const durationMs = end.getTime() - start.getTime()
        const durationSeconds = Math.floor(durationMs / 1000)

        if (durationSeconds < 60) {
            return `${durationSeconds}s`
        } else if (durationSeconds < 3600) {
            const minutes = Math.floor(durationSeconds / 60)
            const seconds = durationSeconds % 60
            return `${minutes}m ${seconds}s`
        } else {
            const hours = Math.floor(durationSeconds / 3600)
            const minutes = Math.floor((durationSeconds % 3600) / 60)
            return `${hours}h ${minutes}m`
        }
    }

    // Get display message for the scan status - uses latest log if available, otherwise formats progress info
    const getDisplayMessage = () => {
        // For completed/failed scans, always prioritize the status message over logs
        if (scanStatus.status !== 'running' && scanStatus.message) {
            return scanStatus.message
        }

        // For running scans, prioritize custom labels over logs
        if (scanStatus.status === 'running') {
            const { current_portion, total_portions, current_step, total_steps, portion_label, step_label } = scanStatus

            let progressParts = []

            // Use custom portion label as-is if available, otherwise default format with numbers
            if (portion_label) {
                // Just show the portion label as-is
                progressParts.push(portion_label)
            } else if (total_portions && total_portions > 1) {
                if (current_portion == total_portions) {
                    progressParts.push(`Finishing up`)

                } else {
                    // Fallback to numbered format only if no custom label
                    progressParts.push(`Working on ${current_portion || 1} of ${total_portions}`)
                }
            }

            // Use custom step label as-is if available, otherwise default format with numbers
            if (step_label) {
                if (!portion_label) {
                    // Just show the step label as-is
                    progressParts.push(step_label)
                }
            } else if (total_steps && total_steps > 0) {
                if (current_step === total_steps) {
                    progressParts.push(`Finishing task`)
                } else {
                    // Fallback to numbered format only if no custom label
                    progressParts.push(`Task ${current_step || 1} of ${total_steps}`)
                }
            }

            // If we have custom labels, use them instead of logs
            if (progressParts.length > 0) {
                return progressParts.join(' • ')
            }

            // Fall back to recent logs if no custom labels are available
            if (logs.length > 0) {
                const latestLog = logs[logs.length - 1]
                // Only use logs from the last 10 seconds to ensure they're current
                const logAge = Date.now() - (latestLog.timestamp * 1000)
                if (logAge < 10000) { // 10 seconds
                    return latestLog.message
                }
            }
        }

        // Default to the original message
        return scanStatus.message
    }

    return (
        <>
            {/* Toast/Alert Messages */}
            <div className="fixed top-4 right-4 z-50 space-y-2">
                {alerts.map((alert) => (
                    <Alert
                        key={alert.id}
                        className={`max-w-sm ${alert.type === 'error'
                            ? 'border-red-200 bg-red-50 text-red-800'
                            : alert.type === 'success'
                                ? 'border-green-200 bg-green-50 text-green-800'
                                : 'border-blue-200 bg-blue-50 text-blue-800'
                            }`}
                    >
                        {alert.type === 'error' ? (
                            <XCircle className="h-4 w-4" />
                        ) : alert.type === 'success' ? (
                            <CheckCircle className="h-4 w-4" />
                        ) : (
                            <AlertCircle className="h-4 w-4" />
                        )}
                        <AlertDescription>{alert.message}</AlertDescription>
                    </Alert>
                ))}
            </div>

            {/* Compact Scan Status Card */}
            <Card className="border-0 shadow-md bg-gradient-to-br from-slate-50 to-slate-100">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-blue-500 rounded-lg">
                                <Radar className="h-4 w-4 text-white" />
                            </div>
                            <div>
                                <CardTitle className="text-base font-semibold">Scan Details</CardTitle>
                                {(scanStatus.scanner_name || scanStatus.multi_scan) && (
                                    <CardDescription className="text-xs text-gray-600 mt-0.5">
                                        {scanStatus.multi_scan
                                            ? `Multi-Scan ${scanStatus.current_scanner ? `- Running ${scanStatus.current_scanner}` : ''}`
                                            : `Running ${scanStatus.scanner_name}`
                                        }
                                    </CardDescription>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {getStatusBadge(scanStatus.status)}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="space-y-3">
                        {/* Compact Status Overview */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                <div>
                                    <h3 className="text-base font-medium text-gray-600 mb-1">Status:</h3>
                                    {getStatusBadge(scanStatus.status)}
                                </div>

                                {(scanStatus.scanner_name || scanStatus.multi_scan || scanAllProgress) && (
                                    <div>
                                        <span className="text-base font-medium text-gray-600">Scanner:</span>
                                        <div className="mt-1 space-y-1">
                                            {scanStatus.multi_scan ? (
                                                <>
                                                    {/* Multi-scan display */}
                                                    {scanStatus.current_scanner && (
                                                        <div>
                                                            <Badge variant="default" className="bg-blue-600 text-white border-blue-600 text-xs px-2 py-1 mr-2">
                                                                {scanStatus.current_scanner} (Running)
                                                            </Badge>
                                                        </div>
                                                    )}

                                                    {/* Show completed scanners from backend */}
                                                    {scanStatus.scanned_scanners && scanStatus.scanned_scanners.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {scanStatus.scanned_scanners.map((scanner) => (
                                                                <Badge
                                                                    key={scanner}
                                                                    variant="outline"
                                                                    className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-1"
                                                                >
                                                                    {scanner} ✓
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Show total scanners info */}
                                                    {(scanStatus.total_portions || scanStatus.scanner_names) && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {(scanStatus.scanned_scanners?.length || 0)} of {scanStatus.total_portions || scanStatus.scanner_names?.length || 0} scanners completed
                                                        </div>
                                                    )}
                                                </>
                                            ) : scanAllProgress ? (
                                                <>
                                                    {/* Frontend scan all progress (fallback) */}
                                                    {scanAllProgress.currentScanner && (
                                                        <div>
                                                            <Badge variant="default" className="bg-blue-600 text-white border-blue-600 text-xs px-2 py-1 mr-2">
                                                                {scanAllProgress.currentScanner} (Running)
                                                            </Badge>
                                                        </div>
                                                    )}

                                                    {/* Show completed scanners */}
                                                    {scanAllProgress.scannedScanners.length > 0 && (
                                                        <div className="flex flex-wrap gap-1">
                                                            {scanAllProgress.scannedScanners.map((scanner) => (
                                                                <Badge
                                                                    key={scanner}
                                                                    variant="outline"
                                                                    className="bg-green-50 text-green-700 border-green-200 text-xs px-2 py-1"
                                                                >
                                                                    {scanner} ✓
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Show progress summary */}
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {scanAllProgress.current} of {scanAllProgress.total} scanners completed
                                                    </div>
                                                </>
                                            ) : (
                                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2 py-1">
                                                    {scanStatus.scanner_name}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Progress Section */}
                            <div className="space-y-3">
                                {scanStatus.multi_scan && scanStatus.status === 'running' ? (
                                    <>
                                        {/* Backend Multi-scan Progress */}
                                        <div>
                                            <p className="text-base font-medium text-gray-600">Multi-Scan Progress:</p>
                                            <ProgressBar
                                                mode="single"
                                                progress={scanStatus.progress || 0}
                                                showMarquee={false}
                                            />
                                            <p className="text-sm text-gray-500 mt-1">
                                                {scanStatus.current_portion || 0} of {scanStatus.total_portions || 0} scanners completed
                                            </p>
                                        </div>

                                        {/* Individual Scanner Progress (if one is running) */}
                                        {scanStatus.current_scanner && (
                                            <div>
                                                <p className="text-base font-medium text-gray-600">Current Scanner Progress:</p>
                                                <ProgressBar
                                                    mode={scanStatus.display_mode === 'dual' ? 'dual' : 'single'}
                                                    progress={scanStatus.progress_bar || 0}
                                                    secondaryProgress={scanStatus.progress_bar || 0}
                                                    showMarquee={!scanStatus.progress_bar || scanStatus.progress_bar <= 0}
                                                    showSecondaryMarquee={!scanStatus.total_steps || scanStatus.total_steps <= 0}
                                                    secondaryLabel={scanStatus.step_label || 'Current Task'}
                                                    secondaryStatus={
                                                        scanStatus.total_steps && scanStatus.total_steps > 0
                                                            ? `${scanStatus.progress_bar || 0}%`
                                                            : 'Processing...'
                                                    }
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : scanAllProgress && scanAllProgress.total > 0 ? (
                                    <>
                                        {/* Frontend Scan All Progress (fallback) */}
                                        <div>
                                            <p className="text-base font-medium text-gray-600">Scan All Progress:</p>
                                            <ProgressBar
                                                mode="single"
                                                progress={scanAllProgress.total > 0 ? (scanAllProgress.current / scanAllProgress.total) * 100 : 0}
                                                showMarquee={false}
                                            />
                                            <p className="text-sm text-gray-500 mt-1">
                                                {scanAllProgress.current} of {scanAllProgress.total} scanners completed
                                            </p>
                                        </div>

                                        {/* Individual Scanner Progress (if one is running) */}
                                        {scanAllProgress.currentScanner && scanStatus.status === 'running' && (
                                            <div>
                                                <p className="text-base font-medium text-gray-600">Current Scanner Progress:</p>
                                                <ProgressBar
                                                    mode={scanStatus.display_mode === 'dual' ? 'dual' : 'single'}
                                                    progress={scanStatus.progress || 0}
                                                    secondaryProgress={scanStatus.progress_bar || 0}
                                                    showMarquee={!scanStatus.progress || scanStatus.progress <= 0}
                                                    showSecondaryMarquee={!scanStatus.total_steps || scanStatus.total_steps <= 0}
                                                    secondaryLabel={scanStatus.step_label || 'Current Task'}
                                                    secondaryStatus={
                                                        scanStatus.total_steps && scanStatus.total_steps > 0
                                                            ? `${scanStatus.progress_bar || 0}%`
                                                            : 'Processing...'
                                                    }
                                                />
                                            </div>
                                        )}
                                    </>
                                ) : scanStatus.status === 'running' && (
                                    <div>
                                        <p className="text-base font-medium text-gray-600">Progress:</p>
                                        <ProgressBar
                                            mode={scanStatus.display_mode === 'dual' ? 'dual' : 'single'}
                                            progress={scanStatus.progress || 0}
                                            secondaryProgress={scanStatus.progress_bar || 0}
                                            showMarquee={!scanStatus.progress || scanStatus.progress <= 0}
                                            showSecondaryMarquee={!scanStatus.total_steps || scanStatus.total_steps <= 0}
                                            secondaryLabel={scanStatus.step_label || 'Current Task'}
                                            secondaryStatus={
                                                scanStatus.total_steps && scanStatus.total_steps > 0
                                                    ? `${scanStatus.progress_bar || 0}%`
                                                    : 'Processing...'
                                            }
                                        />
                                    </div>
                                )}

                                {/* Current Task Message */}
                                {(scanStatus.status === 'running' || scanStatus.message) && (
                                    <div className="mt-4">
                                        <div className="text-base font-medium text-gray-600 mb-2">Message:</div>
                                        <div className="text-base text-gray-800 bg-gray-50 p-3 rounded border-l-4 border-blue-400">
                                            {getDisplayMessage() || 'Processing...'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Compact Timing Information (only if completed) */}
                        {(scanStatus.start_time || scanStatus.end_time) && (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                                <div className="flex flex-col items-start justify-between text-sm">
                                    <h3 className="text-base font-semibold text-gray-900 mb-1">Timeline</h3>
                                    <div className="w-full flex justify-between items-center text-gray-600">
                                        {scanStatus.start_time && <div><span className="font-semibold">Started:</span> {formatTime(scanStatus.start_time)}</div>}
                                        {scanStatus.end_time && <div><span className="font-semibold">Ended:</span> {formatTime(scanStatus.end_time)}</div>}
                                        {scanStatus.start_time && scanStatus.end_time && (
                                            <div>
                                                <span className="font-semibold">Duration:</span> {formatDuration(scanStatus.start_time, scanStatus.end_time)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Execution Logs Accordion */}
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200 px-3">
                            <Accordion type="single" collapsible className="w-full" onValueChange={(value) => {
                                if (value === 'logs') {
                                    scrollLogsToBottom()
                                }
                            }}>
                                <AccordionItem value="logs">
                                    <AccordionTrigger className="hover:no-underline">
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
                                                {logs.slice(-50).map((log, index) => (
                                                    <div key={index} className={`mb-1 ${log.level === 'ERROR' ? 'text-red-400' :
                                                        log.level === 'WARNING' ? 'text-yellow-400' :
                                                            log.level === 'INFO' ? 'text-green-400' :
                                                                'text-gray-300'
                                                        }`}>
                                                        <span className="text-gray-500 text-xs mr-2">[{log.timestamp}]</span>
                                                        <span>{log.message}</span>
                                                    </div>
                                                ))}
                                                {/* Invisible element to scroll to */}
                                                <div ref={logsEndRef} />
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-500 py-4 text-sm">
                                                No logs available yet. Logs will appear here when scanning starts.
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>

                        {/* Error Display */}
                        {scanStatus.error && (
                            <Alert className="border-red-200 bg-red-50">
                                <AlertCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription className="text-red-800">
                                    {scanStatus.error}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Scan Control Section */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Run Security Scan</CardTitle>
                    <CardDescription className="text-sm">
                        Select a scanner and start a security assessment.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 flex">
                    <div className="flex items-center space-x-3 w-fit mx-auto">
                        <div className="relative">
                            <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className="w-[200px] justify-between"
                                    >
                                        {selectedScanner || "Choose a scanner..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[200px] p-0">
                                    {scanners.map((scanner) => (
                                        <DropdownMenuItem
                                            key={scanner.name}
                                            onSelect={() => setSelectedScanner(scanner.name)}
                                            className="cursor-pointer"
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedScanner === scanner.name ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {scanner.name}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                        <Button
                            onClick={() => handleStartScan(selectedScanner)}
                            disabled={
                                !selectedScanner ||
                                scanStatus.status === 'running' ||
                                currentStartingScan === selectedScanner ||
                                (connectionState !== 'connected' && connectionState !== 'polling')
                            }
                            className="min-w-[100px]"
                        >
                            {currentStartingScan === selectedScanner ? (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Play className="h-4 w-4 mr-1" />
                                    Run Scan
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </>
    )
}
