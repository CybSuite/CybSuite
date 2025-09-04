import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Radar } from 'lucide-react'
import { api } from '@/app/lib/api'

interface Scanner {
    name: string
    description: string
}

interface ScannersListProps {
    scanners: Scanner[]
}

// Server component for static scanners list
export function ScannersList({ scanners }: ScannersListProps) {
    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Available Scanners</CardTitle>
                <CardDescription className="text-sm">
                    Information about available security scanners.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Scanner Name</TableHead>
                            <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {scanners.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="text-center py-6">
                                    <div className="flex flex-col items-center space-y-2">
                                        <Radar className="h-6 w-6 text-gray-400" />
                                        <p className="text-sm text-gray-500">No scanners available</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            scanners.map((scanner) => (
                                <TableRow key={scanner.name}>
                                    <TableCell className="font-medium text-sm">{scanner.name}</TableCell>
                                    <TableCell className="text-gray-600 text-sm">{scanner.description}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

// Server action to fetch scanners
export async function getScannersData(): Promise<Scanner[]> {
    try {
        const response = await api.scanners.getScanners()

        if (response.error) {
            console.error('Failed to load scanners:', response.error)
            return []
        }

        return response.data || []
    } catch (error) {
        console.error('Error fetching scanners:', error)
        return []
    }
}
