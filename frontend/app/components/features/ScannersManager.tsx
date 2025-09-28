'use client'

import React, { useState, useEffect } from 'react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle } from 'lucide-react'
import { api } from '@/app/lib/api'
import { useScanStatus } from '@/app/hooks/useScanStatus'
import ScannerControlsClient from './ScannerControlsClient'
import { ScannersList, Scanner } from './ScannersList'

interface ToastMessage {
	id: string
	type: 'success' | 'error' | 'info'
	message: string
}

interface ScannersManagerProps {
	scanners: Scanner[]
}

export default function ScannersManager({ scanners }: ScannersManagerProps) {
	const [startingScan, setStartingScan] = useState<string | null>(null)
	const [alerts, setAlerts] = useState<ToastMessage[]>([])
	const [isScanningAll, setIsScanningAll] = useState(false)
	const [scanAllProgress, setScanAllProgress] = useState<{
		current: number
		total: number
		scannedScanners: string[]
		currentScanner: string | null
	}>({ current: 0, total: 0, scannedScanners: [], currentScanner: null })

	const {
		status: scanStatus,
		connectionState,
		isConnected,
		requestStatus,
		resetConnection,
	} = useScanStatus()

	// Update scanAllProgress from backend multi-scan status
	useEffect(() => {
		if (scanStatus.multi_scan) {
			setScanAllProgress({
				current: scanStatus.current_portion || 0,
				total: scanStatus.total_portions || 0,
				scannedScanners: scanStatus.scanned_scanners || [],
				currentScanner: scanStatus.current_scanner || null
			})
			// Update isScanningAll based on status
			if (scanStatus.status === 'running') {
				setIsScanningAll(true)
			} else if (scanStatus.status === 'completed' || scanStatus.status === 'failed' || scanStatus.status === 'idle') {
				setIsScanningAll(false)
			}
		} else {
			// Reset scan all progress if not a multi-scan
			if (scanAllProgress.total > 0 && (scanStatus.status === 'idle' || scanStatus.status === 'completed' || scanStatus.status === 'failed')) {
				setScanAllProgress({ current: 0, total: 0, scannedScanners: [], currentScanner: null })
				setIsScanningAll(false)
			}
		}
	}, [scanStatus])

	const showAlert = (type: ToastMessage['type'], message: string) => {
		const id = Math.random().toString(36).substr(2, 9)
		const alert = { id, type, message }
		setAlerts(prev => [...prev, alert])

		// Auto remove after 5 seconds
		setTimeout(() => {
			setAlerts(prev => prev.filter(a => a.id !== id))
		}, 5000)
	}

	const handleStartScan = async (scannerName: string) => {
		if (scanStatus.status === 'running') {
			showAlert('error', 'A scan is already running. Please wait for it to complete.')
			return
		}

		// Enhanced WebSocket reconnection logic - try once if not connected
		if (!isConnected && connectionState !== 'connecting') {
			resetConnection()

			// Wait for connection attempt - give it a bit more time
			await new Promise(resolve => setTimeout(resolve, 3000))
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

	const handleScanAll = async (scannerNames: string[]) => {
		if (scanStatus.status === 'running' || isScanningAll) {
			showAlert('error', 'A scan is already running. Please wait for it to complete.')
			return
		}

		showAlert('info', `Starting multi-scan of ${scannerNames.length} scanners...`)

		// Ensure WebSocket connection before starting
		if (!isConnected && connectionState !== 'connecting') {
			showAlert('info', 'Connecting to real-time updates...')
			resetConnection()
			await new Promise(resolve => setTimeout(resolve, 3000))
		}

		try {
			// Use the new multi-scan API endpoint
			const response = await api.scanners.startMultiScan(scannerNames)

			if (response.error) {
				if (response.status === 409) {
					showAlert('error', 'A scan is already running')
				} else {
					showAlert('error', response.error)
				}
			} else {
				showAlert('success', `Multi-scan started with ${scannerNames.length} scanners`)
				// The backend will handle sequential scanning and WebSocket updates
				// Progress will be updated via the useEffect hook listening to scanStatus
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Failed to start multi-scan'
			showAlert('error', `Multi-scan failed: ${errorMsg}`)
		}
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
							<CheckCircle className="h-4 w-4" />
						)}
						<AlertDescription>{alert.message}</AlertDescription>
					</Alert>
				))}
			</div>

			<div className="space-y-2">
				{/* Scanner Controls - let it manage its own state but share the handleStartScan */}
				<ScannerControlsClient
					scanners={scanners}
					externalHandleStartScan={handleStartScan}
					externalStartingScan={startingScan}
					scanAllProgress={isScanningAll ? scanAllProgress : undefined}
				/>

				{/* Scanners List with Run Buttons */}
				<ScannersList
					scanners={scanners}
					onStartScan={handleStartScan}
					onScanAll={handleScanAll}
					startingScan={startingScan}
					isScannigAll={isScanningAll}
					scanStatus={{
						status: scanStatus.status,
						scanner_name: scanStatus.scanner_name || undefined
					}}
				/>
			</div>
		</>
	)
}
