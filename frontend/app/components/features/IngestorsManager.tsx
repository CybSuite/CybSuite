'use client'

import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/app/lib/api'
import { useIngestStatus } from '@/app/hooks/useIngestStatus'
import IngestorsControlsClient from './IngestorsControlsClient'
import { IngestorsList, Ingestor } from './IngestorsList'
import { FileUpload } from './FileUpload'

interface ToastMessage {
	id: string
	type: 'success' | 'error' | 'info'
	message: string
}

interface IngestorsManagerProps {
	ingestors: Ingestor[]
}

export default function IngestorsManager({ ingestors }: IngestorsManagerProps) {
	const [startingIngest, setStartingIngest] = useState<string | null>(null)
	const [alerts, setAlerts] = useState<ToastMessage[]>([])
	const [isIngestingAll, setIsIngestingAll] = useState(false)
	const [ingestAllProgress, setIngestAllProgress] = useState<{
		current: number
		total: number
		ingestedIngestors: string[]
		currentIngestor: string | null
	}>({ current: 0, total: 0, ingestedIngestors: [], currentIngestor: null })

	// File upload state
	const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
	const [autoDetectedIngestors, setAutoDetectedIngestors] = useState<{ [fileName: string]: string[] }>({})
	const [autoDetectEnabled, setAutoDetectEnabled] = useState<boolean>(true)
	const [selectedIngestor, setSelectedIngestor] = useState<string>('')
	const [compressedFileMode, setCompressedFileMode] = useState<boolean>(false)

	const {
		status: ingestStatus,
		connectionState,
		isConnected,
		resetConnection,
		requestStatus,
	} = useIngestStatus()

	// Update ingestAllProgress from backend multi-ingest status
	useEffect(() => {
		if (ingestStatus.multi_ingest) {
			setIngestAllProgress({
				current: ingestStatus.current_portion || 0,
				total: ingestStatus.total_portions || 0,
				ingestedIngestors: ingestStatus.ingested_ingestors || [],
				currentIngestor: ingestStatus.current_ingestor || null
			})
			// Update isIngestingAll based on status
			if (ingestStatus.status === 'running') {
				setIsIngestingAll(true)
			} else if (ingestStatus.status === 'completed' || ingestStatus.status === 'failed' || ingestStatus.status === 'idle') {
				setIsIngestingAll(false)
			}
		} else {
			// Reset ingest all progress if not a multi-ingest
			if (ingestAllProgress.total > 0 && (ingestStatus.status === 'idle' || ingestStatus.status === 'completed' || ingestStatus.status === 'failed')) {
				setIngestAllProgress({ current: 0, total: 0, ingestedIngestors: [], currentIngestor: null })
				setIsIngestingAll(false)
			}
		}
	}, [ingestStatus])

	const showAlert = (type: ToastMessage['type'], message: string) => {
		const id = Math.random().toString(36).substr(2, 9)
		const alert = { id, type, message }
		setAlerts(prev => [...prev, alert])

		// Auto remove after 5 seconds
		setTimeout(() => {
			setAlerts(prev => prev.filter(a => a.id !== id))
		}, 5000)
	}

	// Auto-detect ingestors for uploaded files
	const detectIngestorsForFiles = async (files: File[]) => {
		if (files.length === 0) return

		// Ensure WebSocket connection before auto-detect API call
		if (!isConnected && connectionState !== 'connecting') {
			resetConnection()
			await new Promise(resolve => setTimeout(resolve, 3000))
		}

		try {
			const response = await api.ingestors.autoDetect(files)
			if (response.error) {
				console.error('Auto-detection failed:', response.error)
				showAlert('error', 'Auto-detection failed: ' + response.error)
				return
			}

			const detections = response.data?.detections || {}
			setAutoDetectedIngestors(prev => ({ ...prev, ...detections }))
		} catch (error) {
			console.error('Auto-detection error:', error)
			showAlert('error', 'Auto-detection failed')
		}
	}

	// Handle file uploads
	const handleFilesSelected = (newFiles: File[]) => {
		setUploadedFiles(prev => [...prev, ...newFiles])

		// Auto-detect ingestors for the new files if auto-detect is enabled
		if (autoDetectEnabled) {
			detectIngestorsForFiles(newFiles)
		}
	}

	// Handle file removal
	const handleRemoveFile = (index: number) => {
		const fileToRemove = uploadedFiles[index]
		setUploadedFiles(prev => prev.filter((_, i) => i !== index))

		// Remove from auto-detected ingestors
		setAutoDetectedIngestors(prev => {
			const updated = { ...prev }
			delete updated[fileToRemove.name]
			return updated
		})
	}

	// Auto-detect toggle handler
	const handleAutoDetectToggle = (enabled: boolean) => {
		setAutoDetectEnabled(enabled)
		if (!enabled) {
			// Clear auto-detected ingestors when switching to manual mode
			setAutoDetectedIngestors({})
		} else if (uploadedFiles.length > 0) {
			// Re-run auto-detection when switching back to auto mode
			detectIngestorsForFiles(uploadedFiles)
		}
	}

	// Compressed file mode toggle handler
	const handleCompressedFileModeToggle = (enabled: boolean) => {
		setCompressedFileMode(enabled)
		if (enabled) {
			// When enabling compressed mode, clear files but keep auto-detect setting
			setAutoDetectedIngestors({})
			setUploadedFiles([])
			// Don't clear selected ingestor - user might want to keep their selection
		} else {
			// When disabling compressed mode, auto-detect setting remains unchanged
			if (uploadedFiles.length > 0) {
				detectIngestorsForFiles(uploadedFiles)
			}
		}
	}

	// Handle ingestor selection for manual mode
	const handleIngestorSelect = (ingestorName: string) => {
		setSelectedIngestor(ingestorName)
	}

	// Run ingest handler
	const handleRunIngest = async () => {
		if (uploadedFiles.length === 0) {
			showAlert('error', 'Please upload files before starting ingestion.')
			return
		}

		// Ensure WebSocket connection before starting ingest
		if (!isConnected && connectionState !== 'connecting') {
			showAlert('info', 'Connecting to real-time updates...')
			resetConnection()
			await new Promise(resolve => setTimeout(resolve, 3000))
		}

		try {
			if (compressedFileMode) {
				// Compressed file mode - handle auto-detect vs manual selection
				if (autoDetectEnabled) {
					// In compressed mode with auto-detect, let backend handle detection after decompression
					// Use a special value to indicate auto-detection should be used
					const response = await api.ingestors.startIngestCompressed('auto-detect', uploadedFiles)

					if (response.error) {
						showAlert('error', 'Failed to start compressed ingest: ' + response.error)
					} else {
						showAlert('success', 'Started compressed file ingest with auto-detection')
						// Clear uploaded files after successful start
						setUploadedFiles([])
						setAutoDetectedIngestors({})
						// Request updated status
						setTimeout(() => requestStatus(), 1000)
					}
				} else {
					// Manual selection mode - use manually selected ingestor
					if (!selectedIngestor) {
						showAlert('error', 'Please select an ingestor for the compressed file')
						return
					}

					// In compressed mode, we pass the compressed file to be decompressed by backend
					const response = await api.ingestors.startIngestCompressed(selectedIngestor, uploadedFiles)

					if (response.error) {
						showAlert('error', 'Failed to start compressed ingest: ' + response.error)
					} else {
						showAlert('success', `Started compressed file ingest with ${selectedIngestor}`)
						// Clear uploaded files after successful start
						setUploadedFiles([])
						setAutoDetectedIngestors({})
						// Request updated status
						setTimeout(() => requestStatus(), 1000)
					}
				}
			} else if (autoDetectEnabled) {
				// Use auto-detected ingestors, with "all" as fallback for undetected files
				const ingestorGroups: { [ingestor: string]: File[] } = {}

				uploadedFiles.forEach(file => {
					const detectedIngestors = autoDetectedIngestors[file.name] || []

					if (detectedIngestors.length > 0) {
						// Use the first detected ingestor for this file
						const ingestor = detectedIngestors[0]
						if (!ingestorGroups[ingestor]) {
							ingestorGroups[ingestor] = []
						}
						ingestorGroups[ingestor].push(file)
					} else {
						// No specific ingestor detected, use "all" as fallback
						if (!ingestorGroups['all']) {
							ingestorGroups['all'] = []
						}
						ingestorGroups['all'].push(file)
					}
				})

				// Run separate ingests for each ingestor group
				const ingestorNames = Object.keys(ingestorGroups)
				let hasErrors = false
				let errorMessages: string[] = []

				// Run ingest for each ingestor with its specific files
				for (const ingestorName of ingestorNames) {
					const files = ingestorGroups[ingestorName]
					const response = await api.ingestors.startIngest(ingestorName, files)

					if (response.error) {
						hasErrors = true
						errorMessages.push(`${ingestorName}: ${response.error}`)
					}
				}

				if (hasErrors) {
					showAlert('error', `Failed to start some ingests: ${errorMessages.join('; ')}`)
				} else {
					const hasAllIngestor = ingestorNames.includes('all')
					const message = hasAllIngestor
						? `Started ingest with ${ingestorNames.length} ingestors for ${uploadedFiles.length} files (using "all" for undetected files)`
						: `Started ingest with ${ingestorNames.length} ingestors for ${uploadedFiles.length} files`
					showAlert('success', message)
					// Clear uploaded files after successful start
					setUploadedFiles([])
					setAutoDetectedIngestors({})
					// Request updated status
					setTimeout(() => requestStatus(), 1000)
				}
			} else {
				// Use manually selected ingestor
				if (!selectedIngestor) {
					showAlert('error', 'Please select an ingestor')
					return
				}

				const response = await api.ingestors.startIngest(selectedIngestor, uploadedFiles)

				if (response.error) {
					showAlert('error', 'Failed to start ingest: ' + response.error)
				} else {
					showAlert('success', `Started ingest with ${selectedIngestor} for ${uploadedFiles.length} files`)
					// Clear uploaded files after successful start
					setUploadedFiles([])
					setAutoDetectedIngestors({})
					// Request updated status
					setTimeout(() => requestStatus(), 1000)
				}
			}
		} catch (error) {
			console.error('Ingest error:', error)
			showAlert('error', 'Failed to start ingest')
		}
	}

	const handleIngestorClick = async (ingestor: Ingestor) => {
		if (uploadedFiles.length === 0) {
			showAlert('error', 'Please upload files before starting ingestion.')
			return
		}

		if (ingestStatus.status === 'running' || startingIngest) {
			showAlert('error', 'An ingest is already running. Please wait for it to complete.')
			return
		}

		setStartingIngest(ingestor.name)
		showAlert('info', `Starting ${ingestor.name} ingestor...`)

		// Ensure WebSocket connection before starting
		if (!isConnected && connectionState !== 'connecting') {
			showAlert('info', 'Connecting to real-time updates...')
			resetConnection()
			await new Promise(resolve => setTimeout(resolve, 3000))
		}

		try {
			// Use the single ingestor endpoint for uploaded files
			const response = await api.ingestors.startIngest(ingestor.name, uploadedFiles)

			if (response.error) {
				showAlert('error', response.error)
			} else {
				showAlert('success', `${ingestor.name} started successfully!`)
				// Clear uploaded files after successful start
				setUploadedFiles([])
				setAutoDetectedIngestors({})
				// Request updated status
				setTimeout(() => requestStatus(), 1000)
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Failed to start ingestion'
			showAlert('error', errorMsg)
		} finally {
			setStartingIngest(null)
		}
	}

	// Wrapper function to match IngestorsList expectations
	const handleStartIngest = async (ingestorName: string, files: File[]) => {
		const ingestor = ingestors.find(ing => ing.name === ingestorName)
		if (ingestor) {
			await handleIngestorClick(ingestor)
		}
	}

	const handleIngestAll = async (ingestorNames: string[], files: File[]) => {
		if (ingestStatus.status === 'running' || isIngestingAll) {
			showAlert('error', 'An ingest is already running. Please wait for it to complete.')
			return
		}

		if (files.length === 0) {
			showAlert('error', 'Please upload files before starting ingestion.')
			return
		}

		showAlert('info', `Starting multi-ingest of ${ingestorNames.length} ingestors...`)

		// Ensure WebSocket connection before starting
		if (!isConnected && connectionState !== 'connecting') {
			showAlert('info', 'Connecting to real-time updates...')
			resetConnection()
			await new Promise(resolve => setTimeout(resolve, 3000))
		}

		try {
			// Start multi-ingest using the API
			const response = await api.ingestors.startMultiIngest(ingestorNames, files)

			if (response.error) {
				showAlert('error', response.error)
			} else {
				showAlert('success', `Multi-ingest started with ${ingestorNames.length} ingestors`)
				// The backend will handle sequential ingestion and WebSocket updates
				// Progress will be updated via the useEffect hook listening to ingestStatus
				// Request updated status
				setTimeout(() => requestStatus(), 1000)
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Failed to start multi-ingest'
			showAlert('error', `Multi-ingest failed: ${errorMsg}`)
		}
	}

	return (
		<>
			{/* Toast/Alert Messages */}
			<div className="fixed top-4 right-4 z-50 space-y-2">
				{alerts.map((alert) => (
					<Alert
						key={alert.id}
						variant={alert.type === 'error' ? 'destructive' : 'default'}
						className="w-96 shadow-lg"
					>
						{alert.type === 'success' && <CheckCircle className="h-4 w-4" />}
						{alert.type === 'error' && <XCircle className="h-4 w-4" />}
						<AlertDescription>{alert.message}</AlertDescription>
					</Alert>
				))}
			</div>

			<div className="space-y-6">
				{/* File Upload Section */}
				<FileUpload
					onFilesSelected={handleFilesSelected}
					uploadedFiles={uploadedFiles}
					onRemoveFile={handleRemoveFile}
					autoDetectedIngestors={autoDetectedIngestors}
					autoDetectEnabled={autoDetectEnabled}
					onAutoDetectToggle={handleAutoDetectToggle}
					onRunIngest={handleRunIngest}
					selectedIngestor={selectedIngestor}
					onIngestorSelect={handleIngestorSelect}
					availableIngestors={ingestors}
					isIngestRunning={ingestStatus.status === 'running'}
					compressedFileMode={compressedFileMode}
					onCompressedFileModeToggle={handleCompressedFileModeToggle}
				/>

				{/* Ingestors Controls */}
				<IngestorsControlsClient
					ingestors={ingestors}
					uploadedFiles={uploadedFiles}
					ingestAllProgress={isIngestingAll ? ingestAllProgress : undefined}
					externalHandleStartIngest={handleStartIngest}
					externalStartingIngest={startingIngest}
				/>

				{/* Ingestors List */}
				<IngestorsList
					ingestors={ingestors}
					onStartIngest={handleStartIngest}
					onIngestAll={handleIngestAll}
					startingIngest={startingIngest}
					isIngestingAll={isIngestingAll}
					ingestStatus={{
						status: ingestStatus.status,
						ingestor_name: ingestStatus.ingestor_name || undefined
					}}
					uploadedFiles={uploadedFiles}
					autoDetectedIngestors={autoDetectedIngestors}
				/>
			</div>
		</>
	)
}
